// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

//! Status history and uptime from the status transitions the controller
//! records (in the style of Gatus uptime and event history).

use chrono::{DateTime, Duration, Utc};
use serde::Serialize;

use crate::App;

pub const DEFAULT_HISTORY_DAYS: i64 = 7;
pub const MAX_HISTORY_DAYS: i64 = 90;
/// Maximum transitions returned for one app (newest are kept).
pub const MAX_EVENTS_LISTED: usize = 200;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StatusEvent {
    pub app_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub message: String,
    pub at: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppUptime {
    pub id: String,
    pub label: String,
    pub namespace: String,
    /// Percentage of observed time spent `healthy`, two decimals. Absent when
    /// nothing has been observed in the window.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uptime_percent: Option<f64>,
    /// Seconds of the window with a known (healthy, degraded or broken) status.
    pub observed_seconds: i64,
    /// Observed seconds spent `degraded` or `broken`.
    pub down_seconds: i64,
    /// Changes of status inside the window.
    pub transitions: usize,
    pub current_status: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppHistory {
    pub days: i64,
    #[serde(flatten)]
    pub uptime: AppUptime,
    /// Newest first.
    pub events: Vec<StatusEvent>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UptimeReport {
    pub days: i64,
    /// Lowest uptime first; apps without history last.
    pub apps: Vec<AppUptime>,
}

fn parse(at: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(at)
        .ok()
        .map(|t| t.with_timezone(&Utc))
}

/// Summarise one app. `events` are its transitions in recording order
/// (oldest first) and may start before the window: the last event before the
/// window gives the status the window opens with. Time before the first event
/// is unobserved and never counted.
pub fn app_history(app: &App, events: &[StatusEvent], days: i64, now: DateTime<Utc>) -> AppHistory {
    let days = days.clamp(1, MAX_HISTORY_DAYS);
    let start = now - Duration::days(days);
    let parsed: Vec<(DateTime<Utc>, &StatusEvent)> = events
        .iter()
        .filter_map(|e| parse(&e.at).map(|t| (t.min(now), e)))
        .collect();

    let mut observed = 0i64;
    let mut healthy = 0i64;
    let mut down = 0i64;
    let mut transitions = 0usize;
    for (i, (at, e)) in parsed.iter().enumerate() {
        let end = parsed.get(i + 1).map_or(now, |(t, _)| *t);
        let from = (*at).max(start);
        let secs = (end - from).num_seconds().max(0);
        // `unknown` and other states say nothing about availability.
        match e.status.as_str() {
            "healthy" => {
                observed += secs;
                healthy += secs;
            }
            "degraded" | "broken" => {
                observed += secs;
                down += secs;
            }
            _ => {}
        }
        if i > 0 && *at >= start && parsed[i - 1].1.status != e.status {
            transitions += 1;
        }
    }
    let uptime_percent =
        (observed > 0).then(|| (healthy as f64 * 10_000.0 / observed as f64).floor() / 100.0);
    let listed: Vec<StatusEvent> = parsed
        .iter()
        .rev()
        .filter(|(t, _)| *t >= start)
        .take(MAX_EVENTS_LISTED)
        .map(|(_, e)| (*e).clone())
        .collect();
    AppHistory {
        days,
        uptime: AppUptime {
            id: app.id.clone(),
            label: app.display_name.clone(),
            namespace: app.namespace.clone(),
            uptime_percent,
            observed_seconds: observed,
            down_seconds: down,
            transitions,
            current_status: app.status.clone(),
        },
        events: listed,
    }
}

/// Uptime for many apps. `events` holds every app's transitions, oldest first.
pub fn uptime_report(
    apps: &[App],
    events: &[StatusEvent],
    days: i64,
    now: DateTime<Utc>,
) -> UptimeReport {
    let days = days.clamp(1, MAX_HISTORY_DAYS);
    let mut by_app: std::collections::HashMap<&str, Vec<StatusEvent>> = Default::default();
    for e in events {
        by_app.entry(e.app_id.as_str()).or_default().push(e.clone());
    }
    let mut out: Vec<AppUptime> = apps
        .iter()
        .take(crate::impact::MAX_APPS)
        .map(|a| {
            let ev = by_app.get(a.id.as_str()).map_or(&[][..], Vec::as_slice);
            app_history(a, ev, days, now).uptime
        })
        .collect();
    out.sort_by(|a, b| {
        let key = |u: &AppUptime| u.uptime_percent.unwrap_or(f64::INFINITY);
        key(a).total_cmp(&key(b)).then_with(|| a.id.cmp(&b.id))
    });
    UptimeReport { days, apps: out }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::impact::tests::app;

    fn now() -> DateTime<Utc> {
        parse("2026-11-25T00:00:00Z").unwrap()
    }

    fn ev(id: &str, status: &str, at: &str) -> StatusEvent {
        StatusEvent {
            app_id: id.into(),
            status: status.into(),
            message: String::new(),
            at: at.into(),
        }
    }

    #[test]
    fn uptime_counts_only_observed_time() {
        let a = app("a", "healthy", &[]);
        // Observed for 4 days of a 7 day window, broken for 1 of them.
        let events = [
            ev("demo/a", "healthy", "2026-11-21T00:00:00Z"),
            ev("demo/a", "broken", "2026-11-22T00:00:00Z"),
            ev("demo/a", "healthy", "2026-11-23T00:00:00Z"),
        ];
        let h = app_history(&a, &events, 7, now());
        assert_eq!(h.uptime.observed_seconds, 4 * 86_400);
        assert_eq!(h.uptime.down_seconds, 86_400);
        assert_eq!(h.uptime.uptime_percent, Some(75.0));
        assert_eq!(h.uptime.transitions, 2);
        assert_eq!(h.events[0].at, "2026-11-23T00:00:00Z");
    }

    #[test]
    fn state_before_the_window_carries_in() {
        let a = app("a", "broken", &[]);
        let events = [
            ev("demo/a", "healthy", "2026-01-01T00:00:00Z"),
            ev("demo/a", "broken", "2026-11-24T00:00:00Z"),
        ];
        let h = app_history(&a, &events, 2, now());
        assert_eq!(h.uptime.observed_seconds, 2 * 86_400);
        assert_eq!(h.uptime.uptime_percent, Some(50.0));
        assert_eq!(h.uptime.transitions, 1);
        assert_eq!(h.events.len(), 1);
    }

    #[test]
    fn no_history_bad_dates_and_clamping() {
        let a = app("a", "healthy", &[]);
        let h = app_history(&a, &[ev("demo/a", "healthy", "yesterday")], 1000, now());
        assert_eq!(h.days, MAX_HISTORY_DAYS);
        assert_eq!(h.uptime.uptime_percent, None);
        assert_eq!(app_history(&a, &[], -3, now()).days, 1);
        // A timestamp in the future never produces negative time.
        let h = app_history(
            &a,
            &[ev("demo/a", "healthy", "2027-01-01T00:00:00Z")],
            1,
            now(),
        );
        assert_eq!(h.uptime.observed_seconds, 0);
    }

    #[test]
    fn unknown_time_is_not_observed() {
        let a = app("a", "healthy", &[]);
        let events = [
            ev("demo/a", "unknown", "2026-11-23T00:00:00Z"),
            ev("demo/a", "healthy", "2026-11-24T00:00:00Z"),
        ];
        let h = app_history(&a, &events, 7, now());
        assert_eq!(h.uptime.observed_seconds, 86_400);
        assert_eq!(h.uptime.uptime_percent, Some(100.0));
    }

    #[test]
    fn report_sorts_worst_first_and_unknown_last() {
        let apps = [
            app("good", "healthy", &[]),
            app("none", "healthy", &[]),
            app("bad", "broken", &[]),
        ];
        let events = [
            ev("demo/good", "healthy", "2026-11-20T00:00:00Z"),
            ev("demo/bad", "broken", "2026-11-20T00:00:00Z"),
        ];
        let r = uptime_report(&apps, &events, 7, now());
        let ids: Vec<&str> = r.apps.iter().map(|a| a.id.as_str()).collect();
        assert_eq!(ids, ["demo/bad", "demo/good", "demo/none"]);
        assert_eq!(r.apps[0].uptime_percent, Some(0.0));
    }
}
