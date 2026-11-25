// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0
package discovery

import (
	"context"
	"path/filepath"
	"testing"

	corev1 "k8s.io/api/core/v1"
	discoveryv1 "k8s.io/api/discovery/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes/fake"
	"k8s.io/client-go/tools/cache"

	"github.com/zyvorai/iris/controller/model"
	"github.com/zyvorai/iris/controller/store"
)

func TestBuildAppInheritsSignatureCanonicalSlugWhenEnabled(t *testing.T) {
	w := &Watcher{cfg: Config{AutoSuggest: true, AutoPublish: true, DiscoverAll: true}}
	svc := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "grafana",
			Namespace: "iris-demo",
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
			Namespace: "iris-demo",
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

func TestReadyCountSumsEndpointSlices(t *testing.T) {
	w := &Watcher{}
	ready := true
	slice := func(name string, n int) *discoveryv1.EndpointSlice {
		s := &discoveryv1.EndpointSlice{ObjectMeta: metav1.ObjectMeta{
			Name: name, Namespace: "ns",
			Labels: map[string]string{discoveryv1.LabelServiceName: "svc"},
		}}
		for i := 0; i < n; i++ {
			s.Endpoints = append(s.Endpoints, discoveryv1.Endpoint{
				Conditions: discoveryv1.EndpointConditions{Ready: &ready},
			})
		}
		return s
	}
	check := func(want int) {
		t.Helper()
		if got, ok := w.readyCount("ns/svc"); !ok || got != want {
			t.Fatalf("ready = %d (%v), want %d", got, ok, want)
		}
	}
	w.recordEndpointSlice(slice("a", 2), false)
	w.recordEndpointSlice(slice("b", 0), false)
	check(2)
	w.recordEndpointSlice(slice("b", 3), false)
	check(5)
	w.recordEndpointSlice(cache.DeletedFinalStateUnknown{Obj: slice("a", 2)}, true)
	check(3)
	if _, _, ok := w.recordEndpointSlice("not a slice", false); ok {
		t.Fatal("accepted an unrelated object")
	}
}

func TestResyncDoesNotRecordRestartBlip(t *testing.T) {
	st, err := store.Open(filepath.Join(t.TempDir(), "iris.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	ready := true
	client := fake.NewSimpleClientset(
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{Name: "svc", Namespace: "ns", Annotations: map[string]string{
				annoEnabled: "true",
				// Nothing listens here, so the probe fails fast with "degraded".
				annoPort: "1",
			}},
			Spec: corev1.ServiceSpec{Ports: []corev1.ServicePort{{Port: 80}}},
		},
		&discoveryv1.EndpointSlice{
			ObjectMeta: metav1.ObjectMeta{
				Name: "svc-1", Namespace: "ns",
				Labels: map[string]string{discoveryv1.LabelServiceName: "svc"},
			},
			Endpoints: []discoveryv1.Endpoint{{Conditions: discoveryv1.EndpointConditions{Ready: &ready}}},
		},
		// Route indexing refreshes the service, so it must see the counts too.
		&networkingv1.Ingress{
			ObjectMeta: metav1.ObjectMeta{Name: "ing", Namespace: "ns"},
			Spec: networkingv1.IngressSpec{Rules: []networkingv1.IngressRule{{
				Host: "svc.example",
				IngressRuleValue: networkingv1.IngressRuleValue{HTTP: &networkingv1.HTTPIngressRuleValue{
					Paths: []networkingv1.HTTPIngressPath{{Backend: networkingv1.IngressBackend{
						Service: &networkingv1.IngressServiceBackend{Name: "svc"},
					}}},
				}},
			}}},
		},
	)
	w := NewWatcher(client, nil, nil, st, Config{AutoSuggest: true, DiscoverIngress: true})
	if err := w.ResyncAll(context.Background()); err != nil {
		t.Fatal(err)
	}
	app, err := st.GetApp("ns/svc")
	if err != nil {
		t.Fatal(err)
	}
	if app.ReadyCount != 1 || app.Status == model.StatusBroken {
		t.Fatalf("ready = %d, status = %s", app.ReadyCount, app.Status)
	}
	events, err := st.StatusEvents("ns/svc")
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 1 || events[0] == model.StatusBroken {
		t.Fatalf("events = %v", events)
	}
}

func intstrFromInt(p int32) intstr.IntOrString {
	return intstr.IntOrString{Type: intstr.Int, IntVal: p}
}
