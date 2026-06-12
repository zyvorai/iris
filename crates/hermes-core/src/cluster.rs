// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

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
    }
}

pub fn list_clusters(apps: &[App]) -> Vec<ClusterInfo> {
    vec![local_cluster(apps)]
}
