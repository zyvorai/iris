// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use serde::{Deserialize, Serialize};

use crate::cluster::{federated_cluster_configs, local_cluster, FederatedClusterConfig};
use crate::{App, Backend, Visibility};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FederationActionResult {
    pub cluster_id: String,
    pub cluster_name: String,
    pub ok: bool,
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
) -> reqwest::RequestBuilder {
    let mut rb = req.header("x-hermes-user", user);
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
    let req = apply_federation_auth(client.post(url), cfg, user);
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
    let req = apply_federation_auth(client.post(url), cfg, user);
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
