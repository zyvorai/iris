// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Backend {
    pub kind: String,
    pub name: String,
    pub port: i32,
    pub scheme: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Visibility {
    #[serde(default)]
    pub published: bool,
    #[serde(default)]
    pub hidden: bool,
    #[serde(default)]
    pub favorite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Rewrite {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub strip_prefix: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub add_prefix: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct MeshPolicy {
    pub kind: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub name: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub namespace: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub hosts: Vec<String>,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub destination: String,
    #[serde(default)]
    pub weight: i32,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppMeta {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub environment: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub owner: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub depends_on: Vec<String>,
    #[serde(default)]
    pub recommended: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub ingress_hosts: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub mesh_routes: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub mesh_policies: Vec<MeshPolicy>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct App {
    pub id: String,
    pub slug: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub canonical_slug: String,
    pub display_name: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub description: String,
    pub namespace: String,
    pub category: String,
    pub icon: String,
    pub backend: Backend,
    pub route_path: String,
    pub public_url: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub status_message: String,
    pub source: String,
    pub auth_mode: String,
    #[serde(default)]
    pub score: i32,
    pub visibility: Visibility,
    #[serde(default)]
    pub rewrite: Rewrite,
    #[serde(default)]
    pub ready_endpoints: i32,
    pub updated_at: String,
    #[serde(default)]
    pub meta: AppMeta,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub app: App,
    pub score: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthSummary {
    pub total: usize,
    pub healthy: usize,
    pub degraded: usize,
    pub broken: usize,
    pub apps: Vec<App>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterSummary {
    pub total: usize,
    pub published: usize,
    pub discovery: usize,
    pub namespaces: usize,
    pub healthy: usize,
    pub degraded: usize,
    pub broken: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogStats {
    pub total: usize,
    pub published: usize,
    pub environments: Vec<LabelCount>,
    pub categories: Vec<LabelCount>,
    pub sources: Vec<LabelCount>,
    pub recommended: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelCount {
    pub label: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEvent {
    pub id: i64,
    pub user_id: String,
    pub action: String,
    pub app_id: String,
    pub detail: String,
    pub created_at: String,
}

/// Authenticated user id propagated from server auth middleware.
#[derive(Clone, Debug)]
pub struct CurrentUser(pub String);

pub mod cluster;
pub mod diagnosis;
pub mod federation;
pub mod graph;
pub mod insight;
pub mod intent;
pub mod k8s_rbac;
pub mod llm;
pub mod rbac;
pub mod share;
pub mod store;
pub mod workspace;
pub mod workspace_acl;

pub use cluster::{
    federated_cluster_configs, fetch_remote_cluster, list_clusters, list_clusters_with_federation,
    local_cluster, ClusterInfo, FederatedClusterConfig,
};
pub use workspace_acl::{
    allowed_workspaces, filter_apps_by_workspace, workspace_rules_from_env, WorkspaceRule,
};
pub use diagnosis::{build_diagnosis, AppDiagnosis, DiagnosisChainNode, SuggestedAction};
pub use graph::{build_graph, AppGraph, GraphEdge, GraphNode, resolve_dependency};
pub use federation::{
    build_federated_audit, build_federated_catalog, federation_cluster, remote_publish, remote_publish_namespace,
    remote_rbac_check, remote_set_recommended, FederatedApp, FederatedAuditEvent, FederationActionResult,
    FederationRbacStatus,
};
pub use insight::{
    resolve_app_insight, resolve_discovery_insight, resolve_fleet_insight, resolve_graph_insight,
    resolve_namespace_insight, resolve_owner_insight, resolve_federated_insight, resolve_activity_insight,
    AppInsight, DiscoveryInsight, FleetInsight, GraphInsight, NamespaceInsight, OwnerInsight,
    FederatedInsight, ActivityInsight,
};
pub use intent::{resolve_search_intent, SearchIntent};
pub use k8s_rbac::{k8s_rbac_enabled, namespace_allowed};
pub use llm::{ai_status, ai_status_with_probe, llm_chat_json, llm_config_from_env, llm_probe, resolve_search_with_llm, AiStatus, LlmConfig};
pub use rbac::{
    allowed_actions_for_groups, allowed_namespaces_for_groups, can_perform_action,
    role_rules_from_env, RoleRule,
};
pub use share::{CreateShareRequest, ShareLink, ShareLinkResponse};
pub use workspace::{build_team_owners, build_workspaces, TeamOwner, Workspace};
