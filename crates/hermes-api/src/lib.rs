// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post, put},
    Json, Router,
};
use hermes_core::store::Store;
use hermes_core::{App, AuditEvent, ClusterSummary, HealthSummary, SearchHit};
use serde::Deserialize;

#[derive(Clone)]
pub struct ApiState {
    pub store: Arc<Store>,
    pub default_user: String,
    pub allowed_namespaces: Vec<String>,
}

pub fn routes(state: ApiState) -> Router {
    Router::new()
        .route("/apps", get(list_apps))
        .route("/apps/{*id}", get(get_app))
        .route("/catalog", get(list_catalog))
        .route("/cluster/summary", get(cluster_summary))
        .route("/discovery", get(list_discovery))
        .route("/discovery/publish/{*id}", post(publish_app))
        .route("/discovery/hide/{*id}", post(hide_app))
        .route("/search", get(search))
        .route("/favorites", get(list_favorites))
        .route("/favorites/{*id}", put(add_favorite).delete(remove_favorite))
        .route("/recents", get(list_recents))
        .route("/recents/{*id}", post(record_recent))
        .route("/health/apps", get(health_apps))
        .route("/audit", get(list_audit))
        .with_state(state)
}

#[derive(Deserialize)]
struct SearchQuery {
    q: String,
    #[serde(default = "default_limit")]
    limit: usize,
}

#[derive(Deserialize)]
struct AuditQuery {
    #[serde(default = "default_audit_limit")]
    limit: usize,
}

fn default_limit() -> usize {
    25
}

fn default_audit_limit() -> usize {
    50
}

fn user_id(headers: &HeaderMap, fallback: &str) -> String {
    headers
        .get("x-hermes-user")
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| fallback.to_string())
}

fn normalize_id(id: axum::extract::Path<String>) -> String {
    id.0.trim_start_matches('/').to_string()
}

fn filter_apps(st: &ApiState, apps: Vec<App>) -> Vec<App> {
    if st.allowed_namespaces.is_empty() {
        return apps;
    }
    apps.into_iter()
        .filter(|a| st.allowed_namespaces.iter().any(|ns| ns == &a.namespace))
        .collect()
}

fn app_allowed(st: &ApiState, app: &App) -> bool {
    st.allowed_namespaces.is_empty()
        || st
            .allowed_namespaces
            .iter()
            .any(|ns| ns == &app.namespace)
}

async fn list_apps(State(st): State<ApiState>) -> Result<Json<Vec<App>>, AppError> {
    Ok(Json(filter_apps(&st, st.store.list_apps(true)?)))
}

async fn get_app(
    State(st): State<ApiState>,
    id: axum::extract::Path<String>,
) -> Result<Json<App>, AppError> {
    let app = st
        .store
        .get_app(&normalize_id(id))?
        .ok_or(AppError::NotFound)?;
    if !app_allowed(&st, &app) {
        return Err(AppError::NotFound);
    }
    Ok(Json(app))
}

async fn list_catalog(State(st): State<ApiState>) -> Result<Json<Vec<App>>, AppError> {
    Ok(Json(filter_apps(&st, st.store.list_catalog()?)))
}

async fn cluster_summary(State(st): State<ApiState>) -> Result<Json<ClusterSummary>, AppError> {
    let apps = filter_apps(&st, st.store.list_catalog()?);
    let mut namespaces = std::collections::HashSet::new();
    let mut published = 0usize;
    let mut discovery = 0usize;
    let mut healthy = 0usize;
    let mut degraded = 0usize;
    let mut broken = 0usize;
    for app in &apps {
        namespaces.insert(app.namespace.clone());
        if app.visibility.published {
            published += 1;
        } else {
            discovery += 1;
        }
        match app.status.as_str() {
            "healthy" => healthy += 1,
            "degraded" => degraded += 1,
            "broken" => broken += 1,
            _ => {}
        }
    }
    Ok(Json(ClusterSummary {
        total: apps.len(),
        published,
        discovery,
        namespaces: namespaces.len(),
        healthy,
        degraded,
        broken,
    }))
}

async fn list_discovery(State(st): State<ApiState>) -> Result<Json<Vec<App>>, AppError> {
    Ok(Json(filter_apps(&st, st.store.list_discovery()?)))
}

async fn publish_app(
    State(st): State<ApiState>,
    headers: HeaderMap,
    id: axum::extract::Path<String>,
) -> Result<StatusCode, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let id = normalize_id(id);
    if let Some(app) = st.store.get_app(&id)? {
        if !app_allowed(&st, &app) {
            return Err(AppError::NotFound);
        }
    }
    st.store.publish_app(&id)?;
    let _ = st.store.record_audit(&uid, "publish", &id, "published from discovery");
    Ok(StatusCode::NO_CONTENT)
}

async fn hide_app(
    State(st): State<ApiState>,
    headers: HeaderMap,
    id: axum::extract::Path<String>,
) -> Result<StatusCode, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let id = normalize_id(id);
    if let Some(app) = st.store.get_app(&id)? {
        if !app_allowed(&st, &app) {
            return Err(AppError::NotFound);
        }
    }
    st.store.hide_app(&id)?;
    let _ = st.store.record_audit(&uid, "hide", &id, "hidden from discovery");
    Ok(StatusCode::NO_CONTENT)
}

async fn search(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Query(q): Query<SearchQuery>,
) -> Result<Json<Vec<SearchHit>>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let hits = st.store.search(&q.q, q.limit)?;
    let filtered: Vec<SearchHit> = hits
        .into_iter()
        .filter(|h| app_allowed(&st, &h.app))
        .collect();
    let _ = st.store.record_audit(
        &uid,
        "search",
        "",
        &format!("q={}", q.q.trim()),
    );
    Ok(Json(filtered))
}

async fn list_favorites(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Vec<App>>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let ids = st.store.list_favorites(&uid)?;
    let mut apps = Vec::new();
    for id in ids {
        if let Some(app) = st.store.get_app(&id)? {
            if app_allowed(&st, &app) {
                apps.push(app);
            }
        }
    }
    Ok(Json(apps))
}

async fn add_favorite(
    State(st): State<ApiState>,
    headers: HeaderMap,
    id: axum::extract::Path<String>,
) -> Result<StatusCode, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let id = normalize_id(id);
    if let Some(app) = st.store.get_app(&id)? {
        if !app_allowed(&st, &app) {
            return Err(AppError::NotFound);
        }
    }
    st.store.add_favorite(&uid, &id)?;
    let _ = st.store.record_audit(&uid, "favorite", &id, "added favorite");
    Ok(StatusCode::NO_CONTENT)
}

async fn remove_favorite(
    State(st): State<ApiState>,
    headers: HeaderMap,
    id: axum::extract::Path<String>,
) -> Result<StatusCode, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let id = normalize_id(id);
    st.store.remove_favorite(&uid, &id)?;
    let _ = st.store.record_audit(&uid, "unfavorite", &id, "removed favorite");
    Ok(StatusCode::NO_CONTENT)
}

async fn list_recents(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Vec<App>>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let ids = st.store.list_recents(&uid, 12)?;
    let mut apps = Vec::new();
    for id in ids {
        if let Some(app) = st.store.get_app(&id)? {
            if app_allowed(&st, &app) {
                apps.push(app);
            }
        }
    }
    Ok(Json(apps))
}

async fn record_recent(
    State(st): State<ApiState>,
    headers: HeaderMap,
    id: axum::extract::Path<String>,
) -> Result<StatusCode, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let id = normalize_id(id);
    if let Some(app) = st.store.get_app(&id)? {
        if !app_allowed(&st, &app) {
            return Err(AppError::NotFound);
        }
    }
    st.store.record_recent(&uid, &id)?;
    let _ = st.store.record_audit(&uid, "recent", &id, "opened from dock");
    Ok(StatusCode::NO_CONTENT)
}

async fn health_apps(State(st): State<ApiState>) -> Result<Json<HealthSummary>, AppError> {
    let apps = filter_apps(&st, st.store.list_apps(true)?);
    let total = apps.len();
    let mut healthy = 0;
    let mut degraded = 0;
    let mut broken = 0;
    for app in &apps {
        match app.status.as_str() {
            "healthy" => healthy += 1,
            "degraded" => degraded += 1,
            "broken" => broken += 1,
            _ => {}
        }
    }
    let unhealthy: Vec<App> = apps
        .into_iter()
        .filter(|a| a.status != "healthy")
        .collect();
    Ok(Json(HealthSummary {
        total,
        healthy,
        degraded,
        broken,
        apps: unhealthy,
    }))
}

async fn list_audit(
    State(st): State<ApiState>,
    Query(q): Query<AuditQuery>,
) -> Result<Json<Vec<AuditEvent>>, AppError> {
    Ok(Json(st.store.list_audit(q.limit)?))
}

#[derive(Debug)]
pub enum AppError {
    NotFound,
    Internal(anyhow::Error),
}

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        AppError::Internal(e)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        match self {
            AppError::NotFound => (StatusCode::NOT_FOUND, "not found").into_response(),
            AppError::Internal(e) => {
                tracing::error!("api error: {e:#}");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
            }
        }
    }
}
