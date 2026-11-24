// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

//! Maturity scorecard (gold / silver / bronze) derived from the conformance
//! report, in the style of Cortex and OpsLevel service maturity levels, plus
//! a staleness report and exporters (CSV, per-app Prometheus series).

use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::conformance::ConformanceReport;
use crate::App;

/// Upper bound on staleness window, in days.
pub const MAX_STALE_DAYS: i64 = 3650;
pub const DEFAULT_STALE_DAYS: i64 = 30;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScorecardApp {
    pub id: String,
    pub label: String,
    pub namespace: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub owner: String,
    /// `gold`, `silver`, `bronze` or `none`.
    pub level: String,
    pub score: u32,
    /// What to fix to move up, errors first.
    pub next_steps: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScorecardSummary {
    pub gold: usize,
    pub silver: usize,
    pub bronze: usize,
    pub none: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Scorecard {
    /// Lowest level first.
    pub apps: Vec<ScorecardApp>,
    pub summary: ScorecardSummary,
}

fn level_rank(level: &str) -> u8 {
    match level {
        "none" => 0,
        "bronze" => 1,
        "silver" => 2,
        _ => 3,
    }
}

/// Gold: no findings. Silver: no errors and at most one warning.
/// Bronze: no errors. None: any error finding.
pub fn scorecard(report: &ConformanceReport) -> Scorecard {
    let mut summary = ScorecardSummary::default();
    let mut apps: Vec<ScorecardApp> = report
        .apps
        .iter()
        .map(|a| {
            let errors = a.findings.iter().filter(|f| f.severity == "error").count();
            let warnings = a
                .findings
                .iter()
                .filter(|f| f.severity == "warning")
                .count();
            let level = if errors > 0 {
                summary.none += 1;
                "none"
            } else if a.findings.is_empty() {
                summary.gold += 1;
                "gold"
            } else if warnings <= 1 {
                summary.silver += 1;
                "silver"
            } else {
                summary.bronze += 1;
                "bronze"
            };
            let mut steps: Vec<&crate::conformance::Finding> = a.findings.iter().collect();
            steps.sort_by_key(|f| f.severity != "error");
            ScorecardApp {
                id: a.id.clone(),
                label: a.label.clone(),
                namespace: a.namespace.clone(),
                owner: a.owner.clone(),
                level: level.into(),
                score: a.score,
                next_steps: steps.iter().map(|f| f.message.clone()).collect(),
            }
        })
        .collect();
    apps.sort_by(|a, b| {
        level_rank(&a.level)
            .cmp(&level_rank(&b.level))
            .then_with(|| a.id.cmp(&b.id))
    });
    Scorecard { apps, summary }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StaleApp {
    pub id: String,
    pub label: String,
    pub namespace: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub owner: String,
    pub updated_at: String,
    pub age_days: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StaleReport {
    pub days: i64,
    /// Apps whose `updatedAt` is missing or unparseable (not counted as stale).
    pub unknown: usize,
    /// Oldest first.
    pub apps: Vec<StaleApp>,
}

/// Apps the controller has not refreshed within `days` (clamped to 1..=3650).
pub fn stale_apps(apps: &[App], days: i64, now: DateTime<Utc>) -> StaleReport {
    let days = days.clamp(1, MAX_STALE_DAYS);
    let mut unknown = 0;
    let mut out = Vec::new();
    for a in apps.iter().take(crate::impact::MAX_APPS) {
        let Ok(t) = DateTime::parse_from_rfc3339(&a.updated_at) else {
            unknown += 1;
            continue;
        };
        let age = (now - t.with_timezone(&Utc)).num_days();
        if age >= days {
            out.push(StaleApp {
                id: a.id.clone(),
                label: a.display_name.clone(),
                namespace: a.namespace.clone(),
                owner: a.meta.owner.clone(),
                updated_at: a.updated_at.clone(),
                age_days: age,
            });
        }
    }
    out.sort_by(|a, b| b.age_days.cmp(&a.age_days).then_with(|| a.id.cmp(&b.id)));
    StaleReport {
        days,
        unknown,
        apps: out,
    }
}

fn csv_cell(raw: &str) -> String {
    // Neutralise spreadsheet formula injection (OWASP CSV injection).
    let mut s = raw.to_string();
    if s.starts_with(['=', '+', '-', '@', '\t', '\r']) {
        s.insert(0, '\'');
    }
    if s.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s
    }
}

/// RFC 4180 CSV of the catalog.
pub fn catalog_csv(apps: &[App]) -> String {
    let mut out = String::from(
        "id,name,namespace,category,status,published,owner,environment,url,dependsOn,updatedAt\r\n",
    );
    for a in apps {
        let cells = [
            a.id.as_str(),
            a.display_name.as_str(),
            a.namespace.as_str(),
            a.category.as_str(),
            a.status.as_str(),
            if a.visibility.published {
                "true"
            } else {
                "false"
            },
            a.meta.owner.as_str(),
            a.meta.environment.as_str(),
            a.public_url.as_str(),
            &a.meta.depends_on.join(";"),
            a.updated_at.as_str(),
        ];
        let row: Vec<String> = cells.iter().map(|c| csv_cell(c)).collect();
        out.push_str(&row.join(","));
        out.push_str("\r\n");
    }
    out
}

fn label_escape(v: &str) -> String {
    v.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
}

/// Per-app Prometheus series: one `iris_app_status` series per app (value 1,
/// `status` label) and `iris_app_conformance_score` for published apps.
pub fn render_app_metrics(apps: &[App], conformance: &ConformanceReport) -> String {
    let mut out = String::from(
        "# HELP iris_app_status Current app status (value is always 1)\n# TYPE iris_app_status gauge\n",
    );
    for a in apps.iter().take(crate::impact::MAX_APPS) {
        out.push_str(&format!(
            "iris_app_status{{app=\"{}\",namespace=\"{}\",status=\"{}\"}} 1\n",
            label_escape(&a.slug),
            label_escape(&a.namespace),
            label_escape(&a.status)
        ));
    }
    out.push_str(
        "# HELP iris_app_conformance_score Conformance score 0-100 of published apps\n# TYPE iris_app_conformance_score gauge\n",
    );
    for c in &conformance.apps {
        out.push_str(&format!(
            "iris_app_conformance_score{{app=\"{}\",namespace=\"{}\"}} {}\n",
            label_escape(c.id.rsplit('/').next().unwrap_or(&c.id)),
            label_escape(&c.namespace),
            c.score
        ));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::conformance::{check_conformance, ConformancePolicy};
    use crate::impact::tests::app;

    fn full(slug: &str) -> App {
        let mut a = app(slug, "healthy", &[]);
        a.meta.owner = "team".into();
        a.meta.environment = "prod".into();
        a
    }

    #[test]
    fn levels_follow_findings() {
        let gold = full("gold");
        let mut silver = full("silver");
        silver.meta.owner.clear();
        let mut bronze = full("bronze");
        bronze.meta.owner.clear();
        bronze.meta.environment.clear();
        let mut none = full("none");
        none.ready_endpoints = 0;
        let r = check_conformance(&[gold, silver, bronze, none], &ConformancePolicy::default());
        let sc = scorecard(&r);
        let lv = |id: &str| {
            sc.apps
                .iter()
                .find(|a| a.id == format!("demo/{id}"))
                .unwrap()
                .level
                .clone()
        };
        assert_eq!(lv("gold"), "gold");
        assert_eq!(lv("silver"), "silver");
        assert_eq!(lv("bronze"), "bronze");
        assert_eq!(lv("none"), "none");
        assert_eq!(
            (
                sc.summary.gold,
                sc.summary.silver,
                sc.summary.bronze,
                sc.summary.none
            ),
            (1, 1, 1, 1)
        );
        assert_eq!(sc.apps[0].level, "none");
        assert_eq!(sc.apps[0].next_steps.len(), 1);
    }

    #[test]
    fn stale_filters_sorts_and_clamps() {
        let now = DateTime::parse_from_rfc3339("2026-11-24T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let mut old = app("old", "healthy", &[]);
        old.updated_at = "2026-01-01T00:00:00Z".into();
        let mut mid = app("mid", "healthy", &[]);
        mid.updated_at = "2026-10-01T00:00:00Z".into();
        let mut fresh = app("fresh", "healthy", &[]);
        fresh.updated_at = "2026-11-23T00:00:00Z".into();
        let blank = app("blank", "healthy", &[]);
        let r = stale_apps(&[fresh, mid, blank, old], 30, now);
        assert_eq!(r.unknown, 1);
        let ids: Vec<&str> = r.apps.iter().map(|a| a.id.as_str()).collect();
        assert_eq!(ids, ["demo/old", "demo/mid"]);
        assert_eq!(stale_apps(&[], -5, now).days, 1);
        assert_eq!(stale_apps(&[], 10_000_000, now).days, MAX_STALE_DAYS);
    }

    #[test]
    fn csv_quotes_and_neutralises_formulas() {
        let mut a = app("a", "healthy", &["b", "c"]);
        a.display_name = "=HYPERLINK(\"x\")".into();
        a.description = "ignored".into();
        a.meta.owner = "team, one".into();
        let csv = catalog_csv(&[a]);
        let mut lines = csv.split("\r\n");
        assert!(lines.next().unwrap().starts_with("id,name,"));
        let row = lines.next().unwrap();
        assert!(
            row.starts_with("demo/a,\"'=HYPERLINK(\"\"x\"\")\","),
            "{row}"
        );
        assert!(row.contains("\"team, one\""));
        assert!(row.contains("b;c"));
    }

    #[test]
    fn metrics_escape_labels() {
        let mut a = app("a", "broken", &[]);
        a.namespace = "we\"ird\\ns".into();
        let r = check_conformance(&[a.clone()], &ConformancePolicy::default());
        let m = render_app_metrics(&[a], &r);
        assert!(m.contains(
            "iris_app_status{app=\"a\",namespace=\"we\\\"ird\\\\ns\",status=\"broken\"} 1"
        ));
        assert!(m.contains("iris_app_conformance_score{app=\"a\""));
    }
}
