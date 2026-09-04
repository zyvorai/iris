// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0
package discovery

import "testing"

func TestNormalizeEnvironment(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"prod", "production"},
		{"production", "production"},
		{"PROD", "production"},
		{"stage", "staging"},
		{"staging", "staging"},
		{"dev", "development"},
		{"development", "development"},
		{"test", "testing"},
		{"testing", "testing"},
		{"qa", "testing"},
		{"canary", "canary"}, // unknown → lowercased passthrough
		{"", ""},
	}
	for _, c := range cases {
		if got := normalizeEnvironment(c.in); got != c.want {
			t.Errorf("normalizeEnvironment(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestInferEnvironment(t *testing.T) {
	cases := []struct {
		ns, want string
	}{
		{"production", "production"},
		{"prod", "production"},
		{"prod-east", "production"},
		{"staging", "staging"},
		{"stage-us", "staging"},
		{"dev", "development"},
		{"development", "development"},
		{"dev-1", "development"},
		{"test", "testing"},
		{"testing", "testing"},
		{"qa", "testing"},
		{"qa-env", "testing"},
		{"monitoring", ""},
		{"default", ""},
		{"kube-system", ""},
	}
	for _, c := range cases {
		if got := inferEnvironment(c.ns); got != c.want {
			t.Errorf("inferEnvironment(%q) = %q, want %q", c.ns, got, c.want)
		}
	}
}

func TestMetaFromAnnotations(t *testing.T) {
	ann := map[string]string{
		annoOwner:       "platform-team",
		annoEnvironment: "prod",
		annoDependsOn:   "monitoring/grafana,monitoring/prometheus",
	}
	meta := metaFromAnnotations(ann)

	if meta.Owner != "platform-team" {
		t.Errorf("owner = %q, want %q", meta.Owner, "platform-team")
	}
	if meta.Environment != "production" {
		t.Errorf("environment = %q, want %q", meta.Environment, "production")
	}
	if len(meta.DependsOn) != 2 {
		t.Errorf("dependsOn len = %d, want 2", len(meta.DependsOn))
	}
}

func TestMetaFromAnnotationsEmpty(t *testing.T) {
	meta := metaFromAnnotations(nil)
	if meta.Owner != "" || meta.Environment != "" || len(meta.DependsOn) != 0 {
		t.Errorf("expected zero meta from empty annotations, got %+v", meta)
	}
}
