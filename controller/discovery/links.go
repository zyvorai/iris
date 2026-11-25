// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

package discovery

import (
	"net/url"
	"regexp"
	"strings"
	"unicode"

	"github.com/zyvorai/iris/controller/model"
)

const (
	maxLinks    = 10
	maxURLLen   = 2048
	maxTitleLen = 64
	maxTags     = 16
	maxTagLen   = 63
)

// Backstage tag format: lowercase letters, digits, ':', '+' and '#', with
// '-' as the separator.
var tagPattern = regexp.MustCompile(`^[a-z0-9:+#]+(-[a-z0-9:+#]+)*$`)

// isSafeLink accepts only absolute http(s) URLs with a host and no whitespace
// or control characters. iris-core applies the same rule when reading.
func isSafeLink(raw string) bool {
	if raw == "" || len(raw) > maxURLLen {
		return false
	}
	if strings.IndexFunc(raw, func(r rune) bool { return unicode.IsSpace(r) || unicode.IsControl(r) }) >= 0 {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	scheme := strings.ToLower(u.Scheme)
	return (scheme == "http" || scheme == "https") && u.Host != ""
}

// linksFromAnnotations reads the well-known runbook, docs and repository
// annotations followed by free-form "Title|URL" lines from the links
// annotation. Unsafe and duplicate URLs are dropped.
func linksFromAnnotations(ann map[string]string) []model.AppLink {
	var links []model.AppLink
	seen := map[string]bool{}
	add := func(title, raw, kind string) {
		raw = strings.TrimSpace(raw)
		if len(links) >= maxLinks || seen[raw] || !isSafeLink(raw) {
			return
		}
		title = strings.TrimSpace(title)
		if title == "" {
			u, _ := url.Parse(raw)
			title = u.Host
		}
		if r := []rune(title); len(r) > maxTitleLen {
			title = string(r[:maxTitleLen])
		}
		seen[raw] = true
		links = append(links, model.AppLink{Title: title, URL: raw, Type: kind})
	}
	add("Runbook", ann[annoRunbook], "runbook")
	add("Docs", ann[annoDocs], "docs")
	add("Repository", ann[annoRepository], "repository")
	for _, line := range strings.Split(ann[annoLinks], "\n") {
		title, raw, found := strings.Cut(line, "|")
		if !found {
			title, raw = "", line
		}
		add(title, raw, "")
	}
	return links
}

func validTag(tag string) bool {
	return len(tag) <= maxTagLen && tagPattern.MatchString(tag)
}

// parseTags splits a comma separated list, lowercases it and drops invalid or
// repeated tags.
func parseTags(raw string) []string {
	var tags []string
	seen := map[string]bool{}
	for _, part := range strings.Split(raw, ",") {
		tag := strings.ToLower(strings.TrimSpace(part))
		if len(tags) >= maxTags || seen[tag] || !validTag(tag) {
			continue
		}
		seen[tag] = true
		tags = append(tags, tag)
	}
	return tags
}

func normalizeLifecycle(raw string) string {
	v := strings.ToLower(strings.TrimSpace(raw))
	if !validTag(v) {
		return ""
	}
	return v
}
