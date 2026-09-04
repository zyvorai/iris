// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

use std::sync::Arc;

use axum::{extract::State, http::StatusCode, response::IntoResponse, routing::get, Router};
use iris_core::store::Store;

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
        "# HELP iris_apps_total Total apps in catalog\n\
# TYPE iris_apps_total gauge\n\
iris_apps_total {}\n\
# HELP iris_apps_published Published apps\n\
# TYPE iris_apps_published gauge\n\
iris_apps_published {}\n\
# HELP iris_apps_healthy Healthy apps\n\
# TYPE iris_apps_healthy gauge\n\
iris_apps_healthy {}\n\
# HELP iris_apps_degraded Degraded apps\n\
# TYPE iris_apps_degraded gauge\n\
iris_apps_degraded {}\n\
# HELP iris_apps_broken Broken apps\n\
# TYPE iris_apps_broken gauge\n\
iris_apps_broken {}\n\
# HELP iris_audit_events_total Audit events recorded\n\
# TYPE iris_audit_events_total counter\n\
iris_audit_events_total {}\n\
# HELP iris_uptime_seconds Server uptime\n\
# TYPE iris_uptime_seconds gauge\n\
iris_uptime_seconds {}\n",
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
