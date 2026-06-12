// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

// Seed local SQLite with demo apps for smoke tests.
package main

import (
	"log"
	"os"

	"github.com/ssahani/hermes/controller/model"
	"github.com/ssahani/hermes/controller/store"
)

func main() {
	path := "/tmp/hermes-smoke.db"
	if len(os.Args) > 1 {
		path = os.Args[1]
	}
	_ = os.Remove(path)

	st, err := store.Open(path)
	if err != nil {
		log.Fatal(err)
	}
	defer st.Close()

	apps := []model.App{
		{
			ID: "monitoring/grafana", Slug: "grafana", DisplayName: "Grafana",
			Namespace: "monitoring", Category: "Monitoring", Icon: "grafana",
			Backend:    model.Backend{Kind: "Service", Name: "grafana", Port: 80, Scheme: "http", Path: "/"},
			RoutePath:  "/a/monitoring/grafana",
			PublicURL:  "http://localhost:8080/a/monitoring/grafana",
			Status:     model.StatusHealthy, Source: model.SourceAnnotation, AuthMode: "none", Score: 80,
			Visibility: model.Visibility{Published: true}, ReadyCount: 2,
		},
		{
			ID: "monitoring/prometheus-server", Slug: "prometheus-server", DisplayName: "Prometheus",
			Namespace: "monitoring", Category: "Monitoring", Icon: "prometheus",
			Backend:    model.Backend{Kind: "Service", Name: "prometheus-server", Port: 9090, Scheme: "http", Path: "/"},
			RoutePath:  "/a/monitoring/prometheus-server",
			PublicURL:  "http://localhost:8080/a/monitoring/prometheus-server",
			Status:     model.StatusHealthy, Source: model.SourceAnnotation, AuthMode: "none", Score: 75,
			Visibility: model.Visibility{Published: true}, ReadyCount: 1,
		},
		{
			ID: "argocd/argocd-server", Slug: "argocd-server", DisplayName: "ArgoCD",
			Namespace: "argocd", Category: "GitOps", Icon: "argocd",
			Backend:    model.Backend{Kind: "Service", Name: "argocd-server", Port: 443, Scheme: "https", Path: "/"},
			RoutePath:  "/a/argocd/argocd-server",
			PublicURL:  "http://localhost:8080/a/argocd/argocd-server",
			Status:     model.StatusBroken, StatusMsg: "Service has no ready endpoints",
			Source: model.SourceSignature, AuthMode: "sso", Score: 45,
			Visibility: model.Visibility{Published: false}, ReadyCount: 0,
		},
	}

	for _, app := range apps {
		if err := st.UpsertApp(app); err != nil {
			log.Fatal(err)
		}
	}
	log.Printf("seeded %d apps at %s", len(apps), path)
}
