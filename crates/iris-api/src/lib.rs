// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post, put},
    Json, Router,
};
use iris_core::store::Store;
use iris_core::{
    ai_status_with_probe, allowed_namespaces_for_groups, analyze_app_impact, analyze_impact,
    app_history, build_diagnosis, build_federated_audit, build_federated_catalog, build_graph,
    build_team_owners, build_workspaces, campaign_progress, can_perform_action, catalog_csv,
    check_conformance, federation_cluster, filter_apps_by_workspace, list_clusters_with_federation,
    remote_publish, remote_publish_namespace, remote_rbac_check, remote_set_recommended,
    resolve_activity_insight, resolve_app_insight, resolve_discovery_insight,
    resolve_federated_insight, resolve_fleet_insight, resolve_graph_insight,
    resolve_namespace_insight, resolve_owner_insight, resolve_search_intent,
    resolve_search_with_llm, scorecard, stale_apps, uptime_report, ActivityInsight, AiStatus, App,
    AppDiagnosis, AppGraph, AppHistory, AppInsight, AuditEvent, Campaign, CampaignProgress,
    CatalogStats, ClusterInfo, ClusterSummary, ConformancePolicy, ConformanceReport,
    CreateCampaignRequest, CreateExemptionRequest, CreateShareRequest, Created, DiscoveryInsight,
    Exemption, ExemptionView, FederatedApp, FederatedAuditEvent, FederatedInsight,
    FederationActionResult, FederationRbacStatus, FleetInsight, GraphInsight, HealthSummary,
    ImpactReport, NamespaceInsight, OwnerInsight, RoleRule, Scorecard, SearchHit, SearchIntent,
    ShareLink, ShareLinkResponse, TeamOwner, UptimeReport, Workspace, WorkspaceRule,
    DEFAULT_HISTORY_DAYS, DEFAULT_STALE_DAYS, MAX_HISTORY_DAYS,
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
        .route(
            "/federation/publish/{cluster_id}/{*id}",
            post(federation_publish),
        )
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
        .route("/impact", get(impact_report))
        .route("/conformance", get(conformance_report))
        .route("/scorecard", get(scorecard_report))
        .route("/stale", get(stale_report))
        .route("/exemptions", get(list_exemptions).post(create_exemption))
        .route("/exemptions/{id}", delete(delete_exemption))
        .route("/campaigns", get(list_campaigns).post(create_campaign))
        .route("/campaigns/{id}", delete(delete_campaign))
        .route("/history", get(status_history))
        .route("/uptime", get(fleet_uptime))
        .route("/workspaces", get(list_workspaces))
        .route("/owners", get(list_owners))
        .route("/discovery", get(list_discovery))
        .route("/discovery/publish/{*id}", post(publish_app))
        .route(
            "/discovery/publish-namespace/{*namespace}",
            post(publish_namespace),
        )
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
        .route(
            "/favorites/{*id}",
            put(add_favorite).delete(remove_favorite),
        )
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
        .get("x-iris-user")
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

fn filter_apps_for_user(st: &ApiState, user: &str, groups: &[String], apps: Vec<App>) -> Vec<App> {
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

fn require_action(
    st: &ApiState,
    user: &str,
    groups: &[String],
    action: &str,
) -> Result<(), AppError> {
    if can_perform_action(groups, &st.role_rules, action, is_admin(st, user, groups)) {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

fn app_allowed(st: &ApiState, app: &App) -> bool {
    st.allowed_namespaces.is_empty() || st.allowed_namespaces.iter().any(|ns| ns == &app.namespace)
}

fn is_admin(st: &ApiState, user: &str, groups: &[String]) -> bool {
    if !st.admin_users.is_empty() && st.admin_users.iter().any(|u| u == user) {
        return true;
    }
    if !st.admin_groups.is_empty() {
        return groups
            .iter()
            .any(|g| st.admin_groups.iter().any(|ag| ag == g));
    }
    st.admin_users.is_empty() && st.admin_groups.is_empty() && user == st.default_user
}

fn user_groups(headers: &HeaderMap) -> Vec<String> {
    headers
        .get("x-iris-groups")
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
    let app = st.store.get_app(&raw)?.ok_or(AppError::NotFound)?;
    if !app_allowed(&st, &app) {
        return Err(AppError::NotFound);
    }
    Ok(Json(app).into_response())
}

fn diagnosis_for_app(st: &ApiState, app_id: &str) -> Result<AppDiagnosis, AppError> {
    let app = st.store.get_app(app_id)?.ok_or(AppError::NotFound)?;
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
    let app = st.store.get_app(app_id)?.ok_or(AppError::NotFound)?;
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

#[derive(Deserialize)]
struct ExportQuery {
    format: Option<String>,
}

async fn export_catalog(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Query(q): Query<ExportQuery>,
) -> Result<Response, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    match q.format.as_deref() {
        None | Some("") | Some("json") => {}
        Some("csv") => {
            return Ok((
                [
                    (axum::http::header::CONTENT_TYPE, "text/csv; charset=utf-8"),
                    (
                        axum::http::header::CONTENT_DISPOSITION,
                        "attachment; filename=\"iris-catalog.csv\"",
                    ),
                ],
                catalog_csv(&apps),
            )
                .into_response())
        }
        Some(_) => {
            return Ok((StatusCode::BAD_REQUEST, "format must be json or csv").into_response())
        }
    }
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

#[derive(Deserialize)]
struct ImpactQuery {
    /// Optional app id (`namespace/slug`): return the detail view for one app.
    app: Option<String>,
}

#[derive(Deserialize)]
struct ConformanceQuery {
    owner: Option<String>,
    namespace: Option<String>,
}

async fn impact_report(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Query(q): Query<ImpactQuery>,
) -> Result<Response, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    match q.app {
        Some(id) => match analyze_app_impact(&apps, &id) {
            Some(detail) => Ok(Json(detail).into_response()),
            None => Ok((StatusCode::NOT_FOUND, "app not found").into_response()),
        },
        None => Ok(Json::<ImpactReport>(analyze_impact(&apps)).into_response()),
    }
}

async fn conformance_report(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Query(q): Query<ConformanceQuery>,
) -> Result<Json<ConformanceReport>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    Ok(Json(evaluate_conformance(&st, &apps, q)?))
}

/// Conformance under the configured policy, with active exemptions applied and
/// the optional owner / namespace filters.
fn evaluate_conformance(
    st: &ApiState,
    apps: &[App],
    q: ConformanceQuery,
) -> Result<ConformanceReport, AppError> {
    let mut report = check_conformance(apps, &ConformancePolicy::from_env());
    report.apply_exemptions(&st.store.list_exemptions()?, chrono::Utc::now());
    let owner = q.owner.filter(|v| !v.is_empty() && v.len() <= 253);
    let ns = q.namespace.filter(|v| !v.is_empty() && v.len() <= 253);
    report.filter(owner.as_deref(), ns.as_deref());
    Ok(report)
}

async fn scorecard_report(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Query(q): Query<ConformanceQuery>,
) -> Result<Json<Scorecard>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    Ok(Json(scorecard(&evaluate_conformance(&st, &apps, q)?)))
}

#[derive(Deserialize)]
struct StaleQuery {
    days: Option<String>,
}

async fn stale_report(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Query(q): Query<StaleQuery>,
) -> Result<Response, AppError> {
    let days = match q.days.as_deref() {
        None | Some("") => DEFAULT_STALE_DAYS,
        Some(v) => match v.parse::<i64>() {
            Ok(d) => d,
            Err(_) => {
                return Ok((StatusCode::BAD_REQUEST, "days must be an integer").into_response())
            }
        },
    };
    let uid = user_id(&headers, &st.default_user);
    let groups = user_groups(&headers);
    let apps = filter_apps_for_user(&st, &uid, &groups, st.store.list_catalog()?);
    Ok(Json(stale_apps(&apps, days, chrono::Utc::now())).into_response())
}

fn require_admin(st: &ApiState, user: &str, groups: &[String]) -> Result<(), AppError> {
    if is_admin(st, user, groups) {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

/// Catalog apps the caller may see.
fn visible_catalog(st: &ApiState, headers: &HeaderMap) -> Result<Vec<App>, AppError> {
    let uid = user_id(headers, &st.default_user);
    let groups = user_groups(headers);
    Ok(filter_apps_for_user(
        st,
        &uid,
        &groups,
        st.store.list_catalog()?,
    ))
}

/// Admins see every exemption (so orphaned ones can be removed); others only
/// those of apps they can see.
async fn list_exemptions(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Vec<ExemptionView>>, AppError> {
    let uid = user_id(&headers, &st.default_user);
    let admin = is_admin(&st, &uid, &user_groups(&headers));
    let visible: std::collections::HashSet<String> = visible_catalog(&st, &headers)?
        .into_iter()
        .map(|a| a.id)
        .collect();
    let now = chrono::Utc::now();
    Ok(Json(
        st.store
            .list_exemptions()?
            .into_iter()
            .filter(|e| admin || visible.contains(&e.app_id))
            .map(|e| ExemptionView {
                status: if e.is_active(now) {
                    "active".into()
                } else {
                    "expired".into()
                },
                exemption: e,
            })
            .collect(),
    ))
}

async fn create_exemption(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Json(body): Json<CreateExemptionRequest>,
) -> Result<(StatusCode, Json<Exemption>), AppError> {
    let uid = user_id(&headers, &st.default_user);
    require_admin(&st, &uid, &user_groups(&headers))?;
    body.validate().map_err(AppError::Invalid)?;
    if !visible_catalog(&st, &headers)?
        .iter()
        .any(|a| a.id == body.app_id)
    {
        return Err(AppError::NotFound);
    }
    match st.store.create_exemption(&body, &uid, chrono::Utc::now())? {
        Created::Ok(e) => {
            let _ = st.store.record_audit(
                &uid,
                "exemption_create",
                &e.app_id,
                &format!("rule={} expires={}", e.rule, e.expires_at),
            );
            Ok((StatusCode::CREATED, Json(e)))
        }
        Created::Duplicate => Err(AppError::Conflict(
            "an active exemption already covers this app and rule",
        )),
        Created::Full => Err(AppError::Conflict("exemption limit reached")),
    }
}

async fn delete_exemption(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let uid = user_id(&headers, &st.default_user);
    require_admin(&st, &uid, &user_groups(&headers))?;
    if !st.store.delete_exemption(&id)? {
        return Err(AppError::NotFound);
    }
    let _ = st
        .store
        .record_audit(&uid, "exemption_revoke", "", &format!("id={id}"));
    Ok(StatusCode::NO_CONTENT)
}

async fn list_campaigns(
    State(st): State<ApiState>,
    headers: HeaderMap,
) -> Result<Json<Vec<CampaignProgress>>, AppError> {
    let apps = visible_catalog(&st, &headers)?;
    let policy = ConformancePolicy::from_env();
    let exemptions = st.store.list_exemptions()?;
    let now = chrono::Utc::now();
    Ok(Json(
        st.store
            .list_campaigns()?
            .iter()
            .map(|c| campaign_progress(c, &apps, &policy, &exemptions, now))
            .collect(),
    ))
}

async fn create_campaign(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Json(body): Json<CreateCampaignRequest>,
) -> Result<(StatusCode, Json<Campaign>), AppError> {
    let uid = user_id(&headers, &st.default_user);
    require_admin(&st, &uid, &user_groups(&headers))?;
    let body = body.normalize().map_err(AppError::Invalid)?;
    match st.store.create_campaign(body, &uid, chrono::Utc::now())? {
        Created::Ok(c) => {
            let _ = st.store.record_audit(
                &uid,
                "campaign_create",
                "",
                &format!("id={} due={}", c.id, c.due_date),
            );
            Ok((StatusCode::CREATED, Json(c)))
        }
        Created::Duplicate | Created::Full => Err(AppError::Conflict("campaign limit reached")),
    }
}

async fn delete_campaign(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    let uid = user_id(&headers, &st.default_user);
    require_admin(&st, &uid, &user_groups(&headers))?;
    if !st.store.delete_campaign(&id)? {
        return Err(AppError::NotFound);
    }
    let _ = st
        .store
        .record_audit(&uid, "campaign_delete", "", &format!("id={id}"));
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct HistoryQuery {
    app: Option<String>,
    days: Option<String>,
}

fn parse_days(raw: Option<&str>) -> Result<i64, AppError> {
    match raw {
        None | Some("") => Ok(DEFAULT_HISTORY_DAYS),
        Some(v) => v
            .parse::<i64>()
            .map(|d| d.clamp(1, MAX_HISTORY_DAYS))
            .map_err(|_| AppError::Invalid("days must be an integer".into())),
    }
}

async fn status_history(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Query(q): Query<HistoryQuery>,
) -> Result<Json<AppHistory>, AppError> {
    let days = parse_days(q.days.as_deref())?;
    let id = q
        .app
        .filter(|v| !v.is_empty())
        .ok_or_else(|| AppError::Invalid("app is required".into()))?;
    let app = visible_catalog(&st, &headers)?
        .into_iter()
        .find(|a| a.id == id)
        .ok_or(AppError::NotFound)?;
    let now = chrono::Utc::now();
    let events = st
        .store
        .list_status_events(Some(&app.id), now - chrono::Duration::days(days))?;
    Ok(Json(app_history(&app, &events, days, now)))
}

async fn fleet_uptime(
    State(st): State<ApiState>,
    headers: HeaderMap,
    Query(q): Query<HistoryQuery>,
) -> Result<Json<UptimeReport>, AppError> {
    let days = parse_days(q.days.as_deref())?;
    let mut apps = visible_catalog(&st, &headers)?;
    apps.retain(|a| a.visibility.published);
    let now = chrono::Utc::now();
    let events = st
        .store
        .list_status_events(None, now - chrono::Duration::days(days))?;
    Ok(Json(uptime_report(&apps, &events, days, now)))
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
        if !iris_core::namespace_allowed(&app.namespace, &groups).await {
            return Err(AppError::Forbidden);
        }
    }
    st.store.publish_app(&id)?;
    let _ = st
        .store
        .record_audit(&uid, "publish", &id, "published from discovery");
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
    if !st.allowed_namespaces.is_empty() && !st.allowed_namespaces.iter().any(|n| n == &ns) {
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
    let _ = st
        .store
        .record_audit(&uid, "hide", &id, "hidden from discovery");
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
    let _ = st
        .store
        .record_audit(&uid, "search", "", &format!("q={}", q.q.trim()));
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
    let _ = st
        .store
        .record_audit(&uid, "favorite", &id, "added favorite");
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
    let _ = st
        .store
        .record_audit(&uid, "unfavorite", &id, "removed favorite");
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
    let _ = st
        .store
        .record_audit(&uid, "recent", &id, "opened from dock");
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
    let unhealthy: Vec<App> = apps.into_iter().filter(|a| a.status != "healthy").collect();
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
        apps.into_iter().filter(|a| a.meta.recommended).collect(),
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
    let app = st.store.get_app(&id)?.ok_or(AppError::NotFound)?;
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
    let mut updated = st.store.get_app(&id)?.ok_or(AppError::NotFound)?;
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
    let app = st.store.get_app(&body.app_id)?.ok_or(AppError::NotFound)?;
    if !app_allowed(&st, &app) {
        return Err(AppError::NotFound);
    }
    if !app.visibility.published {
        return Err(AppError::BadRequest);
    }
    let link = st
        .store
        .create_share(&body.app_id, &uid, body.ttl_minutes, &body.label)?;
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
    let _ = st
        .store
        .record_audit(&uid, "share_revoke", "", &format!("token={share_token}"));
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
    /// 400 with an explanation that is safe to show the caller.
    Invalid(String),
    Conflict(&'static str),
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
            AppError::Invalid(msg) => (StatusCode::BAD_REQUEST, msg).into_response(),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg).into_response(),
            AppError::Internal(e) => {
                tracing::error!("api error: {e:#}");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::{to_bytes, Body};
    use axum::http::Request;
    use iris_core::{AppMeta, Backend, Visibility};
    use tower::ServiceExt;

    fn app(slug: &str, ns: &str, owner: &str, updated: &str) -> App {
        App {
            id: format!("{ns}/{slug}"),
            slug: slug.into(),
            canonical_slug: slug.into(),
            display_name: slug.into(),
            description: String::new(),
            namespace: ns.into(),
            category: "Tools".into(),
            icon: "app".into(),
            backend: Backend {
                kind: "Service".into(),
                name: slug.into(),
                port: 80,
                scheme: "http".into(),
                path: "/".into(),
            },
            route_path: format!("/a/{ns}/{slug}"),
            public_url: String::new(),
            status: "healthy".into(),
            status_message: String::new(),
            source: "annotation".into(),
            auth_mode: "none".into(),
            score: 0,
            visibility: Visibility {
                published: true,
                hidden: false,
                favorite: false,
            },
            rewrite: Default::default(),
            ready_endpoints: 1,
            updated_at: updated.into(),
            meta: AppMeta {
                owner: owner.into(),
                environment: "prod".into(),
                ..Default::default()
            },
        }
    }

    fn router() -> Router {
        routes(state(vec![]))
    }

    fn state(admin_users: Vec<String>) -> ApiState {
        let store = Arc::new(Store::open(":memory:").unwrap());
        let now = chrono::Utc::now().to_rfc3339();
        store.upsert_app(&app("good", "a", "team", &now)).unwrap();
        let mut bad = app("bad", "a", "", "2020-01-01T00:00:00Z");
        bad.ready_endpoints = 0;
        store.upsert_app(&bad).unwrap();
        store.upsert_app(&app("=evil", "b", "team", &now)).unwrap();
        ApiState {
            store,
            default_user: "tester".into(),
            allowed_namespaces: vec![],
            admin_users,
            admin_groups: vec![],
            workspace_rules: vec![],
            role_rules: vec![],
        }
    }

    /// Send a request to an existing router so writes are visible to reads.
    async fn send(
        r: &Router,
        method: &str,
        path: &str,
        user: &str,
        body: Option<serde_json::Value>,
    ) -> (StatusCode, serde_json::Value) {
        let mut req = Request::builder().method(method).uri(path);
        if !user.is_empty() {
            req = req.header("x-iris-user", user);
        }
        let body = match body {
            Some(v) => {
                req = req.header("content-type", "application/json");
                Body::from(v.to_string())
            }
            None => Body::empty(),
        };
        let resp = r.clone().oneshot(req.body(body).unwrap()).await.unwrap();
        let status = resp.status();
        let bytes = to_bytes(resp.into_body(), 1 << 20).await.unwrap();
        let value = serde_json::from_slice(&bytes)
            .unwrap_or_else(|_| String::from_utf8_lossy(&bytes).into_owned().into());
        (status, value)
    }

    async fn get_path(path: &str) -> (StatusCode, String, String) {
        let resp = router()
            .oneshot(Request::get(path).body(Body::empty()).unwrap())
            .await
            .unwrap();
        let status = resp.status();
        let ct = resp
            .headers()
            .get("content-type")
            .map(|v| v.to_str().unwrap().to_string())
            .unwrap_or_default();
        let body =
            String::from_utf8(to_bytes(resp.into_body(), 1 << 20).await.unwrap().to_vec()).unwrap();
        (status, ct, body)
    }

    #[tokio::test]
    async fn scorecard_levels_and_filters() {
        let (s, _, body) = get_path("/scorecard").await;
        assert_eq!(s, StatusCode::OK);
        let v: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(v["summary"]["gold"], 2);
        assert_eq!(v["summary"]["none"], 1);
        assert_eq!(v["apps"][0]["id"], "a/bad");
        assert_eq!(v["apps"][0]["level"], "none");
        let (_, _, body) = get_path("/scorecard?namespace=b").await;
        let v: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(v["apps"].as_array().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn stale_validates_days() {
        let (s, _, body) = get_path("/stale?days=30").await;
        assert_eq!(s, StatusCode::OK);
        let v: serde_json::Value = serde_json::from_str(&body).unwrap();
        assert_eq!(v["days"], 30);
        assert_eq!(v["apps"].as_array().unwrap().len(), 1);
        assert_eq!(v["apps"][0]["id"], "a/bad");
        let (_, _, body) = get_path("/stale").await;
        assert!(body.contains("\"days\":30"));
        let (_, _, body) = get_path("/stale?days=999999").await;
        assert!(body.contains("\"days\":3650"));
        assert_eq!(get_path("/stale?days=abc").await.0, StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn export_csv_and_formats() {
        let (s, ct, body) = get_path("/catalog/export?format=csv").await;
        assert_eq!(s, StatusCode::OK);
        assert!(ct.starts_with("text/csv"));
        assert!(body.starts_with("id,name,namespace"));
        assert!(body.contains("'=evil"), "{body}");
        assert_eq!(body.matches("\r\n").count(), 4);
        let (_, ct, body) = get_path("/catalog/export").await;
        assert_eq!(ct, "application/json");
        assert!(body.starts_with('['));
        assert_eq!(
            get_path("/catalog/export?format=xml").await.0,
            StatusCode::BAD_REQUEST
        );
    }

    #[tokio::test]
    async fn exemptions_waive_findings_until_revoked() {
        let r = routes(state(vec!["boss".into()]));
        let body = serde_json::json!({
            "appId": "a/bad", "rule": "no-ready-endpoints", "reason": "scaled to zero", "days": 7
        });
        let (s, _) = send(&r, "POST", "/exemptions", "dev", Some(body.clone())).await;
        assert_eq!(s, StatusCode::FORBIDDEN);
        let (s, created) = send(&r, "POST", "/exemptions", "boss", Some(body.clone())).await;
        assert_eq!(s, StatusCode::CREATED, "{created}");
        assert_eq!(created["createdBy"], "boss");
        let (s, _) = send(&r, "POST", "/exemptions", "boss", Some(body.clone())).await;
        assert_eq!(s, StatusCode::CONFLICT);

        let (_, sc) = send(&r, "GET", "/scorecard?namespace=a", "", None).await;
        assert_eq!(sc["summary"]["none"], 0, "{sc}");
        let (_, c) = send(&r, "GET", "/conformance?namespace=a", "", None).await;
        assert_eq!(c["apps"][0]["exempted"][0]["rule"], "no-ready-endpoints");

        let (_, list) = send(&r, "GET", "/exemptions", "dev", None).await;
        assert_eq!(list[0]["status"], "active");
        let path = format!("/exemptions/{}", created["id"].as_str().unwrap());
        let (s, _) = send(&r, "DELETE", &path, "dev", None).await;
        assert_eq!(s, StatusCode::FORBIDDEN);
        let (s, _) = send(&r, "DELETE", &path, "boss", None).await;
        assert_eq!(s, StatusCode::NO_CONTENT);
        let (s, _) = send(&r, "DELETE", &path, "boss", None).await;
        assert_eq!(s, StatusCode::NOT_FOUND);
        let (_, sc) = send(&r, "GET", "/scorecard?namespace=a", "", None).await;
        assert_eq!(sc["summary"]["none"], 1);
        let (_, audit) = send(&r, "GET", "/audit", "boss", None).await;
        assert!(audit.to_string().contains("exemption_revoke"));
    }

    #[tokio::test]
    async fn exemption_input_is_validated() {
        let r = router();
        let ok = serde_json::json!({
            "appId": "a/bad", "rule": "owner-missing", "reason": "x", "days": 1
        });
        for (field, value, want) in [
            ("rule", serde_json::json!("nope"), StatusCode::BAD_REQUEST),
            ("days", serde_json::json!(0), StatusCode::BAD_REQUEST),
            ("days", serde_json::json!(366), StatusCode::BAD_REQUEST),
            ("reason", serde_json::json!(""), StatusCode::BAD_REQUEST),
            ("appId", serde_json::json!("a/ghost"), StatusCode::NOT_FOUND),
        ] {
            let mut body = ok.clone();
            body[field] = value;
            let (s, msg) = send(&r, "POST", "/exemptions", "", Some(body)).await;
            assert_eq!(s, want, "{field}: {msg}");
        }
    }

    #[tokio::test]
    async fn campaigns_report_progress_per_owner() {
        let r = routes(state(vec!["boss".into()]));
        let body = serde_json::json!({
            "name": "Own everything", "rules": ["owner-missing"], "dueDate": "2000-01-01"
        });
        let (s, _) = send(&r, "POST", "/campaigns", "dev", Some(body.clone())).await;
        assert_eq!(s, StatusCode::FORBIDDEN);
        let (s, created) = send(&r, "POST", "/campaigns", "boss", Some(body.clone())).await;
        assert_eq!(s, StatusCode::CREATED, "{created}");
        let (_, list) = send(&r, "GET", "/campaigns", "dev", None).await;
        assert_eq!(list[0]["status"], "overdue", "{list}");
        assert_eq!(list[0]["total"], 3);
        assert_eq!(list[0]["failing"], 1);
        assert_eq!(list[0]["percent"], 66);
        assert_eq!(list[0]["failingApps"][0]["id"], "a/bad");
        assert_eq!(list[0]["owners"][0]["owner"], "");

        let mut bad = body.clone();
        bad["dueDate"] = serde_json::json!("soon");
        let (s, msg) = send(&r, "POST", "/campaigns", "boss", Some(bad)).await;
        assert_eq!(s, StatusCode::BAD_REQUEST);
        assert!(msg.as_str().unwrap().contains("YYYY-MM-DD"));

        let path = format!("/campaigns/{}", created["id"].as_str().unwrap());
        let (s, _) = send(&r, "DELETE", &path, "boss", None).await;
        assert_eq!(s, StatusCode::NO_CONTENT);
        let (_, list) = send(&r, "GET", "/campaigns", "dev", None).await;
        assert_eq!(list, serde_json::json!([]));
    }

    #[tokio::test]
    async fn history_and_uptime() {
        let st = state(vec![]);
        let at = |hours: i64| {
            (chrono::Utc::now() - chrono::Duration::hours(hours))
                .format("%Y-%m-%dT%H:%M:%SZ")
                .to_string()
        };
        for (status, hours) in [("healthy", 10), ("broken", 5)] {
            st.store
                .record_status_event(&iris_core::StatusEvent {
                    app_id: "a/bad".into(),
                    status: status.into(),
                    message: String::new(),
                    at: at(hours),
                })
                .unwrap();
        }
        let r = routes(st);
        let (s, h) = send(&r, "GET", "/history?app=a/bad&days=1", "", None).await;
        assert_eq!(s, StatusCode::OK, "{h}");
        assert_eq!(h["transitions"], 1);
        assert_eq!(h["events"][0]["status"], "broken");
        let pct = h["uptimePercent"].as_f64().unwrap();
        assert!((49.0..=51.0).contains(&pct), "{pct}");
        let (_, u) = send(&r, "GET", "/uptime", "", None).await;
        assert_eq!(u["days"], 7);
        assert_eq!(u["apps"][0]["id"], "a/bad");
        assert!(u["apps"][1].get("uptimePercent").is_none());
        for (path, want) in [
            ("/history", StatusCode::BAD_REQUEST),
            ("/history?app=a/ghost", StatusCode::NOT_FOUND),
            ("/history?app=a/bad&days=x", StatusCode::BAD_REQUEST),
            ("/uptime?days=x", StatusCode::BAD_REQUEST),
        ] {
            assert_eq!(send(&r, "GET", path, "", None).await.0, want, "{path}");
        }
    }

    #[tokio::test]
    async fn new_reads_respect_namespace_allow_list() {
        let mut st = state(vec![]);
        st.allowed_namespaces = vec!["b".into()];
        let r = routes(st);
        let (s, _) = send(&r, "GET", "/history?app=a/bad", "", None).await;
        assert_eq!(s, StatusCode::NOT_FOUND);
        let (_, u) = send(&r, "GET", "/uptime", "", None).await;
        assert_eq!(u["apps"].as_array().unwrap().len(), 1);
        let body = serde_json::json!({
            "appId": "a/bad", "rule": "owner-missing", "reason": "x", "days": 1
        });
        let (s, _) = send(&r, "POST", "/exemptions", "", Some(body)).await;
        assert_eq!(s, StatusCode::NOT_FOUND);
    }
}
