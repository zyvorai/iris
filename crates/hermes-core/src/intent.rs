// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use serde::{Deserialize, Serialize};

use crate::{resolve_dependency, App};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchIntent {
    pub intent: String,
    pub answer: String,
    pub apps: Vec<App>,
}

pub fn resolve_search_intent(apps: &[App], query: &str) -> SearchIntent {
    let q = query.trim();
    let lower = q.to_lowercase();

    if let Some(dep) = extract_depends(&lower) {
        let matched: Vec<App> = apps
            .iter()
            .filter(|a| {
                a.meta
                    .depends_on
                    .iter()
                    .any(|d| d.eq_ignore_ascii_case(&dep))
                    || resolve_dependency(&dep, apps).map(|t| t.id.as_str()) == Some(a.id.as_str())
            })
            .filter(|a| a.visibility.published && !a.visibility.hidden)
            .cloned()
            .collect();
        return SearchIntent {
            intent: "depends_on".into(),
            answer: format!("Apps that depend on {dep}"),
            apps: matched,
        };
    }

    if matches_unhealthy(&lower) {
        let matched: Vec<App> = apps
            .iter()
            .filter(|a| a.status == "broken" || a.status == "degraded")
            .filter(|a| a.visibility.published && !a.visibility.hidden)
            .cloned()
            .collect();
        return SearchIntent {
            intent: "unhealthy".into(),
            answer: "Published apps that need attention".into(),
            apps: matched,
        };
    }

    if let Some(owner) = extract_owner(&lower) {
        let matched: Vec<App> = apps
            .iter()
            .filter(|a| a.meta.owner.eq_ignore_ascii_case(&owner))
            .cloned()
            .collect();
        return SearchIntent {
            intent: "owner".into(),
            answer: format!("Apps owned by {owner}"),
            apps: matched,
        };
    }

    if let Some(env) = extract_environment(&lower) {
        let matched: Vec<App> = apps
            .iter()
            .filter(|a| a.meta.environment.eq_ignore_ascii_case(&env))
            .cloned()
            .collect();
        return SearchIntent {
            intent: "environment".into(),
            answer: format!("Apps in {env} environment"),
            apps: matched,
        };
    }

    if is_recommended_query(&lower) {
        let matched: Vec<App> = apps
            .iter()
            .filter(|a| a.meta.recommended && a.visibility.published && !a.visibility.hidden)
            .cloned()
            .collect();
        return SearchIntent {
            intent: "recommended".into(),
            answer: "Team pick applications".into(),
            apps: matched,
        };
    }

    if let Some(ns) = extract_namespace(&lower) {
        let matched: Vec<App> = apps
            .iter()
            .filter(|a| a.namespace.eq_ignore_ascii_case(&ns))
            .cloned()
            .collect();
        return SearchIntent {
            intent: "namespace".into(),
            answer: format!("Apps in namespace {ns}"),
            apps: matched,
        };
    }

    SearchIntent {
        intent: "unknown".into(),
        answer: "Try: unhealthy apps, depends on prometheus, owner:platform-team, production".into(),
        apps: vec![],
    }
}

fn extract_depends(lower: &str) -> Option<String> {
    for prefix in [
        "which apps depend on ",
        "which applications depend on ",
        "apps that depend on ",
        "depends on ",
        "depends:",
    ] {
        if let Some(rest) = lower.strip_prefix(prefix) {
            let dep = rest.trim().trim_end_matches('?').trim();
            if !dep.is_empty() {
                return Some(dep.to_string());
            }
        }
    }
    None
}

fn extract_owner(lower: &str) -> Option<String> {
    if let Some(rest) = lower.strip_prefix("owner:") {
        let owner = rest.trim().trim_end_matches('?');
        if !owner.is_empty() {
            return Some(owner.to_string());
        }
    }
    if let Some(rest) = lower.strip_prefix("owned by ") {
        let owner = rest.trim().trim_end_matches('?');
        if !owner.is_empty() {
            return Some(owner.to_string());
        }
    }
    None
}

fn extract_environment(lower: &str) -> Option<String> {
    if let Some(rest) = lower.strip_prefix("env:") {
        return normalize_env(rest.trim().trim_end_matches('?'));
    }
    if lower.contains("production apps") || lower == "production" || lower == "prod" {
        return Some("production".into());
    }
    if lower.contains("staging apps") || lower == "staging" || lower == "stage" {
        return Some("staging".into());
    }
    if lower.contains("development apps") || lower == "development" || lower == "dev" {
        return Some("development".into());
    }
    None
}

fn normalize_env(raw: &str) -> Option<String> {
    if raw.is_empty() {
        return None;
    }
    Some(match raw {
        "prod" => "production",
        "stage" => "staging",
        "dev" => "development",
        other => other,
    }
    .to_string())
}

fn extract_namespace(lower: &str) -> Option<String> {
    for prefix in ["namespace ", "ns:", "in namespace "] {
        if let Some(rest) = lower.strip_prefix(prefix) {
            let ns = rest.trim().trim_end_matches('?');
            if !ns.is_empty() {
                return Some(ns.to_string());
            }
        }
    }
    None
}

fn matches_unhealthy(lower: &str) -> bool {
    matches!(
        lower,
        "unhealthy"
            | "unhealthy apps"
            | "broken apps"
            | "broken services"
            | "what applications are unhealthy"
            | "which apps are unhealthy"
            | "apps need attention"
    ) || lower.contains("unhealthy")
}

fn is_recommended_query(lower: &str) -> bool {
    matches!(
        lower,
        "team picks" | "team pick" | "recommended" | "recommended apps" | "team favorites"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{AppMeta, Backend, Visibility};

    fn app(id: &str, status: &str, deps: Vec<&str>) -> App {
        App {
            id: id.into(),
            slug: id.into(),
            canonical_slug: String::new(),
            display_name: id.into(),
            description: String::new(),
            namespace: "demo".into(),
            category: "Custom".into(),
            icon: "app".into(),
            backend: Backend {
                kind: "Service".into(),
                name: "svc".into(),
                port: 80,
                scheme: "http".into(),
                path: "/".into(),
            },
            route_path: String::new(),
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
                depends_on: deps.into_iter().map(str::to_string).collect(),
                ..Default::default()
            },
        }
    }

    #[test]
    fn resolves_depends_intent() {
        let apps = vec![app("demo/grafana", "healthy", vec!["prometheus"])];
        let intent = resolve_search_intent(&apps, "which apps depend on prometheus");
        assert_eq!(intent.intent, "depends_on");
        assert_eq!(intent.apps.len(), 1);
    }
}
