// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use serde::Deserialize;

use crate::{resolve_search_intent, App, SearchIntent};

#[derive(Debug, Clone)]
pub struct LlmConfig {
    pub api_url: String,
    pub api_key: String,
    pub model: String,
}

pub fn llm_config_from_env() -> Option<LlmConfig> {
    let api_url = std::env::var("HERMES_LLM_API_URL").ok()?;
    if api_url.trim().is_empty() {
        return None;
    }
    Some(LlmConfig {
        api_url,
        api_key: std::env::var("HERMES_LLM_API_KEY").unwrap_or_default(),
        model: std::env::var("HERMES_LLM_MODEL").unwrap_or_else(|_| "gpt-4o-mini".into()),
    })
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(Debug, Deserialize)]
struct ChatMessage {
    content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LlmAnswer {
    intent: String,
    answer: String,
    #[serde(default, alias = "appIds")]
    app_ids: Vec<String>,
}

pub async fn llm_chat_json<T>(cfg: &LlmConfig, system: &str, user: &str) -> Option<T>
where
    T: for<'de> Deserialize<'de>,
{
    let body = serde_json::json!({
        "model": cfg.model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.15,
    });
    let url = format!("{}/chat/completions", cfg.api_url.trim_end_matches('/'));
    let mut req = reqwest::Client::new()
        .post(url)
        .header("Content-Type", "application/json")
        .json(&body);
    if !cfg.api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", cfg.api_key));
    }
    let resp = req.send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let parsed: ChatCompletionResponse = resp.json().await.ok()?;
    let content = parsed.choices.first()?.message.content.trim();
    let json_start = content.find('{')?;
    let json_end = content.rfind('}')?;
    serde_json::from_str(&content[json_start..=json_end]).ok()
}

pub async fn llm_search_intent(apps: &[App], query: &str, cfg: &LlmConfig) -> Option<SearchIntent> {
    let catalog: Vec<_> = apps
        .iter()
        .filter(|a| a.visibility.published && !a.visibility.hidden)
        .take(80)
        .map(|a| {
            serde_json::json!({
                "id": a.id,
                "name": a.display_name,
                "namespace": a.namespace,
                "status": a.status,
                "statusMessage": a.status_message,
                "environment": a.meta.environment,
                "owner": a.meta.owner,
                "dependsOn": a.meta.depends_on,
                "routePath": a.route_path,
                "recommended": a.meta.recommended,
            })
        })
        .collect();
    let system = "You are Hermes app search. Return JSON only: {\"intent\":\"...\",\"answer\":\"...\",\"appIds\":[\"id1\"]}. Pick matching app ids from the catalog.";
    let user = format!(
        "Catalog: {}\n\nQuery: {}",
        serde_json::to_string(&catalog).ok()?,
        query.trim()
    );
    let llm: LlmAnswer = llm_chat_json(cfg, system, &user).await?;
    let matched: Vec<App> = apps
        .iter()
        .filter(|a| llm.app_ids.iter().any(|id| id == &a.id))
        .cloned()
        .collect();
    Some(SearchIntent {
        intent: if llm.intent.is_empty() {
            "llm".into()
        } else {
            llm.intent
        },
        answer: llm.answer,
        apps: matched,
    })
}

pub async fn resolve_search_with_llm(apps: &[App], query: &str) -> SearchIntent {
    if let Some(cfg) = llm_config_from_env() {
        if let Some(intent) = llm_search_intent(apps, query, &cfg).await {
            if !intent.apps.is_empty() || intent.intent != "unknown" {
                return intent;
            }
        }
    }
    resolve_search_intent(apps, query)
}
