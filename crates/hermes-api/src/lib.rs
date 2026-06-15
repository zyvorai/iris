// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post, put},
    Json, Router,
};
use hermes_core::store::Store;
use hermes_core::{
    allowed_namespaces_for_groups, build_diagnosis, build_federated_audit, build_federated_catalog, build_graph,
    build_team_owners, build_workspaces, can_perform_action, federation_cluster, filter_apps_by_workspace,
    list_clusters_with_federation, remote_publish, remote_publish_namespace, remote_rbac_check,
    remote_set_recommended, resolve_app_insight, resolve_discovery_insight, resolve_fleet_insight,
    resolve_graph_insight, resolve_namespace_insight, resolve_owner_insight,
    resolve_federated_insight, resolve_activity_insight,
    resolve_search_intent,
    resolve_search_with_llm, ai_status_with_probe, App, AppDiagnosis, AppGraph, AppInsight, AiStatus, AuditEvent, CatalogStats,
    ClusterInfo, ClusterSummary, CreateShareRequest, DiscoveryInsight, FederatedApp,
    FederatedAuditEvent, FederationActionResult, FederationRbacStatus, FleetInsight, GraphInsight,
    HealthSummary, NamespaceInsight, OwnerInsight, FederatedInsight, ActivityInsight, RoleRule, SearchHit, SearchIntent, ShareLink,
    ShareLinkResponse, TeamOwner, Workspace, WorkspaceRule,
};
use serde::Deserialize;

#[derive(Clone)]
pub struct ApiState {
    pub store: Arc<Store>,
    pub default_user: String,
    pub allowed_namespaces: Vec<String>,
    pub admin_users: Vec<String>,
    pub admin_groups: Vec<String>,
    pub workspace_rules: Vec<WorkspaceRule>,
    pub role_rules: Vec<RoleRule>,
}

pub fn routes(state: ApiState) -> Router {
    Router::new()
        .route("/apps", get(list_apps))
        .route("/apps/{*id}", get(get_app_or_diagnosis))
        .route("/catalog", get(list_catalog))
        .route("/catalog/federated", get(list_federated_catalog))
        .route("/federation/publish/{cluster_id}/{*id}", post(federation_publish))
        .route(
            "/federation/publish-namespace/{cluster_id}/{*namespace}",
            post(federation_publish_namespace),
        )
        .route(
            "/federation/recommended/{cluster_id}/{*id}",
            put(federation_set_recommended),
        )
        .route("/federation/rbac/{cluster_id}", get(federation_rbac_check))
        .route("/catalog/export", get(export_catalog))
        .route("/stats", get(catalog_stats))
        .route("/cluster/summary", get(cluster_summary))
        .route("/clusters", get(list_clusters_route))
        .route("/graph", get(app_graph))
        .route("/workspaces", get(list_workspaces))
        .route("/owners", get(list_owners))
        .route("/discovery", get(list_discovery))
        .route("/discovery/publish/{*id}", post(publish_app))
        .route("/discovery/publish-namespace/{*namespace}", post(publish_namespace))
        .route("/discovery/hide/{*id}", post(hide_app))
        .route("/search", get(search))
        .route("/search/intent", get(search_intent))
        .route("/search/llm", get(search_llm))
        .route("/insights/fleet", get(fleet_insight))
        .route("/insights/status", get(ai_status_route))
        .route("/insights/discovery", get(discovery_insight))
        .route("/insights/namespace/{namespace}", get(namespace_insight))
        .route("/insights/graph", get(graph_insight))
        .route("/insights/owner/{owner}", get(owner_insight))
        .route("/insights/federated", get(federated_insight))
        .route("/insights/activity", get(activity_insight))
        .route("/favorites", get(list_favorites))
        .route("/favorites/{*id}", put(add_favorite).delete(remove_favorite))
        .route("/recents", get(list_recents))
        .route("/recents/{*id}", post(record_recent))
        .route("/health/apps", get(health_apps))
        .route("/recommended", get(list_recommended))
        .route("/recommended/{*id}", put(set_recommended))
        .route("/shares", get(list_shares).post(create_share))
        .route("/shares/all", get(list_all_shares))
        .route("/shares/{token}", delete(delete_share))
        .route("/audit", get(list_audit))
        .route("/audit/federated", get(list_federated_audit))
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
    let apps = if st.allowed_namespaces.is_empty() {
        apps
    } else {
        apps.into_iter()
            .filter(|a| st.allowed_namespaces.iter().any(|ns| ns == &a.namespace))
            .collect()
    };
    apps
}

fn filter_apps_for_user(
    st: &ApiState,
    user: &str,
    groups: &[String],
    apps: Vec<App>,
) -> Vec<App> {
    let admin = is_admin(st, user, groups);
    let mut apps = filter_apps(st, apps);
    if !admin {
        if let Some(allowed_ns) = allowed_namespaces_for_groups(groups, &st.role_rules) {
            apps.retain(|a| allowed_ns.iter().any(|ns| ns == &a.namespace));
        }
    }
    if admin || st.workspace_rules.is_empty() {
        apps
    } else {
        filter_apps_by_workspace(&apps, groups, &st.workspace_rules)
    }
}

fn require_action(st: &ApiState, user: &str, groups: &[String], action: &str) -> Result<(), AppError> {
    if can_perform_action(groups, &st.role_rules, action, is_admin(st, user, groups)) {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

fn app_allowed(st: &ApiState, app: &App) -> bool {
    st.allowed_namespaces.is_empty()
        || st
            .allowed_namespaces
            .iter()
            .any(|ns| ns == &app.namespace)
}

fn is_admin(st: &ApiState, user: &str, groups: &[String]) -> bool {
    if !st.admin_users.is_empty() && st.admin_users.iter().any(|u| u == user) {
        return true;
    }
    if !st.admin_groups.is_empty() {
        return groups.iter().any(|g| st.admin_groups.iter().any(|ag| ag == g));
    }
    st.admin_users.is_empty() && st.admin_groups.is_empty() && user == st.default_user
}

fn user_groups(headers: &HeaderMap) -> Vec<String> {
    headers
        .get("x-hermes-groups")
        .and_then(|v| v.to_str().ok())
        .map(|raw| {
            raw.split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

async fn list_apps(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Vec<App>>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    Ok(Json(filter_apps_for_user(
        &st,
        &uid,
        &groups,
        st.store.list_apps(true)?,
    )))
}

async fn get_app_or_diagnosis(
    State(st): State<ApiState>,
    id: axum::extract::Path<String>,
) -> Result<Response, AppError> {
    let raw = normalize_id(id);
    if let Some(app_id) = raw.strip_suffix("/diagnosis") {
        let app_id = app_id.trim_end_matches('/');
        return Ok(Json(diagnosis_for_app(&st, app_id)?).into_response());
    }
    if let Some(app_id) = raw.strip_suffix("/insight") {
        let app_id = app_id.trim_end_matches('/');
        return Ok(Json(insight_for_app(&st, app_id).await?).into_response());
    }
    let app = st
        .store
        .get_app(&raw)?
        .ok_or(AppError::NotFound)?;
    if !app_allowed(&st, &app) {
        return Err(AppError::NotFound);
    }
    Ok(Json(app).into_response())
}

fn diagnosis_for_app(st: &ApiState, app_id: &str) -> Result<AppDiagnosis, AppError> {
    let app = st
        .store
        .get_app(app_id)?
        .ok_or(AppError::NotFound)?;
    if !app_allowed(st, &app) {
        return Err(AppError::NotFound);
    }
    if let Some(raw) = st.store.get_diagnosis_json(app_id)? {
        if let Ok(diag) = serde_json::from_str::<AppDiagnosis>(&raw) {
            return Ok(diag);
        }
    }
    Ok(build_diagnosis(&app))
}

async fn insight_for_app(st: &ApiState, app_id: &str) -> Result<AppInsight, AppError> {
    let app = st
        .store
        .get_app(app_id)?
        .ok_or(AppError::NotFound)?;
    if !app_allowed(st, &app) {
        return Err(AppError::NotFound);
    }
    let diagnosis = diagnosis_for_app(st, app_id)?;
    Ok(resolve_app_insight(&app, &diagnosis).await)
}

async fn ai_status_route() -> Json<AiStatus> {
    Json(ai_status_with_probe().await)
}

async fn fleet_insight(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<FleetInsight>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    let summary = st.store.cluster_summary()?;
    let insight = resolve_fleet_insight(&apps, &summary).await;
    let _ = st.store.record_audit(
        &uid,
        "search",
        "",
        &format!("fleet_insight source={}", insight.source),
    );
    Ok(Json(insight))
}

async fn discovery_insight(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<DiscoveryInsight>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let discovery = filter_apps_for_user(&st, &uid, &groups, st.store.list_discovery()?);
    let insight = resolve_discovery_insight(&discovery).await;
    let _ = st.store.record_audit(
        &uid,
        "search",
        "",
        &format!("discovery_insight source={}", insight.source),
    );
    Ok(Json(insight))
}

async fn namespace_insight(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Path(namespace): Path<String>,
) -> Result<Json<NamespaceInsight>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    let insight = resolve_namespace_insight(&namespace, &apps).await;
    let _ = st.store.record_audit(
        &uid,
        "search",
        "",
        &format!("namespace_insight ns={namespace} source={}", insight.source),
    );
    Ok(Json(insight))
}

async fn graph_insight(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<GraphInsight>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    let graph = build_graph(&apps);
    let insight = resolve_graph_insight(&graph).await;
    let _ = st.store.record_audit(
        &uid,
        "search",
        "",
        &format!("graph_insight source={}", insight.source),
    );
    Ok(Json(insight))
}

async fn owner_insight(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Path(owner): Path<String>,
) -> Result<Json<OwnerInsight>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    let insight = resolve_owner_insight(&owner, &apps).await;
    let _ = st.store.record_audit(
        &uid,
        "search",
        "",
        &format!("owner_insight owner={owner} source={}", insight.source),
    );
    Ok(Json(insight))
}

async fn federated_insight(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<FederatedInsight>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    let entries = build_federated_catalog(&apps).await;
    let insight = resolve_federated_insight(&entries).await;
    let _ = st.store.record_audit(
        &uid,
        "search",
        "",
        &format!("federated_insight source={}", insight.source),
    );
    Ok(Json(insight))
}

async fn activity_insight(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<ActivityInsight>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let events = st.store.list_audit(100)?;
    let insight = resolve_activity_insight(&events).await;
    let _ = st.store.record_audit(
        &uid,
        "search",
        "",
        &format!("activity_insight source={}", insight.source),
    );
    Ok(Json(insight))
}

async fn list_federated_catalog(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Vec<FederatedApp>>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    Ok(Json(build_federated_catalog(&apps).await))
}

async fn federation_publish(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Path((cluster_id, id)): Path<(String, String)>,
) -> Result<Json<FederationActionResult>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    require_action(&st, &uid, &groups, "publish")?;
    let cfg = federation_cluster(&cluster_id).ok_or(AppError::NotFound)?;
    let id = id.trim_start_matches('/').to_string();
    let result = remote_publish(&cfg, &id, &uid, &groups).await;
    let _ = st.store.record_audit(
        &uid,
        "federation_publish",
        &id,
        &format!("cluster={} ok={} {}", cluster_id, result.ok, result.detail),
    );
    Ok(Json(result))
}

async fn federation_publish_namespace(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Path((cluster_id, namespace)): Path<(String, String)>,
) -> Result<Json<FederationActionResult>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    require_action(&st, &uid, &groups, "publish")?;
    let cfg = federation_cluster(&cluster_id).ok_or(AppError::NotFound)?;
    let namespace = namespace.trim_start_matches('/').to_string();
    let result = remote_publish_namespace(&cfg, &namespace, &uid, &groups).await;
    let _ = st.store.record_audit(
        &uid,
        "federation_publish_namespace",
        &namespace,
        &format!("cluster={} ok={} {}", cluster_id, result.ok, result.detail),
    );
    Ok(Json(result))
}

#[derive(Deserialize)]
struct RecommendBody {
    recommended: bool,
}

async fn federation_set_recommended(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Path((cluster_id, id)): Path<(String, String)>,
    Json(body): Json<RecommendBody>,
) -> Result<Json<FederationActionResult>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    require_action(&st, &uid, &groups, "publish")?;
    let cfg = federation_cluster(&cluster_id).ok_or(AppError::NotFound)?;
    let id = id.trim_start_matches('/').to_string();
    let result = remote_set_recommended(&cfg, &id, body.recommended, &uid, &groups).await;
    let _ = st.store.record_audit(
        &uid,
        if body.recommended {
            "federation_recommend"
        } else {
            "federation_unrecommend"
        },
        &id,
        &format!("cluster={} ok={}", cluster_id, result.ok),
    );
    Ok(Json(result))
}

async fn federation_rbac_check(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Path(cluster_id): Path<String>,
) -> Result<Json<FederationRbacStatus>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let cfg = federation_cluster(&cluster_id).ok_or(AppError::NotFound)?;
    let result = remote_rbac_check(&cfg, &uid, &groups).await;
    let _ = st.store.record_audit(
        &uid,
        "federation_rbac_check",
        &cluster_id,
        &format!("ok={} actions={:?}", result.ok, result.allowed_actions),
    );
    Ok(Json(result))
}

async fn search_llm(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Query(q): Query<SearchQuery>,
) -> Result<Json<SearchIntent>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    let intent = resolve_search_with_llm(&apps, &q.q).await;
    let _ = st.store.record_audit(
        &uid,
        "search",
        "",
        &format!("llm={} q={}", intent.intent, q.q.trim()),
    );
    Ok(Json(intent))
}

async fn list_catalog(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Vec<App>>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    Ok(Json(filter_apps_for_user(
        &st,
        &uid,
        &groups,
        st.store.list_catalog()?,
    )))
}

async fn export_catalog(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    let body = serde_json::to_string_pretty(&apps)?;
    Ok((
        [(axum::http::header::CONTENT_TYPE, "application/json")],
        body,
    )
        .into_response())
}

async fn catalog_stats(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<CatalogStats>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let mut stats = st.store.catalog_stats()?;
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    stats.total = apps.len();
    stats.published = apps.iter().filter(|a| a.visibility.published).count();
    stats.recommended = apps.iter().filter(|a| a.meta.recommended).count();
    Ok(Json(stats))
}

async fn cluster_summary(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<ClusterSummary>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
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

async fn app_graph(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<AppGraph>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    Ok(Json(build_graph(&apps)))
}

async fn list_workspaces(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Vec<Workspace>>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    Ok(Json(build_workspaces(&apps)))
}

async fn list_owners(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Vec<TeamOwner>>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    Ok(Json(build_team_owners(&apps)))
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
    let groups = user_groups(&headers);
    require_action(&st, &uid, &groups, "publish")?;
    let id = normalize_id(id);
    if let Some(app) = st.store.get_app(&id)? {
        if !app_allowed(&st, &app) {
            return Err(AppError::NotFound);
        }
        if !hermes_core::namespace_allowed(&app.namespace, &groups).await {
            return Err(AppError::Forbidden);
        }
    }
    st.store.publish_app(&id)?;
    let _ = st.store.record_audit(&uid, "publish", &id, "published from discovery");
    Ok(StatusCode::NO_CONTENT)
}

async fn publish_namespace(
    State(st): State<ApiState>,
    headers: HeaderMap,
    namespace: axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    require_action(&st, &uid, &groups, "publish")?;
    let ns = normalize_id(namespace);
    if !st.allowed_namespaces.is_empty()
        && !st.allowed_namespaces.iter().any(|n| n == &ns)
    {
        return Err(AppError::NotFound);
    }
    let n = st.store.publish_namespace(&ns)?;
    let _ = st.store.record_audit(
        &uid,
        "publish_namespace",
        &ns,
        &format!("published {n} apps"),
    );
    Ok(Json(serde_json::json!({ "published": n, "namespace": ns })))
}

async fn hide_app(
    State(st): State<ApiState>,
    headers: HeaderMap,
    id: axum::extract::Path<String>,
) -> Result<StatusCode, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    require_action(&st, &uid, &groups, "hide")?;
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

async fn search_intent(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Query(q): Query<SearchQuery>,
) -> Result<Json<SearchIntent>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    let intent = resolve_search_intent(&apps, &q.q);
    let _ = st.store.record_audit(
        &uid,
        "search",
        "",
        &format!("intent={} q={}", intent.intent, q.q.trim()),
    );
    Ok(Json(intent))
}

async fn list_clusters_route(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Vec<ClusterInfo>>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    Ok(Json(list_clusters_with_federation(&apps).await))
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

async fn health_apps(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<HealthSummary>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_apps(true)?);
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

async fn list_federated_audit(
    State(st): State<ApiState>,
    Query(q): Query<AuditQuery>,
) -> Result<Json<Vec<FederatedAuditEvent>>, AppError> {
    let local = st.store.list_audit(q.limit)?;
    Ok(Json(build_federated_audit(local, q.limit).await))
}

async fn list_recommended(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Vec<App>>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_apps(true)?);
    Ok(Json(
        apps.into_iter()
            .filter(|a| a.meta.recommended)
            .collect(),
    ))
}

#[derive(Deserialize)]
struct RecommendedBody {
    recommended: bool,
}

async fn set_recommended(
    State(st): State<ApiState>,
    headers: HeaderMap,
    id: axum::extract::Path<String>,
    Json(body): Json<RecommendedBody>,
) -> Result<Json<App>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let id = normalize_id(id);
    let app = st
        .store
        .get_app(&id)?
        .ok_or(AppError::NotFound)?;
    if !app_allowed(&st, &app) {
        return Err(AppError::NotFound);
    }
    st.store.set_app_recommended(&id, body.recommended)?;
    let _ = st.store.record_audit(
        &uid,
        if body.recommended {
            "recommend"
        } else {
            "unrecommend"
        },
        &id,
        "team pick updated from dock",
    );
    let mut updated = st
        .store
        .get_app(&id)?
        .ok_or(AppError::NotFound)?;
    updated.meta.recommended = body.recommended;
    Ok(Json(updated))
}

async fn list_shares(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Vec<ShareLinkResponse>>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let links = st.store.list_shares(&uid)?;
    Ok(Json(
        links
            .into_iter()
            .map(|link| share_response(&link))
            .collect(),
    ))
}

async fn create_share(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Json(body): Json<CreateShareRequest>,
) -> Result<Json<ShareLinkResponse>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    require_action(&st, &uid, &groups, "share")?;
    if body.app_id.trim().is_empty() {
        return Err(AppError::BadRequest);
    }
    let app = st
        .store
        .get_app(&body.app_id)?
        .ok_or(AppError::NotFound)?;
    if !app_allowed(&st, &app) {
        return Err(AppError::NotFound);
    }
    if !app.visibility.published {
        return Err(AppError::BadRequest);
    }
    let link = st.store.create_share(
        &body.app_id,
        &uid,
        body.ttl_minutes,
        &body.label,
    )?;
    let _ = st.store.record_audit(
        &uid,
        "share_create",
        &body.app_id,
        &format!("token={} ttl={}m", link.token, body.ttl_minutes),
    );
    Ok(Json(share_response(&link)))
}

async fn list_all_shares(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Vec<ShareLink>>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    if !is_admin(&st, &uid, &groups) {
        return Err(AppError::Forbidden);
    }
    Ok(Json(st.store.list_all_shares()?))
}

async fn delete_share(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Path(share_token): Path<String>,
) -> Result<StatusCode, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let deleted = if is_admin(&st, &uid, &groups) {
        st.store.delete_share_admin(&share_token)?
    } else {
        st.store.delete_share(&share_token, &uid)?
    };
    if !deleted {
        return Err(AppError::NotFound);
    }
    let _ = st.store.record_audit(
        &uid,
        "share_revoke",
        "",
        &format!("token={share_token}"),
    );
    Ok(StatusCode::NO_CONTENT)
}

fn share_response(link: &ShareLink) -> ShareLinkResponse {
    ShareLinkResponse {
        token: link.token.clone(),
        app_id: link.app_id.clone(),
        share_path: format!("/launchpad/s/{}", link.token),
        expires_at: link.expires_at.clone(),
        created_at: link.created_at.clone(),
        label: link.label.clone(),
    }
}

#[derive(Debug)]
pub enum AppError {
    NotFound,
    BadRequest,
    Forbidden,
    Internal(anyhow::Error),
}

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        AppError::Internal(e)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Internal(e.into())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        match self {
            AppError::NotFound => (StatusCode::NOT_FOUND, "not found").into_response(),
            AppError::BadRequest => (StatusCode::BAD_REQUEST, "bad request").into_response(),
            AppError::Forbidden => (StatusCode::FORBIDDEN, "forbidden").into_response(),
            AppError::Internal(e) => {
                tracing::error!("api error: {e:#}");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
            }
        }
    }
}
