// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use serde::{Deserialize, Serialize};

use crate::cluster::local_cluster;
use crate::{federated_cluster_configs, App, Backend, Visibility};

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
