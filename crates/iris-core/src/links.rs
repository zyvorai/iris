// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

//! External links on a catalog entry (runbook, docs, repository, ...), in the
//! style of Backstage `metadata.links`. Values come from user controlled
//! annotations, so only plain `http`/`https` URLs are ever surfaced.

use serde::{Deserialize, Serialize};

/// Maximum links surfaced per app.
pub const MAX_LINKS: usize = 10;
/// Maximum length of a link URL.
pub const MAX_URL_LEN: usize = 2048;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppLink {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub url: String,
    /// `runbook`, `docs`, `repository` or empty for a free-form link.
    #[serde(default, rename = "type", skip_serializing_if = "String::is_empty")]
    pub kind: String,
}

/// True for an absolute `http(s)` URL with a host and no whitespace or
/// control characters.
pub fn is_safe_link(url: &str) -> bool {
    if url.is_empty() || url.len() > MAX_URL_LEN {
        return false;
    }
    if url.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return false;
    }
    let lower = url.to_ascii_lowercase();
    let Some(rest) = lower
        .strip_prefix("https://")
        .or_else(|| lower.strip_prefix("http://"))
    else {
        return false;
    };
    !rest.is_empty() && !rest.starts_with(['/', '?', '#'])
}

/// Drop unsafe links and cap the list.
pub fn sanitize_links(links: &mut Vec<AppLink>) {
    links.retain(|l| is_safe_link(&l.url));
    links.truncate(MAX_LINKS);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_http_urls_are_safe() {
        for ok in ["https://wiki.example/run", "HTTP://host:8080/x?y=1"] {
            assert!(is_safe_link(ok), "{ok}");
        }
        for bad in [
            "",
            "javascript:alert(1)",
            "data:text/html,x",
            "//evil.example",
            "/relative",
            "https://",
            "https:///path",
            "https://a b",
            "https://a\nb",
        ] {
            assert!(!is_safe_link(bad), "{bad:?}");
        }
        assert!(!is_safe_link(&format!(
            "https://{}",
            "a".repeat(MAX_URL_LEN)
        )));
    }

    #[test]
    fn sanitize_filters_and_caps() {
        let mut links: Vec<AppLink> = (0..20)
            .map(|i| AppLink {
                title: format!("l{i}"),
                url: format!("https://x.example/{i}"),
                kind: String::new(),
            })
            .collect();
        links.insert(
            0,
            AppLink {
                title: "bad".into(),
                url: "javascript:1".into(),
                kind: String::new(),
            },
        );
        sanitize_links(&mut links);
        assert_eq!(links.len(), MAX_LINKS);
        assert_eq!(links[0].title, "l0");
    }
}
