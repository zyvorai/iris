// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

package discovery

import (
	"strings"

	"github.com/zyvorai/hermes/controller/model"
)

func metaFromAnnotations(ann map[string]string) model.AppMeta {
	meta := model.AppMeta{}
	if v := ann[annoEnvironment]; v != "" {
		meta.Environment = normalizeEnvironment(v)
	}
	if v := ann[annoOwner]; v != "" {
		meta.Owner = v
	}
	if v := ann[annoDependsOn]; v != "" {
		for _, part := range strings.Split(v, ",") {
			part = strings.TrimSpace(part)
			if part != "" {
				meta.DependsOn = append(meta.DependsOn, part)
			}
		}
	}
	if ann[annoRecommended] == "true" {
		meta.Recommended = true
	}
	return meta
}

func inferEnvironment(namespace string) string {
	ns := strings.ToLower(namespace)
	switch {
	case strings.Contains(ns, "prod"), ns == "production":
		return "production"
	case strings.Contains(ns, "staging"), strings.Contains(ns, "stage"):
		return "staging"
	case strings.Contains(ns, "dev"), strings.Contains(ns, "development"):
		return "development"
	case strings.Contains(ns, "test"), strings.Contains(ns, "qa"):
		return "testing"
	default:
		return ""
	}
}

func normalizeEnvironment(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "prod", "production":
		return "production"
	case "stage", "staging":
		return "staging"
	case "dev", "development":
		return "development"
	case "test", "testing", "qa":
		return "testing"
	default:
		return strings.ToLower(strings.TrimSpace(raw))
	}
}

func enrichMeta(meta model.AppMeta, namespace string) model.AppMeta {
	if meta.Environment == "" {
		meta.Environment = inferEnvironment(namespace)
	}
	return meta
}
