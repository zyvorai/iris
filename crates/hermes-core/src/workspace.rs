// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

use serde::{Deserialize, Serialize};

use crate::App;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub label: String,
    pub app_count: usize,
    pub published: usize,
    pub healthy: usize,
    pub degraded: usize,
    pub broken: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TeamOwner {
    pub id: String,
    pub label: String,
    pub app_count: usize,
    pub recommended: usize,
    pub unhealthy: usize,
}

pub fn build_workspaces(apps: &[App]) -> Vec<Workspace> {
    let mut map: std::collections::BTreeMap<String, Workspace> = std::collections::BTreeMap::new();
    for app in apps {
        let env = app.meta.environment.trim();
        if env.is_empty() {
            continue;
        }
        let entry = map.entry(env.to_string()).or_insert_with(|| Workspace {
            id: env.to_string(),
            label: title_case_env(env),
            app_count: 0,
            published: 0,
            healthy: 0,
            degraded: 0,
            broken: 0,
        });
        entry.app_count += 1;
        if app.visibility.published {
            entry.published += 1;
        }
        match app.status.as_str() {
            "healthy" => entry.healthy += 1,
            "degraded" => entry.degraded += 1,
            "broken" => entry.broken += 1,
            _ => {}
        }
    }
    map.into_values().collect()
}

pub fn build_team_owners(apps: &[App]) -> Vec<TeamOwner> {
    let mut map: std::collections::BTreeMap<String, TeamOwner> = std::collections::BTreeMap::new();
    for app in apps {
        let owner = app.meta.owner.trim();
        if owner.is_empty() {
            continue;
        }
        let entry = map.entry(owner.to_string()).or_insert_with(|| TeamOwner {
            id: owner.to_string(),
            label: owner.to_string(),
            app_count: 0,
            recommended: 0,
            unhealthy: 0,
        });
        entry.app_count += 1;
        if app.meta.recommended {
            entry.recommended += 1;
        }
        if app.status == "broken" || app.status == "degraded" {
            entry.unhealthy += 1;
        }
    }
    map.into_values().collect()
}

fn title_case_env(raw: &str) -> String {
    match raw {
        "production" | "prod" => "Production".into(),
        "staging" | "stage" => "Staging".into(),
        "development" | "dev" => "Development".into(),
        "testing" | "test" | "qa" => "Testing".into(),
        other => {
            let mut chars = other.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{AppMeta, Backend, Visibility};

    fn app(env: &str, owner: &str, status: &str) -> App {
        App {
            id: format!("ns/{env}"),
            slug: env.into(),
            canonical_slug: String::new(),
            display_name: env.into(),
            description: String::new(),
            namespace: "ns".into(),
            category: "Custom".into(),
            icon: "app".into(),
            backend: Backend {
                kind: "Service".into(),
                name: "svc".into(),
                port: 80,
                scheme: "http".into(),
                path: "/".into(),
            },
            route_path: "/a/ns/svc".into(),
            public_url: String::new(),
            status: status.into(),
            status_message: String::new(),
            source: "annotation".into(),
            auth_mode: "none".into(),
            score: 0,
            visibility: Visibility {
                published: true,
                hidden: false,
                favorite: false,
            },
            rewrite: Default::default(),
            ready_endpoints: 1,
            updated_at: String::new(),
            meta: AppMeta {
                environment: env.into(),
                owner: owner.into(),
                recommended: true,
                ..Default::default()
            },
        }
    }

    #[test]
    fn groups_workspaces_and_owners() {
        let apps = vec![
            app("production", "platform-team", "healthy"),
            app("staging", "gitops", "broken"),
        ];
        assert_eq!(build_workspaces(&apps).len(), 2);
        assert_eq!(build_team_owners(&apps).len(), 2);
    }
}
