// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

package discovery

import (
	"context"
	"strings"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var virtualServiceGVR = schema.GroupVersionResource{
	Group:    "networking.istio.io",
	Version:  "v1beta1",
	Resource: "virtualservices",
}

func (w *Watcher) syncMeshRoutes(ctx context.Context) error {
	if !w.cfg.DiscoverMesh || w.dynClient == nil {
		return nil
	}
	w.meshRoutes = make(map[string][]string)
	list, err := w.dynClient.Resource(virtualServiceGVR).Namespace("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return err
	}
	for _, item := range list.Items {
		w.indexVirtualService(&item)
	}
	return nil
}

func (w *Watcher) indexVirtualService(us *unstructured.Unstructured) {
	hosts, _, _ := unstructured.NestedStringSlice(us.Object, "spec", "hosts")
	httpRoutes, _, _ := unstructured.NestedSlice(us.Object, "spec", "http")
	for _, hr := range httpRoutes {
		hm, ok := hr.(map[string]interface{})
		if !ok {
			continue
		}
		routes, ok := hm["route"].([]interface{})
		if !ok {
			continue
		}
		for _, rt := range routes {
			rm, ok := rt.(map[string]interface{})
			if !ok {
				continue
			}
			dest, ok := rm["destination"].(map[string]interface{})
			if !ok {
				continue
			}
			host, _ := dest["host"].(string)
			key := meshServiceKey(host)
			if key == "" {
				continue
			}
			label := strings.Join(hosts, ",")
			if label == "" {
				label = host
			}
			w.meshRoutes[key] = appendUnique(w.meshRoutes[key], "istio:"+label)
		}
	}
}

func meshServiceKey(host string) string {
	host = strings.TrimSpace(host)
	if host == "" {
		return ""
	}
	parts := strings.Split(host, ".")
	if len(parts) >= 2 {
		return parts[1] + "/" + parts[0]
	}
	return ""
}

func linkerdRoutes(svc *corev1.Service) []string {
	if svc.Annotations == nil {
		return nil
	}
	var routes []string
	if v := svc.Annotations["linkerd.io/inject"]; v == "enabled" || v == "inject" {
		routes = append(routes, "linkerd:"+svc.Name)
	}
	if v := svc.Annotations["config.linkerd.io/opaque-ports"]; v != "" {
		routes = append(routes, "linkerd:ports:"+v)
	}
	return routes
}

func (w *Watcher) meshRoutesForService(svc *corev1.Service) []string {
	key := svc.Namespace + "/" + svc.Name
	var routes []string
	if mesh, ok := w.meshRoutes[key]; ok {
		routes = append(routes, mesh...)
	}
	for _, lr := range linkerdRoutes(svc) {
		routes = appendUnique(routes, lr)
	}
	return routes
}
