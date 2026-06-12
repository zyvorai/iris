// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

package discovery

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	discoveryv1 "k8s.io/api/discovery/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"

	"github.com/ssahani/hermes/controller/model"
	"github.com/ssahani/hermes/controller/signatures"
	"github.com/ssahani/hermes/controller/store"
)

const (
	annoPrefix    = "hermes.zyvor.dev/"
	annoEnabled   = annoPrefix + "enabled"
	annoName      = annoPrefix + "name"
	annoDesc      = annoPrefix + "description"
	annoIcon      = annoPrefix + "icon"
	annoCategory  = annoPrefix + "category"
	annoPort      = annoPrefix + "port"
	annoScheme    = annoPrefix + "scheme"
	annoPath      = annoPrefix + "path"
	annoAuth      = annoPrefix + "auth"
	annoFavorite  = annoPrefix + "favorite"
	annoPublished = annoPrefix + "published"
)

type Config struct {
	PublicBaseURL string
	AutoPublish   bool
	AutoSuggest   bool
	DiscoverAll   bool
	WatchNS       []string
}

type Watcher struct {
	client    kubernetes.Interface
	store     *store.Store
	cfg       Config
	endpoints map[string]int // key: ns/name -> ready count
}

func NewWatcher(client kubernetes.Interface, st *store.Store, cfg Config) *Watcher {
	return &Watcher{
		client:    client,
		store:     st,
		cfg:       cfg,
		endpoints: make(map[string]int),
	}
}

func (w *Watcher) Run(ctx context.Context) error {
	ns := ""
	if len(w.cfg.WatchNS) == 1 {
		ns = w.cfg.WatchNS[0]
	}
	factory := informers.NewSharedInformerFactoryWithOptions(w.client, 30*time.Second,
		informers.WithNamespace(ns),
	)

	svcInf := factory.Core().V1().Services().Informer()
	epsInf := factory.Discovery().V1().EndpointSlices().Informer()

	svcInf.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(obj interface{}) { w.onService(obj) },
		UpdateFunc: func(_, newObj interface{}) { w.onService(newObj) },
		DeleteFunc: func(obj interface{}) { w.onServiceDelete(obj) },
	})

	epsInf.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc:    func(obj interface{}) { w.onEndpointSlice(obj) },
		UpdateFunc: func(_, newObj interface{}) { w.onEndpointSlice(newObj) },
		DeleteFunc: func(obj interface{}) { w.onEndpointSlice(obj) },
	})

	factory.Start(ctx.Done())
	factory.WaitForCacheSync(ctx.Done())

	<-ctx.Done()
	return nil
}

func (w *Watcher) onEndpointSlice(obj interface{}) {
	eps, ok := obj.(*discoveryv1.EndpointSlice)
	if !ok {
		if t, ok := obj.(cache.DeletedFinalStateUnknown); ok {
			eps, ok = t.Obj.(*discoveryv1.EndpointSlice)
		}
	}
	if eps == nil {
		return
	}
	ns := eps.Namespace
	svcName := eps.Labels[discoveryv1.LabelServiceName]
	if svcName == "" {
		return
	}
	ready := 0
	for _, ep := range eps.Endpoints {
		if ep.Conditions.Ready != nil && *ep.Conditions.Ready {
			ready++
		}
	}
	key := ns + "/" + svcName
	w.endpoints[key] = ready
	w.refreshServiceByName(ns, svcName)
}

func (w *Watcher) refreshServiceByName(ns, name string) {
	svc, err := w.client.CoreV1().Services(ns).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		return
	}
	w.onService(svc)
}

func (w *Watcher) onServiceDelete(obj interface{}) {
	svc, ok := obj.(*corev1.Service)
	if !ok {
		if t, ok := obj.(cache.DeletedFinalStateUnknown); ok {
			svc, ok = t.Obj.(*corev1.Service)
		}
	}
	if svc == nil {
		return
	}
	id := fmt.Sprintf("%s/%s", svc.Namespace, svc.Name)
	delete(w.endpoints, id)
	if err := w.store.DeleteApp(id); err != nil {
		log.Printf("delete app %s: %v", id, err)
	}
}

func (w *Watcher) onService(obj interface{}) {
	svc, ok := obj.(*corev1.Service)
	if !ok || svc == nil {
		return
	}
	if len(w.cfg.WatchNS) > 1 {
		found := false
		for _, n := range w.cfg.WatchNS {
			if n == svc.Namespace {
				found = true
				break
			}
		}
		if !found {
			return
		}
	}
	id := fmt.Sprintf("%s/%s", svc.Namespace, svc.Name)
	hidden, _ := w.store.IsServiceHidden(svc.Namespace, svc.Name)
	if hidden {
		_ = w.store.DeleteApp(id)
		return
	}
	app, ok := w.buildApp(svc)
	if !ok {
		_ = w.store.DeleteApp(id)
		return
	}
	key := svc.Namespace + "/" + svc.Name
	if ready, exists := w.endpoints[key]; exists {
		app.ReadyCount = ready
	}
	app.Status, app.StatusMsg = w.healthStatus(app)
	if err := w.store.UpsertApp(app); err != nil {
		log.Printf("upsert app %s: %v", app.ID, err)
	}
}

func (w *Watcher) buildApp(svc *corev1.Service) (model.App, bool) {
	ann := svc.Annotations
	enabled := ann[annoEnabled] == "true"
	sig, sigScore := signatures.MatchService(svc.Namespace, svc.Name, svc)

	if !enabled && sig == nil {
		if !w.cfg.DiscoverAll {
			return model.App{}, false
		}
		if !signatures.IsDiscoverable(svc) {
			return model.App{}, false
		}
	}

	id := fmt.Sprintf("%s/%s", svc.Namespace, svc.Name)
	slug := svc.Name
	displayName := signatures.TitleName(svc.Name)
	desc := ""
	icon := signatures.IconForService(svc.Namespace, svc.Name, svc)
	category := signatures.CategoryForService(svc.Namespace, svc.Name, svc)
	port := signatures.DefaultHTTPPort(svc)
	scheme := "http"
	path := "/"
	auth := "none"
	source := model.SourceService
	score := sigScore
	published := w.cfg.AutoPublish

	if enabled {
		source = model.SourceAnnotation
		score += 50
		if v := ann[annoName]; v != "" {
			displayName = v
		}
		desc = ann[annoDesc]
		if v := ann[annoIcon]; v != "" {
			icon = v
		}
		if v := ann[annoCategory]; v != "" {
			category = v
		}
		if v := ann[annoPort]; v != "" {
			if p, err := strconv.Atoi(v); err == nil {
				port = int32(p)
			}
		}
		if v := ann[annoScheme]; v != "" {
			scheme = v
		}
		if v := ann[annoPath]; v != "" {
			path = v
		}
		if v := ann[annoAuth]; v != "" {
			auth = v
		}
		if ann[annoPublished] == "true" || ann[annoFavorite] == "true" {
			published = true
		}
	} else if sig != nil {
		source = model.SourceSignature
		displayName = sig.DisplayName
		category = sig.Category
		icon = sig.Icon
		port = sig.Port
		score = sig.Score
		if !w.cfg.AutoSuggest {
			return model.App{}, false
		}
		published = w.cfg.AutoPublish
	} else {
		if !w.cfg.AutoSuggest {
			return model.App{}, false
		}
		if score <= 0 {
			score = 5
		}
		published = w.cfg.AutoPublish
	}

	routePath := fmt.Sprintf("/a/%s/%s", svc.Namespace, slug)
	publicURL := strings.TrimRight(w.cfg.PublicBaseURL, "/") + routePath

	return model.App{
		ID:          id,
		Slug:        slug,
		DisplayName: displayName,
		Description: desc,
		Namespace:   svc.Namespace,
		Category:    category,
		Icon:        icon,
		Backend: model.Backend{
			Kind:   "Service",
			Name:   svc.Name,
			Port:   int(port),
			Scheme: scheme,
			Path:   path,
		},
		RoutePath:  routePath,
		PublicURL:  publicURL,
		Source:     source,
		AuthMode:   auth,
		Score:      score,
		Visibility: model.Visibility{Published: published},
		Rewrite:    model.Rewrite{StripPrefix: routePath},
	}, true
}

func (w *Watcher) healthStatus(app model.App) (string, string) {
	if app.ReadyCount == 0 {
		return model.StatusBroken, "Service has no ready endpoints"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	url := fmt.Sprintf("%s://%s.%s.svc.cluster.local:%d%s",
		app.Backend.Scheme, app.Backend.Name, app.Namespace, app.Backend.Port, app.Backend.Path)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return model.StatusUnknown, err.Error()
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return model.StatusDegraded, err.Error()
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 500 {
		return model.StatusDegraded, fmt.Sprintf("Backend returned %d", resp.StatusCode)
	}
	return model.StatusHealthy, ""
}

// RefreshHealth periodically re-checks published apps.
func (w *Watcher) RefreshHealth(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			apps, err := w.store.ListApps(false)
			if err != nil {
				continue
			}
			for _, app := range apps {
				key := app.Namespace + "/" + app.Backend.Name
				if ready, ok := w.endpoints[key]; ok {
					app.ReadyCount = ready
				}
				app.Status, app.StatusMsg = w.healthStatus(app)
				_ = w.store.UpsertApp(app)
			}
		}
	}
}

// ResyncAll lists all services once at startup.
func (w *Watcher) ResyncAll(ctx context.Context) error {
	var list *corev1.ServiceList
	var err error
	if len(w.cfg.WatchNS) == 0 {
		list, err = w.client.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	} else {
		for _, ns := range w.cfg.WatchNS {
			part, e := w.client.CoreV1().Services(ns).List(ctx, metav1.ListOptions{})
			if e != nil {
				return e
			}
			if list == nil {
				list = part
			} else {
				list.Items = append(list.Items, part.Items...)
			}
		}
	}
	if err != nil {
		return err
	}
	for i := range list.Items {
		w.onService(&list.Items[i])
	}
	epsList, err := w.client.DiscoveryV1().EndpointSlices("").List(ctx, metav1.ListOptions{})
	if err == nil {
		for i := range epsList.Items {
			w.onEndpointSlice(&epsList.Items[i])
		}
	}
	return nil
}
