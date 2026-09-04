// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

use serde::{Deserialize, Serialize};

use crate::App;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClusterInfo {
    pub id: String,
    pub name: String,
    pub app_count: usize,
    pub published: usize,
    pub healthy: usize,
    pub is_local: bool,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub url: String,
    #[serde(default = "default_cluster_status")]
    pub status: String,
    #[serde(default)]
    pub write_enabled: bool,
}

fn default_cluster_status() -> String {
    "online".into()
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FederatedClusterConfig {
    pub id: String,
    pub name: String,
    pub url: String,
    #[serde(default)]
    pub write_enabled: bool,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub api_key: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteClusterSummary {
    total: usize,
    published: usize,
    healthy: usize,
}

pub fn parse_federated_clusters(raw: &str) -> Vec<FederatedClusterConfig> {
    if raw.trim().is_empty() {
        return vec![];
    }
    serde_json::from_str(raw).unwrap_or_default()
}

pub fn federated_cluster_configs() -> Vec<FederatedClusterConfig> {
    std::env::var("HERMES_FEDERATED_CLUSTERS")
        .ok()
        .map(|raw| parse_federated_clusters(&raw))
        .unwrap_or_default()
}

pub fn local_cluster(apps: &[App]) -> ClusterInfo {
    let id = std::env::var("HERMES_CLUSTER_ID").unwrap_or_else(|_| "local".into());
    let name = std::env::var("HERMES_CLUSTER_NAME").unwrap_or_else(|_| "Local cluster".into());
    let mut published = 0usize;
    let mut healthy = 0usize;
    for app in apps {
        if app.visibility.published {
            published += 1;
        }
        if app.status == "healthy" {
            healthy += 1;
        }
    }
    ClusterInfo {
        id,
        name,
        app_count: apps.len(),
        published,
        healthy,
        is_local: true,
        url: String::new(),
        status: "online".into(),
        write_enabled: false,
    }
}

pub fn list_clusters(apps: &[App]) -> Vec<ClusterInfo> {
    vec![local_cluster(apps)]
}

pub fn offline_remote_cluster(cfg: &FederatedClusterConfig) -> ClusterInfo {
    ClusterInfo {
        id: cfg.id.clone(),
        name: cfg.name.clone(),
        app_count: 0,
        published: 0,
        healthy: 0,
        is_local: false,
        url: cfg.url.clone(),
        status: "offline".into(),
        write_enabled: cfg.write_enabled,
    }
}

fn remote_cluster_from_summary(cfg: &FederatedClusterConfig, summary: &RemoteClusterSummary) -> ClusterInfo {
    ClusterInfo {
        id: cfg.id.clone(),
        name: cfg.name.clone(),
        app_count: summary.total,
        published: summary.published,
        healthy: summary.healthy,
        is_local: false,
        url: cfg.url.clone(),
        status: "online".into(),
        write_enabled: cfg.write_enabled,
    }
}

pub async fn fetch_remote_cluster(
    client: &reqwest::Client,
    cfg: &FederatedClusterConfig,
) -> ClusterInfo {
    let url = format!(
        "{}/api/v1/cluster/summary",
        cfg.url.trim_end_matches('/')
    );
    match client.get(url).send().await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(summary) = resp.json::<RemoteClusterSummary>().await {
                return remote_cluster_from_summary(cfg, &summary);
            }
        }
        _ => {}
    }
    offline_remote_cluster(cfg)
}

pub async fn list_clusters_with_federation(apps: &[App]) -> Vec<ClusterInfo> {
    let mut clusters = list_clusters(apps);
    let remotes = federated_cluster_configs();
    if remotes.is_empty() {
        return clusters;
    }
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build()
    {
        Ok(c) => c,
        Err(_) => {
            clusters.extend(remotes.iter().map(offline_remote_cluster));
            return clusters;
        }
    };
    for cfg in remotes {
        clusters.push(fetch_remote_cluster(&client, &cfg).await);
    }
    clusters
}
