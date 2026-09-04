// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

use serde::{Deserialize, Serialize};

use crate::App;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceRule {
    pub environment: String,
    #[serde(default)]
    pub groups: Vec<String>,
}

pub fn parse_workspace_rules(raw: &str) -> Vec<WorkspaceRule> {
    if raw.trim().is_empty() {
        return vec![];
    }
    serde_json::from_str(raw).unwrap_or_default()
}

pub fn workspace_rules_from_env() -> Vec<WorkspaceRule> {
    std::env::var("HERMES_WORKSPACE_RULES")
        .ok()
        .map(|raw| parse_workspace_rules(&raw))
        .unwrap_or_default()
}

pub fn user_allowed_environment(env: &str, groups: &[String], rules: &[WorkspaceRule]) -> bool {
    if rules.is_empty() || env.is_empty() {
        return true;
    }
    let Some(rule) = rules.iter().find(|r| r.environment.eq_ignore_ascii_case(env)) else {
        return true;
    };
    if rule.groups.is_empty() {
        return true;
    }
    groups
        .iter()
        .any(|g| rule.groups.iter().any(|rg| rg.eq_ignore_ascii_case(g)))
}

pub fn filter_apps_by_workspace(apps: &[App], groups: &[String], rules: &[WorkspaceRule]) -> Vec<App> {
    if rules.is_empty() {
        return apps.to_vec();
    }
    apps.iter()
        .filter(|app| user_allowed_environment(&app.meta.environment, groups, rules))
        .cloned()
        .collect()
}

pub fn allowed_workspaces(groups: &[String], rules: &[WorkspaceRule]) -> Vec<String> {
    if rules.is_empty() {
        return vec![];
    }
    rules
        .iter()
        .filter(|rule| {
            rule.groups.is_empty()
                || groups
                    .iter()
                    .any(|g| rule.groups.iter().any(|rg| rg.eq_ignore_ascii_case(g)))
        })
        .map(|rule| rule.environment.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{AppMeta, Backend, Visibility};

    fn app(env: &str) -> App {
        App {
            id: "demo/app".into(),
            slug: "app".into(),
            canonical_slug: String::new(),
            display_name: "App".into(),
            description: String::new(),
            namespace: "demo".into(),
            category: "Custom".into(),
            icon: "app".into(),
            backend: Backend {
                kind: "Service".into(),
                name: "svc".into(),
                port: 80,
                scheme: "http".into(),
                path: "/".into(),
            },
            route_path: "/a/demo/app".into(),
            public_url: String::new(),
            status: "healthy".into(),
            status_message: String::new(),
            source: "service".into(),
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
                ..Default::default()
            },
        }
    }

    #[test]
    fn filters_production_for_platform_team() {
        let rules = parse_workspace_rules(
            r#"[{"environment":"production","groups":["platform-team"]}]"#,
        );
        let apps = vec![app("production"), app("staging")];
        let filtered = filter_apps_by_workspace(&apps, &["platform-team".into()], &rules);
        assert_eq!(filtered.len(), 2);
        let filtered = filter_apps_by_workspace(&apps, &["other".into()], &rules);
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].meta.environment, "staging");
    }
}
