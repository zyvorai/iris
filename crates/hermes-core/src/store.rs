// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use std::path::Path;
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::{params, Connection};

use crate::{App, Backend, SearchHit, Visibility};

pub struct Store {
    conn: Arc<Mutex<Connection>>,
}

impl Store {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let conn = Connection::open(path).context("open sqlite")?;
        conn.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
        )?;
        let store = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        store.migrate()?;
        Ok(store)
    }

    fn migrate(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            r#"
CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  namespace TEXT NOT NULL,
  category TEXT DEFAULT 'Custom',
  icon TEXT DEFAULT 'app',
  backend_json TEXT NOT NULL,
  route_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  status_message TEXT DEFAULT '',
  source TEXT NOT NULL,
  auth_mode TEXT DEFAULT 'none',
  score INTEGER DEFAULT 0,
  visibility_json TEXT NOT NULL,
  rewrite_json TEXT DEFAULT '{}',
  ready_endpoints INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_apps_namespace ON apps(namespace);
CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, app_id)
);
CREATE TABLE IF NOT EXISTS recents (
  user_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  PRIMARY KEY (user_id, app_id)
);
CREATE TABLE IF NOT EXISTS hidden_services (
  namespace TEXT NOT NULL,
  service_name TEXT NOT NULL,
  PRIMARY KEY (namespace, service_name)
);
"#,
        )?;
        Ok(())
    }

    pub fn list_apps(&self, published_only: bool) -> Result<Vec<App>> {
        let conn = self.conn.lock().unwrap();
        let sql = if published_only {
            "SELECT id, slug, display_name, description, namespace, category, icon,
              backend_json, route_path, public_url, status, status_message, source,
              auth_mode, score, visibility_json, rewrite_json, ready_endpoints, updated_at
             FROM apps
             WHERE json_extract(visibility_json, '$.published') = 1
               AND json_extract(visibility_json, '$.hidden') = 0
             ORDER BY display_name"
        } else {
            "SELECT id, slug, display_name, description, namespace, category, icon,
              backend_json, route_path, public_url, status, status_message, source,
              auth_mode, score, visibility_json, rewrite_json, ready_endpoints, updated_at
             FROM apps ORDER BY display_name"
        };
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map([], |row| row_to_app(row))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn list_discovery(&self) -> Result<Vec<App>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, slug, display_name, description, namespace, category, icon,
              backend_json, route_path, public_url, status, status_message, source,
              auth_mode, score, visibility_json, rewrite_json, ready_endpoints, updated_at
             FROM apps
             WHERE json_extract(visibility_json, '$.published') = 0
               AND json_extract(visibility_json, '$.hidden') = 0
             ORDER BY score DESC, display_name",
        )?;
        let rows = stmt.query_map([], |row| row_to_app(row))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn list_catalog(&self) -> Result<Vec<App>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, slug, display_name, description, namespace, category, icon,
              backend_json, route_path, public_url, status, status_message, source,
              auth_mode, score, visibility_json, rewrite_json, ready_endpoints, updated_at
             FROM apps
             WHERE json_extract(visibility_json, '$.hidden') = 0
             ORDER BY namespace, display_name",
        )?;
        let rows = stmt.query_map([], |row| row_to_app(row))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn cluster_summary(&self) -> Result<crate::ClusterSummary> {
        let apps = self.list_catalog()?;
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
        Ok(crate::ClusterSummary {
            total: apps.len(),
            published,
            discovery,
            namespaces: namespaces.len(),
            healthy,
            degraded,
            broken,
        })
    }

    pub fn get_app(&self, id: &str) -> Result<Option<App>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, slug, display_name, description, namespace, category, icon,
              backend_json, route_path, public_url, status, status_message, source,
              auth_mode, score, visibility_json, rewrite_json, ready_endpoints, updated_at
             FROM apps WHERE id = ?1",
        )?;
        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(row_to_app(&row)?));
        }
        Ok(None)
    }

    pub fn get_app_by_route(&self, namespace: &str, slug: &str) -> Result<Option<App>> {
        let id = format!("{namespace}/{slug}");
        self.get_app(&id)
    }

    pub fn publish_app(&self, id: &str) -> Result<()> {
        let vis = Visibility {
            published: true,
            ..Default::default()
        };
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE apps SET visibility_json = ?1, updated_at = ?2 WHERE id = ?3",
            params![serde_json::to_string(&vis)?, Utc::now().to_rfc3339(), id],
        )?;
        Ok(())
    }

    pub fn hide_app(&self, id: &str) -> Result<()> {
        let vis = Visibility {
            hidden: true,
            ..Default::default()
        };
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE apps SET visibility_json = ?1, updated_at = ?2 WHERE id = ?3",
            params![serde_json::to_string(&vis)?, Utc::now().to_rfc3339(), id],
        )?;
        Ok(())
    }

    pub fn search(&self, q: &str, limit: usize) -> Result<Vec<SearchHit>> {
        let q = q.trim().to_lowercase();
        if q.is_empty() {
            return Ok(vec![]);
        }
        let apps = self.list_catalog()?;
        let mut hits: Vec<SearchHit> = apps
            .into_iter()
            .filter_map(|app| {
                let mut score = 0;
                if app.display_name.to_lowercase().contains(&q) {
                    score += 100;
                }
                if app.slug.to_lowercase().contains(&q) {
                    score += 80;
                }
                if app.namespace.to_lowercase().contains(&q) {
                    score += 40;
                }
                if app.category.to_lowercase().contains(&q) {
                    score += 30;
                }
                if app.id.to_lowercase().contains(&q) {
                    score += 20;
                }
                if app.backend.name.to_lowercase().contains(&q) {
                    score += 15;
                }
                if score > 0 {
                    if app.visibility.published {
                        score += 10;
                    }
                    Some(SearchHit { app, score })
                } else {
                    None
                }
            })
            .collect();
        hits.sort_by(|a, b| b.score.cmp(&a.score));
        hits.truncate(limit);
        Ok(hits)
    }

    pub fn list_favorites(&self, user_id: &str) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT app_id FROM favorites WHERE user_id = ?1 ORDER BY created_at")?;
        let rows = stmt.query_map([user_id], |row| row.get(0))?;
        rows.collect::<Result<Vec<String>, _>>().map_err(Into::into)
    }

    pub fn add_favorite(&self, user_id: &str, app_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO favorites (user_id, app_id, created_at) VALUES (?1, ?2, ?3)",
            params![user_id, app_id, Utc::now().to_rfc3339()],
        )?;
        Ok(())
    }

    pub fn remove_favorite(&self, user_id: &str, app_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM favorites WHERE user_id = ?1 AND app_id = ?2",
            params![user_id, app_id],
        )?;
        Ok(())
    }

    pub fn list_recents(&self, user_id: &str, limit: usize) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT app_id FROM recents WHERE user_id = ?1 ORDER BY opened_at DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![user_id, limit as i64], |row| row.get(0))?;
        rows.collect::<Result<Vec<String>, _>>().map_err(Into::into)
    }

    pub fn record_recent(&self, user_id: &str, app_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO recents (user_id, app_id, opened_at) VALUES (?1, ?2, ?3)",
            params![user_id, app_id, Utc::now().to_rfc3339()],
        )?;
        Ok(())
    }

    pub fn health_summary(&self) -> Result<crate::HealthSummary> {
        let apps = self.list_apps(true)?;
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
        Ok(crate::HealthSummary {
            total: apps.len(),
            healthy,
            degraded,
            broken,
            apps: apps
                .into_iter()
                .filter(|a| a.status != "healthy")
                .collect(),
        })
    }
}

fn row_to_app(row: &rusqlite::Row<'_>) -> rusqlite::Result<App> {
    let backend_json: String = row.get(7)?;
    let visibility_json: String = row.get(15)?;
    let rewrite_json: String = row.get(16)?;
    Ok(App {
        id: row.get(0)?,
        slug: row.get(1)?,
        display_name: row.get(2)?,
        description: row.get(3)?,
        namespace: row.get(4)?,
        category: row.get(5)?,
        icon: row.get(6)?,
        backend: serde_json::from_str(&backend_json).unwrap_or(Backend {
            kind: "Service".into(),
            name: String::new(),
            port: 80,
            scheme: "http".into(),
            path: "/".into(),
        }),
        route_path: row.get(8)?,
        public_url: row.get(9)?,
        status: row.get(10)?,
        status_message: row.get(11)?,
        source: row.get(12)?,
        auth_mode: row.get(13)?,
        score: row.get(14)?,
        visibility: serde_json::from_str(&visibility_json).unwrap_or_default(),
        rewrite: serde_json::from_str(&rewrite_json).unwrap_or_default(),
        ready_endpoints: row.get(17)?,
        updated_at: row.get(18)?,
    })
}
