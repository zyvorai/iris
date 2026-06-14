// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use std::path::Path;
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::{params, Connection};

use crate::{App, AuditEvent, Backend, SearchHit, ShareLink, Visibility};

const APP_SELECT: &str = "SELECT id, slug, canonical_slug, display_name, description, namespace, category, icon,
              backend_json, route_path, public_url, status, status_message, source,
              auth_mode, score, visibility_json, rewrite_json, ready_endpoints, updated_at, meta_json";

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
CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  app_id TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
"#,
        )?;
        let _ = conn.execute("ALTER TABLE apps ADD COLUMN canonical_slug TEXT DEFAULT ''", []);
        let _ = conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_apps_canonical_slug ON apps(canonical_slug)",
            [],
        );
        let _ = conn.execute("ALTER TABLE apps ADD COLUMN meta_json TEXT DEFAULT '{}'", []);
        let _ = conn.execute(
            "ALTER TABLE apps ADD COLUMN diagnosis_json TEXT DEFAULT ''",
            [],
        );
        conn.execute_batch(
            r#"
CREATE TABLE IF NOT EXISTS share_links (
  token TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  label TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_share_links_app ON share_links(app_id);
"#,
        )?;
        Ok(())
    }

    pub fn get_diagnosis_json(&self, id: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT diagnosis_json FROM apps WHERE id = ?1")?;
        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            let raw: String = row.get(0)?;
            if raw.trim().is_empty() {
                return Ok(None);
            }
            return Ok(Some(raw));
        }
        Ok(None)
    }

    pub fn update_diagnosis_json(&self, id: &str, json: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE apps SET diagnosis_json = ?1, updated_at = ?2 WHERE id = ?3",
            params![json, Utc::now().to_rfc3339(), id],
        )?;
        Ok(())
    }

    pub fn list_apps(&self, published_only: bool) -> Result<Vec<App>> {
        let conn = self.conn.lock().unwrap();
        let sql = if published_only {
            format!(
                "{APP_SELECT}
             FROM apps
             WHERE json_extract(visibility_json, '$.published') = 1
               AND json_extract(visibility_json, '$.hidden') = 0
             ORDER BY display_name"
            )
        } else {
            format!("{APP_SELECT} FROM apps ORDER BY display_name")
        };
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt.query_map([], |row| row_to_app(row))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn list_discovery(&self) -> Result<Vec<App>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            &format!(
                "{APP_SELECT}
             FROM apps
             WHERE json_extract(visibility_json, '$.published') = 0
               AND json_extract(visibility_json, '$.hidden') = 0
             ORDER BY score DESC, display_name"
            ),
        )?;
        let rows = stmt.query_map([], |row| row_to_app(row))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn list_catalog(&self) -> Result<Vec<App>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            &format!(
                "{APP_SELECT}
             FROM apps
             WHERE json_extract(visibility_json, '$.hidden') = 0
             ORDER BY namespace, display_name"
            ),
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
        let mut stmt = conn.prepare(&format!("{APP_SELECT} FROM apps WHERE id = ?1"))?;
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

    pub fn get_app_by_canonical_slug(&self, slug: &str) -> Result<Option<App>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            &format!(
                "{APP_SELECT}
             FROM apps
             WHERE canonical_slug = ?1
               AND json_extract(visibility_json, '$.hidden') = 0
             ORDER BY json_extract(visibility_json, '$.published') DESC, score DESC
             LIMIT 1"
            ),
        )?;
        let mut rows = stmt.query([slug])?;
        if let Some(row) = rows.next()? {
            return Ok(Some(row_to_app(&row)?));
        }
        Ok(None)
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

    pub fn publish_namespace(&self, namespace: &str) -> Result<usize> {
        let vis = Visibility {
            published: true,
            ..Default::default()
        };
        let conn = self.conn.lock().unwrap();
        let n = conn.execute(
            "UPDATE apps SET visibility_json = ?1, updated_at = ?2
             WHERE namespace = ?3
               AND json_extract(visibility_json, '$.hidden') = 0
               AND json_extract(visibility_json, '$.published') = 0",
            params![serde_json::to_string(&vis)?, Utc::now().to_rfc3339(), namespace],
        )?;
        Ok(n)
    }

    pub fn catalog_stats(&self) -> Result<crate::CatalogStats> {
        let apps = self.list_catalog()?;
        let mut env_counts = std::collections::BTreeMap::new();
        let mut cat_counts = std::collections::BTreeMap::new();
        let mut src_counts = std::collections::BTreeMap::new();
        let mut published = 0usize;
        let mut recommended = 0usize;
        for app in &apps {
            if app.visibility.published {
                published += 1;
            }
            if app.meta.recommended {
                recommended += 1;
            }
            if !app.meta.environment.is_empty() {
                *env_counts.entry(app.meta.environment.clone()).or_insert(0) += 1;
            }
            *cat_counts.entry(app.category.clone()).or_insert(0) += 1;
            *src_counts.entry(app.source.clone()).or_insert(0) += 1;
        }
        Ok(crate::CatalogStats {
            total: apps.len(),
            published,
            environments: counts_to_vec(env_counts),
            categories: counts_to_vec(cat_counts),
            sources: counts_to_vec(src_counts),
            recommended,
        })
    }

    pub fn hide_app(&self, id: &str) -> Result<()> {
        if let Some((ns, name)) = id.split_once('/') {
            let conn = self.conn.lock().unwrap();
            conn.execute(
                "INSERT OR IGNORE INTO hidden_services (namespace, service_name) VALUES (?1, ?2)",
                params![ns, name],
            )?;
        }
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
                if app.canonical_slug.to_lowercase().contains(&q) {
                    score += 90;
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
                if app.meta.owner.to_lowercase().contains(&q) {
                    score += 25;
                }
                if app.meta.environment.to_lowercase().contains(&q) {
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

    pub fn record_audit(
        &self,
        user_id: &str,
        action: &str,
        app_id: &str,
        detail: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO audit_events (user_id, action, app_id, detail, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                user_id,
                action,
                app_id,
                detail,
                Utc::now().to_rfc3339()
            ],
        )?;
        Ok(())
    }

    pub fn set_app_recommended(&self, id: &str, recommended: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT meta_json FROM apps WHERE id = ?1")?;
        let mut rows = stmt.query([id])?;
        let Some(row) = rows.next()? else {
            return Ok(());
        };
        let meta_json: String = row.get(0)?;
        let mut meta: crate::AppMeta = serde_json::from_str(&meta_json).unwrap_or_default();
        meta.recommended = recommended;
        let updated = serde_json::to_string(&meta)?;
        conn.execute(
            "UPDATE apps SET meta_json = ?1, updated_at = ?2 WHERE id = ?3",
            params![updated, Utc::now().to_rfc3339(), id],
        )?;
        Ok(())
    }

    pub fn create_share(
        &self,
        app_id: &str,
        created_by: &str,
        ttl_minutes: i64,
        label: &str,
    ) -> Result<ShareLink> {
        let ttl = ttl_minutes.clamp(5, 7 * 24 * 60);
        let now = Utc::now();
        let expires = now + chrono::Duration::minutes(ttl);
        let token = uuid::Uuid::new_v4().simple().to_string();
        let link = ShareLink {
            token: token.clone(),
            app_id: app_id.to_string(),
            created_by: created_by.to_string(),
            expires_at: expires.to_rfc3339(),
            created_at: now.to_rfc3339(),
            label: label.to_string(),
        };
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO share_links (token, app_id, created_by, expires_at, created_at, label) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                link.token,
                link.app_id,
                link.created_by,
                link.expires_at,
                link.created_at,
                link.label
            ],
        )?;
        Ok(link)
    }

    pub fn get_share(&self, token: &str) -> Result<Option<ShareLink>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT token, app_id, created_by, expires_at, created_at, label FROM share_links WHERE token = ?1",
        )?;
        let mut rows = stmt.query([token])?;
        if let Some(row) = rows.next()? {
            let link = ShareLink {
                token: row.get(0)?,
                app_id: row.get(1)?,
                created_by: row.get(2)?,
                expires_at: row.get(3)?,
                created_at: row.get(4)?,
                label: row.get(5)?,
            };
            if is_expired(&link.expires_at) {
                let _ = conn.execute("DELETE FROM share_links WHERE token = ?1", [token]);
                return Ok(None);
            }
            return Ok(Some(link));
        }
        Ok(None)
    }

    pub fn list_shares(&self, user_id: &str) -> Result<Vec<ShareLink>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT token, app_id, created_by, expires_at, created_at, label FROM share_links WHERE created_by = ?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([user_id], |row| {
            Ok(ShareLink {
                token: row.get(0)?,
                app_id: row.get(1)?,
                created_by: row.get(2)?,
                expires_at: row.get(3)?,
                created_at: row.get(4)?,
                label: row.get(5)?,
            })
        })?;
        let mut links = Vec::new();
        for row in rows {
            let link = row?;
            if !is_expired(&link.expires_at) {
                links.push(link);
            }
        }
        Ok(links)
    }

    pub fn delete_share(&self, token: &str, user_id: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let n = conn.execute(
            "DELETE FROM share_links WHERE token = ?1 AND created_by = ?2",
            params![token, user_id],
        )?;
        Ok(n > 0)
    }

    pub fn delete_share_admin(&self, token: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let n = conn.execute("DELETE FROM share_links WHERE token = ?1", [token])?;
        Ok(n > 0)
    }

    pub fn list_all_shares(&self) -> Result<Vec<ShareLink>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT token, app_id, created_by, expires_at, created_at, label FROM share_links ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ShareLink {
                token: row.get(0)?,
                app_id: row.get(1)?,
                created_by: row.get(2)?,
                expires_at: row.get(3)?,
                created_at: row.get(4)?,
                label: row.get(5)?,
            })
        })?;
        let mut links = Vec::new();
        for row in rows {
            let link = row?;
            if !is_expired(&link.expires_at) {
                links.push(link);
            }
        }
        Ok(links)
    }

    pub fn purge_expired_shares(&self) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT token, expires_at FROM share_links")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut purged = 0usize;
        for row in rows {
            let (token, expires_at) = row?;
            if is_expired(&expires_at) {
                purged += conn.execute("DELETE FROM share_links WHERE token = ?1", [token])?;
            }
        }
        Ok(purged)
    }

    pub fn list_audit(&self, limit: usize) -> Result<Vec<AuditEvent>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, user_id, action, app_id, detail, created_at FROM audit_events ORDER BY id DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map([limit as i64], |row| {
            Ok(AuditEvent {
                id: row.get(0)?,
                user_id: row.get(1)?,
                action: row.get(2)?,
                app_id: row.get(3)?,
                detail: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn count_audit(&self) -> Result<u64> {
        let conn = self.conn.lock().unwrap();
        let count: u64 = conn.query_row(
            "SELECT COUNT(*) FROM audit_events",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }
}

fn row_to_app(row: &rusqlite::Row<'_>) -> rusqlite::Result<App> {
    let backend_json: String = row.get(8)?;
    let visibility_json: String = row.get(16)?;
    let rewrite_json: String = row.get(17)?;
    let meta_json: String = row.get(20)?;
    Ok(App {
        id: row.get(0)?,
        slug: row.get(1)?,
        canonical_slug: row.get(2)?,
        display_name: row.get(3)?,
        description: row.get(4)?,
        namespace: row.get(5)?,
        category: row.get(6)?,
        icon: row.get(7)?,
        backend: serde_json::from_str(&backend_json).unwrap_or(Backend {
            kind: "Service".into(),
            name: String::new(),
            port: 80,
            scheme: "http".into(),
            path: "/".into(),
        }),
        route_path: row.get(9)?,
        public_url: row.get(10)?,
        status: row.get(11)?,
        status_message: row.get(12)?,
        source: row.get(13)?,
        auth_mode: row.get(14)?,
        score: row.get(15)?,
        visibility: serde_json::from_str(&visibility_json).unwrap_or_default(),
        rewrite: serde_json::from_str(&rewrite_json).unwrap_or_default(),
        ready_endpoints: row.get(18)?,
        updated_at: row.get(19)?,
        meta: serde_json::from_str(&meta_json).unwrap_or_default(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn in_memory() -> Store {
        Store::open(":memory:").expect("open in-memory store")
    }

    #[test]
    fn count_audit_empty() {
        let store = in_memory();
        assert_eq!(store.count_audit().unwrap(), 0);
    }

    #[test]
    fn count_audit_after_records() {
        let store = in_memory();
        store.record_audit("alice", "launch", "ns/app", "").unwrap();
        store.record_audit("bob", "search", "", "grafana").unwrap();
        assert_eq!(store.count_audit().unwrap(), 2);
    }

    #[test]
    fn list_audit_respects_limit() {
        let store = in_memory();
        for i in 0..10 {
            store.record_audit("user", "launch", &format!("ns/app{i}"), "").unwrap();
        }
        assert_eq!(store.list_audit(3).unwrap().len(), 3);
        assert_eq!(store.list_audit(100).unwrap().len(), 10);
    }

    #[test]
    fn favorites_roundtrip() {
        let store = in_memory();
        store.add_favorite("alice", "ns/grafana").unwrap();
        store.add_favorite("alice", "ns/prometheus").unwrap();
        let favs = store.list_favorites("alice").unwrap();
        assert!(favs.contains(&"ns/grafana".to_string()));
        assert!(favs.contains(&"ns/prometheus".to_string()));
        store.remove_favorite("alice", "ns/grafana").unwrap();
        let favs = store.list_favorites("alice").unwrap();
        assert!(!favs.contains(&"ns/grafana".to_string()));
    }
}

fn counts_to_vec(map: std::collections::BTreeMap<String, usize>) -> Vec<crate::LabelCount> {
    map.into_iter()
        .map(|(label, count)| crate::LabelCount { label, count })
        .collect()
}

fn is_expired(expires_at: &str) -> bool {
    chrono::DateTime::parse_from_rfc3339(expires_at)
        .ok()
        .map(|t| t.with_timezone(&Utc) < Utc::now())
        .unwrap_or(true)
}
