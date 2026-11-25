// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

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

    let published_apps: Vec<_> = apps
        .iter()
        .filter(|a| a.visibility.published)
        .cloned()
        .collect();
    let mut conformance =
        iris_core::check_conformance(&published_apps, &iris_core::ConformancePolicy::from_env());
    conformance.apply_exemptions(
        &st.store.list_exemptions().unwrap_or_default(),
        chrono::Utc::now(),
    );
    let app_series = iris_core::render_app_metrics(&apps, &conformance);

    let mut body = format!(
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
    body.push_str(&app_series);

    (
        StatusCode::OK,
        [(
            axum::http::header::CONTENT_TYPE,
            "text/plain; version=0.0.4",
        )],
        body,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use tower::ServiceExt;

    #[tokio::test]
    async fn metrics_include_per_app_series() {
        let store = Arc::new(Store::open(":memory:").unwrap());
        let a: iris_core::App = serde_json::from_value(serde_json::json!({
            "id": "demo/grafana", "slug": "grafana", "displayName": "grafana",
            "namespace": "demo", "category": "Tools", "icon": "app",
            "backend": {"kind":"Service","name":"grafana","port":80,"scheme":"http","path":"/"},
            "routePath": "/a/demo/grafana", "publicUrl": "", "status": "broken",
            "source": "annotation", "authMode": "none",
            "visibility": {"published": true, "hidden": false, "favorite": false},
            "readyEndpoints": 1, "updatedAt": ""
        }))
        .unwrap();
        store.upsert_app(&a).unwrap();
        let app = routes(MetricsState {
            store,
            started_at: 0,
        });
        let resp = app
            .oneshot(
                axum::http::Request::get("/metrics")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = axum::body::to_bytes(resp.into_body(), 1 << 20)
            .await
            .unwrap();
        let text = String::from_utf8(body.to_vec()).unwrap();
        assert!(text.contains("iris_apps_total 1"));
        assert!(text
            .contains("iris_app_status{app=\"grafana\",namespace=\"demo\",status=\"broken\"} 1"));
        assert!(text.contains("iris_app_conformance_score{app=\"grafana\""));
    }
}
