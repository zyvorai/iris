// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use std::sync::{Arc, OnceLock};

use axum::{
    body::Body,
    extract::{FromRequestParts, Path, State, WebSocketUpgrade},
    http::{header, HeaderMap, HeaderName, HeaderValue, Request, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::any,
    Router,
};
use axum::body::Bytes;
use futures_util::{SinkExt, StreamExt};
use hermes_core::store::Store;

#[derive(Clone)]
pub struct GatewayState {
    pub store: Arc<Store>,
    pub default_user: String,
}

pub fn routes(state: GatewayState) -> Router {
    Router::new()
        // Zeus Launchpad public URLs (with and without trailing slash on roots)
        .route("/launchpad/apps/{slug}", any(proxy_canonical_root))
        .route("/launchpad/apps/{slug}/", any(proxy_canonical_root))
        .route("/launchpad/apps/{slug}/{*rest}", any(proxy_canonical_path))
        .route("/launchpad/a/{namespace}/{slug}", any(proxy_root))
        .route("/launchpad/a/{namespace}/{slug}/", any(proxy_root))
        .route("/launchpad/a/{namespace}/{slug}/{*rest}", any(proxy_path))
        .route("/launchpad/s/{token}", any(share_proxy_root))
        .route("/launchpad/s/{token}/", any(share_proxy_root))
        .route("/launchpad/s/{token}/{*rest}", any(share_proxy_path))
        // Legacy aliases
        .route("/apps/{slug}", any(proxy_canonical_root))
        .route("/apps/{slug}/", any(proxy_canonical_root))
        .route("/apps/{slug}/{*rest}", any(proxy_canonical_path))
        .route("/a/{namespace}/{slug}", any(proxy_root))
        .route("/a/{namespace}/{slug}/", any(proxy_root))
        .route("/a/{namespace}/{slug}/{*rest}", any(proxy_path))
        .route("/s/{token}", any(share_proxy_root))
        .route("/s/{token}/", any(share_proxy_root))
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
        let query = req.uri().query().map(str::to_string);
        let forwarded = collect_forward_context(req.headers(), &app);
        let (mut parts, _body) = req.into_parts();
        match WebSocketUpgrade::from_request_parts(&mut parts, &()).await {
            Ok(ws) => {
                let backend_path = build_backend_path(&app, &rest);
                let mut ws_url = format!(
                    "ws://{}.{}.svc.cluster.local:{}{}",
                    app.backend.name, app.namespace, app.backend.port, backend_path
                );
                if let Some(q) = query.as_deref().filter(|q| !q.is_empty()) {
                    ws_url.push('?');
                    ws_url.push_str(q);
                }
                return ws
                    .on_upgrade(move |client_ws| async move {
                        if let Err(e) = tunnel_websocket(client_ws, &ws_url, &forwarded).await {
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

fn wants_streaming(headers: &HeaderMap) -> bool {
    if headers
        .get(header::ACCEPT)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.contains("text/event-stream"))
        .unwrap_or(false)
    {
        return true;
    }
    headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.starts_with("application/grpc"))
        .unwrap_or(false)
}

fn wants_grpc(headers: &HeaderMap) -> bool {
    let is_grpc_ct = |v: &str| v.starts_with("application/grpc");
    if headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(is_grpc_ct)
        .unwrap_or(false)
    {
        return true;
    }
    headers
        .get(header::ACCEPT)
        .and_then(|v| v.to_str().ok())
        .map(is_grpc_ct)
        .unwrap_or(false)
}

static HTTP1_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
static HTTP2_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn proxy_client(headers: &HeaderMap) -> &'static reqwest::Client {
    if wants_grpc(headers) {
        HTTP2_CLIENT.get_or_init(|| {
            reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .http2_prior_knowledge()
                .pool_max_idle_per_host(8)
                .build()
                .unwrap_or_else(|_| reqwest::Client::new())
        })
    } else {
        HTTP1_CLIENT.get_or_init(|| {
            reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .pool_max_idle_per_host(16)
                .build()
                .unwrap_or_else(|_| reqwest::Client::new())
        })
    }
}

#[derive(Clone, Default)]
struct ForwardContext {
    proto: String,
    host: String,
    prefix: String,
    cookie: Option<String>,
    authorization: Option<String>,
    hermes_user: Option<String>,
}

fn collect_forward_context(headers: &HeaderMap, app: &hermes_core::App) -> ForwardContext {
    let proto = headers
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty())
        .unwrap_or("http")
        .to_string();
    let host = headers
        .get(header::HOST)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    ForwardContext {
        proto,
        host,
        prefix: app.route_path.trim_end_matches('/').to_string(),
        cookie: headers
            .get(header::COOKIE)
            .and_then(|v| v.to_str().ok())
            .map(str::to_string),
        authorization: headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .map(str::to_string),
        hermes_user: headers
            .get("x-hermes-user")
            .and_then(|v| v.to_str().ok())
            .filter(|s| !s.is_empty())
            .map(str::to_string),
    }
}

async fn http_proxy(app: hermes_core::App, rest: String, req: Request<Body>) -> Response {
    let query = req.uri().query().map(str::to_string);
    let forward = collect_forward_context(req.headers(), &app);
    let backend_path = build_backend_path(&app, &rest);
    let mut target = format!(
        "{}://{}.{}.svc.cluster.local:{}{}",
        app.backend.scheme,
        app.backend.name,
        app.namespace,
        app.backend.port,
        backend_path
    );
    if let Some(q) = query.as_deref().filter(|q| !q.is_empty()) {
        target.push('?');
        target.push_str(q);
    }

    let method = req.method().clone();
    let mut headers = filter_request_headers(req.headers());
    inject_hermes_headers(&mut headers, &app, &forward);

    let client = proxy_client(&headers);

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
                if !should_forward_response_header(k) {
                    continue;
                }
                let value = if k.as_str() == "location" || k.as_str() == "refresh" {
                    rewrite_redirect_header(&app, k.as_str(), v.as_bytes())
                } else if k.as_str() == "set-cookie" {
                    rewrite_set_cookie(&app, v.as_bytes())
                } else {
                    HeaderValue::from_bytes(v.as_bytes()).ok()
                };
                if let Some(val) = value {
                    // Preserve multiple Set-Cookie headers.
                    out_headers.append(k.clone(), val);
                }
            }
            if wants_streaming(&headers)
                || resp
                    .headers()
                    .get(header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .map(|v| v.contains("text/event-stream"))
                    .unwrap_or(false)
            {
                let stream = resp.bytes_stream().map(|chunk| {
                    chunk
                        .map(Bytes::from)
                        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
                });
                let body = Body::from_stream(stream);
                return (status, out_headers, body).into_response();
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
    forward: &ForwardContext,
) -> anyhow::Result<()> {
    use tokio_tungstenite::connect_async;
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;

    let mut request = upstream_url.into_client_request()?;
    {
        let headers = request.headers_mut();
        if !forward.host.is_empty() {
            let _ = headers.insert(
                "x-forwarded-host",
                forward.host.parse().unwrap_or_else(|_| "unknown".parse().unwrap()),
            );
        }
        let _ = headers.insert(
            "x-forwarded-proto",
            forward.proto.parse().unwrap_or_else(|_| "http".parse().unwrap()),
        );
        if !forward.prefix.is_empty() {
            let _ = headers.insert(
                "x-forwarded-prefix",
                forward.prefix.parse().unwrap_or_else(|_| "/".parse().unwrap()),
            );
        }
        if let Some(cookie) = &forward.cookie {
            let _ = headers.insert(
                "cookie",
                cookie.parse().unwrap_or_else(|_| "".parse().unwrap()),
            );
        }
        if let Some(auth) = &forward.authorization {
            let _ = headers.insert(
                "authorization",
                auth.parse().unwrap_or_else(|_| "".parse().unwrap()),
            );
        }
        if let Some(user) = &forward.hermes_user {
            let _ = headers.insert(
                "x-hermes-user",
                user.parse().unwrap_or_else(|_| "".parse().unwrap()),
            );
        }
    }

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

/// Build the upstream path.
///
/// Mode A (default): Axum already stripped the mount; forward `backend.path` + `rest`.
/// Mode B (`rewrite.add_prefix`): re-attach the public mount so subpath-aware apps
/// (Grafana `serve_from_sub_path`, Prometheus `--web.route-prefix`, …) see the full path.
pub fn build_backend_path(app: &hermes_core::App, rest: &str) -> String {
    let base = if app.backend.path.is_empty() {
        "/".to_string()
    } else {
        app.backend.path.clone()
    };

    let mut suffix = {
        let s = rest.trim();
        if s.is_empty() {
            String::new()
        } else if s.starts_with('/') {
            s.to_string()
        } else {
            format!("/{s}")
        }
    };

    // Historical strip_prefix: only applies when rest still contains the mount
    // (e.g. callers that pass the full public path).
    if !app.rewrite.strip_prefix.is_empty() && !suffix.is_empty() {
        let strip = app.rewrite.strip_prefix.trim_end_matches('/');
        if suffix == strip {
            suffix.clear();
        } else if let Some(stripped) = suffix.strip_prefix(strip) {
            if stripped.is_empty() || stripped.starts_with('/') {
                suffix = stripped.to_string();
            }
        }
    }

    let path = if suffix.is_empty() || suffix == "/" {
        normalize_path(&base)
    } else if base.ends_with('/') {
        normalize_path(&format!("{}{}", base.trim_end_matches('/'), suffix))
    } else {
        normalize_path(&format!(
            "{}/{}",
            base.trim_end_matches('/'),
            suffix.trim_start_matches('/')
        ))
    };

    if app.rewrite.add_prefix.is_empty() {
        return path;
    }

    let prefix = app.rewrite.add_prefix.trim_end_matches('/');
    if path == "/" {
        // Prefer trailing slash so directory-style apps (Grafana) do not 301.
        format!("{prefix}/")
    } else if path.starts_with(prefix)
        && (path.len() == prefix.len() || path.as_bytes().get(prefix.len()) == Some(&b'/'))
    {
        path
    } else {
        format!("{prefix}{path}")
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
            || name.eq_ignore_ascii_case("content-length")
            || name.starts_with("sec-websocket")
        {
            continue;
        }
        out.append(k.clone(), v.clone());
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
            hm.append(name, val);
        }
    }
    hm
}

fn inject_hermes_headers(headers: &mut HeaderMap, app: &hermes_core::App, forward: &ForwardContext) {
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
        HeaderValue::from_str(&forward.proto).unwrap_or(HeaderValue::from_static("http")),
    );
    if !forward.host.is_empty() {
        let _ = headers.insert(
            HeaderName::from_static("x-forwarded-host"),
            HeaderValue::from_str(&forward.host).unwrap_or(HeaderValue::from_static("unknown")),
        );
    }
    if !forward.prefix.is_empty() {
        let _ = headers.insert(
            HeaderName::from_static("x-forwarded-prefix"),
            HeaderValue::from_str(&forward.prefix).unwrap_or(HeaderValue::from_static("/")),
        );
    }
    if app.auth_mode != "none" {
        if let Some(user) = forward.hermes_user.as_deref() {
            let _ = headers.insert(
                HeaderName::from_static("x-forwarded-user"),
                HeaderValue::from_str(user).unwrap_or(HeaderValue::from_static("unknown")),
            );
            let _ = headers.insert(
                HeaderName::from_static("remote-user"),
                HeaderValue::from_str(user).unwrap_or(HeaderValue::from_static("unknown")),
            );
        }
    }
}

fn should_forward_response_header(name: &header::HeaderName) -> bool {
    !matches!(
        name.as_str(),
        "connection" | "keep-alive" | "transfer-encoding" | "upgrade"
    )
}

fn route_mount(app: &hermes_core::App) -> String {
    app.route_path.trim_end_matches('/').to_string()
}

fn path_under_mount(mount: &str, path: &str) -> bool {
    path == mount
        || path.starts_with(&(mount.to_string() + "/"))
        || path == (mount.to_string() + "/")
}

/// Rewrite absolute-path redirects so they stay under the launchpad mount.
pub fn rewrite_location(app: &hermes_core::App, location: &str) -> String {
    let mount = route_mount(app);
    let location = location.trim();
    if location.is_empty() {
        return format!("{mount}/");
    }

    // Absolute URL — rewrite path if present; keep relative query/fragment.
    if let Ok(uri) = location.parse::<Uri>() {
        if uri.scheme().is_some() || location.starts_with("//") {
            let path = uri.path();
            let rewritten = rewrite_absolute_path(app, &mount, path);
            let mut out = rewritten;
            if let Some(q) = uri.query() {
                out.push('?');
                out.push_str(q);
            }
            return out;
        }
    }

    if location.starts_with('/') {
        return rewrite_absolute_path(app, &mount, location);
    }

    // Relative Location — browser resolves against current public URL.
    location.to_string()
}

fn rewrite_absolute_path(app: &hermes_core::App, mount: &str, path: &str) -> String {
    if path.is_empty() || path == "/" {
        return format!("{mount}/");
    }
    if path_under_mount(mount, path) {
        return path.to_string();
    }
    // Mode B backends may emit paths that already include add_prefix.
    let add = app.rewrite.add_prefix.trim_end_matches('/');
    if !add.is_empty() && path_under_mount(add, path) {
        return path.to_string();
    }
    if mount.is_empty() {
        return path.to_string();
    }
    format!("{mount}{path}")
}

fn rewrite_redirect_header(app: &hermes_core::App, name: &str, raw: &[u8]) -> Option<HeaderValue> {
    let s = std::str::from_utf8(raw).ok()?;
    let rewritten = if name == "refresh" {
        rewrite_refresh(app, s)
    } else {
        rewrite_location(app, s)
    };
    HeaderValue::from_str(&rewritten).ok()
}

fn rewrite_refresh(app: &hermes_core::App, value: &str) -> String {
    // e.g. "0;url=/login" or "5; URL=/graph"
    let lower = value.to_ascii_lowercase();
    if let Some(idx) = lower.find("url=") {
        let (prefix, url_part) = value.split_at(idx + 4);
        let url = url_part.trim().trim_matches('"').trim_matches('\'');
        format!("{prefix}{}", rewrite_location(app, url))
    } else {
        value.to_string()
    }
}

pub fn rewrite_set_cookie_value(app: &hermes_core::App, value: &str) -> String {
    let mount = route_mount(app);
    if mount.is_empty() {
        return value.to_string();
    }
    let mut parts: Vec<String> = Vec::new();
    let mut saw_path = false;
    for part in value.split(';') {
        let trimmed = part.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(rest) = trimmed
            .strip_prefix("Path=")
            .or_else(|| trimmed.strip_prefix("path="))
        {
            saw_path = true;
            let path = if rest.is_empty() || rest == "/" {
                format!("{mount}/")
            } else if path_under_mount(&mount, rest) {
                rest.to_string()
            } else if rest.starts_with('/') {
                format!("{mount}{rest}")
            } else {
                format!("{mount}/{rest}")
            };
            parts.push(format!("Path={path}"));
        } else {
            parts.push(trimmed.to_string());
        }
    }
    if !saw_path {
        parts.push(format!("Path={mount}/"));
    }
    parts.join("; ")
}

fn rewrite_set_cookie(app: &hermes_core::App, raw: &[u8]) -> Option<HeaderValue> {
    let s = std::str::from_utf8(raw).ok()?;
    HeaderValue::from_str(&rewrite_set_cookie_value(app, s)).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use hermes_core::{App, AppMeta, Backend, Rewrite, Visibility};

    fn sample_app(rewrite: Rewrite) -> App {
        App {
            id: "hermes-demo/grafana".into(),
            slug: "grafana".into(),
            canonical_slug: "grafana".into(),
            display_name: "Grafana".into(),
            description: String::new(),
            namespace: "hermes-demo".into(),
            category: "Monitoring".into(),
            icon: "grafana".into(),
            backend: Backend {
                kind: "Service".into(),
                name: "grafana".into(),
                port: 80,
                scheme: "http".into(),
                path: "/".into(),
            },
            route_path: "/launchpad/a/hermes-demo/grafana".into(),
            public_url: "http://example/launchpad/apps/grafana".into(),
            status: "healthy".into(),
            status_message: String::new(),
            source: "annotation".into(),
            auth_mode: "none".into(),
            score: 100,
            visibility: Visibility {
                published: true,
                hidden: false,
                favorite: false,
            },
            rewrite,
            ready_endpoints: 1,
            updated_at: String::new(),
            meta: AppMeta::default(),
        }
    }

    #[test]
    fn backend_path_mode_a_root_and_rest() {
        let app = sample_app(Rewrite {
            strip_prefix: "/launchpad/a/hermes-demo/grafana".into(),
            add_prefix: String::new(),
        });
        assert_eq!(build_backend_path(&app, ""), "/");
        assert_eq!(build_backend_path(&app, "graph"), "/graph");
        assert_eq!(build_backend_path(&app, "/api/v1/query"), "/api/v1/query");
    }

    #[test]
    fn backend_path_mode_b_add_prefix() {
        let app = sample_app(Rewrite {
            strip_prefix: String::new(),
            add_prefix: "/launchpad/a/hermes-demo/grafana".into(),
        });
        assert_eq!(
            build_backend_path(&app, ""),
            "/launchpad/a/hermes-demo/grafana/"
        );
        assert_eq!(
            build_backend_path(&app, "login"),
            "/launchpad/a/hermes-demo/grafana/login"
        );
        assert_eq!(
            build_backend_path(&app, "/api/health"),
            "/launchpad/a/hermes-demo/grafana/api/health"
        );
    }

    #[test]
    fn location_rewrite_absolute_paths() {
        let app = sample_app(Rewrite::default());
        assert_eq!(
            rewrite_location(&app, "/"),
            "/launchpad/a/hermes-demo/grafana/"
        );
        assert_eq!(
            rewrite_location(&app, "/login"),
            "/launchpad/a/hermes-demo/grafana/login"
        );
        assert_eq!(
            rewrite_location(&app, "/launchpad/a/hermes-demo/grafana/"),
            "/launchpad/a/hermes-demo/grafana/"
        );
        assert_eq!(
            rewrite_location(&app, "http://grafana.hermes-demo.svc/login"),
            "/launchpad/a/hermes-demo/grafana/login"
        );
    }

    #[test]
    fn set_cookie_path_scoped_to_mount() {
        let app = sample_app(Rewrite::default());
        assert_eq!(
            rewrite_set_cookie_value(&app, "sid=abc; Path=/; HttpOnly"),
            "sid=abc; Path=/launchpad/a/hermes-demo/grafana/; HttpOnly"
        );
        assert_eq!(
            rewrite_set_cookie_value(&app, "sid=abc; Path=/grafana"),
            "sid=abc; Path=/launchpad/a/hermes-demo/grafana/grafana"
        );
    }
}
