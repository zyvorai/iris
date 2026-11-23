// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

//! Dependency impact analysis: propagates health along `dependsOn` edges,
//! computes blast radius and detects dependency cycles.
//!
//! The analysis is a pure function over the catalog so it can be tested with
//! fakes. All inputs are untrusted (annotations are user controlled) and are
//! bounded by the `MAX_*` caps below.

use std::collections::{HashMap, HashSet, VecDeque};

use serde::Serialize;

use crate::App;

/// Maximum number of apps analysed; extra apps are ignored and `truncated` is set.
pub const MAX_APPS: usize = 2000;
/// Maximum `dependsOn` entries read per app.
pub const MAX_DEPS_PER_APP: usize = 64;
/// Maximum total resolved edges in one analysis.
pub const MAX_EDGES: usize = 20_000;
/// Maximum length of a dependency reference (a DNS name is at most 253 bytes).
pub const MAX_REF_LEN: usize = 253;
/// Maximum ids listed in any per-app list (`blockedBy`, `downstream`, ...).
pub const MAX_LIST: usize = 50;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppImpact {
    pub id: String,
    pub label: String,
    pub namespace: String,
    pub own_status: String,
    /// Own status, or `degraded` when a transitive dependency is degraded or broken.
    pub effective_status: String,
    /// Unhealthy transitive dependencies (capped at `MAX_LIST`).
    pub blocked_by: Vec<String>,
    pub direct_dependents: usize,
    /// Transitive dependents (blast radius if this app fails).
    pub dependents: usize,
    pub in_cycle: bool,
    /// Dependency references that match no catalog app.
    pub unresolved: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImpactSummary {
    pub total: usize,
    pub healthy: usize,
    /// Apps whose own status differs from their effective status.
    pub degraded_by_dependency: usize,
    pub in_cycle: usize,
    pub unresolved_refs: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImpactReport {
    /// Sorted by blast radius (descending), then id.
    pub apps: Vec<AppImpact>,
    /// Groups of apps that depend on each other (a self edge is a group of one).
    pub cycles: Vec<Vec<String>>,
    pub summary: ImpactSummary,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppImpactDetail {
    #[serde(flatten)]
    pub impact: AppImpact,
    /// Transitive dependencies (capped).
    pub upstream: Vec<String>,
    /// Transitive dependents (capped).
    pub downstream: Vec<String>,
}

struct Dag<'a> {
    nodes: Vec<&'a App>,
    /// `up[i]`: direct dependencies of i. `down[i]`: direct dependents of i.
    up: Vec<Vec<usize>>,
    down: Vec<Vec<usize>>,
    unresolved: Vec<Vec<String>>,
    truncated: bool,
}

fn rank(status: &str) -> u8 {
    match status {
        "broken" => 2,
        "degraded" => 1,
        _ => 0,
    }
}

fn reach(start: usize, adj: &[Vec<usize>]) -> Vec<usize> {
    let mut seen = HashSet::new();
    let mut order = Vec::new();
    let mut queue = VecDeque::new();
    queue.push_back(start);
    while let Some(n) = queue.pop_front() {
        for &m in &adj[n] {
            if seen.insert(m) {
                order.push(m);
                queue.push_back(m);
            }
        }
    }
    order
}

fn build_dag(apps: &[App]) -> Dag<'_> {
    let mut nodes: Vec<&App> = apps
        .iter()
        .filter(|a| a.visibility.published && !a.visibility.hidden)
        .collect();
    let truncated = nodes.len() > MAX_APPS;
    nodes.truncate(MAX_APPS);

    // Lookup by every identifier `resolve_dependency` accepts; first app wins.
    let mut index: HashMap<&str, usize> = HashMap::new();
    for (i, a) in nodes.iter().enumerate() {
        for key in [
            a.id.as_str(),
            a.slug.as_str(),
            a.canonical_slug.as_str(),
            a.backend.name.as_str(),
        ] {
            if !key.is_empty() {
                index.entry(key).or_insert(i);
            }
        }
    }

    let n = nodes.len();
    let mut up = vec![Vec::new(); n];
    let mut down = vec![Vec::new(); n];
    let mut unresolved = vec![Vec::new(); n];
    let mut edges = 0usize;
    for (i, app) in nodes.iter().enumerate() {
        let mut seen = HashSet::new();
        for dep in app.meta.depends_on.iter().take(MAX_DEPS_PER_APP) {
            let dep = dep.trim();
            if dep.is_empty() || !seen.insert(dep) {
                continue;
            }
            if dep.len() > MAX_REF_LEN {
                let head: String = dep.chars().take(32).collect();
                unresolved[i].push(format!("{head}…"));
                continue;
            }
            match index.get(dep) {
                Some(&j) if edges < MAX_EDGES => {
                    if !up[i].contains(&j) {
                        up[i].push(j);
                        down[j].push(i);
                        edges += 1;
                    }
                }
                Some(_) => {}
                None => unresolved[i].push(dep.to_string()),
            }
        }
    }
    Dag {
        nodes,
        up,
        down,
        unresolved,
        truncated,
    }
}

fn impact_of(dag: &Dag<'_>, i: usize) -> (AppImpact, Vec<usize>, Vec<usize>) {
    let app = dag.nodes[i];
    let upstream = reach(i, &dag.up);
    let downstream = reach(i, &dag.down);
    let in_cycle = upstream.contains(&i);

    let mut blockers: Vec<usize> = upstream
        .iter()
        .copied()
        .filter(|&j| j != i && rank(&dag.nodes[j].status) > 0)
        .collect();
    blockers.sort_by(|&a, &b| {
        rank(&dag.nodes[b].status)
            .cmp(&rank(&dag.nodes[a].status))
            .then_with(|| dag.nodes[a].id.cmp(&dag.nodes[b].id))
    });
    let effective_status = if rank(&app.status) == 0 && !blockers.is_empty() {
        "degraded".to_string()
    } else {
        app.status.clone()
    };
    let impact = AppImpact {
        id: app.id.clone(),
        label: app.display_name.clone(),
        namespace: app.namespace.clone(),
        own_status: app.status.clone(),
        effective_status,
        blocked_by: blockers
            .iter()
            .take(MAX_LIST)
            .map(|&j| dag.nodes[j].id.clone())
            .collect(),
        direct_dependents: dag.down[i].len(),
        dependents: downstream.len(),
        in_cycle,
        unresolved: dag.unresolved[i].iter().take(MAX_LIST).cloned().collect(),
    };
    (impact, upstream, downstream)
}

/// Analyse the whole catalog. Only published, non-hidden apps take part.
pub fn analyze_impact(apps: &[App]) -> ImpactReport {
    let dag = build_dag(apps);
    let n = dag.nodes.len();
    let mut up_sets: Vec<HashSet<usize>> = Vec::with_capacity(n);
    let mut list = Vec::with_capacity(n);
    for i in 0..n {
        let (impact, upstream, _) = impact_of(&dag, i);
        up_sets.push(upstream.into_iter().collect());
        list.push(impact);
    }

    // Group cyclic nodes: a and b share a cycle iff each reaches the other.
    let mut cycles: Vec<Vec<String>> = Vec::new();
    let mut assigned = vec![false; n];
    for i in 0..n {
        if assigned[i] || !up_sets[i].contains(&i) {
            continue;
        }
        let mut group = vec![i];
        assigned[i] = true;
        for j in (i + 1)..n {
            if !assigned[j] && up_sets[i].contains(&j) && up_sets[j].contains(&i) {
                assigned[j] = true;
                group.push(j);
            }
        }
        let mut ids: Vec<String> = group.iter().map(|&k| dag.nodes[k].id.clone()).collect();
        ids.sort();
        cycles.push(ids);
    }
    cycles.sort();

    let summary = ImpactSummary {
        total: n,
        healthy: list
            .iter()
            .filter(|a| a.effective_status == "healthy")
            .count(),
        degraded_by_dependency: list
            .iter()
            .filter(|a| a.own_status != a.effective_status)
            .count(),
        in_cycle: list.iter().filter(|a| a.in_cycle).count(),
        unresolved_refs: dag.unresolved.iter().map(Vec::len).sum(),
    };
    list.sort_by(|a, b| {
        b.dependents
            .cmp(&a.dependents)
            .then_with(|| a.id.cmp(&b.id))
    });
    ImpactReport {
        apps: list,
        cycles,
        summary,
        truncated: dag.truncated,
    }
}

/// Detail view (upstream and downstream lists) for one app id.
pub fn analyze_app_impact(apps: &[App], id: &str) -> Option<AppImpactDetail> {
    let id = id.trim();
    if id.is_empty() || id.len() > MAX_REF_LEN {
        return None;
    }
    let dag = build_dag(apps);
    let i = dag.nodes.iter().position(|a| a.id == id)?;
    let (impact, upstream, downstream) = impact_of(&dag, i);
    let names = |v: Vec<usize>| -> Vec<String> {
        let mut ids: Vec<String> = v.into_iter().map(|j| dag.nodes[j].id.clone()).collect();
        ids.sort();
        ids.truncate(MAX_LIST);
        ids
    };
    Some(AppImpactDetail {
        impact,
        upstream: names(upstream),
        downstream: names(downstream),
    })
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::{AppMeta, Backend, Visibility};

    pub fn app(slug: &str, status: &str, deps: &[&str]) -> App {
        App {
            id: format!("demo/{slug}"),
            slug: slug.into(),
            canonical_slug: slug.into(),
            display_name: slug.into(),
            description: String::new(),
            namespace: "demo".into(),
            category: "Tools".into(),
            icon: "app".into(),
            backend: Backend {
                kind: "Service".into(),
                name: slug.into(),
                port: 80,
                scheme: "http".into(),
                path: "/".into(),
            },
            route_path: format!("/a/demo/{slug}"),
            public_url: String::new(),
            status: status.into(),
            status_message: String::new(),
            source: "annotation".into(),
            auth_mode: "none".into(),
            score: 0,
            visibility: Visibility {
                published: true,
                hidden: false,
                favorite: false,
            },
            rewrite: Default::default(),
            ready_endpoints: 1,
            updated_at: String::new(),
            meta: AppMeta {
                depends_on: deps.iter().map(|s| s.to_string()).collect(),
                ..Default::default()
            },
        }
    }

    fn find<'a>(r: &'a ImpactReport, slug: &str) -> &'a AppImpact {
        let id = format!("demo/{slug}");
        r.apps.iter().find(|a| a.id == id).unwrap()
    }

    #[test]
    fn broken_dependency_degrades_transitive_dependents() {
        let apps = vec![
            app("db", "broken", &[]),
            app("api", "healthy", &["db"]),
            app("web", "healthy", &["api"]),
            app("other", "healthy", &[]),
        ];
        let r = analyze_impact(&apps);
        assert_eq!(find(&r, "web").effective_status, "degraded");
        assert_eq!(find(&r, "web").blocked_by, vec!["demo/db"]);
        assert_eq!(find(&r, "api").effective_status, "degraded");
        assert_eq!(find(&r, "db").effective_status, "broken");
        assert_eq!(find(&r, "db").dependents, 2);
        assert_eq!(find(&r, "db").direct_dependents, 1);
        assert_eq!(find(&r, "other").effective_status, "healthy");
        assert_eq!(r.apps[0].id, "demo/db");
        assert_eq!(r.summary.degraded_by_dependency, 2);
    }

    #[test]
    fn detects_cycles_and_self_dependency() {
        let apps = vec![
            app("a", "healthy", &["b"]),
            app("b", "healthy", &["c"]),
            app("c", "healthy", &["a"]),
            app("s", "healthy", &["s"]),
            app("ok", "healthy", &["a"]),
        ];
        let r = analyze_impact(&apps);
        assert_eq!(r.cycles.len(), 2);
        assert!(r
            .cycles
            .contains(&vec!["demo/a".into(), "demo/b".into(), "demo/c".into()]));
        assert!(r.cycles.contains(&vec!["demo/s".into()]));
        assert!(!find(&r, "ok").in_cycle);
        assert_eq!(r.summary.in_cycle, 4);
    }

    #[test]
    fn unresolved_and_hidden_refs() {
        let mut hidden = app("h", "broken", &[]);
        hidden.visibility.hidden = true;
        let apps = vec![hidden, app("x", "healthy", &["h", "ghost", "ghost", " "])];
        let r = analyze_impact(&apps);
        let x = find(&r, "x");
        assert_eq!(x.unresolved, vec!["h", "ghost"]);
        assert_eq!(x.effective_status, "healthy");
        assert_eq!(r.summary.unresolved_refs, 2);
    }

    #[test]
    fn hostile_input_is_bounded() {
        let long = "z".repeat(100_000);
        let many: Vec<String> = (0..10_000).map(|i| format!("dep{i}")).collect();
        let many_refs: Vec<&str> = many.iter().map(String::as_str).collect();
        let mut apps = vec![
            app("evil", "healthy", &[long.as_str()]),
            app("many", "healthy", &many_refs),
        ];
        for i in 0..(MAX_APPS + 50) {
            apps.push(app(&format!("bulk{i}"), "healthy", &["evil"]));
        }
        let r = analyze_impact(&apps);
        assert!(r.truncated);
        assert_eq!(r.apps.len(), MAX_APPS);
        let evil = find(&r, "evil");
        assert_eq!(evil.unresolved.len(), 1);
        assert!(evil.unresolved[0].len() < 100);
        assert!(find(&r, "many").unresolved.len() <= MAX_LIST);
        assert!(r.summary.unresolved_refs <= 2 * MAX_DEPS_PER_APP + 1);
    }

    #[test]
    fn detail_lists_upstream_and_downstream() {
        let apps = vec![
            app("db", "degraded", &[]),
            app("api", "healthy", &["db"]),
            app("web", "healthy", &["api"]),
        ];
        let d = analyze_app_impact(&apps, "demo/api").unwrap();
        assert_eq!(d.upstream, vec!["demo/db"]);
        assert_eq!(d.downstream, vec!["demo/web"]);
        assert!(analyze_app_impact(&apps, "demo/nope").is_none());
        assert!(analyze_app_impact(&apps, &"x".repeat(5000)).is_none());
    }
}
