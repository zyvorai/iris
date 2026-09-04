// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

use serde::{Deserialize, Serialize};

use crate::{App, Backend};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosisChainNode {
    pub id: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SuggestedAction {
    pub label: String,
    pub href: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppDiagnosis {
    pub app_id: String,
    pub route_path: String,
    pub public_url: String,
    pub backend: Backend,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub problem: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub cause: String,
    pub chain: Vec<DiagnosisChainNode>,
    pub suggested_actions: Vec<SuggestedAction>,
}

pub fn build_diagnosis(app: &App) -> AppDiagnosis {
    let slug = if app.canonical_slug.is_empty() {
        app.slug.as_str()
    } else {
        app.canonical_slug.as_str()
    };
    let mut chain = vec![
        DiagnosisChainNode {
            id: "user".into(),
            label: "User".into(),
            status: String::new(),
        },
        DiagnosisChainNode {
            id: "identity".into(),
            label: "Zeus Identity".into(),
            status: String::new(),
        },
        DiagnosisChainNode {
            id: "gateway".into(),
            label: "Hermes Gateway".into(),
            status: String::new(),
        },
        DiagnosisChainNode {
            id: "approute".into(),
            label: format!("AppRoute: {slug}"),
            status: String::new(),
        },
        DiagnosisChainNode {
            id: "namespace".into(),
            label: format!("Namespace: {}", app.namespace),
            status: String::new(),
        },
    ];

    let svc_label = format!("{}:{}", app.backend.name, app.backend.port);
    let mut svc_status = app.status.clone();
    if app.ready_endpoints == 0 {
        svc_status = "broken".into();
    }
    chain.push(DiagnosisChainNode {
        id: "service".into(),
        label: format!("Service {svc_label}"),
        status: svc_status,
    });

    let mut problem = String::new();
    let mut cause = String::new();
    if app.status != "healthy" {
        problem = app.status_message.clone();
        if problem.is_empty() {
            problem = match app.status.as_str() {
                "broken" => "Backend unavailable".into(),
                "degraded" => "Backend degraded".into(),
                _ => "Health check failed".into(),
            };
        }
        if app.ready_endpoints == 0 {
            cause = "Service exists but has no ready endpoints".into();
        }
    }

    let ns = app.namespace.replace(' ', "%20");
    let mut suggested_actions = vec![
        SuggestedAction {
            label: "View in cluster catalog".into(),
            href: format!("/cluster?ns={ns}"),
        },
        SuggestedAction {
            label: "Open dependency graph".into(),
            href: "/graph".into(),
        },
    ];
    if app.ready_endpoints == 0 || app.status != "healthy" {
        suggested_actions.push(SuggestedAction {
            label: "Copy kubectl pod check".into(),
            href: format!(
                "#copy:kubectl get pods -n {} -l app.kubernetes.io/name={}",
                app.namespace, app.backend.name
            ),
        });
    }
    suggested_actions.push(SuggestedAction {
        label: "Open Kubernetes workloads".into(),
        href: format!("/k8s/workloads?ns={ns}"),
    });

    if !app.meta.ingress_hosts.is_empty() {
        let host = app.meta.ingress_hosts[0].clone();
        let href = if host.starts_with("http") {
            host.clone()
        } else {
            format!("https://{host}")
        };
        suggested_actions.insert(
            0,
            SuggestedAction {
                label: format!("Open ingress: {host}"),
                href,
            },
        );
    }

    AppDiagnosis {
        app_id: app.id.clone(),
        route_path: app.route_path.clone(),
        public_url: app.public_url.clone(),
        backend: app.backend.clone(),
        problem,
        cause,
        chain,
        suggested_actions,
    }
}
