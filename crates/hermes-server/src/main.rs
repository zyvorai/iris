// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use std::env;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Context;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
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

    let bind = env::var("HERMES_BIND").unwrap_or_else(|_| "0.0.0.0:8080".into());
    let db_path = env::var("HERMES_DB_PATH").unwrap_or_else(|_| "/data/hermes/hermes.db".into());
    let ui_dir = env::var("HERMES_UI_DIR").unwrap_or_else(|_| "./ui/dist".into());
    let default_user = env::var("HERMES_DEFAULT_USER").unwrap_or_else(|_| "local".into());

    let store = Arc::new(Store::open(&db_path).context("open store")?);

    let api = hermes_api::routes(ApiState {
        store: store.clone(),
        default_user,
    });

    let gateway = hermes_gateway::routes(GatewayState {
        store: store.clone(),
    });

    let ui_path = PathBuf::from(&ui_dir);
    let index = ui_path.join("index.html");

    let spa = ServeDir::new(&ui_path)
        .not_found_service(ServeFile::new(index.clone()));

    let app = Router::new()
        .route("/healthz", get(|| async { StatusCode::OK }))
        .route("/api/v1/ws-echo", get(ws_echo))
        .nest("/api/v1", api)
        .merge(gateway)
        .fallback_service(spa)
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = bind.parse().context("parse bind address")?;
    tracing::info!("hermes-server listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn ws_echo(ws: axum::extract::WebSocketUpgrade) -> Response {
    ws.on_upgrade(|mut socket| async move {
        use axum::extract::ws::Message;
        use futures_util::StreamExt;
        while let Some(Ok(msg)) = socket.next().await {
            if matches!(msg, Message::Close(_)) {
                break;
            }
            if socket.send(msg).await.is_err() {
                break;
            }
        }
    })
    .into_response()
}
