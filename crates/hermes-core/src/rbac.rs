// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RoleRule {
    #[serde(default)]
    pub groups: Vec<String>,
    #[serde(default)]
    pub actions: Vec<String>,
    #[serde(default)]
    pub namespaces: Vec<String>,
}

pub fn parse_role_rules(raw: &str) -> Vec<RoleRule> {
    if raw.trim().is_empty() {
        return vec![];
    }
    serde_json::from_str(raw).unwrap_or_default()
}

pub fn role_rules_from_env() -> Vec<RoleRule> {
    std::env::var("HERMES_ROLE_RULES")
        .ok()
        .map(|raw| parse_role_rules(&raw))
        .unwrap_or_default()
}

pub fn can_perform_action(
    groups: &[String],
    rules: &[RoleRule],
    action: &str,
    is_admin: bool,
) -> bool {
    if is_admin || rules.is_empty() {
        return true;
    }
    for rule in rules {
        if !rule.groups.is_empty()
            && !groups
                .iter()
                .any(|g| rule.groups.iter().any(|rg| rg.eq_ignore_ascii_case(g)))
        {
            continue;
        }
        if rule.actions.iter().any(|a| a == action || a == "*") {
            return true;
        }
    }
    false
}

pub fn allowed_namespaces_for_groups(groups: &[String], rules: &[RoleRule]) -> Option<Vec<String>> {
    if rules.is_empty() {
        return None;
    }
    let mut allowed = Vec::new();
    for rule in rules {
        if rule.namespaces.is_empty() {
            continue;
        }
        if rule.groups.is_empty()
            || groups
                .iter()
                .any(|g| rule.groups.iter().any(|rg| rg.eq_ignore_ascii_case(g)))
        {
            allowed.extend(rule.namespaces.clone());
        }
    }
    if allowed.is_empty() {
        Some(vec![])
    } else {
        allowed.sort();
        allowed.dedup();
        Some(allowed)
    }
}

pub fn allowed_actions_for_groups(groups: &[String], rules: &[RoleRule], is_admin: bool) -> Vec<String> {
    if is_admin || rules.is_empty() {
        return vec![
            "launch".into(),
            "publish".into(),
            "hide".into(),
            "share".into(),
            "admin".into(),
        ];
    }
    let mut actions = std::collections::HashSet::new();
    actions.insert("launch".into());
    for rule in rules {
        if rule.groups.is_empty()
            || groups
                .iter()
                .any(|g| rule.groups.iter().any(|rg| rg.eq_ignore_ascii_case(g)))
        {
            for action in &rule.actions {
                actions.insert(action.clone());
            }
        }
    }
    actions.into_iter().collect()
}
