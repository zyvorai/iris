// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use serde::{Deserialize, Serialize};

use crate::cluster::{federated_cluster_configs, local_cluster, FederatedClusterConfig};
use crate::{App, AuditEvent, Backend, Visibility};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FederationActionResult {
    pub cluster_id: String,
    pub cluster_name: String,
    pub ok: bool,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FederationRbacStatus {
    pub cluster_id: String,
    pub cluster_name: String,
    pub ok: bool,
    pub user_id: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub allowed_actions: Vec<String>,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub detail: String,
}

pub fn federation_cluster(cluster_id: &str) -> Option<FederatedClusterConfig> {
    federated_cluster_configs()
        .into_iter()
        .find(|c| c.id == cluster_id)
}

fn federation_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

fn apply_federation_auth(
    req: reqwest::RequestBuilder,
    cfg: &FederatedClusterConfig,
    user: &str,
    groups: &[String],
) -> reqwest::RequestBuilder {
    let mut rb = req.header("x-hermes-user", user);
    if !groups.is_empty() {
        rb = rb.header("x-hermes-groups", groups.join(","));
    }
    if !cfg.api_key.is_empty() {
        rb = rb.header("x-hermes-key", cfg.api_key.as_str());
    }
    rb
}

fn percent_encode_segment(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

fn encode_path_segment(s: &str) -> String {
    percent_encode_segment(s)
}

fn encode_app_path(id: &str) -> String {
    id.split('/')
        .map(encode_path_segment)
        .collect::<Vec<_>>()
        .join("/")
}

pub async fn remote_publish(
    cfg: &FederatedClusterConfig,
    app_id: &str,
    user: &str,
    groups: &[String],
) -> FederationActionResult {
    if !cfg.write_enabled {
        return FederationActionResult {
            cluster_id: cfg.id.clone(),
            cluster_name: cfg.name.clone(),
            ok: false,
            detail: "write not enabled for cluster".into(),
        };
    }
    let url = format!(
        "{}/api/v1/discovery/publish/{}",
        cfg.url.trim_end_matches('/'),
        encode_app_path(app_id)
    );
    let client = federation_client();
    let req = apply_federation_auth(client.post(url), cfg, user, groups);
    match req.send().await {
        Ok(resp) if resp.status().is_success() => FederationActionResult {
            cluster_id: cfg.id.clone(),
            cluster_name: cfg.name.clone(),
            ok: true,
            detail: format!("published {app_id}"),
        },
        Ok(resp) => FederationActionResult {
            cluster_id: cfg.id.clone(),
            cluster_name: cfg.name.clone(),
            ok: false,
            detail: format!("remote status {}", resp.status()),
        },
        Err(e) => FederationActionResult {
            cluster_id: cfg.id.clone(),
            cluster_name: cfg.name.clone(),
            ok: false,
            detail: e.to_string(),
        },
    }
}

pub async fn remote_publish_namespace(
    cfg: &FederatedClusterConfig,
    namespace: &str,
    user: &str,
    groups: &[String],
) -> FederationActionResult {
    if !cfg.write_enabled {
        return FederationActionResult {
            cluster_id: cfg.id.clone(),
            cluster_name: cfg.name.clone(),
            ok: false,
            detail: "write not enabled for cluster".into(),
        };
    }
    let url = format!(
        "{}/api/v1/discovery/publish-namespace/{}",
        cfg.url.trim_end_matches('/'),
        encode_path_segment(namespace)
    );
    let client = federation_client();
    let req = apply_federation_auth(client.post(url), cfg, user, groups);
    match req.send().await {
        Ok(resp) if resp.status().is_success() => {
            let detail = resp.text().await.unwrap_or_default();
            FederationActionResult {
                cluster_id: cfg.id.clone(),
                cluster_name: cfg.name.clone(),
                ok: true,
                detail,
            }
        }
        Ok(resp) => FederationActionResult {
            cluster_id: cfg.id.clone(),
            cluster_name: cfg.name.clone(),
            ok: false,
            detail: format!("remote status {}", resp.status()),
        },
        Err(e) => FederationActionResult {
            cluster_id: cfg.id.clone(),
            cluster_name: cfg.name.clone(),
            ok: false,
            detail: e.to_string(),
        },
    }
}

pub async fn remote_set_recommended(
    cfg: &FederatedClusterConfig,
    app_id: &str,
    recommended: bool,
    user: &str,
    groups: &[String],
) -> FederationActionResult {
    if !cfg.write_enabled {
        return FederationActionResult {
            cluster_id: cfg.id.clone(),
            cluster_name: cfg.name.clone(),
            ok: false,
            detail: "write not enabled for cluster".into(),
        };
    }
    let url = format!(
        "{}/api/v1/recommended/{}",
        cfg.url.trim_end_matches('/'),
        encode_app_path(app_id)
    );
    let client = federation_client();
    let req = apply_federation_auth(
        client.put(url).json(&serde_json::json!({ "recommended": recommended })),
        cfg,
        user,
        groups,
    );
    match req.send().await {
        Ok(resp) if resp.status().is_success() => FederationActionResult {
            cluster_id: cfg.id.clone(),
            cluster_name: cfg.name.clone(),
            ok: true,
            detail: format!("recommended={recommended} for {app_id}"),
        },
        Ok(resp) => FederationActionResult {
            cluster_id: cfg.id.clone(),
            cluster_name: cfg.name.clone(),
            ok: false,
            detail: format!("remote status {}", resp.status()),
        },
        Err(e) => FederationActionResult {
            cluster_id: cfg.id.clone(),
            cluster_name: cfg.name.clone(),
            ok: false,
            detail: e.to_string(),
        },
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteAuthMe {
    #[serde(default)]
    user_id: String,
    #[serde(default)]
    allowed_actions: Vec<String>,
}

pub async fn remote_rbac_check(
    cfg: &FederatedClusterConfig,
    user: &str,
    groups: &[String],
) -> FederationRbacStatus {
    let url = format!("{}/auth/me", cfg.url.trim_end_matches('/'));
    let client = federation_client();
    let req = apply_federation_auth(client.get(url), cfg, user, groups);
    match req.send().await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(body) = resp.json::<RemoteAuthMe>().await {
                let ok = body.allowed_actions.iter().any(|a| a == "publish" || a == "admin" || a == "*");
                return FederationRbacStatus {
                    cluster_id: cfg.id.clone(),
                    cluster_name: cfg.name.clone(),
                    ok,
                    user_id: if body.user_id.is_empty() {
                        user.into()
                    } else {
                        body.user_id
                    },
                    allowed_actions: body.allowed_actions,
                    detail: if ok {
                        "publish allowed on remote".into()
                    } else {
                        "publish not allowed on remote".into()
                    },
                };
            }
            FederationRbacStatus {
                cluster_id: cfg.id.clone(),
                cluster_name: cfg.name.clone(),
                ok: false,
                user_id: user.into(),
                allowed_actions: vec![],
                detail: "invalid auth/me response".into(),
            }
        }
        Ok(resp) => FederationRbacStatus {
            cluster_id: cfg.id.clone(),
            cluster_name: cfg.name.clone(),
            ok: false,
            user_id: user.into(),
            allowed_actions: vec![],
            detail: format!("remote status {}", resp.status()),
        },
        Err(e) => FederationRbacStatus {
            cluster_id: cfg.id.clone(),
            cluster_name: cfg.name.clone(),
            ok: false,
            user_id: user.into(),
            allowed_actions: vec![],
            detail: e.to_string(),
        },
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FederatedApp {
    #[serde(flatten)]
    pub app: App,
    pub cluster_id: String,
    pub cluster_name: String,
}

pub async fn build_federated_catalog(local_apps: &[App]) -> Vec<FederatedApp> {
    let local = local_cluster(local_apps);
    let mut out: Vec<FederatedApp> = local_apps
        .iter()
        .map(|app| FederatedApp {
            app: app.clone(),
            cluster_id: local.id.clone(),
            cluster_name: local.name.clone(),
        })
        .collect();

    let remotes = federated_cluster_configs();
    if remotes.is_empty() {
        return out;
    }
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(6))
        .build()
    {
        Ok(c) => c,
        Err(_) => return out,
    };
    for cfg in remotes {
        let url = format!("{}/api/v1/catalog", cfg.url.trim_end_matches('/'));
        match client.get(url).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(apps) = resp.json::<Vec<App>>().await {
                    out.extend(apps.into_iter().map(|app| FederatedApp {
                        app,
                        cluster_id: cfg.id.clone(),
                        cluster_name: cfg.name.clone(),
                    }));
                }
            }
            _ => {
                out.push(FederatedApp {
                    app: placeholder_cluster_app(&cfg),
                    cluster_id: cfg.id.clone(),
                    cluster_name: cfg.name.clone(),
                });
            }
        }
    }
    out
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FederatedAuditEvent {
    pub id: i64,
    pub user_id: String,
    pub action: String,
    pub app_id: String,
    pub detail: String,
    pub created_at: String,
    pub cluster_id: String,
    pub cluster_name: String,
}

pub async fn build_federated_audit(local_events: Vec<AuditEvent>, limit: usize) -> Vec<FederatedAuditEvent> {
    let local_id = std::env::var("HERMES_CLUSTER_ID").unwrap_or_else(|_| "local".into());
    let local_name = std::env::var("HERMES_CLUSTER_NAME").unwrap_or_else(|_| "Local cluster".into());
    let per_cluster = limit.max(20).min(500);
    let mut out: Vec<FederatedAuditEvent> = local_events
        .into_iter()
        .take(per_cluster)
        .map(|event| FederatedAuditEvent {
            id: event.id,
            user_id: event.user_id,
            action: event.action,
            app_id: event.app_id,
            detail: event.detail,
            created_at: event.created_at,
            cluster_id: local_id.clone(),
            cluster_name: local_name.clone(),
        })
        .collect();

    let remotes = federated_cluster_configs();
    if remotes.is_empty() {
        out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        out.truncate(limit);
        return out;
    }

    let client = federation_client();

    for cfg in remotes {
        let url = format!(
            "{}/api/v1/audit?limit={}",
            cfg.url.trim_end_matches('/'),
            per_cluster
        );
        let req = apply_federation_auth(client.get(url), &cfg, "federation-audit", &[]);
        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(events) = resp.json::<Vec<AuditEvent>>().await {
                    for (idx, event) in events.into_iter().enumerate() {
                        out.push(FederatedAuditEvent {
                            id: -(idx as i64 + 1),
                            user_id: event.user_id,
                            action: event.action,
                            app_id: event.app_id,
                            detail: event.detail,
                            created_at: event.created_at,
                            cluster_id: cfg.id.clone(),
                            cluster_name: cfg.name.clone(),
                        });
                    }
                }
            }
            _ => {
                out.push(FederatedAuditEvent {
                    id: -9_000,
                    user_id: String::new(),
                    action: "cluster_offline".into(),
                    app_id: String::new(),
                    detail: format!("Could not fetch audit from {}", cfg.url),
                    created_at: String::new(),
                    cluster_id: cfg.id.clone(),
                    cluster_name: cfg.name.clone(),
                });
            }
        }
    }

    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    out.truncate(limit);
    out
}

fn placeholder_cluster_app(cfg: &crate::FederatedClusterConfig) -> App {
    App {
        id: format!("{}/__offline__", cfg.id),
        slug: "__offline__".into(),
        canonical_slug: String::new(),
        display_name: format!("{} (offline)", cfg.name),
        description: "Remote cluster unreachable".into(),
        namespace: cfg.id.clone(),
        category: "Cluster".into(),
        icon: "server".into(),
        backend: Backend {
            kind: "Cluster".into(),
            name: cfg.id.clone(),
            port: 443,
            scheme: "https".into(),
            path: "/".into(),
        },
        route_path: String::new(),
        public_url: cfg.url.clone(),
        status: "broken".into(),
        status_message: "Could not fetch remote catalog".into(),
        source: "federation".into(),
        auth_mode: "none".into(),
        score: 0,
        visibility: Visibility {
            published: true,
            hidden: false,
            favorite: false,
        },
        rewrite: Default::default(),
        ready_endpoints: 0,
        updated_at: String::new(),
        meta: Default::default(),
    }
}
