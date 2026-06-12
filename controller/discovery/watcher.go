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
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"

	"github.com/ssahani/hermes/controller/model"
	"github.com/ssahani/hermes/controller/signatures"
	"github.com/ssahani/hermes/controller/store"
	gwclientset "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned"
	gwexternalversions "sigs.k8s.io/gateway-api/pkg/client/informers/externalversions"
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
	annoSlug        = annoPrefix + "slug"
	annoEnvironment = annoPrefix + "environment"
	annoOwner       = annoPrefix + "owner"
	annoDependsOn   = annoPrefix + "depends-on"
	annoRecommended = annoPrefix + "recommended"
)

type Config struct {
	PublicBaseURL    string
	PublicPathPrefix string
	AutoPublish      bool
	AutoSuggest     bool
	DiscoverAll     bool
	DiscoverIngress    bool
	DiscoverGatewayAPI bool
	WatchNS            []string
}

type Watcher struct {
	client       kubernetes.Interface
	gwClient     gwclientset.Interface
	store        *store.Store
	cfg          Config
	endpoints    map[string]int // key: ns/name -> ready count
	ingressHosts map[string][]string
}

func NewWatcher(client kubernetes.Interface, gwClient gwclientset.Interface, st *store.Store, cfg Config) *Watcher {
	return &Watcher{
		client:       client,
		gwClient:     gwClient,
		store:        st,
		cfg:          cfg,
		endpoints:    make(map[string]int),
		ingressHosts: make(map[string][]string),
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

	if w.cfg.DiscoverIngress {
		ingInf := factory.Networking().V1().Ingresses().Informer()
		ingInf.AddEventHandler(cache.ResourceEventHandlerFuncs{
			AddFunc:    func(obj interface{}) { w.onIngress(obj) },
			UpdateFunc: func(_, newObj interface{}) { w.onIngress(newObj) },
			DeleteFunc: func(obj interface{}) { w.onIngressDelete(obj) },
		})
	}

	if w.cfg.DiscoverGatewayAPI && w.gwClient != nil {
		gwFactory := gwexternalversions.NewSharedInformerFactoryWithOptions(w.gwClient, 30*time.Second,
			gwexternalversions.WithNamespace(ns),
		)
		hrInf := gwFactory.Gateway().V1().HTTPRoutes().Informer()
		hrInf.AddEventHandler(cache.ResourceEventHandlerFuncs{
			AddFunc:    func(obj interface{}) { w.onHTTPRoute(obj) },
			UpdateFunc: func(_, newObj interface{}) { w.onHTTPRoute(newObj) },
			DeleteFunc: func(obj interface{}) { w.onHTTPRouteDelete(obj) },
		})
		gwFactory.Start(ctx.Done())
		gwFactory.WaitForCacheSync(ctx.Done())
	}

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

func (w *Watcher) onIngress(obj interface{}) {
	ing, ok := obj.(*networkingv1.Ingress)
	if !ok || ing == nil {
		return
	}
	w.indexIngress(ing)
}

func (w *Watcher) onIngressDelete(obj interface{}) {
	ing, ok := obj.(*networkingv1.Ingress)
	if !ok {
		if t, ok := obj.(cache.DeletedFinalStateUnknown); ok {
			ing, ok = t.Obj.(*networkingv1.Ingress)
		}
	}
	if ing == nil {
		return
	}
	for _, rule := range ing.Spec.Rules {
		if rule.HTTP == nil {
			continue
		}
		for _, p := range rule.HTTP.Paths {
			if p.Backend.Service == nil {
				continue
			}
			key := ing.Namespace + "/" + p.Backend.Service.Name
			delete(w.ingressHosts, key)
			w.refreshServiceByName(ing.Namespace, p.Backend.Service.Name)
		}
	}
}

func (w *Watcher) indexIngress(ing *networkingv1.Ingress) {
	for _, rule := range ing.Spec.Rules {
		host := rule.Host
		if rule.HTTP == nil {
			continue
		}
		for _, p := range rule.HTTP.Paths {
			if p.Backend.Service == nil {
				continue
			}
			svcName := p.Backend.Service.Name
			key := ing.Namespace + "/" + svcName
			entry := host
			if p.Path != "" {
				entry = strings.TrimRight(host, "/") + p.Path
			}
			w.ingressHosts[key] = appendUnique(w.ingressHosts[key], entry)
			w.refreshServiceByName(ing.Namespace, svcName)
		}
	}
}

func appendUnique(list []string, v string) []string {
	for _, x := range list {
		if x == v {
			return list
		}
	}
	return append(list, v)
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
	canonicalSlug := ""

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
		if v := ann[annoSlug]; v != "" {
			canonicalSlug = v
		}
	} else if sig != nil {
		source = model.SourceSignature
		displayName = sig.DisplayName
		category = sig.Category
		icon = sig.Icon
		port = sig.Port
		score = sig.Score
		canonicalSlug = sig.CanonicalSlug
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

	svcKey := svc.Namespace + "/" + svc.Name
	if hosts, ok := w.ingressHosts[svcKey]; ok && len(hosts) > 0 {
		score += 15
		if source == model.SourceService {
			source = model.SourceIngress
		}
		if desc == "" {
			desc = "Route: " + strings.Join(hosts, ", ")
		}
	}

	base := strings.TrimRight(w.cfg.PublicBaseURL, "/")
	pathPrefix := strings.Trim(w.cfg.PublicPathPrefix, "/")
	var routePath, publicURL string
	if pathPrefix != "" {
		routePath = fmt.Sprintf("/%s/a/%s/%s", pathPrefix, svc.Namespace, slug)
		publicURL = base + routePath
		if canonicalSlug != "" {
			publicURL = fmt.Sprintf("%s/%s/apps/%s", base, pathPrefix, canonicalSlug)
		}
	} else {
		routePath = fmt.Sprintf("/a/%s/%s", svc.Namespace, slug)
		publicURL = base + routePath
		if canonicalSlug != "" {
			publicURL = base + "/apps/" + canonicalSlug
		}
	}

	meta := enrichMeta(metaFromAnnotations(ann), svc.Namespace)
	if sig != nil && len(sig.DependsOn) > 0 && len(meta.DependsOn) == 0 {
		meta.DependsOn = append([]string(nil), sig.DependsOn...)
	}
	if sig != nil && sig.Recommended {
		meta.Recommended = true
	}

	return model.App{
		ID:            id,
		Slug:          slug,
		CanonicalSlug: canonicalSlug,
		DisplayName:   displayName,
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
		Meta:       meta,
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
				_ = w.store.UpdateDiagnosis(app.ID, w.Diagnose(ctx, app))
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
	if w.cfg.DiscoverIngress {
		ingList, e := w.client.NetworkingV1().Ingresses("").List(ctx, metav1.ListOptions{})
		if e == nil {
			for i := range ingList.Items {
				w.indexIngress(&ingList.Items[i])
			}
		}
	}
	if w.cfg.DiscoverGatewayAPI && w.gwClient != nil {
		hrList, e := w.gwClient.GatewayV1().HTTPRoutes("").List(ctx, metav1.ListOptions{})
		if e == nil {
			for i := range hrList.Items {
				w.indexHTTPRoute(&hrList.Items[i])
			}
		}
	}
	return nil
}
