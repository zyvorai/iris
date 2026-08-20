// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use serde::{Deserialize, Serialize};

use crate::llm::{llm_chat_json, llm_config_from_env, LlmConfig};
use crate::{App, AppDiagnosis, AppGraph, AuditEvent, ClusterSummary, FederatedApp, SuggestedAction};

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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryInsight {
    pub summary: String,
    pub explanation: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub highlights: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub suggest_publish_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NamespaceInsight {
    pub namespace: String,
    pub summary: String,
    pub explanation: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub highlights: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub focus_app_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphInsight {
    pub summary: String,
    pub explanation: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub highlights: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub focus_app_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OwnerInsight {
    pub owner: String,
    pub summary: String,
    pub explanation: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub highlights: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub focus_app_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FederatedInsight {
    pub summary: String,
    pub explanation: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub highlights: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub focus_app_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActivityInsight {
    pub summary: String,
    pub explanation: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub highlights: Vec<String>,
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
    let system = "You are Zyra AI for Hermes Kubernetes app platform. Return JSON only: {\"summary\":\"one line\",\"explanation\":\"2-4 sentences for operators\",\"remediation\":[\"actionable step\"]}. Be concise and practical.";
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
    let system = "You are Zyra AI fleet analyst for Hermes. Return JSON only: {\"summary\":\"one line\",\"explanation\":\"2-4 sentences\",\"highlights\":[\"bullet\"],\"focusAppIds\":[\"app-id\"]}. Prioritize broken services and shared namespaces.";
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

fn publish_priority(app: &App) -> i32 {
    let mut score = 0;
    if app.status == "healthy" {
        score += 100;
    } else if app.status == "degraded" {
        score += 40;
    }
    score += app.ready_endpoints.min(10) * 5;
    let cat = app.category.to_lowercase();
    if cat.contains("monitor") || cat.contains("observ") || cat.contains("grafana") || cat.contains("prometheus") {
        score += 25;
    }
    if !app.meta.depends_on.is_empty() {
        score += 10;
    }
    -score
}

pub fn rule_discovery_insight(discovery: &[App]) -> DiscoveryInsight {
    if discovery.is_empty() {
        return DiscoveryInsight {
            summary: "Discovery queue is empty.".into(),
            explanation: "All discovered services are published. Use Cluster to review the full inventory.".into(),
            source: "rules".into(),
            highlights: vec![],
            suggest_publish_ids: vec![],
        };
    }

    let mut sorted: Vec<&App> = discovery.iter().collect();
    sorted.sort_by(|a, b| {
        publish_priority(b)
            .cmp(&publish_priority(a))
            .then(a.display_name.cmp(&b.display_name))
    });

    let healthy = discovery.iter().filter(|a| a.status == "healthy").count();
    let broken = discovery.iter().filter(|a| a.status == "broken").count();
    let mut highlights = Vec::new();
    if healthy > 0 {
        highlights.push(format!("{healthy} unpublished service(s) are healthy and safe to publish"));
    }
    if broken > 0 {
        highlights.push(format!("{broken} unpublished service(s) are broken — fix probes before publishing"));
    }
    let mut ns_counts = std::collections::BTreeMap::<String, usize>::new();
    for app in discovery {
        *ns_counts.entry(app.namespace.clone()).or_default() += 1;
    }
    if let Some((ns, count)) = ns_counts.iter().max_by_key(|(_, c)| *c) {
        if *count >= 2 {
            highlights.push(format!("Namespace {ns} has {count} waiting services"));
        }
    }

    let suggest_publish_ids: Vec<String> = sorted
        .iter()
        .filter(|a| a.status != "broken")
        .take(6)
        .map(|a| a.id.clone())
        .collect();

    let summary = format!(
        "{} unpublished service(s) — {} ready to publish first.",
        discovery.len(),
        suggest_publish_ids.len()
    );
    let explanation = if healthy > 0 {
        "Hermes ranked unpublished services by health, readiness, and observability value. Start with healthy monitoring stacks, then platform dependencies.".into()
    } else {
        "Unpublished services need probe fixes before launchpad publish. Inspect broken apps in Discovery or Cluster.".into()
    };

    DiscoveryInsight {
        summary,
        explanation,
        source: "rules".into(),
        highlights,
        suggest_publish_ids,
    }
}

async fn llm_discovery_insight(discovery: &[App], cfg: &LlmConfig) -> Option<DiscoveryInsight> {
    let sample: Vec<_> = discovery
        .iter()
        .take(30)
        .map(|a| {
            serde_json::json!({
                "id": a.id,
                "name": a.display_name,
                "namespace": a.namespace,
                "status": a.status,
                "category": a.category,
                "readyEndpoints": a.ready_endpoints,
                "dependsOn": a.meta.depends_on,
            })
        })
        .collect();
    let system = "You are Zyra AI for Hermes discovery queue. Return JSON only: {\"summary\":\"one line\",\"explanation\":\"2-3 sentences\",\"highlights\":[\"bullet\"],\"suggestPublishIds\":[\"app-id\"]}. Prefer healthy observability and platform services.";
    let user = format!("Rank unpublished services to publish:\n{}", serde_json::to_string_pretty(&sample).ok()?);
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LlmDiscoveryInsight {
        summary: String,
        explanation: String,
        #[serde(default)]
        highlights: Vec<String>,
        #[serde(default, alias = "suggestPublishIds")]
        suggest_publish_ids: Vec<String>,
    }
    let llm: LlmDiscoveryInsight = llm_chat_json(cfg, system, &user).await?;
    if llm.summary.trim().is_empty() {
        return None;
    }
    Some(DiscoveryInsight {
        summary: llm.summary,
        explanation: llm.explanation,
        source: "llm".into(),
        highlights: llm.highlights,
        suggest_publish_ids: llm.suggest_publish_ids,
    })
}

pub async fn resolve_discovery_insight(discovery: &[App]) -> DiscoveryInsight {
    if let Some(cfg) = llm_config_from_env() {
        if let Some(insight) = llm_discovery_insight(discovery, &cfg).await {
            return insight;
        }
    }
    rule_discovery_insight(discovery)
}

pub fn rule_namespace_insight(namespace: &str, apps: &[App]) -> NamespaceInsight {
    let in_ns: Vec<_> = apps.iter().filter(|a| a.namespace == namespace).collect();
    if in_ns.is_empty() {
        return NamespaceInsight {
            namespace: namespace.into(),
            summary: format!("No services found in namespace {namespace}."),
            explanation: "Hermes has not discovered apps in this namespace yet, or your workspace filter excludes them.".into(),
            source: "rules".into(),
            highlights: vec![],
            focus_app_ids: vec![],
        };
    }

    let unhealthy: Vec<_> = in_ns.iter().filter(|a| a.status != "healthy").collect();
    let broken = unhealthy.iter().filter(|a| a.status == "broken").count();
    let degraded = unhealthy.iter().filter(|a| a.status == "degraded").count();
    let published = in_ns.iter().filter(|a| a.visibility.published).count();
    let mut highlights = Vec::new();
    if broken > 0 {
        highlights.push(format!("{broken} broken service(s) in {namespace}"));
    }
    if degraded > 0 {
        highlights.push(format!("{degraded} degraded service(s) in {namespace}"));
    }
    if published < in_ns.len() {
        highlights.push(format!("{} of {} services unpublished", in_ns.len() - published, in_ns.len()));
    }

    let focus_app_ids: Vec<String> = unhealthy
        .iter()
        .take(5)
        .map(|a| a.id.clone())
        .collect();

    let summary = if unhealthy.is_empty() {
        format!("Namespace {namespace} is healthy — {} service(s), {published} published.", in_ns.len())
    } else {
        format!(
            "Namespace {namespace}: {} of {} services need attention ({} broken, {} degraded).",
            unhealthy.len(),
            in_ns.len(),
            broken,
            degraded
        )
    };

    let explanation = if unhealthy.is_empty() {
        format!("All {namespace} services passed latest probes. Use Mission Control or Graph to monitor drift.")
    } else {
        format!(
            "Start with broken apps in {namespace}, then verify dependencies and unpublished services blocking downstream health."
        )
    };

    NamespaceInsight {
        namespace: namespace.into(),
        summary,
        explanation,
        source: "rules".into(),
        highlights,
        focus_app_ids,
    }
}

async fn llm_namespace_insight(namespace: &str, apps: &[App], cfg: &LlmConfig) -> Option<NamespaceInsight> {
    let in_ns: Vec<_> = apps
        .iter()
        .filter(|a| a.namespace == namespace)
        .take(25)
        .map(|a| {
            serde_json::json!({
                "id": a.id,
                "name": a.display_name,
                "status": a.status,
                "statusMessage": a.status_message,
                "published": a.visibility.published,
                "dependsOn": a.meta.depends_on,
            })
        })
        .collect();
    if in_ns.is_empty() {
        return None;
    }
    let system = "You are Zyra AI namespace analyst for Hermes. Return JSON only: {\"summary\":\"one line\",\"explanation\":\"2-3 sentences\",\"highlights\":[\"bullet\"],\"focusAppIds\":[\"app-id\"]}.";
    let user = format!(
        "Summarize namespace {namespace}:\n{}",
        serde_json::to_string_pretty(&in_ns).ok()?
    );
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LlmNamespaceInsight {
        summary: String,
        explanation: String,
        #[serde(default)]
        highlights: Vec<String>,
        #[serde(default, alias = "focusAppIds")]
        focus_app_ids: Vec<String>,
    }
    let llm: LlmNamespaceInsight = llm_chat_json(cfg, system, &user).await?;
    if llm.summary.trim().is_empty() {
        return None;
    }
    Some(NamespaceInsight {
        namespace: namespace.into(),
        summary: llm.summary,
        explanation: llm.explanation,
        source: "llm".into(),
        highlights: llm.highlights,
        focus_app_ids: llm.focus_app_ids,
    })
}

pub async fn resolve_namespace_insight(namespace: &str, apps: &[App]) -> NamespaceInsight {
    if let Some(cfg) = llm_config_from_env() {
        if let Some(insight) = llm_namespace_insight(namespace, apps, &cfg).await {
            return insight;
        }
    }
    rule_namespace_insight(namespace, apps)
}

pub fn rule_graph_insight(graph: &AppGraph) -> GraphInsight {
    let unresolved: Vec<_> = graph.edges.iter().filter(|e| !e.resolved).collect();
    let node_status: std::collections::HashMap<&str, &str> =
        graph.nodes.iter().map(|n| (n.id.as_str(), n.status.as_str())).collect();

    let mut focus = Vec::new();
    for edge in &unresolved {
        if node_status.get(edge.to.as_str()) == Some(&"broken") || node_status.get(edge.to.as_str()) == Some(&"degraded") {
            focus.push(edge.to.clone());
        }
        if node_status.get(edge.from.as_str()) == Some(&"broken") {
            focus.push(edge.from.clone());
        }
    }
    focus.sort();
    focus.dedup();
    focus.truncate(6);

    let mut highlights = Vec::new();
    if !unresolved.is_empty() {
        highlights.push(format!("{} unresolved dependency link(s)", unresolved.len()));
    }
    let broken_targets = unresolved
        .iter()
        .filter(|e| node_status.get(e.to.as_str()) == Some(&"broken"))
        .count();
    if broken_targets > 0 {
        highlights.push(format!("{broken_targets} broken downstream consumer(s)"));
    }
    let mesh_nodes = graph.nodes.iter().filter(|n| !n.mesh_routes.is_empty()).count();
    if mesh_nodes > 0 {
        highlights.push(format!("{mesh_nodes} service(s) expose mesh routes"));
    }

    let summary = if unresolved.is_empty() {
        format!(
            "Dependency graph is clean — {} apps with {} resolved links.",
            graph.nodes.len(),
            graph.edges.len()
        )
    } else {
        format!(
            "{} unresolved dependency link(s) across {} apps — inspect downstream consumers first.",
            unresolved.len(),
            graph.nodes.len()
        )
    };

    let explanation = if unresolved.is_empty() {
        "Published catalog dependencies are mapped and resolved. Use filters to inspect mesh-only or broken subgraphs.".into()
    } else {
        "Hermes found dependency edges that do not resolve to healthy catalog apps. Broken downstream services often indicate upstream or routing failures.".into()
    };

    GraphInsight {
        summary,
        explanation,
        source: "rules".into(),
        highlights,
        focus_app_ids: focus,
    }
}

async fn llm_graph_insight(graph: &AppGraph, cfg: &LlmConfig) -> Option<GraphInsight> {
    let unresolved: Vec<_> = graph
        .edges
        .iter()
        .filter(|e| !e.resolved)
        .take(20)
        .map(|e| serde_json::json!({"from": e.from, "to": e.to, "label": e.label}))
        .collect();
    let broken: Vec<_> = graph
        .nodes
        .iter()
        .filter(|n| n.status != "healthy")
        .take(20)
        .map(|n| serde_json::json!({"id": n.id, "label": n.label, "status": n.status, "namespace": n.namespace}))
        .collect();
    let context = serde_json::json!({ "unresolvedEdges": unresolved, "unhealthyNodes": broken });
    let system = "You are Zyra AI topology analyst for Hermes. Return JSON only: {\"summary\":\"one line\",\"explanation\":\"2-3 sentences\",\"highlights\":[\"bullet\"],\"focusAppIds\":[\"app-id\"]}. Prioritize broken downstream dependencies.";
    let user = format!("Analyze dependency graph:\n{}", serde_json::to_string_pretty(&context).ok()?);
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LlmGraphInsight {
        summary: String,
        explanation: String,
        #[serde(default)]
        highlights: Vec<String>,
        #[serde(default, alias = "focusAppIds")]
        focus_app_ids: Vec<String>,
    }
    let llm: LlmGraphInsight = llm_chat_json(cfg, system, &user).await?;
    if llm.summary.trim().is_empty() {
        return None;
    }
    Some(GraphInsight {
        summary: llm.summary,
        explanation: llm.explanation,
        source: "llm".into(),
        highlights: llm.highlights,
        focus_app_ids: llm.focus_app_ids,
    })
}

pub async fn resolve_graph_insight(graph: &AppGraph) -> GraphInsight {
    if let Some(cfg) = llm_config_from_env() {
        if let Some(insight) = llm_graph_insight(graph, &cfg).await {
            return insight;
        }
    }
    rule_graph_insight(graph)
}

pub fn rule_owner_insight(owner: &str, apps: &[App]) -> OwnerInsight {
    let needle = owner.to_lowercase();
    let owned: Vec<_> = apps
        .iter()
        .filter(|a| a.meta.owner.to_lowercase() == needle)
        .collect();
    if owned.is_empty() {
        return OwnerInsight {
            owner: owner.into(),
            summary: format!("No services owned by {owner}."),
            explanation: "Add hermes.zyvor.dev/owner annotations or check the owner spelling.".into(),
            source: "rules".into(),
            highlights: vec![],
            focus_app_ids: vec![],
        };
    }

    let unhealthy: Vec<_> = owned.iter().filter(|a| a.status != "healthy").collect();
    let broken = unhealthy.iter().filter(|a| a.status == "broken").count();
    let degraded = unhealthy.iter().filter(|a| a.status == "degraded").count();
    let published = owned.iter().filter(|a| a.visibility.published).count();
    let recommended = owned.iter().filter(|a| a.meta.recommended).count();
    let mut highlights = Vec::new();
    if broken > 0 {
        highlights.push(format!("{broken} broken service(s) owned by {owner}"));
    }
    if recommended > 0 {
        highlights.push(format!("{recommended} team pick(s)"));
    }
    if published < owned.len() {
        highlights.push(format!("{} unpublished", owned.len() - published));
    }

    let focus_app_ids: Vec<String> = unhealthy.iter().take(5).map(|a| a.id.clone()).collect();
    let summary = if unhealthy.is_empty() {
        format!("Team {owner} owns {} healthy service(s).", owned.len())
    } else {
        format!(
            "Team {owner}: {} of {} services need attention ({} broken, {} degraded).",
            unhealthy.len(),
            owned.len(),
            broken,
            degraded
        )
    };
    let explanation = if unhealthy.is_empty() {
        format!("All services owned by {owner} passed latest probes.")
    } else {
        format!("Review {owner}'s broken apps first, then check shared dependencies and unpublished services.")
    };

    OwnerInsight {
        owner: owner.into(),
        summary,
        explanation,
        source: "rules".into(),
        highlights,
        focus_app_ids,
    }
}

async fn llm_owner_insight(owner: &str, apps: &[App], cfg: &LlmConfig) -> Option<OwnerInsight> {
    let needle = owner.to_lowercase();
    let sample: Vec<_> = apps
        .iter()
        .filter(|a| a.meta.owner.to_lowercase() == needle)
        .take(25)
        .map(|a| {
            serde_json::json!({
                "id": a.id,
                "name": a.display_name,
                "status": a.status,
                "namespace": a.namespace,
                "published": a.visibility.published,
                "recommended": a.meta.recommended,
            })
        })
        .collect();
    if sample.is_empty() {
        return None;
    }
    let system = "You are Zyra AI team analyst for Hermes. Return JSON only: {\"summary\":\"one line\",\"explanation\":\"2-3 sentences\",\"highlights\":[\"bullet\"],\"focusAppIds\":[\"app-id\"]}.";
    let user = format!("Summarize owner team {owner}:\n{}", serde_json::to_string_pretty(&sample).ok()?);
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LlmOwnerInsight {
        summary: String,
        explanation: String,
        #[serde(default)]
        highlights: Vec<String>,
        #[serde(default, alias = "focusAppIds")]
        focus_app_ids: Vec<String>,
    }
    let llm: LlmOwnerInsight = llm_chat_json(cfg, system, &user).await?;
    if llm.summary.trim().is_empty() {
        return None;
    }
    Some(OwnerInsight {
        owner: owner.into(),
        summary: llm.summary,
        explanation: llm.explanation,
        source: "llm".into(),
        highlights: llm.highlights,
        focus_app_ids: llm.focus_app_ids,
    })
}

pub async fn resolve_owner_insight(owner: &str, apps: &[App]) -> OwnerInsight {
    if let Some(cfg) = llm_config_from_env() {
        if let Some(insight) = llm_owner_insight(owner, apps, &cfg).await {
            return insight;
        }
    }
    rule_owner_insight(owner, apps)
}

pub fn rule_federated_insight(entries: &[FederatedApp]) -> FederatedInsight {
    if entries.is_empty() {
        return FederatedInsight {
            summary: "No federated apps in catalog.".into(),
            explanation: "Configure HERMES_FEDERATED_CLUSTERS to merge remote cluster catalogs into Hermes.".into(),
            source: "rules".into(),
            highlights: vec!["Add peer cluster URLs in Helm values or HERMES_FEDERATED_CLUSTERS".into()],
            focus_app_ids: vec![],
        };
    }

    let mut cluster_ids = std::collections::BTreeSet::new();
    for entry in entries {
        cluster_ids.insert(entry.cluster_id.as_str());
    }
    let unhealthy: Vec<_> = entries.iter().filter(|e| e.app.status != "healthy").collect();
    let broken = unhealthy.iter().filter(|e| e.app.status == "broken").count();

    let summary = if unhealthy.is_empty() {
        format!(
            "{} federated app(s) across {} cluster(s) are healthy.",
            entries.len(),
            cluster_ids.len()
        )
    } else {
        format!(
            "{} of {} federated services need attention ({} broken).",
            unhealthy.len(),
            entries.len(),
            broken
        )
    };

    let explanation = if unhealthy.is_empty() {
        "Remote catalogs merged successfully. Use write federation to publish across peer clusters.".into()
    } else {
        "Inspect unhealthy remote services on their origin cluster before cross-cluster publish or dependency changes.".into()
    };

    let mut highlights: Vec<String> = unhealthy
        .iter()
        .map(|e| format!("{} · {} ({})", e.app.display_name, e.cluster_name, e.app.status))
        .take(4)
        .collect();
    if highlights.is_empty() {
        highlights.push(format!("{} read-only peer cluster(s) synced", cluster_ids.len()));
    }

    let focus_app_ids: Vec<String> = unhealthy
        .iter()
        .map(|e| e.app.id.clone())
        .take(6)
        .collect();

    FederatedInsight {
        summary,
        explanation,
        source: "rules".into(),
        highlights,
        focus_app_ids,
    }
}

async fn llm_federated_insight(entries: &[FederatedApp], cfg: &LlmConfig) -> Option<FederatedInsight> {
    let sample: Vec<_> = entries
        .iter()
        .take(40)
        .map(|e| {
            serde_json::json!({
                "id": e.app.id,
                "name": e.app.display_name,
                "clusterId": e.cluster_id,
                "clusterName": e.cluster_name,
                "status": e.app.status,
                "namespace": e.app.namespace,
            })
        })
        .collect();
    let system = "You are Zyra AI federation analyst for Hermes. Return JSON only: {\"summary\":\"one line\",\"explanation\":\"2-4 sentences\",\"highlights\":[\"bullet\"],\"focusAppIds\":[\"app-id\"]}. Prioritize unhealthy remote services.";
    let user = format!("Federated catalog:\n{}", serde_json::to_string_pretty(&sample).ok()?);
    let llm: LlmFleetInsight = llm_chat_json(cfg, system, &user).await?;
    if llm.summary.trim().is_empty() {
        return None;
    }
    Some(FederatedInsight {
        summary: llm.summary,
        explanation: llm.explanation,
        source: "llm".into(),
        highlights: llm.highlights,
        focus_app_ids: llm.focus_app_ids,
    })
}

pub async fn resolve_federated_insight(entries: &[FederatedApp]) -> FederatedInsight {
    if let Some(cfg) = llm_config_from_env() {
        if let Some(insight) = llm_federated_insight(entries, &cfg).await {
            return insight;
        }
    }
    rule_federated_insight(entries)
}

pub fn rule_activity_insight(events: &[AuditEvent]) -> ActivityInsight {
    if events.is_empty() {
        return ActivityInsight {
            summary: "No platform activity recorded yet.".into(),
            explanation: "Launches, discovery publishes, Spotlight searches, and share links will appear in the audit log.".into(),
            source: "rules".into(),
            highlights: vec!["Open an app from Quick Launch to seed activity".into()],
        };
    }

    let mut action_counts = std::collections::BTreeMap::<&str, usize>::new();
    for event in events {
        *action_counts.entry(event.action.as_str()).or_default() += 1;
    }

    let launches = *action_counts.get("launch").unwrap_or(&0) + *action_counts.get("recent").unwrap_or(&0);
    let discovery = action_counts
        .get("publish")
        .copied()
        .unwrap_or(0)
        + action_counts.get("publish_namespace").copied().unwrap_or(0);
    let searches = *action_counts.get("search").unwrap_or(&0);

    let summary = format!(
        "{} recent audit events — {} launches, {} discovery actions, {} searches.",
        events.len(),
        launches,
        discovery,
        searches
    );

    let explanation = if discovery > launches {
        "Discovery and publish activity is outpacing launches — review the Discovery queue and publish high-value services.".into()
    } else if launches > 0 {
        "Operators are actively launching services. Check Health if launch volume correlates with new unhealthy apps.".into()
    } else {
        "Most recent activity is search and catalog operations. Use Spotlight or Mission Control to drive launches.".into()
    };

    let mut ranked: Vec<_> = action_counts.iter().map(|(a, c)| (*a, *c)).collect();
    ranked.sort_by(|a, b| b.1.cmp(&a.1));
    let mut highlights: Vec<String> = ranked
        .iter()
        .take(4)
        .map(|(action, count)| format!("{action}: {count}"))
        .collect();
    if let Some(latest) = events.first() {
        highlights.insert(
            0,
            format!(
                "Latest: {} by {}{}",
                latest.action,
                latest.user_id,
                if latest.app_id.is_empty() {
                    String::new()
                } else {
                    format!(" on {}", latest.app_id)
                }
            ),
        );
    }

    ActivityInsight {
        summary,
        explanation,
        source: "rules".into(),
        highlights,
    }
}

async fn llm_activity_insight(events: &[AuditEvent], cfg: &LlmConfig) -> Option<ActivityInsight> {
    let sample: Vec<_> = events
        .iter()
        .take(50)
        .map(|e| {
            serde_json::json!({
                "action": e.action,
                "userId": e.user_id,
                "appId": e.app_id,
                "detail": e.detail,
                "createdAt": e.created_at,
            })
        })
        .collect();
    let system = "You are Zyra AI platform activity analyst for Hermes. Return JSON only: {\"summary\":\"one line\",\"explanation\":\"2-4 sentences\",\"highlights\":[\"bullet\"]}. Surface operator patterns and anomalies.";
    let user = format!("Recent audit events:\n{}", serde_json::to_string_pretty(&sample).ok()?);
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LlmActivityInsight {
        summary: String,
        explanation: String,
        #[serde(default)]
        highlights: Vec<String>,
    }
    let llm: LlmActivityInsight = llm_chat_json(cfg, system, &user).await?;
    if llm.summary.trim().is_empty() {
        return None;
    }
    Some(ActivityInsight {
        summary: llm.summary,
        explanation: llm.explanation,
        source: "llm".into(),
        highlights: llm.highlights,
    })
}

pub async fn resolve_activity_insight(events: &[AuditEvent]) -> ActivityInsight {
    if let Some(cfg) = llm_config_from_env() {
        if let Some(insight) = llm_activity_insight(events, &cfg).await {
            return insight;
        }
    }
    rule_activity_insight(events)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Backend, Visibility};

    fn sample_app(id: &str, status: &str, owner: &str) -> App {
        App {
            id: id.into(),
            slug: id.into(),
            canonical_slug: id.into(),
            display_name: id.into(),
            description: String::new(),
            category: "infra".into(),
            namespace: "hermes-demo".into(),
            route_path: format!("/launchpad/{id}"),
            public_url: String::new(),
            icon: String::new(),
            status: status.into(),
            status_message: String::new(),
            score: 0,
            rewrite: Default::default(),
            ready_endpoints: 1,
            source: "discovered".into(),
            auth_mode: "none".into(),
            backend: Backend {
                kind: "service".into(),
                name: id.into(),
                port: 80,
                scheme: "http".into(),
                path: "/".into(),
            },
            visibility: Visibility { published: true, ..Default::default() },
            meta: crate::AppMeta {
                owner: owner.into(),
                ..Default::default()
            },
            updated_at: String::new(),
        }
    }

    #[test]
    fn graph_insight_flags_unresolved_edges() {
        let graph = AppGraph {
            nodes: vec![
                crate::GraphNode {
                    id: "a".into(),
                    label: "A".into(),
                    category: "infra".into(),
                    status: "healthy".into(),
                    namespace: "ns".into(),
                    owner: String::new(),
                    icon: String::new(),
                    mesh_routes: vec![],
                },
                crate::GraphNode {
                    id: "b".into(),
                    label: "B".into(),
                    category: "infra".into(),
                    status: "broken".into(),
                    namespace: "ns".into(),
                    owner: String::new(),
                    icon: String::new(),
                    mesh_routes: vec![],
                },
            ],
            edges: vec![crate::GraphEdge {
                from: "a".into(),
                to: "b".into(),
                label: "depends".into(),
                resolved: false,
            }],
        };
        let insight = rule_graph_insight(&graph);
        assert!(insight.summary.contains("unresolved"));
        assert!(insight.focus_app_ids.contains(&"b".into()));
    }

    #[test]
    fn owner_insight_summarizes_unhealthy_team() {
        let apps = vec![
            sample_app("hermes-demo/ok", "healthy", "platform"),
            sample_app("hermes-demo/bad", "broken", "platform"),
        ];
        let insight = rule_owner_insight("platform", &apps);
        assert!(insight.summary.contains("need attention"));
        assert_eq!(insight.focus_app_ids, vec!["hermes-demo/bad".to_string()]);
    }
}
