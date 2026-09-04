// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

package discovery

import (
	"fmt"
	"strings"

	gwv1 "sigs.k8s.io/gateway-api/apis/v1"
	"k8s.io/client-go/tools/cache"
)

func (w *Watcher) onHTTPRoute(obj interface{}) {
	route, ok := obj.(*gwv1.HTTPRoute)
	if !ok || route == nil {
		return
	}
	w.indexHTTPRoute(route)
}

func (w *Watcher) onHTTPRouteDelete(obj interface{}) {
	route, ok := obj.(*gwv1.HTTPRoute)
	if !ok {
		if t, ok := obj.(cache.DeletedFinalStateUnknown); ok {
			route, ok = t.Obj.(*gwv1.HTTPRoute)
		}
	}
	if route == nil {
		return
	}
	for _, rule := range route.Spec.Rules {
		for _, ref := range rule.BackendRefs {
			if ref.Kind != nil && string(*ref.Kind) != "Service" {
				continue
			}
			if ref.Name == "" {
				continue
			}
			ns := route.Namespace
			if ref.Namespace != nil && *ref.Namespace != "" {
				ns = string(*ref.Namespace)
			}
			key := ns + "/" + string(ref.Name)
			delete(w.ingressHosts, key)
			w.refreshServiceByName(ns, string(ref.Name))
		}
	}
}

func (w *Watcher) indexHTTPRoute(route *gwv1.HTTPRoute) {
	hosts := make([]string, 0, len(route.Spec.Hostnames))
	for _, h := range route.Spec.Hostnames {
		hosts = append(hosts, string(h))
	}
	if len(hosts) == 0 {
		hosts = []string{fmt.Sprintf("%s/%s", route.Namespace, route.Name)}
	}

	for _, rule := range route.Spec.Rules {
		for _, ref := range rule.BackendRefs {
			if ref.Kind != nil && string(*ref.Kind) != "Service" {
				continue
			}
			if ref.Name == "" {
				continue
			}
			ns := route.Namespace
			if ref.Namespace != nil && *ref.Namespace != "" {
				ns = string(*ref.Namespace)
			}
			svcName := string(ref.Name)
			key := ns + "/" + svcName
			for _, host := range hosts {
				entry := host
				if rule.Matches != nil {
					for _, m := range rule.Matches {
						if m.Path != nil && m.Path.Value != nil && *m.Path.Value != "" {
							entry = strings.TrimRight(host, "/") + *m.Path.Value
							break
						}
					}
				}
				w.ingressHosts[key] = appendUnique(w.ingressHosts[key], entry)
			}
			w.refreshServiceByName(ns, svcName)
		}
	}
}
