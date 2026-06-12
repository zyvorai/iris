// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, put},
    Json, Router,
};
use hermes_core::store::Store;
use hermes_core::{App, ClusterSummary, HealthSummary, SearchHit};
use serde::Deserialize;

#[derive(Clone)]
pub struct ApiState {
    pub store: Arc<Store>,
    pub default_user: String,
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
        .with_state(state)
}

#[derive(Deserialize)]
struct SearchQuery {
    q: String,
    #[serde(default = "default_limit")]
    limit: usize,
}

fn default_limit() -> usize {
    25
}

async fn list_apps(State(st): State<ApiState>) -> Result<Json<Vec<App>>, AppError> {
    Ok(Json(st.store.list_apps(true)?))
}

fn normalize_id(id: axum::extract::Path<String>) -> String {
    id.0.trim_start_matches('/').to_string()
}

async fn get_app(
    State(st): State<ApiState>,
    id: axum::extract::Path<String>,
) -> Result<Json<App>, AppError> {
    st.store
        .get_app(&normalize_id(id))?
        .map(Json)
        .ok_or(AppError::NotFound)
}

async fn list_catalog(State(st): State<ApiState>) -> Result<Json<Vec<App>>, AppError> {
    Ok(Json(st.store.list_catalog()?))
}

async fn cluster_summary(State(st): State<ApiState>) -> Result<Json<ClusterSummary>, AppError> {
    Ok(Json(st.store.cluster_summary()?))
}

async fn list_discovery(State(st): State<ApiState>) -> Result<Json<Vec<App>>, AppError> {
    Ok(Json(st.store.list_discovery()?))
}

async fn publish_app(
    State(st): State<ApiState>,
    id: axum::extract::Path<String>,
) -> Result<StatusCode, AppError> {
    st.store.publish_app(&normalize_id(id))?;
    Ok(StatusCode::NO_CONTENT)
}

async fn hide_app(
    State(st): State<ApiState>,
    id: axum::extract::Path<String>,
) -> Result<StatusCode, AppError> {
    st.store.hide_app(&normalize_id(id))?;
    Ok(StatusCode::NO_CONTENT)
}

async fn search(
    State(st): State<ApiState>,
    Query(q): Query<SearchQuery>,
) -> Result<Json<Vec<SearchHit>>, AppError> {
    Ok(Json(st.store.search(&q.q, q.limit)?))
}

async fn list_favorites(State(st): State<ApiState>) -> Result<Json<Vec<App>>, AppError> {
    let ids = st.store.list_favorites(&st.default_user)?;
    let mut apps = Vec::new();
    for id in ids {
        if let Some(app) = st.store.get_app(&id)? {
            apps.push(app);
        }
    }
    Ok(Json(apps))
}

async fn add_favorite(
    State(st): State<ApiState>,
    id: axum::extract::Path<String>,
) -> Result<StatusCode, AppError> {
    st.store.add_favorite(&st.default_user, &normalize_id(id))?;
    Ok(StatusCode::NO_CONTENT)
}

async fn remove_favorite(
    State(st): State<ApiState>,
    id: axum::extract::Path<String>,
) -> Result<StatusCode, AppError> {
    st.store.remove_favorite(&st.default_user, &normalize_id(id))?;
    Ok(StatusCode::NO_CONTENT)
}

async fn list_recents(State(st): State<ApiState>) -> Result<Json<Vec<App>>, AppError> {
    let ids = st.store.list_recents(&st.default_user, 12)?;
    let mut apps = Vec::new();
    for id in ids {
        if let Some(app) = st.store.get_app(&id)? {
            apps.push(app);
        }
    }
    Ok(Json(apps))
}

async fn record_recent(
    State(st): State<ApiState>,
    id: axum::extract::Path<String>,
) -> Result<StatusCode, AppError> {
    st.store.record_recent(&st.default_user, &normalize_id(id))?;
    Ok(StatusCode::NO_CONTENT)
}

async fn health_apps(State(st): State<ApiState>) -> Result<Json<HealthSummary>, AppError> {
    Ok(Json(st.store.health_summary()?))
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
