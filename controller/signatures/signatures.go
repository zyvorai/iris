// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

package signatures

import (
	"strings"

	corev1 "k8s.io/api/core/v1"
)

type Match struct {
	DisplayName string
	Category    string
	Icon        string
	Port        int32
	Score       int
}

type rule struct {
	test  func(ns, name string, labels map[string]string, ports []corev1.ServicePort) bool
	match Match
}

var denyNamespaces = map[string]bool{
	"kube-system":     true,
	"kube-public":     true,
	"kube-node-lease": true,
}

var rules = []rule{
	{
		test: func(ns, name string, labels map[string]string, _ []corev1.ServicePort) bool {
			return strings.Contains(name, "grafana") || labels["app.kubernetes.io/name"] == "grafana"
		},
		match: Match{DisplayName: "Grafana", Category: "Monitoring", Icon: "grafana", Port: 80, Score: 50},
	},
	{
		test: func(ns, name string, _ map[string]string, _ []corev1.ServicePort) bool {
			return strings.Contains(name, "prometheus")
		},
		match: Match{DisplayName: "Prometheus", Category: "Monitoring", Icon: "prometheus", Port: 9090, Score: 50},
	},
	{
		test: func(ns, name string, labels map[string]string, _ []corev1.ServicePort) bool {
			n := strings.ToLower(name)
			return strings.Contains(n, "zeus") || strings.Contains(n, "v9s") ||
				strings.Contains(n, "consolehub") || strings.Contains(n, "console-hub") ||
				labels["app.kubernetes.io/part-of"] == "zeus" ||
				labels["app.kubernetes.io/name"] == "zeus" ||
				labels["app.kubernetes.io/name"] == "v9s"
		},
		match: Match{Category: "Platform", Icon: "zeus", Port: 80, Score: 70},
	},
	{
		test: func(ns, name string, _ map[string]string, _ []corev1.ServicePort) bool {
			return ns == "argocd" && strings.Contains(name, "argocd")
		},
		match: Match{DisplayName: "ArgoCD", Category: "GitOps", Icon: "argocd", Port: 443, Score: 50},
	},
	{
		test: func(ns, name string, _ map[string]string, _ []corev1.ServicePort) bool {
			return strings.Contains(name, "harbor")
		},
		match: Match{DisplayName: "Harbor", Category: "Registry", Icon: "harbor", Port: 80, Score: 45},
	},
	{
		test: func(ns, name string, _ map[string]string, _ []corev1.ServicePort) bool {
			return name == "longhorn-frontend" || strings.Contains(name, "longhorn-frontend")
		},
		match: Match{DisplayName: "Longhorn", Category: "Storage", Icon: "longhorn", Port: 80, Score: 45},
	},
	{
		test: func(ns, name string, _ map[string]string, _ []corev1.ServicePort) bool {
			return strings.Contains(name, "guacamole")
		},
		match: Match{DisplayName: "Guacamole", Category: "Virtualization", Icon: "guacamole", Port: 8080, Score: 40},
	},
	{
		test: func(ns, name string, labels map[string]string, _ []corev1.ServicePort) bool {
			return labels["app"] == "packetwolf" || strings.Contains(name, "packetwolf")
		},
		match: Match{DisplayName: "PacketWolf", Category: "Security", Icon: "packetwolf", Port: 80, Score: 40},
	},
	{
		test: func(ns, name string, _ map[string]string, _ []corev1.ServicePort) bool {
			return name == "hubble-ui" || strings.Contains(name, "hubble-ui")
		},
		match: Match{DisplayName: "Hubble", Category: "Networking", Icon: "hubble", Port: 80, Score: 35},
	},
	{
		test: func(ns, name string, _ map[string]string, _ []corev1.ServicePort) bool {
			return strings.Contains(name, "traefik") || strings.Contains(name, "ingress-nginx")
		},
		match: Match{Category: "Networking", Icon: "ingress", Port: 80, Score: 35},
	},
}

func IsDiscoverable(svc *corev1.Service) bool {
	if svc == nil {
		return false
	}
	if denyNamespaces[svc.Namespace] {
		return false
	}
	if svc.Labels["app.kubernetes.io/name"] == "hermes" {
		return false
	}
	if svc.Spec.Type == corev1.ServiceTypeExternalName {
		return false
	}
	if svc.Spec.ClusterIP == "None" {
		return false
	}
	if len(svc.Spec.Ports) == 0 {
		return false
	}
	if svc.Name == "kubernetes" {
		return false
	}
	return true
}

func HTTPPortScore(svc *corev1.Service) int {
	score := 0
	for _, p := range svc.Spec.Ports {
		if p.Name == "http" || p.Name == "https" || p.Port == 80 || p.Port == 443 || p.Port == 8080 || p.Port == 9090 || p.Port == 3000 {
			score += 10
			break
		}
	}
	return score
}

func MatchService(ns, name string, svc *corev1.Service) (*Match, int) {
	if !IsDiscoverable(svc) {
		return nil, -40
	}
	score := HTTPPortScore(svc)
	for _, r := range rules {
		if r.test(ns, name, svc.Labels, svc.Spec.Ports) {
			m := r.match
			if m.DisplayName == "" {
				m.DisplayName = TitleName(name)
			}
			if m.Port == 0 && len(svc.Spec.Ports) > 0 {
				m.Port = svc.Spec.Ports[0].Port
			} else {
				for _, p := range svc.Spec.Ports {
					if p.Port == m.Port || p.Name == "http" {
						m.Port = p.Port
						break
					}
				}
				if m.Port == 0 && len(svc.Spec.Ports) > 0 {
					m.Port = svc.Spec.Ports[0].Port
				}
			}
			m.Score += score
			return &m, m.Score
		}
	}
	if score > 0 {
		return nil, score
	}
	return nil, 5
}

func CategoryForService(ns, name string, svc *corev1.Service) string {
	if sig, _ := MatchService(ns, name, svc); sig != nil && sig.Category != "" {
		return sig.Category
	}
	switch {
	case strings.Contains(ns, "monitor"):
		return "Monitoring"
	case strings.Contains(ns, "ingress"), strings.Contains(ns, "network"):
		return "Networking"
	case strings.Contains(ns, "zeus"), strings.Contains(ns, "v9s"):
		return "Platform"
	default:
		return "Services"
	}
}

func IconForService(ns, name string, svc *corev1.Service) string {
	if sig, _ := MatchService(ns, name, svc); sig != nil && sig.Icon != "" {
		return sig.Icon
	}
	n := strings.ToLower(name)
	switch {
	case strings.Contains(n, "zeus"), strings.Contains(n, "v9s"):
		return "zeus"
	case strings.Contains(n, "api"):
		return "api"
	case strings.Contains(n, "web"), strings.Contains(n, "ui"):
		return "ui"
	default:
		return "app"
	}
}

func TitleName(name string) string {
	parts := strings.Split(strings.ReplaceAll(name, "-", " "), " ")
	for i, p := range parts {
		if p == "" {
			continue
		}
		parts[i] = strings.ToUpper(p[:1]) + p[1:]
	}
	return strings.Join(parts, " ")
}

func DefaultHTTPPort(svc *corev1.Service) int32 {
	for _, p := range svc.Spec.Ports {
		if p.Name == "http" || p.Name == "https" {
			return p.Port
		}
	}
	for _, p := range svc.Spec.Ports {
		if p.Port == 80 || p.Port == 443 || p.Port == 8080 || p.Port == 9090 || p.Port == 3000 {
			return p.Port
		}
	}
	if len(svc.Spec.Ports) > 0 {
		return svc.Spec.Ports[0].Port
	}
	return 80
}
