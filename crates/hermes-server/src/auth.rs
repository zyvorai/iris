// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use anyhow::{anyhow, Context, Result};
use axum::{
    body::Body,
    extract::{Query, State},
    http::{header, HeaderMap, HeaderName, HeaderValue, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Redirect, Response},
    routing::{get, post},
    Json, Router,
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::RngCore;
use serde::{Deserialize, Serialize};

const SESSION_COOKIE: &str = "hermes_session";

#[derive(Clone)]
pub struct AuthConfig {
    pub mode: String,
    pub api_key: String,
    pub fallback_user: String,
    pub session_secret: String,
    pub oidc_issuer: String,
    pub oidc_client_id: String,
    pub oidc_client_secret: String,
    pub oidc_redirect_url: String,
    // value is expiry unix-seconds; states older than 5 minutes are swept on login
    pub pending_states: Arc<Mutex<HashMap<String, u64>>>,
}

impl AuthConfig {
    pub fn from_env(fallback_user: String) -> Result<Self> {
        const DEV_SECRET: &str = "hermes-dev-session-secret-change-me";
        let session_secret = std::env::var("HERMES_SESSION_SECRET")
            .unwrap_or_else(|_| DEV_SECRET.into());
        if session_secret == DEV_SECRET {
            tracing::warn!(
                "HERMES_SESSION_SECRET is using the insecure development default. \
                 Set it to a random secret (e.g. `openssl rand -hex 32`) before deploying."
            );
        }
        Ok(Self {
            mode: std::env::var("HERMES_AUTH_MODE").unwrap_or_else(|_| "none".into()),
            api_key: std::env::var("HERMES_API_KEY").unwrap_or_default(),
            fallback_user,
            session_secret,
            oidc_issuer: std::env::var("HERMES_OIDC_ISSUER").unwrap_or_default(),
            oidc_client_id: std::env::var("HERMES_OIDC_CLIENT_ID").unwrap_or_default(),
            oidc_client_secret: std::env::var("HERMES_OIDC_CLIENT_SECRET").unwrap_or_default(),
            oidc_redirect_url: std::env::var("HERMES_OIDC_REDIRECT_URL").unwrap_or_default(),
            pending_states: Arc::new(Mutex::new(HashMap::new())),
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct SessionClaims {
    sub: String,
    email: Option<String>,
    #[serde(default)]
    groups: Vec<String>,
    exp: usize,
}

#[derive(Debug, Deserialize)]
struct OidcDiscovery {
    authorization_endpoint: String,
    token_endpoint: String,
    #[serde(default)]
    userinfo_endpoint: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    #[serde(default)]
    id_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OidcUserInfo {
    sub: String,
    email: Option<String>,
    preferred_username: Option<String>,
    #[serde(default)]
    groups: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthMe {
    authenticated: bool,
    user_id: String,
    mode: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    groups: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    allowed_workspaces: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    allowed_actions: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

pub fn routes(cfg: AuthConfig) -> Router {
    Router::new()
        .route("/auth/login", get(login))
        .route("/auth/callback", get(callback))
        .route("/auth/logout", post(logout))
        .route("/auth/me", get(me))
        .with_state(cfg)
}

pub fn split_csv(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect()
}

pub async fn require_auth(
    State(auth): State<AuthConfig>,
    mut req: Request<Body>,
    next: Next,
) -> Response {
    if auth.mode == "none" {
        return next.run(req).await;
    }

    let jar = jar_from_headers(req.headers());
    if let Some(user) = user_from_session(&auth, &jar) {
        let groups = groups_from_session(&auth, &jar);
        let _ = req.headers_mut().insert(
            HeaderName::from_static("x-hermes-user"),
            HeaderValue::from_str(&user).unwrap_or(HeaderValue::from_static("local")),
        );
        if !groups.is_empty() {
            let _ = req.headers_mut().insert(
                HeaderName::from_static("x-hermes-groups"),
                HeaderValue::from_str(&groups).unwrap_or(HeaderValue::from_static("")),
            );
        }
        return next.run(req).await;
    }

    if auth.mode == "api_key" {
        if auth.api_key.is_empty() {
            return (StatusCode::INTERNAL_SERVER_ERROR, "auth misconfigured").into_response();
        }
        let authorized = req
            .headers()
            .get("x-hermes-key")
            .and_then(|v| v.to_str().ok())
            .map(|v| v == auth.api_key)
            .unwrap_or(false)
            || req
                .headers()
                .get(header::AUTHORIZATION)
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.strip_prefix("Bearer "))
                .map(|v| v == auth.api_key)
                .unwrap_or(false);
        if authorized {
            if federation_trust_headers() {
                if req
                    .headers()
                    .get("x-hermes-user")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| !s.is_empty())
                    .unwrap_or(false)
                {
                    return next.run(req).await;
                }
            }
            let _ = req.headers_mut().insert(
                HeaderName::from_static("x-hermes-user"),
                HeaderValue::from_static("api-key"),
            );
            return next.run(req).await;
        }
        return (StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }

    if auth.mode == "oidc" {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "login_required", "loginUrl": "/auth/login" })),
        )
            .into_response();
    }

    next.run(req).await
}

fn jar_from_headers(headers: &HeaderMap) -> CookieJar {
    let mut jar = CookieJar::new();
    if let Some(cookie_header) = headers.get(header::COOKIE) {
        if let Ok(raw) = cookie_header.to_str() {
            for part in raw.split(';') {
                let part = part.trim();
                if let Some((name, value)) = part.split_once('=') {
                    let name = name.trim().to_string();
                    let value = value.trim().to_string();
                    let mut cookie = Cookie::new(name, value);
                    cookie.set_path("/");
                    jar = jar.add(cookie);
                }
            }
        }
    }
    jar
}

fn groups_from_session(auth: &AuthConfig, jar: &CookieJar) -> String {
    if auth.mode != "oidc" {
        return String::new();
    }
    let token = match jar.get(SESSION_COOKIE) {
        Some(c) => c.value(),
        None => return String::new(),
    };
    decode_session(token, &auth.session_secret)
        .ok()
        .map(|claims| claims.groups.join(","))
        .unwrap_or_default()
}

fn user_from_session(auth: &AuthConfig, jar: &CookieJar) -> Option<String> {
    if auth.mode != "oidc" {
        return None;
    }
    let token = jar.get(SESSION_COOKIE)?.value();
    let claims = decode_session(token, &auth.session_secret).ok()?;
    Some(display_user(&claims))
}

async fn login(State(auth): State<AuthConfig>) -> Result<Response, AppAuthError> {
    if auth.mode != "oidc" {
        return Err(AppAuthError::BadRequest("OIDC not enabled"));
    }
    let discovery = fetch_discovery(&auth.oidc_issuer).await?;
    let state = random_token();
    let expiry = (SystemTime::now() + Duration::from_secs(300))
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    {
        let mut pending = auth.pending_states.lock().unwrap();
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
        pending.retain(|_, exp| *exp > now);
        pending.insert(state.clone(), expiry);
    }

    let url = format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&scope=openid%20profile%20email&state={}",
        discovery.authorization_endpoint,
        urlencoding(&auth.oidc_client_id),
        urlencoding(&auth.oidc_redirect_url),
        urlencoding(&state),
    );

    let mut response = Redirect::temporary(&url).into_response();
    let return_to = Cookie::build(("hermes_auth_return", "/"))
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .build();
    response.headers_mut().append(
        header::SET_COOKIE,
        HeaderValue::from_str(&return_to.to_string()).unwrap(),
    );
    Ok(response)
}

async fn callback(
    State(auth): State<AuthConfig>,
    Query(q): Query<CallbackQuery>,
    jar: CookieJar,
) -> Result<Response, AppAuthError> {
    if auth.mode != "oidc" {
        return Err(AppAuthError::BadRequest("OIDC not enabled"));
    }
    if q.error.is_some() {
        return Err(AppAuthError::BadRequest("OIDC login denied"));
    }
    let code = q
        .code
        .ok_or(AppAuthError::BadRequest("missing authorization code"))?;
    let state = q
        .state
        .ok_or(AppAuthError::BadRequest("missing state"))?;
    {
        let mut pending = auth.pending_states.lock().unwrap();
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
        match pending.remove(&state) {
            None => return Err(AppAuthError::BadRequest("invalid or unknown state")),
            Some(exp) if exp < now => return Err(AppAuthError::BadRequest("state token expired")),
            Some(_) => {}
        }
    }

    let discovery = fetch_discovery(&auth.oidc_issuer).await?;
    let token = exchange_code(&auth, &discovery, &code).await?;
    let user = fetch_userinfo(&discovery, &token.access_token).await?;

    let claims = SessionClaims {
        sub: user.sub.clone(),
        email: user.email.or(user.preferred_username),
        groups: user.groups,
        exp: (SystemTime::now() + Duration::from_secs(86400))
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as usize,
    };
    let session = sign_session(&claims, &auth.session_secret)?;
    let cookie = Cookie::build((SESSION_COOKIE, session))
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .max_age(time::Duration::seconds(86400))
        .build();

    let return_to = jar
        .get("hermes_auth_return")
        .map(|c| c.value().to_string())
        .unwrap_or_else(|| "/".into());

    let mut response = Redirect::temporary(&return_to).into_response();
    response
        .headers_mut()
        .append(header::SET_COOKIE, HeaderValue::from_str(&cookie.to_string()).unwrap());
    Ok(response)
}

async fn logout(State(_auth): State<AuthConfig>) -> Response {
    let cleared = Cookie::build((SESSION_COOKIE, ""))
        .path("/")
        .http_only(true)
        .same_site(SameSite::Lax)
        .max_age(time::Duration::seconds(0))
        .build();
    let mut response = (StatusCode::NO_CONTENT).into_response();
    response
        .headers_mut()
        .append(header::SET_COOKIE, HeaderValue::from_str(&cleared.to_string()).unwrap());
    response
}

async fn me(State(auth): State<AuthConfig>, headers: HeaderMap) -> Json<AuthMe> {
    let jar = jar_from_headers(&headers);
    let user = user_from_session(&auth, &jar);
    let groups = groups_from_session(&auth, &jar)
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    let header_user = headers
        .get("x-hermes-user")
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let header_groups = headers
        .get("x-hermes-groups")
        .and_then(|v| v.to_str().ok())
        .map(|raw| {
            raw
                .split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let user_id = user
        .clone()
        .or(header_user.clone())
        .unwrap_or_else(|| auth.fallback_user.clone());
    let has_header_user = header_user.is_some();
    let groups = if user.is_some() {
        groups
    } else if !header_groups.is_empty() {
        header_groups
    } else {
        groups
    };
    let rules = hermes_core::workspace_acl::workspace_rules_from_env();
    let role_rules = hermes_core::rbac::role_rules_from_env();
    let admin_users = split_csv(&std::env::var("HERMES_ADMIN_USERS").unwrap_or_default());
    let admin_groups = split_csv(&std::env::var("HERMES_ADMIN_GROUPS").unwrap_or_default());
    let is_admin = (!admin_users.is_empty() && admin_users.iter().any(|u| u == &user_id))
        || groups.iter().any(|g| admin_groups.iter().any(|ag| ag == g));
    Json(AuthMe {
        authenticated: user.is_some() || has_header_user,
        user_id,
        mode: auth.mode.clone(),
        groups: groups.clone(),
        allowed_workspaces: hermes_core::workspace_acl::allowed_workspaces(&groups, &rules),
        allowed_actions: hermes_core::rbac::allowed_actions_for_groups(&groups, &role_rules, is_admin),
    })
}

pub async fn ws_echo(ws: axum::extract::WebSocketUpgrade) -> Response {
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

fn display_user(claims: &SessionClaims) -> String {
    claims
        .email
        .clone()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| claims.sub.clone())
}

fn sign_session(claims: &SessionClaims, secret: &str) -> Result<String> {
    encode(
        &Header::default(),
        claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(Into::into)
}

fn decode_session(token: &str, secret: &str) -> Result<SessionClaims> {
    let data = decode::<SessionClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(data.claims)
}

async fn fetch_discovery(issuer: &str) -> Result<OidcDiscovery> {
    if issuer.is_empty() {
        return Err(anyhow!("HERMES_OIDC_ISSUER is required"));
    }
    let url = format!(
        "{}/.well-known/openid-configuration",
        issuer.trim_end_matches('/')
    );
    reqwest::Client::new()
        .get(url)
        .send()
        .await
        .context("fetch oidc discovery")?
        .json()
        .await
        .context("parse oidc discovery")
}

async fn exchange_code(
    auth: &AuthConfig,
    discovery: &OidcDiscovery,
    code: &str,
) -> Result<TokenResponse> {
    if auth.oidc_client_id.is_empty() || auth.oidc_redirect_url.is_empty() {
        return Err(anyhow!("HERMES_OIDC_CLIENT_ID and HERMES_OIDC_REDIRECT_URL are required"));
    }
    let mut form = vec![
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", auth.oidc_redirect_url.as_str()),
        ("client_id", auth.oidc_client_id.as_str()),
    ];
    if !auth.oidc_client_secret.is_empty() {
        form.push(("client_secret", auth.oidc_client_secret.as_str()));
    }
    reqwest::Client::new()
        .post(&discovery.token_endpoint)
        .form(&form)
        .send()
        .await
        .context("token exchange")?
        .json()
        .await
        .context("parse token response")
}

async fn fetch_userinfo(discovery: &OidcDiscovery, access_token: &str) -> Result<OidcUserInfo> {
    if let Some(url) = &discovery.userinfo_endpoint {
        let resp = reqwest::Client::new()
            .get(url)
            .bearer_auth(access_token)
            .send()
            .await
            .context("userinfo request")?;
        if resp.status().is_success() {
            return resp.json().await.context("parse userinfo");
        }
    }
    Ok(OidcUserInfo {
        sub: random_token(),
        email: None,
        preferred_username: Some("oidc-user".into()),
        groups: vec![],
    })
}

fn random_token() -> String {
    let mut bytes = [0u8; 8];
    rand::thread_rng().fill_bytes(&mut bytes);
    format!("oidc-{}", hex_encode(&bytes))
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn federation_trust_headers() -> bool {
    std::env::var("HERMES_FEDERATION_TRUST_HEADERS")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn urlencoding(raw: &str) -> String {
    raw.chars()
        .map(|c| match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            _ => format!("%{:02X}", c as u8),
        })
        .collect()
}

#[derive(Debug)]
enum AppAuthError {
    BadRequest(&'static str),
    Internal(anyhow::Error),
}

impl IntoResponse for AppAuthError {
    fn into_response(self) -> Response {
        match self {
            AppAuthError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg).into_response(),
            AppAuthError::Internal(e) => {
                tracing::error!("auth error: {e:#}");
                (StatusCode::INTERNAL_SERVER_ERROR, "auth error").into_response()
            }
        }
    }
}

impl From<anyhow::Error> for AppAuthError {
    fn from(e: anyhow::Error) -> Self {
        AppAuthError::Internal(e)
    }
}

impl From<jsonwebtoken::errors::Error> for AppAuthError {
    fn from(e: jsonwebtoken::errors::Error) -> Self {
        AppAuthError::Internal(e.into())
    }
}
