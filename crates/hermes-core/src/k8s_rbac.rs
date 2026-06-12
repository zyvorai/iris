// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubjectAccessReviewResponse {
    status: SarStatus,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SarStatus {
    allowed: bool,
}

pub fn k8s_rbac_enabled() -> bool {
    std::env::var("HERMES_K8S_RBAC")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false)
}

pub async fn namespace_allowed(namespace: &str, groups: &[String]) -> bool {
    if !k8s_rbac_enabled() {
        return true;
    }
    let token = match std::fs::read_to_string(
        "/var/run/secrets/kubernetes.io/serviceaccount/token",
    ) {
        Ok(t) => t,
        Err(_) => return true,
    };
    let host = std::env::var("KUBERNETES_SERVICE_HOST").unwrap_or_default();
    let port = std::env::var("KUBERNETES_SERVICE_PORT").unwrap_or_else(|_| "443".into());
    if host.is_empty() {
        return true;
    }
    let url = format!(
        "https://{host}:{port}/apis/authorization.k8s.io/v1/selfsubjectaccessreviews"
    );
    let body = serde_json::json!({
        "apiVersion": "authorization.k8s.io/v1",
        "kind": "SelfSubjectAccessReview",
        "spec": {
            "resourceAttributes": {
                "namespace": namespace,
                "verb": "get",
                "group": "",
                "resource": "services"
            },
            "groups": groups,
        }
    });
    let client = match reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_secs(3))
        .build()
    {
        Ok(c) => c,
        Err(_) => return true,
    };
    match client
        .post(url)
        .bearer_auth(token.trim())
        .json(&body)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => resp
            .json::<SubjectAccessReviewResponse>()
            .await
            .map(|s| s.status.allowed)
            .unwrap_or(true),
        _ => true,
    }
}
