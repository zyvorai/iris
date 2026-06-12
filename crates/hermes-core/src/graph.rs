// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use serde::{Deserialize, Serialize};

use crate::App;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub category: String,
    pub status: String,
    pub namespace: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub icon: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub from: String,
    pub to: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub label: String,
    pub resolved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppGraph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

pub fn resolve_dependency<'a>(dep: &str, apps: &'a [App]) -> Option<&'a App> {
    let dep = dep.trim();
    if dep.is_empty() {
        return None;
    }
    apps.iter().find(|app| {
        app.id == dep
            || app.slug == dep
            || app.canonical_slug == dep
            || app.backend.name == dep
    })
}

pub fn build_graph(apps: &[App]) -> AppGraph {
    let published: Vec<&App> = apps
        .iter()
        .filter(|a| a.visibility.published && !a.visibility.hidden)
        .collect();

    let mut nodes = Vec::new();
    for app in &published {
        nodes.push(GraphNode {
            id: app.id.clone(),
            label: app.display_name.clone(),
            category: app.category.clone(),
            status: app.status.clone(),
            namespace: app.namespace.clone(),
            icon: app.icon.clone(),
        });
    }

    let mut edges = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for app in &published {
        for dep in &app.meta.depends_on {
            let key = format!("{}->{}:{}", app.id, dep, dep);
            if !seen.insert(key) {
                continue;
            }
            if let Some(target) = resolve_dependency(dep, apps) {
                edges.push(GraphEdge {
                    from: target.id.clone(),
                    to: app.id.clone(),
                    label: dep.clone(),
                    resolved: true,
                });
            } else {
                edges.push(GraphEdge {
                    from: dep.clone(),
                    to: app.id.clone(),
                    label: dep.clone(),
                    resolved: false,
                });
            }
        }
    }

    AppGraph { nodes, edges }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{AppMeta, Backend, Visibility};

    fn sample_app(id: &str, slug: &str, deps: Vec<&str>) -> App {
        App {
            id: id.into(),
            slug: slug.into(),
            canonical_slug: slug.into(),
            display_name: slug.into(),
            description: String::new(),
            namespace: "demo".into(),
            category: "Monitoring".into(),
            icon: "app".into(),
            backend: Backend {
                kind: "Service".into(),
                name: slug.into(),
                port: 80,
                scheme: "http".into(),
                path: "/".into(),
            },
            route_path: format!("/a/demo/{slug}"),
            public_url: format!("http://localhost/a/demo/{slug}"),
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
            updated_at: String::new(),
            meta: AppMeta {
                depends_on: deps.into_iter().map(str::to_string).collect(),
                ..Default::default()
            },
        }
    }

    #[test]
    fn resolves_dependency_edges() {
        let apps = vec![
            sample_app("demo/prometheus", "prometheus", vec![]),
            sample_app("demo/grafana", "grafana", vec!["prometheus"]),
        ];
        let graph = build_graph(&apps);
        assert_eq!(graph.nodes.len(), 2);
        assert_eq!(graph.edges.len(), 1);
        assert!(graph.edges[0].resolved);
        assert_eq!(graph.edges[0].from, "demo/prometheus");
        assert_eq!(graph.edges[0].to, "demo/grafana");
    }
}
