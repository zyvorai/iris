// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

package discovery

import (
	"context"
	"fmt"
	"strings"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/zyvorai/iris/controller/model"
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
	w.meshPolicies = make(map[string][]model.MeshPolicy)
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

			weight := 100
			if wv, ok := rm["weight"].(float64); ok && wv > 0 {
				weight = int(wv)
			}
			policy := model.MeshPolicy{
				Kind:        "istio",
				Name:        us.GetName(),
				Namespace:   us.GetNamespace(),
				Hosts:       append([]string(nil), hosts...),
				Destination: host,
				Weight:      weight,
				Detail:      fmt.Sprintf("VirtualService %s/%s", us.GetNamespace(), us.GetName()),
			}
			w.meshPolicies[key] = appendUniqueMeshPolicy(w.meshPolicies[key], policy)
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

func linkerdPolicies(svc *corev1.Service) []model.MeshPolicy {
	if svc.Annotations == nil {
		return nil
	}
	var policies []model.MeshPolicy
	if v := svc.Annotations["linkerd.io/inject"]; v == "enabled" || v == "inject" {
		policies = append(policies, model.MeshPolicy{
			Kind:      "linkerd",
			Name:      svc.Name,
			Namespace: svc.Namespace,
			Detail:    "Sidecar injection enabled (" + v + ")",
		})
	}
	if v := svc.Annotations["config.linkerd.io/opaque-ports"]; v != "" {
		policies = append(policies, model.MeshPolicy{
			Kind:      "linkerd",
			Name:      svc.Name,
			Namespace: svc.Namespace,
			Detail:    "Opaque ports: " + v,
		})
	}
	return policies
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

func (w *Watcher) meshPoliciesForService(svc *corev1.Service) []model.MeshPolicy {
	key := svc.Namespace + "/" + svc.Name
	var policies []model.MeshPolicy
	if mesh, ok := w.meshPolicies[key]; ok {
		policies = append(policies, mesh...)
	}
	for _, lp := range linkerdPolicies(svc) {
		policies = appendUniqueMeshPolicy(policies, lp)
	}
	return policies
}

func appendUniqueMeshPolicy(list []model.MeshPolicy, policy model.MeshPolicy) []model.MeshPolicy {
	key := policy.Kind + "|" + policy.Namespace + "|" + policy.Name + "|" + policy.Destination + "|" + policy.Detail
	for _, existing := range list {
		existingKey := existing.Kind + "|" + existing.Namespace + "|" + existing.Name + "|" + existing.Destination + "|" + existing.Detail
		if existingKey == key {
			return list
		}
	}
	return append(list, policy)
}
