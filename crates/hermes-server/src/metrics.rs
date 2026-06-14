// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use std::sync::Arc;

use axum::{extract::State, http::StatusCode, response::IntoResponse, routing::get, Router};
use hermes_core::store::Store;

#[derive(Clone)]
pub struct MetricsState {
    pub store: Arc<Store>,
    pub started_at: i64,
}

pub fn routes(state: MetricsState) -> Router {
    Router::new()
        .route("/metrics", get(prometheus))
        .with_state(state)
}

async fn prometheus(State(st): State<MetricsState>) -> impl IntoResponse {
    let apps = st.store.list_catalog().unwrap_or_default();
    let mut healthy = 0usize;
    let mut degraded = 0usize;
    let mut broken = 0usize;
    let mut published = 0usize;
    for app in &apps {
        if app.visibility.published {
            published += 1;
        }
        match app.status.as_str() {
            "healthy" => healthy += 1,
            "degraded" => degraded += 1,
            "broken" => broken += 1,
            _ => {}
        }
    }
    let audit_count = st.store.count_audit().unwrap_or(0);
    let uptime = chrono::Utc::now().timestamp() - st.started_at;

    let body = format!(
        "# HELP hermes_apps_total Total apps in catalog\n\
# TYPE hermes_apps_total gauge\n\
hermes_apps_total {}\n\
# HELP hermes_apps_published Published apps\n\
# TYPE hermes_apps_published gauge\n\
hermes_apps_published {}\n\
# HELP hermes_apps_healthy Healthy apps\n\
# TYPE hermes_apps_healthy gauge\n\
hermes_apps_healthy {}\n\
# HELP hermes_apps_degraded Degraded apps\n\
# TYPE hermes_apps_degraded gauge\n\
hermes_apps_degraded {}\n\
# HELP hermes_apps_broken Broken apps\n\
# TYPE hermes_apps_broken gauge\n\
hermes_apps_broken {}\n\
# HELP hermes_audit_events_total Audit events recorded\n\
# TYPE hermes_audit_events_total counter\n\
hermes_audit_events_total {}\n\
# HELP hermes_uptime_seconds Server uptime\n\
# TYPE hermes_uptime_seconds gauge\n\
hermes_uptime_seconds {}\n",
        apps.len(),
        published,
        healthy,
        degraded,
        broken,
        audit_count,
        uptime,
    );

    (
        StatusCode::OK,
        [(axum::http::header::CONTENT_TYPE, "text/plain; version=0.0.4")],
        body,
    )
}
