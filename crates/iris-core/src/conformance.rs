// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

//! Catalog conformance: checks published apps against a small, configurable
//! metadata policy (ownership, environment, description) plus structural
//! rules (dependency cycles, unresolved dependencies, missing endpoints).
//!
//! Modelled on Backstage's required `owner`/`lifecycle` fields and on policy
//! attachment in Kyverno/OPA, but read-only: Iris reports, it never mutates.

use serde::Serialize;

use crate::impact::analyze_impact;
use crate::App;

/// Metadata fields a policy may require.
pub const KNOWN_FIELDS: [&str; 3] = ["owner", "environment", "description"];
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

/// Evaluate every published, non-hidden app against `policy`.
pub fn check_conformance(apps: &[App], policy: &ConformancePolicy) -> ConformanceReport {
    let impact = analyze_impact(apps);
    let by_id: std::collections::HashMap<&str, &crate::impact::AppImpact> =
        impact.apps.iter().map(|a| (a.id.as_str(), a)).collect();

    let mut out: Vec<AppConformance> = Vec::new();
    for app in apps
        .iter()
        .filter(|a| a.visibility.published && !a.visibility.hidden)
        .take(crate::impact::MAX_APPS)
    {
        let mut f: Vec<Finding> = Vec::new();
        for field in &policy.require {
            let value = match field.as_str() {
                "owner" => &app.meta.owner,
                "environment" => &app.meta.environment,
                _ => &app.description,
            };
            if value.trim().is_empty() {
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
        f.truncate(MAX_FINDINGS_PER_APP);
        let score = 100u32.saturating_sub(f.iter().map(|x| penalty(&x.severity)).sum());
        out.push(AppConformance {
            id: app.id.clone(),
            label: app.display_name.clone(),
            namespace: app.namespace.clone(),
            owner: app.meta.owner.clone(),
            score,
            findings: f,
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
    fn findings_per_app_are_capped() {
        let deps: Vec<String> = (0..60).map(|i| format!("ghost{i}")).collect();
        let refs: Vec<&str> = deps.iter().map(String::as_str).collect();
        let r = check_conformance(&[app("x", "healthy", &refs)], &ConformancePolicy::default());
        assert!(r.apps[0].findings.len() <= MAX_FINDINGS_PER_APP);
        assert_eq!(r.apps[0].score, 0);
    }
}
