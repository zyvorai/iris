// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

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
pub struct AppMeta {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub environment: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub owner: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub depends_on: Vec<String>,
    #[serde(default)]
    pub recommended: bool,
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

#[derive(Debug, Clone, Serialize)]
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

pub mod diagnosis;
pub mod graph;
pub mod share;
pub mod store;
pub mod workspace;

pub use diagnosis::{build_diagnosis, AppDiagnosis, DiagnosisChainNode, SuggestedAction};
pub use graph::{build_graph, AppGraph, GraphEdge, GraphNode, resolve_dependency};
pub use share::{CreateShareRequest, ShareLink, ShareLinkResponse};
pub use workspace::{build_team_owners, build_workspaces, TeamOwner, Workspace};
