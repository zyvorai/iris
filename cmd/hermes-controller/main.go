// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/dynamic"
	gwclientset "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned"

	"github.com/zyvorai/hermes/controller/discovery"
	"github.com/zyvorai/hermes/controller/store"
)

func main() {
	dbPath := env("HERMES_DB_PATH", "/data/hermes/hermes.db")
	publicBase := env("HERMES_PUBLIC_BASE_URL", "https://localhost:31847")
	publicPathPrefix := env("HERMES_PUBLIC_PATH_PREFIX", "")
	autoPublish := env("HERMES_AUTO_PUBLISH", "false") == "true"
	autoSuggest := env("HERMES_AUTO_SUGGEST", "true") != "false"
	discoverAll := env("HERMES_DISCOVER_ALL", "true") != "false"
	discoverIngress := env("HERMES_DISCOVER_INGRESS", "true") != "false"
	discoverGatewayAPI := env("HERMES_DISCOVER_GATEWAY_API", "true") != "false"
	discoverMesh := env("HERMES_DISCOVER_MESH", "true") != "false"
	watchNS := splitCSV(env("HERMES_WATCH_NAMESPACES", ""))
	healthInterval := 30 * time.Second

	st, err := store.Open(dbPath)
	if err != nil {
		log.Fatalf("open store: %v", err)
	}
	defer st.Close()

	restCfg, err := restConfig()
	if err != nil {
		log.Fatalf("k8s config: %v", err)
	}
	client, err := kubernetes.NewForConfig(restCfg)
	if err != nil {
		log.Fatalf("k8s client: %v", err)
	}

	var gwClient gwclientset.Interface
	if discoverGatewayAPI {
		gwClient, err = gwclientset.NewForConfig(restCfg)
		if err != nil {
			log.Printf("gateway-api client unavailable (install Gateway API CRDs to enable): %v", err)
			discoverGatewayAPI = false
		}
	}

	var dynClient dynamic.Interface
	if discoverMesh {
		dynClient, err = dynamic.NewForConfig(restCfg)
		if err != nil {
			log.Printf("dynamic client unavailable: %v", err)
			discoverMesh = false
		}
	}

	cfg := discovery.Config{
		PublicBaseURL:      publicBase,
		PublicPathPrefix:   publicPathPrefix,
		AutoPublish:        autoPublish,
		AutoSuggest:        autoSuggest,
		DiscoverAll:        discoverAll,
		DiscoverIngress:    discoverIngress,
		DiscoverGatewayAPI: discoverGatewayAPI,
		DiscoverMesh:       discoverMesh,
		WatchNS:            watchNS,
	}
	w := discovery.NewWatcher(client, gwClient, dynClient, st, cfg)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	if err := w.ResyncAll(ctx); err != nil {
		log.Printf("initial resync: %v", err)
	}

	go w.RefreshHealth(ctx, healthInterval)

	log.Printf("hermes-controller watching (autoPublish=%v autoSuggest=%v discoverAll=%v discoverIngress=%v discoverGatewayAPI=%v discoverMesh=%v)",
		autoPublish, autoSuggest, discoverAll, discoverIngress, discoverGatewayAPI, discoverMesh)
	if err := w.Run(ctx); err != nil {
		log.Fatalf("watcher: %v", err)
	}
}

func restConfig() (*rest.Config, error) {
	cfg, err := rest.InClusterConfig()
	if err != nil {
		kubeconfig := os.Getenv("KUBECONFIG")
		if kubeconfig == "" {
			kubeconfig = clientcmd.RecommendedHomeFile
		}
		cfg, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return nil, err
		}
	}
	return cfg, nil
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func splitCSV(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
