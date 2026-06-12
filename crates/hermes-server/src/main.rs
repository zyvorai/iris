// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

mod auth;
mod metrics;

use std::env;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Context;
use axum::{
    middleware,
    routing::get,
    Router,
};
use hermes_api::ApiState;
use hermes_core::store::Store;
use hermes_gateway::GatewayState;
use tower_http::{
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "hermes_server=info,tower_http=info".into()),
        )
        .init();

    let bind = env::var("HERMES_BIND").unwrap_or_else(|_| "0.0.0.0:31847".into());
    let db_path = env::var("HERMES_DB_PATH").unwrap_or_else(|_| "/data/hermes/hermes.db".into());
    let ui_dir = env::var("HERMES_UI_DIR").unwrap_or_else(|_| "./ui/dist".into());
    let default_user = env::var("HERMES_DEFAULT_USER").unwrap_or_else(|_| "local".into());
    let allowed_namespaces = auth::split_csv(&env::var("HERMES_ALLOWED_NAMESPACES").unwrap_or_default());
    let admin_users = auth::split_csv(&env::var("HERMES_ADMIN_USERS").unwrap_or_default());
    let admin_groups = auth::split_csv(&env::var("HERMES_ADMIN_GROUPS").unwrap_or_default());
    let workspace_rules = hermes_core::workspace_acl::workspace_rules_from_env();
    let role_rules = hermes_core::rbac::role_rules_from_env();
    let auth_cfg = auth::AuthConfig::from_env(default_user.clone())?;

    let store = Arc::new(Store::open(&db_path).context("open store")?);
    if let Ok(purged) = store.purge_expired_shares() {
        if purged > 0 {
            tracing::info!("purged {purged} expired share links");
        }
    }

    let api_state = ApiState {
        store: store.clone(),
        default_user: default_user.clone(),
        allowed_namespaces,
        admin_users,
        admin_groups,
        workspace_rules,
        role_rules,
    };

    let gateway_state = GatewayState {
        store: store.clone(),
        default_user: default_user.clone(),
    };

    let api = hermes_api::routes(api_state);
    let gateway = hermes_gateway::routes(gateway_state);
    let auth_routes = auth::routes(auth_cfg.clone());
    let metrics_routes = metrics::routes(metrics::MetricsState {
        store: store.clone(),
        started_at: chrono::Utc::now().timestamp(),
    });

    let ui_path = PathBuf::from(&ui_dir);
    let index = ui_path.join("index.html");
    let spa = ServeDir::new(&ui_path).not_found_service(ServeFile::new(index));

    let protected = Router::new()
        .nest("/api/v1", api)
        .merge(gateway)
        .layer(middleware::from_fn_with_state(auth_cfg.clone(), auth::require_auth));

    let app = Router::new()
        .route("/healthz", get(|| async { axum::http::StatusCode::OK }))
        .route("/api/v1/ws-echo", get(auth::ws_echo))
        .merge(metrics_routes)
        .merge(auth_routes)
        .merge(protected)
        .fallback_service(spa)
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = bind.parse().context("parse bind address")?;
    tracing::info!("hermes-server listening on {addr} (auth={})", auth_cfg.mode);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
