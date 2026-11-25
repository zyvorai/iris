// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

//! SQLite persistence for exemptions, campaigns and status history.

use anyhow::Result;
use chrono::{DateTime, Duration, SecondsFormat, Utc};
use rusqlite::params;

use crate::governance::{
    Campaign, CreateCampaignRequest, CreateExemptionRequest, Exemption, MAX_CAMPAIGNS,
    MAX_EXEMPTIONS,
};
use crate::history::StatusEvent;
use crate::store::Store;

/// `status_events` is also created and written by the Go controller; keep the
/// two definitions in step.
pub(crate) const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS conformance_exemptions (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  rule TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rules_json TEXT NOT NULL,
  namespace TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS status_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_status_events_app ON status_events(app_id, id);
"#;

/// Result of an insert that is subject to uniqueness or capacity limits.
#[derive(Debug)]
pub enum Created<T> {
    Ok(T),
    Duplicate,
    Full,
}

fn stamp(t: DateTime<Utc>) -> String {
    t.to_rfc3339_opts(SecondsFormat::Secs, true)
}

impl Store {
    pub fn list_exemptions(&self) -> Result<Vec<Exemption>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, app_id, rule, reason, created_by, created_at, expires_at
             FROM conformance_exemptions ORDER BY created_at DESC, id",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(Exemption {
                id: r.get(0)?,
                app_id: r.get(1)?,
                rule: r.get(2)?,
                reason: r.get(3)?,
                created_by: r.get(4)?,
                created_at: r.get(5)?,
                expires_at: r.get(6)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    /// Insert a validated exemption. `Duplicate` when an unexpired one already
    /// covers the same app and rule. Expired rows are dropped to make room.
    pub fn create_exemption(
        &self,
        req: &CreateExemptionRequest,
        created_by: &str,
        now: DateTime<Utc>,
    ) -> Result<Created<Exemption>> {
        let e = Exemption {
            id: uuid::Uuid::new_v4().to_string(),
            app_id: req.app_id.clone(),
            rule: req.rule.clone(),
            reason: req.reason.trim().to_string(),
            created_by: created_by.to_string(),
            created_at: stamp(now),
            expires_at: stamp(now + Duration::days(req.days)),
        };
        let conn = self.conn.lock().unwrap();
        let live: i64 = conn.query_row(
            "SELECT COUNT(*) FROM conformance_exemptions
             WHERE app_id = ?1 AND rule = ?2 AND expires_at > ?3",
            params![e.app_id, e.rule, e.created_at],
            |r| r.get(0),
        )?;
        if live > 0 {
            return Ok(Created::Duplicate);
        }
        let count = |c: &rusqlite::Connection| -> rusqlite::Result<i64> {
            c.query_row("SELECT COUNT(*) FROM conformance_exemptions", [], |r| {
                r.get(0)
            })
        };
        if count(&conn)? >= MAX_EXEMPTIONS as i64 {
            conn.execute(
                "DELETE FROM conformance_exemptions WHERE expires_at <= ?1",
                [&e.created_at],
            )?;
            if count(&conn)? >= MAX_EXEMPTIONS as i64 {
                return Ok(Created::Full);
            }
        }
        conn.execute(
            "INSERT INTO conformance_exemptions
             (id, app_id, rule, reason, created_by, created_at, expires_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                e.id,
                e.app_id,
                e.rule,
                e.reason,
                e.created_by,
                e.created_at,
                e.expires_at
            ],
        )?;
        Ok(Created::Ok(e))
    }

    pub fn delete_exemption(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        Ok(conn.execute("DELETE FROM conformance_exemptions WHERE id = ?1", [id])? > 0)
    }

    pub fn list_campaigns(&self) -> Result<Vec<Campaign>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, description, rules_json, namespace, owner, due_date,
                    created_by, created_at
             FROM campaigns ORDER BY due_date, name, id",
        )?;
        let rows = stmt.query_map([], |r| {
            let rules: String = r.get(3)?;
            Ok(Campaign {
                id: r.get(0)?,
                name: r.get(1)?,
                description: r.get(2)?,
                rules: serde_json::from_str(&rules).unwrap_or_default(),
                namespace: r.get(4)?,
                owner: r.get(5)?,
                due_date: r.get(6)?,
                created_by: r.get(7)?,
                created_at: r.get(8)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    /// Insert a normalised campaign request.
    pub fn create_campaign(
        &self,
        req: CreateCampaignRequest,
        created_by: &str,
        now: DateTime<Utc>,
    ) -> Result<Created<Campaign>> {
        let c = Campaign {
            id: uuid::Uuid::new_v4().to_string(),
            name: req.name,
            description: req.description,
            rules: req.rules,
            namespace: req.namespace,
            owner: req.owner,
            due_date: req.due_date,
            created_by: created_by.to_string(),
            created_at: stamp(now),
        };
        let rules = serde_json::to_string(&c.rules)?;
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM campaigns", [], |r| r.get(0))?;
        if count >= MAX_CAMPAIGNS as i64 {
            return Ok(Created::Full);
        }
        conn.execute(
            "INSERT INTO campaigns (id, name, description, rules_json, namespace, owner,
               due_date, created_by, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                c.id,
                c.name,
                c.description,
                rules,
                c.namespace,
                c.owner,
                c.due_date,
                c.created_by,
                c.created_at
            ],
        )?;
        Ok(Created::Ok(c))
    }

    pub fn delete_campaign(&self, id: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        Ok(conn.execute("DELETE FROM campaigns WHERE id = ?1", [id])? > 0)
    }

    /// Record a status transition. The Go controller is the production
    /// writer; this exists for seeding and for handler-level tests.
    pub fn record_status_event(&self, event: &StatusEvent) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO status_events (app_id, status, message, at) VALUES (?1, ?2, ?3, ?4)",
            params![event.app_id, event.status, event.message, event.at],
        )?;
        Ok(())
    }

    /// Transitions since `since` plus, per app, the last one before it (the
    /// status the window opens with), oldest first. `app_id` narrows to one app.
    pub fn list_status_events(
        &self,
        app_id: Option<&str>,
        since: DateTime<Utc>,
    ) -> Result<Vec<StatusEvent>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT app_id, status, message, at FROM status_events
             WHERE (?1 IS NULL OR app_id = ?1)
               AND (at >= ?2 OR id IN (
                 SELECT MAX(id) FROM status_events
                 WHERE at < ?2 AND (?1 IS NULL OR app_id = ?1)
                 GROUP BY app_id))
             ORDER BY id",
        )?;
        let rows = stmt.query_map(params![app_id, stamp(since)], |r| {
            Ok(StatusEvent {
                app_id: r.get(0)?,
                status: r.get(1)?,
                message: r.get(2)?,
                at: r.get(3)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-11-25T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc)
    }

    fn req(rule: &str) -> CreateExemptionRequest {
        CreateExemptionRequest {
            app_id: "a/b".into(),
            rule: rule.into(),
            reason: " why ".into(),
            days: 10,
        }
    }

    #[test]
    fn exemptions_reject_live_duplicates_but_allow_renewal_after_expiry() {
        let s = Store::open(":memory:").unwrap();
        let Created::Ok(e) = s
            .create_exemption(&req("owner-missing"), "u", now())
            .unwrap()
        else {
            panic!("not created");
        };
        assert_eq!(e.reason, "why");
        assert_eq!(e.expires_at, "2026-12-05T00:00:00Z");
        assert!(matches!(
            s.create_exemption(&req("owner-missing"), "u", now())
                .unwrap(),
            Created::Duplicate
        ));
        let later = now() + Duration::days(11);
        assert!(matches!(
            s.create_exemption(&req("owner-missing"), "u", later)
                .unwrap(),
            Created::Ok(_)
        ));
        assert_eq!(s.list_exemptions().unwrap().len(), 2);
        assert!(s.delete_exemption(&e.id).unwrap());
        assert!(!s.delete_exemption(&e.id).unwrap());
    }

    #[test]
    fn campaigns_round_trip_and_cap() {
        let s = Store::open(":memory:").unwrap();
        let r = CreateCampaignRequest {
            name: "n".into(),
            description: "d".into(),
            rules: vec!["owner-missing".into()],
            namespace: String::new(),
            owner: String::new(),
            due_date: "2026-12-31".into(),
        };
        for _ in 0..MAX_CAMPAIGNS {
            assert!(matches!(
                s.create_campaign(r.clone(), "u", now()).unwrap(),
                Created::Ok(_)
            ));
        }
        assert!(matches!(
            s.create_campaign(r, "u", now()).unwrap(),
            Created::Full
        ));
        let all = s.list_campaigns().unwrap();
        assert_eq!(all.len(), MAX_CAMPAIGNS);
        assert_eq!(all[0].rules, ["owner-missing"]);
        assert!(s.delete_campaign(&all[0].id).unwrap());
    }

    #[test]
    fn status_events_include_the_opening_state() {
        let s = Store::open(":memory:").unwrap();
        for (app, status, at) in [
            ("a", "healthy", "2026-01-01T00:00:00Z"),
            ("a", "broken", "2026-02-01T00:00:00Z"),
            ("b", "healthy", "2026-01-15T00:00:00Z"),
            ("a", "healthy", "2026-11-24T00:00:00Z"),
        ] {
            s.record_status_event(&StatusEvent {
                app_id: app.into(),
                status: status.into(),
                message: String::new(),
                at: at.into(),
            })
            .unwrap();
        }
        let since = now() - Duration::days(7);
        let got = s.list_status_events(Some("a"), since).unwrap();
        let st: Vec<&str> = got.iter().map(|e| e.status.as_str()).collect();
        assert_eq!(st, ["broken", "healthy"]);
        assert_eq!(s.list_status_events(None, since).unwrap().len(), 3);
    }
}
