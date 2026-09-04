// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0
package main

import (
	"os"
	"testing"
)

func TestSplitCSV(t *testing.T) {
	cases := []struct {
		in   string
		want []string
	}{
		{"", nil},
		{"a", []string{"a"}},
		{"a,b,c", []string{"a", "b", "c"}},
		{" a , b , c ", []string{"a", "b", "c"}},
		{"a,,b", []string{"a", "b"}},
		{",,,", nil},
	}
	for _, c := range cases {
		got := splitCSV(c.in)
		if len(got) != len(c.want) {
			t.Errorf("splitCSV(%q) = %v, want %v", c.in, got, c.want)
			continue
		}
		for i := range got {
			if got[i] != c.want[i] {
				t.Errorf("splitCSV(%q)[%d] = %q, want %q", c.in, i, got[i], c.want[i])
			}
		}
	}
}

func TestEnv(t *testing.T) {
	const key = "IRIS_TEST_VAR_XYZ"
	os.Unsetenv(key)

	if got := env(key, "default"); got != "default" {
		t.Errorf("env unset: got %q, want %q", got, "default")
	}

	os.Setenv(key, "value")
	defer os.Unsetenv(key)

	if got := env(key, "default"); got != "value" {
		t.Errorf("env set: got %q, want %q", got, "value")
	}
}
