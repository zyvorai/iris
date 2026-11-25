// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

//! Governance on top of conformance: time-boxed rule exemptions (as in
//! Cortex Scorecard rule exemptions) and campaigns, a set of rules with a due
//! date and progress per owner (as in Datadog / OpsLevel campaigns).

use std::collections::BTreeMap;

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use crate::conformance::{check_conformance, ConformancePolicy, KNOWN_FIELDS, KNOWN_RULES};
use crate::App;

/// Longest exemption that can be granted; there are no permanent exemptions.
pub const MAX_EXEMPTION_DAYS: i64 = 365;
/// Maximum stored exemptions (expired ones included).
pub const MAX_EXEMPTIONS: usize = 1000;
/// Maximum stored campaigns.
pub const MAX_CAMPAIGNS: usize = 50;
pub const MAX_REASON_LEN: usize = 500;
pub const MAX_NAME_LEN: usize = 120;
/// Maximum failing apps listed per campaign.
pub const MAX_FAILING_LISTED: usize = 200;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Exemption {
    pub id: String,
    pub app_id: String,
    pub rule: String,
    pub reason: String,
    pub created_by: String,
    pub created_at: String,
    pub expires_at: String,
}

impl Exemption {
    /// An exemption with an unparseable expiry never applies.
    pub fn is_active(&self, now: DateTime<Utc>) -> bool {
        DateTime::parse_from_rfc3339(&self.expires_at).is_ok_and(|t| t > now)
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExemptionView {
    #[serde(flatten)]
    pub exemption: Exemption,
    /// `active` or `expired`.
    pub status: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateExemptionRequest {
    pub app_id: String,
    pub rule: String,
    pub reason: String,
    pub days: i64,
}

impl CreateExemptionRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.app_id.trim().is_empty() {
            return Err("appId is required".into());
        }
        if !KNOWN_RULES.contains(&self.rule.as_str()) {
            return Err(format!("rule must be one of {}", KNOWN_RULES.join(", ")));
        }
        let reason = self.reason.trim();
        if reason.is_empty() || reason.chars().count() > MAX_REASON_LEN {
            return Err(format!(
                "reason is required (max {MAX_REASON_LEN} characters)"
            ));
        }
        if !(1..=MAX_EXEMPTION_DAYS).contains(&self.days) {
            return Err(format!("days must be between 1 and {MAX_EXEMPTION_DAYS}"));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Campaign {
    pub id: String,
    pub name: String,
    pub description: String,
    pub rules: Vec<String>,
    /// Empty means every namespace.
    pub namespace: String,
    /// Empty means every owner.
    pub owner: String,
    /// `YYYY-MM-DD`; the campaign is overdue after this day (UTC).
    pub due_date: String,
    pub created_by: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCampaignRequest {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub rules: Vec<String>,
    #[serde(default)]
    pub namespace: String,
    #[serde(default)]
    pub owner: String,
    pub due_date: String,
}

fn parse_date(raw: &str) -> Option<NaiveDate> {
    if raw.len() != 10 {
        return None;
    }
    NaiveDate::parse_from_str(raw, "%Y-%m-%d").ok()
}

impl CreateCampaignRequest {
    /// Validate and normalise (trim, de-duplicate rules).
    pub fn normalize(mut self) -> Result<Self, String> {
        self.name = self.name.trim().to_string();
        self.description = self.description.trim().to_string();
        self.namespace = self.namespace.trim().to_string();
        self.owner = self.owner.trim().to_string();
        if self.name.is_empty() || self.name.chars().count() > MAX_NAME_LEN {
            return Err(format!("name is required (max {MAX_NAME_LEN} characters)"));
        }
        if self.description.chars().count() > MAX_REASON_LEN {
            return Err(format!(
                "description is limited to {MAX_REASON_LEN} characters"
            ));
        }
        if self.namespace.len() > 253 || self.owner.len() > 253 {
            return Err("namespace and owner are limited to 253 characters".into());
        }
        let mut rules: Vec<String> = Vec::new();
        for r in &self.rules {
            if !KNOWN_RULES.contains(&r.as_str()) {
                return Err(format!("rules must be from {}", KNOWN_RULES.join(", ")));
            }
            if !rules.contains(r) {
                rules.push(r.clone());
            }
        }
        if rules.is_empty() {
            return Err("at least one rule is required".into());
        }
        self.rules = rules;
        if parse_date(&self.due_date).is_none() {
            return Err("dueDate must be YYYY-MM-DD".into());
        }
        Ok(self)
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CampaignFailure {
    pub id: String,
    pub label: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub owner: String,
    pub rules: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OwnerProgress {
    /// Empty for apps without an owner.
    pub owner: String,
    pub total: usize,
    pub failing: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CampaignProgress {
    #[serde(flatten)]
    pub campaign: Campaign,
    /// `empty`, `complete`, `active` or `overdue`.
    pub status: String,
    /// Days until the due date, negative once it has passed.
    pub days_left: i64,
    pub total: usize,
    pub passing: usize,
    pub failing: usize,
    /// Passing apps as a percentage, rounded down.
    pub percent: u32,
    /// Most failing owners first.
    pub owners: Vec<OwnerProgress>,
    pub failing_apps: Vec<CampaignFailure>,
}

/// Evaluate one campaign over `apps`.
///
/// Rules of the form `<field>-missing` are required for the campaign even when
/// the global policy does not require that field. An actively exempted finding
/// does not count as failing.
pub fn campaign_progress(
    campaign: &Campaign,
    apps: &[App],
    base: &ConformancePolicy,
    exemptions: &[Exemption],
    now: DateTime<Utc>,
) -> CampaignProgress {
    let mut policy = base.clone();
    for field in KNOWN_FIELDS {
        let rule = format!("{field}-missing");
        if campaign.rules.contains(&rule) && !policy.require.iter().any(|f| f == field) {
            policy.require.push(field.to_string());
        }
    }
    let mut report = check_conformance(apps, &policy);
    report.apply_exemptions(exemptions, now);
    report.filter(
        Some(campaign.owner.as_str()).filter(|v| !v.is_empty()),
        Some(campaign.namespace.as_str()).filter(|v| !v.is_empty()),
    );

    let mut owners: BTreeMap<String, (usize, usize)> = BTreeMap::new();
    let mut failing_apps = Vec::new();
    let mut failing = 0;
    for a in &report.apps {
        let mut rules: Vec<String> = a
            .findings
            .iter()
            .filter(|f| campaign.rules.contains(&f.rule))
            .map(|f| f.rule.clone())
            .collect();
        rules.sort();
        rules.dedup();
        let entry = owners.entry(a.owner.clone()).or_default();
        entry.0 += 1;
        if !rules.is_empty() {
            entry.1 += 1;
            failing += 1;
            if failing_apps.len() < MAX_FAILING_LISTED {
                failing_apps.push(CampaignFailure {
                    id: a.id.clone(),
                    label: a.label.clone(),
                    owner: a.owner.clone(),
                    rules,
                });
            }
        }
    }
    failing_apps.sort_by(|a, b| a.id.cmp(&b.id));
    let total = report.apps.len();
    let passing = total - failing;
    let days_left = parse_date(&campaign.due_date).map_or(0, |d| (d - now.date_naive()).num_days());
    let status = if total == 0 {
        "empty"
    } else if failing == 0 {
        "complete"
    } else if days_left < 0 {
        "overdue"
    } else {
        "active"
    };
    let mut owners: Vec<OwnerProgress> = owners
        .into_iter()
        .map(|(owner, (total, failing))| OwnerProgress {
            owner,
            total,
            failing,
        })
        .collect();
    owners.sort_by(|a, b| {
        b.failing
            .cmp(&a.failing)
            .then_with(|| a.owner.cmp(&b.owner))
    });
    CampaignProgress {
        campaign: campaign.clone(),
        status: status.into(),
        days_left,
        total,
        passing,
        failing,
        percent: (passing * 100).checked_div(total).unwrap_or(0) as u32,
        owners,
        failing_apps,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impact::tests::app;

    fn now() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-11-25T12:00:00Z")
            .unwrap()
            .with_timezone(&Utc)
    }

    fn campaign(rules: &[&str], due: &str) -> Campaign {
        Campaign {
            id: "c1".into(),
            name: "n".into(),
            description: String::new(),
            rules: rules.iter().map(|r| r.to_string()).collect(),
            namespace: String::new(),
            owner: String::new(),
            due_date: due.into(),
            created_by: "u".into(),
            created_at: String::new(),
        }
    }

    fn exemption(app: &str, rule: &str, expires: &str) -> Exemption {
        Exemption {
            id: "e".into(),
            app_id: app.into(),
            rule: rule.into(),
            reason: "r".into(),
            created_by: "u".into(),
            created_at: String::new(),
            expires_at: expires.into(),
        }
    }

    #[test]
    fn exemption_request_validation() {
        let ok = CreateExemptionRequest {
            app_id: "a/b".into(),
            rule: "owner-missing".into(),
            reason: "migrating".into(),
            days: 30,
        };
        assert!(ok.validate().is_ok());
        for bad in [
            CreateExemptionRequest {
                rule: "nope".into(),
                ..ok.clone()
            },
            CreateExemptionRequest {
                reason: "  ".into(),
                ..ok.clone()
            },
            CreateExemptionRequest {
                reason: "x".repeat(MAX_REASON_LEN + 1),
                ..ok.clone()
            },
            CreateExemptionRequest {
                days: 0,
                ..ok.clone()
            },
            CreateExemptionRequest {
                days: MAX_EXEMPTION_DAYS + 1,
                ..ok.clone()
            },
            CreateExemptionRequest {
                app_id: " ".into(),
                ..ok.clone()
            },
        ] {
            assert!(bad.validate().is_err(), "{bad:?}");
        }
    }

    #[test]
    fn expiry_controls_activity() {
        assert!(exemption("a", "owner-missing", "2026-12-01T00:00:00Z").is_active(now()));
        assert!(!exemption("a", "owner-missing", "2026-11-01T00:00:00Z").is_active(now()));
        assert!(!exemption("a", "owner-missing", "garbage").is_active(now()));
    }

    #[test]
    fn campaign_request_normalises_and_rejects() {
        let ok = CreateCampaignRequest {
            name: " Runbooks ".into(),
            description: String::new(),
            rules: vec!["runbook-missing".into(), "runbook-missing".into()],
            namespace: String::new(),
            owner: String::new(),
            due_date: "2026-12-31".into(),
        };
        let n = ok.clone().normalize().unwrap();
        assert_eq!(n.name, "Runbooks");
        assert_eq!(n.rules, ["runbook-missing"]);
        for bad in [
            CreateCampaignRequest {
                rules: vec![],
                ..ok.clone()
            },
            CreateCampaignRequest {
                rules: vec!["x".into()],
                ..ok.clone()
            },
            CreateCampaignRequest {
                due_date: "2026-13-01".into(),
                ..ok.clone()
            },
            CreateCampaignRequest {
                due_date: "26-1-1".into(),
                ..ok.clone()
            },
            CreateCampaignRequest {
                name: "".into(),
                ..ok.clone()
            },
        ] {
            assert!(bad.normalize().is_err());
        }
    }

    #[test]
    fn progress_adds_required_field_and_honours_exemptions() {
        let a = app("a", "healthy", &[]);
        let b = app("b", "healthy", &[]);
        let apps = [a, b];
        let base = ConformancePolicy::parse("");
        let c = campaign(&["runbook-missing"], "2026-12-31");
        let p = campaign_progress(&c, &apps, &base, &[], now());
        assert_eq!((p.total, p.failing, p.percent), (2, 2, 0));
        assert_eq!(p.status, "active");
        assert_eq!(p.days_left, 36);
        let ex = [exemption(
            "demo/a",
            "runbook-missing",
            "2026-12-01T00:00:00Z",
        )];
        let p = campaign_progress(&c, &apps, &base, &ex, now());
        assert_eq!((p.failing, p.percent), (1, 50));
        assert_eq!(p.failing_apps[0].id, "demo/b");
    }

    #[test]
    fn progress_status_overdue_complete_empty() {
        let mut a = app("a", "healthy", &[]);
        a.meta.owner = "t".into();
        let base = ConformancePolicy::default();
        let late = campaign(&["environment-missing"], "2026-11-24");
        let p = campaign_progress(&late, std::slice::from_ref(&a), &base, &[], now());
        assert_eq!(p.status, "overdue");
        assert_eq!(p.days_left, -1);
        let done = campaign(&["owner-missing"], "2026-11-24");
        let p = campaign_progress(&done, std::slice::from_ref(&a), &base, &[], now());
        assert_eq!((p.status.as_str(), p.percent), ("complete", 100));
        let mut scoped = done.clone();
        scoped.owner = "nobody".into();
        let p = campaign_progress(&scoped, &[a], &base, &[], now());
        assert_eq!((p.status.as_str(), p.percent), ("empty", 0));
        // Due today is not yet overdue.
        let today = campaign(&["environment-missing"], "2026-11-25");
        let p = campaign_progress(&today, &[app("z", "healthy", &[])], &base, &[], now());
        assert_eq!(p.status, "active");
    }
}
