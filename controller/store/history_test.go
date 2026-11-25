// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

package store

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/zyvorai/iris/controller/model"
)

func open(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "iris.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.Close() })
	// Durability is irrelevant here and fsync makes hundreds of inserts slow.
	s.db.SetMaxOpenConns(1)
	if _, err := s.db.Exec("PRAGMA synchronous=OFF"); err != nil {
		t.Fatal(err)
	}
	return s
}

func statuses(t *testing.T, s *Store, id string) []string {
	t.Helper()
	out, err := s.StatusEvents(id)
	if err != nil {
		t.Fatal(err)
	}
	return out
}

func TestUpsertRecordsOnlyStatusChanges(t *testing.T) {
	s := open(t)
	app := model.App{ID: "a/b", Slug: "b", Namespace: "a", Source: model.SourceService}
	for _, st := range []string{"healthy", "healthy", "broken", "broken", "healthy"} {
		app.Status = st
		if err := s.UpsertApp(app); err != nil {
			t.Fatal(err)
		}
	}
	if got := strings.Join(statuses(t, s, "a/b"), ","); got != "healthy,broken,healthy" {
		t.Fatalf("events = %s", got)
	}
	if err := s.DeleteApp("a/b"); err != nil {
		t.Fatal(err)
	}
	if got := statuses(t, s, "a/b"); len(got) != 0 {
		t.Fatalf("events after delete = %v", got)
	}
}

func TestStatusHistoryIsTrimmedPerApp(t *testing.T) {
	s := open(t)
	if err := s.recordStatus("other/app", "healthy", "", "2026-01-01T00:00:00Z"); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < maxEventsPerApp+10; i++ {
		st := "healthy"
		if i%2 == 1 {
			st = "broken"
		}
		if err := s.recordStatus("a/b", st, strings.Repeat("m", 2000), "2026-01-01T00:00:00Z"); err != nil {
			t.Fatal(err)
		}
	}
	if n := len(statuses(t, s, "a/b")); n != maxEventsPerApp {
		t.Fatalf("kept %d events", n)
	}
	if n := len(statuses(t, s, "other/app")); n != 1 {
		t.Fatalf("other app kept %d events", n)
	}
	var longest int
	if err := s.db.QueryRow(`SELECT MAX(length(message)) FROM status_events`).Scan(&longest); err != nil {
		t.Fatal(err)
	}
	if longest != maxMessageLen {
		t.Fatalf("message length = %d", longest)
	}
}

func TestMetaRoundTripKeepsLinksTagsLifecycle(t *testing.T) {
	s := open(t)
	app := model.App{
		ID: "a/b", Slug: "b", Namespace: "a", Source: model.SourceService, Status: "healthy",
		Meta: model.AppMeta{
			Owner: "team", Lifecycle: "deprecated", Tags: []string{"go"},
			Links: []model.AppLink{{Title: "Runbook", URL: "https://x.example", Type: "runbook"}},
		},
	}
	if err := s.UpsertApp(app); err != nil {
		t.Fatal(err)
	}
	// Removing the annotations on the next sync clears the values.
	got, err := s.GetApp("a/b")
	if err != nil {
		t.Fatal(err)
	}
	if got.Meta.Lifecycle != "deprecated" || len(got.Meta.Tags) != 1 || len(got.Meta.Links) != 1 {
		t.Fatalf("meta = %+v", got.Meta)
	}
	app.Meta = model.AppMeta{Owner: "team"}
	if err := s.UpsertApp(app); err != nil {
		t.Fatal(err)
	}
	got, err = s.GetApp("a/b")
	if err != nil {
		t.Fatal(err)
	}
	if got.Meta.Lifecycle != "" || got.Meta.Tags != nil || got.Meta.Links != nil {
		t.Fatalf("meta after removal = %+v", got.Meta)
	}
}
