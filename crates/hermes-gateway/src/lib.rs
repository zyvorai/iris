// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use std::sync::Arc;

use axum::{
    body::Body,
    extract::{FromRequestParts, Path, State, WebSocketUpgrade},
    http::{header, HeaderMap, HeaderName, HeaderValue, Request, StatusCode},
    response::{IntoResponse, Response},
    routing::any,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use hermes_core::store::Store;

#[derive(Clone)]
pub struct GatewayState {
    pub store: Arc<Store>,
    pub default_user: String,
}

pub fn routes(state: GatewayState) -> Router {
    Router::new()
        // Zeus Launchpad public URLs
        .route("/launchpad/apps/{slug}", any(proxy_canonical_root))
        .route("/launchpad/apps/{slug}/{*rest}", any(proxy_canonical_path))
        .route("/launchpad/a/{namespace}/{slug}", any(proxy_root))
        .route("/launchpad/a/{namespace}/{slug}/{*rest}", any(proxy_path))
        .route("/launchpad/s/{token}", any(share_proxy_root))
        .route("/launchpad/s/{token}/{*rest}", any(share_proxy_path))
        // Legacy aliases
        .route("/apps/{slug}", any(proxy_canonical_root))
        .route("/apps/{slug}/{*rest}", any(proxy_canonical_path))
        .route("/a/{namespace}/{slug}", any(proxy_root))
        .route("/a/{namespace}/{slug}/{*rest}", any(proxy_path))
        .route("/s/{token}", any(share_proxy_root))
        .route("/s/{token}/{*rest}", any(share_proxy_path))
        .with_state(state)
}

async fn share_proxy_root(
    State(st): State<GatewayState>,
    Path(token): Path<String>,
    req: Request<Body>,
) -> Response {
    share_proxy(st, token, String::new(), req).await
}

async fn share_proxy_path(
    State(st): State<GatewayState>,
    Path((token, rest)): Path<(String, String)>,
    req: Request<Body>,
) -> Response {
    share_proxy(st, token, rest, req).await
}

async fn share_proxy(st: GatewayState, token: String, rest: String, req: Request<Body>) -> Response {
    let link = match st.store.get_share(&token) {
        Ok(Some(link)) => link,
        Ok(None) => {
            return (StatusCode::NOT_FOUND, "share link not found or expired").into_response();
        }
        Err(e) => {
            tracing::error!("store error: {e:#}");
            return (StatusCode::INTERNAL_SERVER_ERROR, "store error").into_response();
        }
    };

    let app = match st.store.get_app(&link.app_id) {
        Ok(Some(app)) => app,
        Ok(None) => return (StatusCode::NOT_FOUND, "app not found").into_response(),
        Err(e) => {
            tracing::error!("store error: {e:#}");
            return (StatusCode::INTERNAL_SERVER_ERROR, "store error").into_response();
        }
    };

    if !app.visibility.published {
        return (StatusCode::FORBIDDEN, "app not published").into_response();
    }

    let user = req
        .headers()
        .get("x-hermes-user")
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| st.default_user.clone());

    let _ = st.store.record_audit(
        &user,
        "share_access",
        &app.id,
        &format!("token={token}"),
    );

    proxy_app(st, app, rest, req).await
}

async fn proxy_canonical_root(
    State(st): State<GatewayState>,
    Path(slug): Path<String>,
    req: Request<Body>,
) -> Response {
    match st.store.get_app_by_canonical_slug(&slug) {
        Ok(Some(app)) => proxy_app(st, app, String::new(), req).await,
        Ok(None) => (StatusCode::NOT_FOUND, "app not found").into_response(),
        Err(e) => {
            tracing::error!("store error: {e:#}");
            (StatusCode::INTERNAL_SERVER_ERROR, "store error").into_response()
        }
    }
}

async fn proxy_canonical_path(
    State(st): State<GatewayState>,
    Path((slug, rest)): Path<(String, String)>,
    req: Request<Body>,
) -> Response {
    match st.store.get_app_by_canonical_slug(&slug) {
        Ok(Some(app)) => proxy_app(st, app, rest, req).await,
        Ok(None) => (StatusCode::NOT_FOUND, "app not found").into_response(),
        Err(e) => {
            tracing::error!("store error: {e:#}");
            (StatusCode::INTERNAL_SERVER_ERROR, "store error").into_response()
        }
    }
}

async fn proxy_root(
    State(st): State<GatewayState>,
    Path((namespace, slug)): Path<(String, String)>,
    req: Request<Body>,
) -> Response {
    match st.store.get_app_by_route(&namespace, &slug) {
        Ok(Some(app)) => proxy_app(st, app, String::new(), req).await,
        Ok(None) => (StatusCode::NOT_FOUND, "app not found").into_response(),
        Err(e) => {
            tracing::error!("store error: {e:#}");
            (StatusCode::INTERNAL_SERVER_ERROR, "store error").into_response()
        }
    }
}

async fn proxy_path(
    State(st): State<GatewayState>,
    Path((namespace, slug, rest)): Path<(String, String, String)>,
    req: Request<Body>,
) -> Response {
    match st.store.get_app_by_route(&namespace, &slug) {
        Ok(Some(app)) => proxy_app(st, app, rest, req).await,
        Ok(None) => (StatusCode::NOT_FOUND, "app not found").into_response(),
        Err(e) => {
            tracing::error!("store error: {e:#}");
            (StatusCode::INTERNAL_SERVER_ERROR, "store error").into_response()
        }
    }
}

async fn proxy_app(st: GatewayState, app: hermes_core::App, rest: String, req: Request<Body>) -> Response {
    if !app.visibility.published {
        return (StatusCode::FORBIDDEN, "app not published").into_response();
    }

    if app.ready_endpoints == 0 || app.status == "broken" {
        return (
            StatusCode::BAD_GATEWAY,
            format!("backend unavailable: {}", app.status_message),
        )
            .into_response();
    }

    let user = req
        .headers()
        .get("x-hermes-user")
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| st.default_user.clone());

    let _ = st.store.record_audit(
        &user,
        "launch",
        &app.id,
        &app.route_path,
    );

    if is_websocket_upgrade(req.headers()) {
        let (mut parts, _body) = req.into_parts();
        match WebSocketUpgrade::from_request_parts(&mut parts, &()).await {
            Ok(ws) => {
                let backend_path = build_backend_path(&app, &rest);
                let ws_url = format!(
                    "ws://{}.{}.svc.cluster.local:{}{}",
                    app.backend.name, app.namespace, app.backend.port, backend_path
                );
                return ws.on_upgrade(move |client_ws| async move {
                    if let Err(e) = tunnel_websocket(client_ws, &ws_url).await {
                        tracing::warn!("ws tunnel: {e:#}");
                    }
                })
                .into_response();
            }
            Err(e) => return e.into_response(),
        }
    }

    http_proxy(app, rest, req).await
}

fn is_websocket_upgrade(headers: &HeaderMap) -> bool {
    headers
        .get(header::UPGRADE)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.eq_ignore_ascii_case("websocket"))
        .unwrap_or(false)
}

async fn http_proxy(app: hermes_core::App, rest: String, req: Request<Body>) -> Response {
    let backend_path = build_backend_path(&app, &rest);
    let target = format!(
        "{}://{}.{}.svc.cluster.local:{}{}",
        app.backend.scheme,
        app.backend.name,
        app.namespace,
        app.backend.port,
        backend_path
    );

    let method = req.method().clone();
    let mut headers = filter_request_headers(req.headers());
    inject_hermes_headers(&mut headers, &app);

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap();

    let body_bytes = match axum::body::to_bytes(req.into_body(), 16 * 1024 * 1024).await {
        Ok(b) => b,
        Err(_) => return (StatusCode::BAD_REQUEST, "body read error").into_response(),
    };

    let mut rb = client.request(method, &target).headers(to_reqwest_headers(&headers));
    if !body_bytes.is_empty() {
        rb = rb.body(body_bytes.to_vec());
    }

    match rb.send().await {
        Ok(resp) => {
            let status =
                StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
            let mut out_headers = HeaderMap::new();
            for (k, v) in resp.headers() {
                if should_forward_response_header(k) {
                    if let Ok(val) = HeaderValue::from_bytes(v.as_bytes()) {
                        out_headers.insert(k.clone(), val);
                    }
                }
            }
            let body = resp.bytes().await.unwrap_or_default();
            (status, out_headers, body).into_response()
        }
        Err(e) => (StatusCode::BAD_GATEWAY, format!("proxy error: {e}")).into_response(),
    }
}

async fn tunnel_websocket(
    client_ws: axum::extract::ws::WebSocket,
    upstream_url: &str,
) -> anyhow::Result<()> {
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;
    use tokio_tungstenite::connect_async;

    let request = upstream_url.into_client_request()?;
    let (upstream, _) = connect_async(request).await?;
    let (mut client_sink, mut client_stream) = client_ws.split();
    let (mut upstream_sink, mut upstream_stream) = upstream.split();

    let client_to_upstream = async {
        while let Some(msg) = client_stream.next().await {
            match msg {
                Ok(axum::extract::ws::Message::Text(t)) => {
                    upstream_sink
                        .send(tokio_tungstenite::tungstenite::Message::Text(t.to_string().into()))
                        .await?;
                }
                Ok(axum::extract::ws::Message::Binary(b)) => {
                    upstream_sink
                        .send(tokio_tungstenite::tungstenite::Message::Binary(b.into()))
                        .await?;
                }
                Ok(axum::extract::ws::Message::Ping(p)) => {
                    upstream_sink
                        .send(tokio_tungstenite::tungstenite::Message::Ping(p.into()))
                        .await?;
                }
                Ok(axum::extract::ws::Message::Pong(p)) => {
                    upstream_sink
                        .send(tokio_tungstenite::tungstenite::Message::Pong(p.into()))
                        .await?;
                }
                Ok(axum::extract::ws::Message::Close(_)) => break,
                Err(_) => break,
            }
        }
        Ok::<(), anyhow::Error>(())
    };

    let upstream_to_client = async {
        while let Some(msg) = upstream_stream.next().await {
            match msg {
                Ok(tokio_tungstenite::tungstenite::Message::Text(t)) => {
                    client_sink
                        .send(axum::extract::ws::Message::Text(t.to_string().into()))
                        .await?;
                }
                Ok(tokio_tungstenite::tungstenite::Message::Binary(b)) => {
                    client_sink
                        .send(axum::extract::ws::Message::Binary(b.into()))
                        .await?;
                }
                Ok(tokio_tungstenite::tungstenite::Message::Ping(p)) => {
                    client_sink
                        .send(axum::extract::ws::Message::Ping(p.into()))
                        .await?;
                }
                Ok(tokio_tungstenite::tungstenite::Message::Pong(p)) => {
                    client_sink
                        .send(axum::extract::ws::Message::Pong(p.into()))
                        .await?;
                }
                Ok(tokio_tungstenite::tungstenite::Message::Close(_)) => break,
                Err(_) => break,
                _ => {}
            }
        }
        Ok::<(), anyhow::Error>(())
    };

    tokio::select! {
        r = client_to_upstream => r?,
        r = upstream_to_client => r?,
    }
    Ok(())
}

fn build_backend_path(app: &hermes_core::App, rest: &str) -> String {
    let base = if app.backend.path.is_empty() {
        "/".to_string()
    } else {
        app.backend.path.clone()
    };

    let suffix = {
        let s = rest.trim();
        if s.is_empty() {
            String::new()
        } else if s.starts_with('/') {
            s.to_string()
        } else {
            format!("/{s}")
        }
    };

    let mut suffix = suffix;
    if !app.rewrite.strip_prefix.is_empty() && !suffix.is_empty() {
        let strip = app.rewrite.strip_prefix.trim_end_matches('/');
        if suffix.starts_with(strip) {
            suffix = suffix.strip_prefix(strip).unwrap_or(&suffix).to_string();
        }
    }

    if suffix.is_empty() || suffix == "/" {
        return normalize_path(&base);
    }

    if base.ends_with('/') {
        normalize_path(&format!("{}{}", base.trim_end_matches('/'), suffix))
    } else {
        normalize_path(&format!("{}/{}", base.trim_end_matches('/'), suffix.trim_start_matches('/')))
    }
}

fn normalize_path(path: &str) -> String {
    if path.is_empty() || path == "/" {
        return "/".to_string();
    }
    if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{path}")
    }
}

fn filter_request_headers(in_headers: &HeaderMap) -> HeaderMap {
    let mut out = HeaderMap::new();
    for (k, v) in in_headers {
        let name = k.as_str();
        if name.eq_ignore_ascii_case("host")
            || name.eq_ignore_ascii_case("connection")
            || name.eq_ignore_ascii_case("upgrade")
            || name.starts_with("sec-websocket")
        {
            continue;
        }
        out.insert(k.clone(), v.clone());
    }
    out
}

fn to_reqwest_headers(headers: &HeaderMap) -> reqwest::header::HeaderMap {
    let mut hm = reqwest::header::HeaderMap::new();
    for (k, v) in headers {
        if let (Ok(name), Ok(val)) = (
            reqwest::header::HeaderName::from_bytes(k.as_str().as_bytes()),
            reqwest::header::HeaderValue::from_bytes(v.as_bytes()),
        ) {
            hm.insert(name, val);
        }
    }
    hm
}

fn inject_hermes_headers(headers: &mut HeaderMap, app: &hermes_core::App) {
    headers.insert(
        HeaderName::from_static("x-hermes-app"),
        HeaderValue::from_str(&app.slug).unwrap_or(HeaderValue::from_static("unknown")),
    );
    headers.insert(
        HeaderName::from_static("x-hermes-namespace"),
        HeaderValue::from_str(&app.namespace).unwrap_or(HeaderValue::from_static("unknown")),
    );
    headers.insert(
        HeaderName::from_static("x-forwarded-proto"),
        HeaderValue::from_static("https"),
    );
}

fn should_forward_response_header(name: &header::HeaderName) -> bool {
    !matches!(
        name.as_str(),
        "connection" | "keep-alive" | "transfer-encoding" | "upgrade"
    )
}
