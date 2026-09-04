// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShareLink {
    pub token: String,
    pub app_id: String,
    pub created_by: String,
    pub expires_at: String,
    pub created_at: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateShareRequest {
    pub app_id: String,
    #[serde(default = "default_ttl_minutes")]
    pub ttl_minutes: i64,
    #[serde(default)]
    pub label: String,
}

fn default_ttl_minutes() -> i64 {
    30
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareLinkResponse {
    pub token: String,
    pub app_id: String,
    pub share_path: String,
    pub expires_at: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub label: String,
}
