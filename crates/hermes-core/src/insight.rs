// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use serde::{Deserialize, Serialize};

use crate::llm::{llm_chat_json, llm_config_from_env, LlmConfig};
use crate::{App, AppDiagnosis, ClusterSummary, SuggestedAction};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppInsight {
    pub app_id: String,
    pub summary: String,
    pub explanation: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub remediation: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub suggested_actions: Vec<SuggestedAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FleetInsight {
    pub summary: String,
    pub explanation: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub highlights: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub focus_app_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LlmAppInsight {
    summary: String,
    explanation: String,
    #[serde(default)]
    remediation: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LlmFleetInsight {
    summary: String,
    explanation: String,
    #[serde(default)]
    highlights: Vec<String>,
    #[serde(default, alias = "focusAppIds")]
    focus_app_ids: Vec<String>,
}

pub fn rule_app_insight(app: &App, diagnosis: &AppDiagnosis) -> AppInsight {
    let mut remediation = Vec::new();
    if app.ready_endpoints == 0 {
        remediation.push(format!(
            "Check pods in namespace {}: kubectl get pods -n {}",
            app.namespace, app.namespace
        ));
    }
    if !app.meta.depends_on.is_empty() {
        remediation.push(format!(
            "Verify dependencies are healthy: {}",
            app.meta.depends_on.join(", ")
        ));
    }
    if app.status != "healthy" && !app.status_message.is_empty() {
        remediation.push("Review the probe error in technical details on the app card.".into());
    }

    let summary = if app.status == "healthy" {
        format!("{} is healthy with {} ready endpoint(s).", app.display_name, app.ready_endpoints)
    } else {
        format!(
            "{} is {} — {} ready endpoint(s).",
            app.display_name, app.status, app.ready_endpoints
        )
    };

    let explanation = if !diagnosis.cause.is_empty() {
        diagnosis.cause.clone()
    } else if !diagnosis.problem.is_empty() {
        diagnosis.problem.clone()
    } else if app.status == "healthy" {
        format!(
            "{} is reachable through {} with no active probe failures.",
            app.display_name, app.route_path
        )
    } else {
        "Hermes detected a health probe failure but no detailed cause was stored yet.".into()
    };

    AppInsight {
        app_id: app.id.clone(),
        summary,
        explanation,
        source: "rules".into(),
        remediation,
        suggested_actions: diagnosis.suggested_actions.clone(),
    }
}

async fn llm_app_insight(app: &App, diagnosis: &AppDiagnosis, cfg: &LlmConfig) -> Option<AppInsight> {
    let chain: Vec<_> = diagnosis
        .chain
        .iter()
        .map(|n| {
            serde_json::json!({
                "id": n.id,
                "label": n.label,
                "status": n.status,
            })
        })
        .collect();
    let context = serde_json::json!({
        "id": app.id,
        "name": app.display_name,
        "namespace": app.namespace,
        "status": app.status,
        "statusMessage": app.status_message,
        "readyEndpoints": app.ready_endpoints,
        "routePath": app.route_path,
        "publicUrl": app.public_url,
        "environment": app.meta.environment,
        "owner": app.meta.owner,
        "dependsOn": app.meta.depends_on,
        "problem": diagnosis.problem,
        "cause": diagnosis.cause,
        "chain": chain,
    });
    let system = "You are Zeus AI for Hermes Kubernetes app platform. Return JSON only: {\"summary\":\"one line\",\"explanation\":\"2-4 sentences for operators\",\"remediation\":[\"actionable step\"]}. Be concise and practical.";
    let user = format!("Diagnose this service:\n{}", serde_json::to_string_pretty(&context).ok()?);
    let llm: LlmAppInsight = llm_chat_json(cfg, system, &user).await?;
    if llm.summary.trim().is_empty() && llm.explanation.trim().is_empty() {
        return None;
    }
    Some(AppInsight {
        app_id: app.id.clone(),
        summary: llm.summary,
        explanation: llm.explanation,
        source: "llm".into(),
        remediation: llm.remediation,
        suggested_actions: diagnosis.suggested_actions.clone(),
    })
}

pub async fn resolve_app_insight(app: &App, diagnosis: &AppDiagnosis) -> AppInsight {
    if let Some(cfg) = llm_config_from_env() {
        if let Some(insight) = llm_app_insight(app, diagnosis, &cfg).await {
            return insight;
        }
    }
    rule_app_insight(app, diagnosis)
}

pub fn rule_fleet_insight(apps: &[App], summary: &ClusterSummary) -> FleetInsight {
    let unhealthy: Vec<_> = apps.iter().filter(|a| a.status != "healthy").collect();
    let broken = unhealthy.iter().filter(|a| a.status == "broken").count();
    let degraded = unhealthy.iter().filter(|a| a.status == "degraded").count();
    let mut highlights = Vec::new();
    if broken > 0 {
        highlights.push(format!("{broken} broken service(s) need immediate attention"));
    }
    if degraded > 0 {
        highlights.push(format!("{degraded} degraded service(s) have partial failures"));
    }
    let mut ns_counts = std::collections::BTreeMap::<String, usize>::new();
    for app in &unhealthy {
        *ns_counts.entry(app.namespace.clone()).or_default() += 1;
    }
    if let Some((ns, count)) = ns_counts.iter().max_by_key(|(_, c)| *c) {
        if *count >= 2 {
            highlights.push(format!("Namespace {ns} has {count} unhealthy services"));
        }
    }
    let timeout_count = unhealthy
        .iter()
        .filter(|a| {
            a.status_message
                .to_lowercase()
                .contains("timeout") || a.status_message.to_lowercase().contains("deadline")
        })
        .count();
    if timeout_count > 0 {
        highlights.push(format!("{timeout_count} failures look probe-timeout related"));
    }

    let focus_app_ids: Vec<String> = unhealthy
        .iter()
        .take(5)
        .map(|a| a.id.clone())
        .collect();

    let summary_line = if unhealthy.is_empty() {
        format!(
            "Fleet is healthy — {} services across {} namespaces with {} published.",
            summary.total, summary.namespaces, summary.published
        )
    } else {
        format!(
            "{} of {} services need attention ({} broken, {} degraded).",
            unhealthy.len(),
            summary.total,
            broken,
            degraded
        )
    };

    let explanation = if unhealthy.is_empty() {
        "All discovered services passed their latest health probes. Use Mission Control or Health to monitor drift.".into()
    } else {
        format!(
            "Hermes flagged {} unhealthy services. Start with broken apps, then inspect degraded dependencies and namespace blast radius.",
            unhealthy.len()
        )
    };

    FleetInsight {
        summary: summary_line,
        explanation,
        source: "rules".into(),
        highlights,
        focus_app_ids,
    }
}

async fn llm_fleet_insight(apps: &[App], summary: &ClusterSummary, cfg: &LlmConfig) -> Option<FleetInsight> {
    let unhealthy: Vec<_> = apps
        .iter()
        .filter(|a| a.status != "healthy")
        .take(25)
        .map(|a| {
            serde_json::json!({
                "id": a.id,
                "name": a.display_name,
                "namespace": a.namespace,
                "status": a.status,
                "statusMessage": a.status_message,
                "dependsOn": a.meta.depends_on,
            })
        })
        .collect();
    let context = serde_json::json!({
        "cluster": summary,
        "unhealthySample": unhealthy,
    });
    let system = "You are Zeus AI fleet analyst for Hermes. Return JSON only: {\"summary\":\"one line\",\"explanation\":\"2-4 sentences\",\"highlights\":[\"bullet\"],\"focusAppIds\":[\"app-id\"]}. Prioritize broken services and shared namespaces.";
    let user = format!("Summarize fleet health:\n{}", serde_json::to_string_pretty(&context).ok()?);
    let llm: LlmFleetInsight = llm_chat_json(cfg, system, &user).await?;
    if llm.summary.trim().is_empty() {
        return None;
    }
    Some(FleetInsight {
        summary: llm.summary,
        explanation: llm.explanation,
        source: "llm".into(),
        highlights: llm.highlights,
        focus_app_ids: llm.focus_app_ids,
    })
}

pub async fn resolve_fleet_insight(apps: &[App], summary: &ClusterSummary) -> FleetInsight {
    if let Some(cfg) = llm_config_from_env() {
        if let Some(insight) = llm_fleet_insight(apps, summary, &cfg).await {
            return insight;
        }
    }
    rule_fleet_insight(apps, summary)
}
