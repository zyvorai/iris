// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

package discovery

import (
	"context"
	"fmt"
	"net/url"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/zyvorai/hermes/controller/model"
)

func (w *Watcher) Diagnose(ctx context.Context, app model.App) model.AppDiagnosis {
	slug := app.CanonicalSlug
	if slug == "" {
		slug = app.Slug
	}
	chain := []model.DiagnosisChainNode{
		{ID: "user", Label: "User"},
		{ID: "identity", Label: "Zeus Identity"},
		{ID: "gateway", Label: "Hermes Gateway"},
		{ID: "approute", Label: "AppRoute: " + slug},
		{ID: "namespace", Label: "Namespace: " + app.Namespace},
	}

	svcLabel := fmt.Sprintf("%s:%d", app.Backend.Name, app.Backend.Port)
	svcStatus := app.Status
	if app.ReadyCount == 0 {
		svcStatus = model.StatusBroken
	}
	chain = append(chain, model.DiagnosisChainNode{
		ID: "service", Label: "Service " + svcLabel, Status: svcStatus,
	})

	problem := ""
	cause := ""
	if app.Status != model.StatusHealthy {
		problem = app.StatusMsg
		if problem == "" {
			switch app.Status {
			case model.StatusBroken:
				problem = "Backend unavailable"
			case model.StatusDegraded:
				problem = "Backend degraded"
			default:
				problem = "Health check failed"
			}
		}
	}

	podName, podStatus := w.lookupPodHint(ctx, app)
	if podName != "" {
		chain = append(chain, model.DiagnosisChainNode{
			ID: "pod", Label: "Pod " + podName, Status: podStatus,
		})
		if cause == "" && podStatus != "" {
			cause = fmt.Sprintf("Pod %s is %s", podName, podStatus)
		}
	} else if app.ReadyCount == 0 {
		cause = "Service exists but has no ready endpoints"
	}

	ns := url.QueryEscape(app.Namespace)
	actions := []model.SuggestedAction{
		{Label: "Open Kubernetes workloads", Href: fmt.Sprintf("/k8s/workloads?ns=%s", ns)},
	}
	if podName != "" {
		actions = append(actions, model.SuggestedAction{
			Label: "View pod logs",
			Href:  fmt.Sprintf("/k8s/workloads?ns=%s", ns),
		})
	}

	return model.AppDiagnosis{
		AppID:            app.ID,
		RoutePath:        app.RoutePath,
		PublicURL:        app.PublicURL,
		Backend:          app.Backend,
		Problem:          problem,
		Cause:            cause,
		Chain:            chain,
		SuggestedActions: actions,
	}
}

func (w *Watcher) lookupPodHint(ctx context.Context, app model.App) (string, string) {
	svc, err := w.client.CoreV1().Services(app.Namespace).Get(ctx, app.Backend.Name, metav1.GetOptions{})
	if err != nil {
		return "", ""
	}
	selector := labels.Set(svc.Spec.Selector).String()
	if selector == "" {
		return "", ""
	}
	pods, err := w.client.CoreV1().Pods(app.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: selector,
	})
	if err != nil || len(pods.Items) == 0 {
		return "", ""
	}
	pod := pods.Items[0]
	status := string(pod.Status.Phase)
	for _, cs := range pod.Status.ContainerStatuses {
		if cs.State.Waiting != nil && cs.State.Waiting.Reason != "" {
			status = cs.State.Waiting.Reason
			break
		}
		if cs.State.Terminated != nil && cs.State.Terminated.Reason != "" {
			status = cs.State.Terminated.Reason
			break
		}
	}
	return pod.Name, status
}
