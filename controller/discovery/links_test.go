// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

package discovery

import (
	"fmt"
	"reflect"
	"strings"
	"testing"

	"github.com/zyvorai/iris/controller/model"
)

func TestIsSafeLink(t *testing.T) {
	for _, ok := range []string{"https://wiki.example/run", "HTTP://host:8080/x?y=1"} {
		if !isSafeLink(ok) {
			t.Errorf("%q should be safe", ok)
		}
	}
	for _, bad := range []string{
		"", "javascript:alert(1)", "data:text/html,x", "//evil.example", "/relative",
		"https://", "https:///path", "https://a b", "https://a\nb",
		"https://" + strings.Repeat("a", maxURLLen),
	} {
		if isSafeLink(bad) {
			t.Errorf("%q should be rejected", bad)
		}
	}
}

func TestLinksFromAnnotations(t *testing.T) {
	got := linksFromAnnotations(map[string]string{
		annoRunbook:    "https://wiki.example/run",
		annoDocs:       "javascript:alert(1)",
		annoRepository: "https://git.example/app",
		annoLinks: "Dash|https://dash.example/d\n\nhttps://status.example\n" +
			"Dup|https://wiki.example/run\nBad|ftp://x",
	})
	want := []model.AppLink{
		{Title: "Runbook", URL: "https://wiki.example/run", Type: "runbook"},
		{Title: "Repository", URL: "https://git.example/app", Type: "repository"},
		{Title: "Dash", URL: "https://dash.example/d"},
		{Title: "status.example", URL: "https://status.example"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("links = %+v, want %+v", got, want)
	}
}

func TestLinksAreCapped(t *testing.T) {
	var lines []string
	for i := 0; i < 30; i++ {
		lines = append(lines, fmt.Sprintf("%s|https://x.example/%d", strings.Repeat("t", 200), i))
	}
	got := linksFromAnnotations(map[string]string{annoLinks: strings.Join(lines, "\n")})
	if len(got) != maxLinks || len(got[0].Title) != maxTitleLen {
		t.Fatalf("len = %d, title len = %d", len(got), len(got[0].Title))
	}
}

func TestTagsAndLifecycle(t *testing.T) {
	got := parseTags(" Go, go ,c#,java++, -bad,bad-, has space,lang:rust,,team-a")
	want := []string{"go", "c#", "java++", "lang:rust", "team-a"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("tags = %v, want %v", got, want)
	}
	meta := metaFromAnnotations(map[string]string{
		annoTags:      "go",
		annoLifecycle: " Deprecated ",
		annoRunbook:   "https://wiki.example/run",
	})
	if meta.Lifecycle != "deprecated" || len(meta.Tags) != 1 || len(meta.Links) != 1 {
		t.Fatalf("meta = %+v", meta)
	}
	if v := normalizeLifecycle("not valid!"); v != "" {
		t.Fatalf("lifecycle = %q, want empty", v)
	}
}
