// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

//! Catalog conformance: checks published apps against a small, configurable
//! metadata policy (ownership, environment, description) plus structural
//! rules (dependency cycles, unresolved dependencies, missing endpoints).
//!
//! Modelled on Backstage's required `owner`/`lifecycle` fields and on policy
//! attachment in Kyverno/OPA, but read-only: Iris reports, it never mutates.

use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::governance::Exemption;
use crate::impact::analyze_impact;
use crate::App;

/// Metadata fields a policy may require.
pub const KNOWN_FIELDS: [&str; 6] = [
    "owner",
    "environment",
    "description",
    "runbook",
    "lifecycle",
    "tags",
];
/// Every rule id a finding can carry.
pub const KNOWN_RULES: [&str; 10] = [
    "owner-missing",
    "environment-missing",
    "description-missing",
    "runbook-missing",
    "lifecycle-missing",
    "tags-missing",
    "no-ready-endpoints",
    "dependency-cycle",
    "dependency-unresolved",
    "dependency-deprecated",
];
/// Maximum findings reported per app.
pub const MAX_FINDINGS_PER_APP: usize = 20;
/// Maximum length of the policy string read from the environment.
const MAX_POLICY_LEN: usize = 256;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConformancePolicy {
    /// Required fields, a subset of `KNOWN_FIELDS`.
    pub require: Vec<String>,
}

impl Default for ConformancePolicy {
    fn default() -> Self {
        Self {
            require: vec!["owner".into(), "environment".into()],
        }
    }
}

impl ConformancePolicy {
    /// Parse a comma separated field list. Unknown names are ignored, input
    /// is length capped, and an empty string means "require nothing".
    pub fn parse(raw: &str) -> Self {
        let raw: String = raw.chars().take(MAX_POLICY_LEN).collect();
        let mut require: Vec<String> = Vec::new();
        for part in raw.split(',') {
            let f = part.trim().to_ascii_lowercase();
            if KNOWN_FIELDS.contains(&f.as_str()) && !require.contains(&f) {
                require.push(f);
            }
        }
        Self { require }
    }

    /// `IRIS_CONFORMANCE_REQUIRE` (default `owner,environment`).
    pub fn from_env() -> Self {
        match std::env::var("IRIS_CONFORMANCE_REQUIRE") {
            Ok(v) => Self::parse(&v),
            Err(_) => Self::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    /// Stable rule id, for example `owner-missing`.
    pub rule: String,
    /// `error`, `warning` or `info`.
    pub severity: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppConformance {
    pub id: String,
    pub label: String,
    pub namespace: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub owner: String,
    /// 0 to 100, higher is better.
    pub score: u32,
    pub findings: Vec<Finding>,
    /// Findings waived by an active exemption; they do not affect the score.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub exempted: Vec<Finding>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ConformanceSummary {
    pub total: usize,
    pub conforming: usize,
    pub errors: usize,
    pub warnings: usize,
    pub infos: usize,
    /// Mean app score, 100 when the catalog is empty.
    pub score: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConformanceReport {
    pub required: Vec<String>,
    /// Worst scores first.
    pub apps: Vec<AppConformance>,
    pub summary: ConformanceSummary,
}

fn finding(rule: &str, severity: &str, message: String) -> Finding {
    Finding {
        rule: rule.into(),
        severity: severity.into(),
        message,
    }
}

fn penalty(severity: &str) -> u32 {
    match severity {
        "error" => 30,
        "warning" => 15,
        _ => 5,
    }
}

fn score_of(findings: &[Finding]) -> u32 {
    100u32.saturating_sub(findings.iter().map(|x| penalty(&x.severity)).sum())
}

/// Evaluate every published, non-hidden app against `policy`.
pub fn check_conformance(apps: &[App], policy: &ConformancePolicy) -> ConformanceReport {
    let impact = analyze_impact(apps);
    let by_id: std::collections::HashMap<&str, &crate::impact::AppImpact> =
        impact.apps.iter().map(|a| (a.id.as_str(), a)).collect();

    let published = || {
        apps.iter()
            .filter(|a| a.visibility.published && !a.visibility.hidden)
            .take(crate::impact::MAX_APPS)
    };
    // Same identifiers and "first app wins" order as the impact analysis.
    let mut lookup: std::collections::HashMap<&str, &App> = std::collections::HashMap::new();
    for a in published() {
        for key in [&a.id, &a.slug, &a.canonical_slug, &a.backend.name] {
            if !key.is_empty() {
                lookup.entry(key.as_str()).or_insert(a);
            }
        }
    }

    let mut out: Vec<AppConformance> = Vec::new();
    for app in published() {
        let mut f: Vec<Finding> = Vec::new();
        for field in &policy.require {
            let missing = match field.as_str() {
                "owner" => app.meta.owner.trim().is_empty(),
                "environment" => app.meta.environment.trim().is_empty(),
                "lifecycle" => app.meta.lifecycle.trim().is_empty(),
                "tags" => app.meta.tags.is_empty(),
                "runbook" => !app
                    .meta
                    .links
                    .iter()
                    .any(|l| l.kind == "runbook" && crate::links::is_safe_link(&l.url)),
                _ => app.description.trim().is_empty(),
            };
            if missing {
                f.push(finding(
                    &format!("{field}-missing"),
                    "warning",
                    format!("required field `{field}` is not set"),
                ));
            }
        }
        if app.ready_endpoints == 0 {
            f.push(finding(
                "no-ready-endpoints",
                "error",
                "published app has no ready endpoints".into(),
            ));
        }
        if let Some(i) = by_id.get(app.id.as_str()) {
            if i.in_cycle {
                f.push(finding(
                    "dependency-cycle",
                    "error",
                    "app is part of a dependency cycle".into(),
                ));
            }
            for dep in &i.unresolved {
                f.push(finding(
                    "dependency-unresolved",
                    "warning",
                    format!("dependsOn `{dep}` matches no published app"),
                ));
            }
        }
        if app.meta.lifecycle != "deprecated" {
            let mut seen = std::collections::HashSet::new();
            for dep in app
                .meta
                .depends_on
                .iter()
                .take(crate::impact::MAX_DEPS_PER_APP)
            {
                let Some(target) = lookup.get(dep.trim()) else {
                    continue;
                };
                if target.meta.lifecycle == "deprecated" && seen.insert(target.id.as_str()) {
                    f.push(finding(
                        "dependency-deprecated",
                        "warning",
                        format!("depends on deprecated app `{}`", target.id),
                    ));
                }
            }
        }
        f.truncate(MAX_FINDINGS_PER_APP);
        let score = score_of(&f);
        out.push(AppConformance {
            id: app.id.clone(),
            label: app.display_name.clone(),
            namespace: app.namespace.clone(),
            owner: app.meta.owner.clone(),
            score,
            findings: f,
            exempted: Vec::new(),
        });
    }

    out.sort_by(|a, b| a.score.cmp(&b.score).then_with(|| a.id.cmp(&b.id)));
    ConformanceReport {
        required: policy.require.clone(),
        summary: summarize(&out),
        apps: out,
    }
}

fn summarize(out: &[AppConformance]) -> ConformanceSummary {
    let count = |sev: &str| {
        out.iter()
            .flat_map(|a| &a.findings)
            .filter(|x| x.severity == sev)
            .count()
    };
    ConformanceSummary {
        total: out.len(),
        conforming: out.iter().filter(|a| a.findings.is_empty()).count(),
        errors: count("error"),
        warnings: count("warning"),
        infos: count("info"),
        score: if out.is_empty() {
            100
        } else {
            (out.iter().map(|a| u64::from(a.score)).sum::<u64>() / out.len() as u64) as u32
        },
    }
}

impl ConformanceReport {
    /// Move findings covered by an active exemption to `exempted`, then
    /// recompute scores, ordering and the summary.
    pub fn apply_exemptions(&mut self, exemptions: &[Exemption], now: DateTime<Utc>) {
        let active: std::collections::HashSet<(&str, &str)> = exemptions
            .iter()
            .filter(|e| e.is_active(now))
            .map(|e| (e.app_id.as_str(), e.rule.as_str()))
            .collect();
        if active.is_empty() {
            return;
        }
        for app in &mut self.apps {
            let (waived, kept): (Vec<Finding>, Vec<Finding>) = std::mem::take(&mut app.findings)
                .into_iter()
                .partition(|f| active.contains(&(app.id.as_str(), f.rule.as_str())));
            app.findings = kept;
            app.exempted.extend(waived);
            app.score = score_of(&app.findings);
        }
        self.apps
            .sort_by(|a, b| a.score.cmp(&b.score).then_with(|| a.id.cmp(&b.id)));
        self.summary = summarize(&self.apps);
    }

    /// Keep only apps matching the optional owner / namespace and recompute the summary.
    pub fn filter(&mut self, owner: Option<&str>, namespace: Option<&str>) {
        self.apps.retain(|a| {
            owner.is_none_or(|o| a.owner == o) && namespace.is_none_or(|n| a.namespace == n)
        });
        self.summary = summarize(&self.apps);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impact::tests::app;

    #[test]
    fn policy_parse_is_strict() {
        assert_eq!(
            ConformancePolicy::parse(" Owner, owner ,bogus,description").require,
            vec!["owner", "description"]
        );
        assert!(ConformancePolicy::parse("").require.is_empty());
        let huge = format!("{}owner", "x,".repeat(10_000));
        assert!(ConformancePolicy::parse(&huge).require.is_empty());
    }

    #[test]
    fn flags_missing_metadata_and_structure() {
        let mut good = app("good", "healthy", &[]);
        good.meta.owner = "team-a".into();
        good.meta.environment = "prod".into();
        let mut bad = app("bad", "healthy", &["bad", "ghost"]);
        bad.ready_endpoints = 0;
        let r = check_conformance(&[good, bad], &ConformancePolicy::default());
        assert_eq!(r.summary.total, 2);
        assert_eq!(r.summary.conforming, 1);
        let worst = &r.apps[0];
        assert_eq!(worst.id, "demo/bad");
        let rules: Vec<&str> = worst.findings.iter().map(|f| f.rule.as_str()).collect();
        for want in [
            "owner-missing",
            "environment-missing",
            "no-ready-endpoints",
            "dependency-cycle",
            "dependency-unresolved",
        ] {
            assert!(rules.contains(&want), "missing {want}: {rules:?}");
        }
        assert!(worst.score < 50);
        assert_eq!(r.apps[1].score, 100);
    }

    #[test]
    fn whitespace_counts_as_missing_and_empty_catalog_is_perfect() {
        let mut a = app("a", "healthy", &[]);
        a.meta.owner = "   ".into();
        let r = check_conformance(&[a], &ConformancePolicy::parse("owner"));
        assert_eq!(r.apps[0].findings[0].rule, "owner-missing");
        let e = check_conformance(&[], &ConformancePolicy::default());
        assert_eq!(e.summary.score, 100);
    }

    #[test]
    fn filter_recomputes_summary() {
        let mut a = app("a", "healthy", &[]);
        a.meta.owner = "t1".into();
        a.meta.environment = "prod".into();
        let b = app("b", "healthy", &[]);
        let mut r = check_conformance(&[a, b], &ConformancePolicy::default());
        assert_eq!(r.summary.total, 2);
        r.filter(Some("t1"), None);
        assert_eq!(r.summary.total, 1);
        assert_eq!(r.summary.score, 100);
        r.filter(None, Some("other-ns"));
        assert_eq!(r.summary.total, 0);
    }

    #[test]
    fn runbook_lifecycle_and_tags_can_be_required() {
        let mut a = app("a", "healthy", &[]);
        let policy = ConformancePolicy::parse("runbook,lifecycle,tags");
        let r = check_conformance(std::slice::from_ref(&a), &policy);
        let rules: Vec<&str> = r.apps[0].findings.iter().map(|f| f.rule.as_str()).collect();
        assert_eq!(
            rules,
            ["runbook-missing", "lifecycle-missing", "tags-missing"]
        );
        a.meta.lifecycle = "production".into();
        a.meta.tags = vec!["go".into()];
        a.meta.links = vec![crate::AppLink {
            title: "Runbook".into(),
            url: "javascript:alert(1)".into(),
            kind: "runbook".into(),
        }];
        let r = check_conformance(std::slice::from_ref(&a), &policy);
        assert_eq!(r.apps[0].findings.len(), 1, "unsafe runbook does not count");
        a.meta.links[0].url = "https://wiki.example/run".into();
        let r = check_conformance(&[a], &policy);
        assert!(r.apps[0].findings.is_empty());
    }

    #[test]
    fn dependency_on_deprecated_app_is_flagged_once() {
        let mut old = app("old", "healthy", &[]);
        old.meta.lifecycle = "deprecated".into();
        let user = app("user", "healthy", &["old", "demo/old"]);
        let mut also_old = app("also", "healthy", &["old"]);
        also_old.meta.lifecycle = "deprecated".into();
        let r = check_conformance(&[old, user, also_old], &ConformancePolicy::parse(""));
        let count = |id: &str| {
            r.apps
                .iter()
                .find(|a| a.id == id)
                .unwrap()
                .findings
                .iter()
                .filter(|f| f.rule == "dependency-deprecated")
                .count()
        };
        assert_eq!(count("demo/user"), 1);
        assert_eq!(count("demo/also"), 0);
    }

    #[test]
    fn exemptions_waive_only_active_matching_findings() {
        let a = app("a", "healthy", &[]);
        let mut r = check_conformance(&[a], &ConformancePolicy::default());
        assert_eq!(r.apps[0].score, 70);
        let ex = |rule: &str, expires: &str| Exemption {
            id: rule.into(),
            app_id: "demo/a".into(),
            rule: rule.into(),
            reason: "r".into(),
            created_by: "u".into(),
            created_at: String::new(),
            expires_at: expires.into(),
        };
        r.apply_exemptions(
            &[
                ex("owner-missing", "2999-01-01T00:00:00Z"),
                ex("environment-missing", "2000-01-01T00:00:00Z"),
            ],
            Utc::now(),
        );
        assert_eq!(r.apps[0].score, 85);
        assert_eq!(r.apps[0].findings[0].rule, "environment-missing");
        assert_eq!(r.apps[0].exempted[0].rule, "owner-missing");
        assert_eq!(r.summary.warnings, 1);
    }

    #[test]
    fn findings_per_app_are_capped() {
        let deps: Vec<String> = (0..60).map(|i| format!("ghost{i}")).collect();
        let refs: Vec<&str> = deps.iter().map(String::as_str).collect();
        let r = check_conformance(&[app("x", "healthy", &refs)], &ConformancePolicy::default());
        assert!(r.apps[0].findings.len() <= MAX_FINDINGS_PER_APP);
        assert_eq!(r.apps[0].score, 0);
    }
}
