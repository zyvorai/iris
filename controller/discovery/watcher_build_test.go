// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
package discovery

import (
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

func TestBuildAppInheritsSignatureCanonicalSlugWhenEnabled(t *testing.T) {
	w := &Watcher{cfg: Config{AutoSuggest: true, AutoPublish: true, DiscoverAll: true}}
	svc := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "grafana",
			Namespace: "hermes-demo",
			Annotations: map[string]string{
				annoEnabled:   "true",
				annoName:      "Grafana",
				annoPublished: "true",
			},
		},
		Spec: corev1.ServiceSpec{
			Ports: []corev1.ServicePort{{Port: 80, TargetPort: intstrFromInt(3000)}},
		},
	}

	app, ok := w.buildApp(svc)
	if !ok {
		t.Fatal("expected app to be built")
	}
	if app.CanonicalSlug != "grafana" {
		t.Fatalf("CanonicalSlug = %q, want grafana", app.CanonicalSlug)
	}
}

func TestBuildAppKeepsExplicitAnnotationSlug(t *testing.T) {
	w := &Watcher{cfg: Config{AutoSuggest: true, AutoPublish: true, DiscoverAll: true}}
	svc := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "grafana",
			Namespace: "hermes-demo",
			Annotations: map[string]string{
				annoEnabled: "true",
				annoSlug:    "custom-grafana",
			},
		},
		Spec: corev1.ServiceSpec{
			Ports: []corev1.ServicePort{{Port: 80}},
		},
	}

	app, ok := w.buildApp(svc)
	if !ok {
		t.Fatal("expected app to be built")
	}
	if app.CanonicalSlug != "custom-grafana" {
		t.Fatalf("CanonicalSlug = %q, want custom-grafana", app.CanonicalSlug)
	}
}

func intstrFromInt(p int32) intstr.IntOrString {
	return intstr.IntOrString{Type: intstr.Int, IntVal: p}
}
