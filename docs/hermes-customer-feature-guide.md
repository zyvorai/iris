# Hermes — Feature Guide

> **The application operating layer for Kubernetes — Every Application. One Door.**

Hermes turns Kubernetes from an infrastructure platform into an application platform. It continuously discovers every dashboard, API, and internal tool running in your cluster, recognizes what each one is, monitors its health, and gives users a permanent front door to launch software — no more kubectl port-forward, bookmark sprawl, or namespace archaeology. Think macOS Launchpad and Spotlight, but for your clusters.

**40+** REST & gateway endpoints · **11** Nebula UI pages · **8** Zyra AI insight APIs · **15+** recognized platform tools · **3** discovery sources (Service, Ingress/Gateway API, mesh) · **0** port-forwards needed

This is the customer-facing onboarding guide — how to access the product, your first workflows, and how to use every feature. A print-ready PDF of the same content sits alongside this file.

## Contents

0. [Getting started — access & first workflows](#getting-started)
1. [Continuous Discovery](#1-continuous-discovery)
2. [Recognition & Catalog](#2-recognition-catalog)
3. [Universal Gateway](#3-universal-gateway)
4. [Nebula Launchpad UI](#4-nebula-launchpad-ui)
5. [Spotlight Search](#5-spotlight-search)
6. [Zyra AI Intelligence](#6-zyra-ai-intelligence)
7. [Health & Diagnostics](#7-health-diagnostics)
8. [Application Graph](#8-application-graph)
9. [Multi-Cluster & Teams](#9-multi-cluster-teams)
10. [Security & Access](#10-security-access)
11. [Sharing, Audit & Memory](#11-sharing,-audit-memory)
12. [Deployment & Operations](#12-deployment-operations)

## Getting started

**How to access it**

- **Web:** Nebula launchpad UI on NodePort **31847** — open `https://localhost:31847` (or `https://<node-ip>:31847`). Use https (self-signed by default). Press `⌘K` / `Ctrl+K` for Spotlight to search and launch any app through the gateway. Key pages: `/` (Command Deck), `/apps`, `/cluster`, `/discovery`, `/health`, `/graph`, `/teams`, `/federated`, `/activity`.
- **CLI:** There is no dedicated end-user CLI — Hermes is operated with `kubectl` / `helm` plus repo scripts (`./scripts/deploy-remote.sh <host> <user>`, `./scripts/configure-llm-remote.sh`, `./scripts/setup-ollama-remote.sh`, `./scripts/e2e-deploy-verify.sh https://host:31847`). Every action is also scriptable over REST with `curl`.
- **API:** REST + WebSocket surface under `https://localhost:31847/api/v1`. Public (no auth): `GET /healthz`, `GET /metrics`, `/auth/*`, `/api/v1/ws-echo`. Example: `curl -sk https://localhost:31847/api/v1/apps | jq '.[0]'`. Embedded Zyra AI insights live under `/api/v1/insights/*` and `/api/v1/search/llm`.
- **Login:** Auth is disabled unless `HERMES_AUTH_MODE` is set. With `api_key`, send `Authorization: Bearer `; with `oidc`, sign in at `/auth/login` (redirects to your IdP, sets a session cookie). `GET /auth/me` returns the current user, groups, workspaces, and allowed actions.
- **Needs:** A running Kubernetes cluster (Hermes installs via Helm); optionally set an OpenAI-compatible LLM (`HERMES_LLM_API_URL` + `HERMES_LLM_API_KEY`) to unlock Zyra AI natural-language answers — rule-based mode works with no key.

**Your first workflows**

- **Install and open Hermes**
  1. Install the chart: `helm install hermes oci://ghcr.io/zyvorai/charts/hermes --version 0.2.0 --namespace hermes-system --create-namespace`.
  1. Wait for rollout: `kubectl -n hermes-system rollout status deployment/hermes`.
  1. Open the Nebula UI at `https://<node-ip>:31847` — discovery starts automatically across every namespace.
- **Review the discovery queue and publish an app**
  1. Let discovery run (`discoverAll: true` by default) so newly found Services land in the queue.
  1. Open `/discovery` in the UI and review candidates ranked by Zyra AI publish suggestions.
  1. Click Publish on the right services (or `POST /api/v1/discovery/publish/{namespace}/{slug}`; bulk with `/api/v1/discovery/publish-namespace/{namespace}`).
  1. The app now appears on Home Quick Launch and the `/apps` catalog.
- **Launch an app with zero port-forward**
  1. Open the UI and press `⌘K` / `Ctrl+K` to open Spotlight.
  1. Type a few letters of the app name, namespace, or category (e.g. `gra` for Grafana).
  1. Press Enter to launch it through the gateway at `/launchpad/apps/{slug}` — WebSockets, SSE, and gRPC proxy transparently, no `kubectl port-forward`.
- **Enrich a custom in-house app**
  1. Add `hermes.zyvor.dev/*` annotations to the Kubernetes Service — e.g. `hermes.zyvor.dev/name`, `/icon`, `/owner`, `/category`, `/depends-on`.
  1. Set `hermes.zyvor.dev/published: "true"` to publish it immediately, or leave it for the discovery queue.
  1. The app renders with a polished name, icon, owner, and dependency edges on `/apps` and `/graph`.
- **Diagnose an unhealthy app**
  1. Open `/health` and read the attention queue with its Zyra AI summary.
  1. Click Diagnose on a failing service to open the global Diagnosis drawer.
  1. Read the route lens, friendly probe summary (expand for raw detail), suggested kubectl commands, and Zyra AI remediation narrative (`GET /api/v1/apps/{id}/diagnosis` + `/insight`).
- **Enable Zyra AI natural-language mode**
  1. Create the LLM secret: `kubectl create secret generic hermes-llm --from-literal=apiKey="sk-..." -n hermes-system`.
  1. Upgrade with LLM settings: `helm upgrade hermes oci://ghcr.io/zyvorai/charts/hermes --reuse-values --set server.llm.apiUrl="https://api.openai.com/v1" --set server.llm.existingSecret="hermes-llm" --set server.llm.model="gpt-4o-mini" -n hermes-system`.
  1. Confirm the active mode: `GET /api/v1/insights/status` (or Spotlight `ai status`) should report `defaultSource: llm`.

## 1. Continuous Discovery

_Hermes watches the cluster and builds a living application catalog for you — no manual registration._

- **Cluster-Wide Service Discovery** — Continuously watches Kubernetes Services across every namespace and adds them to the catalog automatically. — _Stop maintaining spreadsheets of service URLs — the cluster documents itself._
  - **How:** Automatic — the Go controller watches Services cluster-wide (`discoverAll: true`). Browse results at `/cluster` in the UI or `GET /api/v1/apps`.
- **Ingress & Gateway API Routes** — Discovers routing from Ingress objects and Gateway API HTTPRoutes, including ingress host metadata on each app. — _See the real public entry point for an app, not just its internal service name._
  - **How:** Automatic during discovery; the ingress host shows on the app card at `/apps/:id` and in `GET /api/v1/apps/{id}`.
- **Service Mesh Route Discovery** — Reads Istio VirtualServices and Linkerd annotations to map mesh-based routing into the catalog. — _Mesh-routed apps become as discoverable as everything else._
  - **How:** Automatic for Istio VirtualServices and Linkerd annotations; filter mesh-routed apps on `/graph` or via `GET /api/v1/graph`.
- **Automatic Catalog Refresh** — Correlates EndpointSlice readiness and updates the catalog live as the cluster changes. — _The catalog is always current without any human upkeep._
  - **How:** Automatic — the controller correlates EndpointSlice readiness; no action needed. Live counts at `GET /api/v1/cluster/summary`.
- **Discovery Queue** — Surfaces newly found but unpublished services in a dedicated review queue separate from the live launchpad. — _Nothing gets a front door by accident — you decide what goes live._
  - **How:** Web UI `/discovery`; REST `GET /api/v1/discovery`.

## 2. Recognition & Catalog

_Hermes identifies popular software automatically and enriches every app with human-friendly metadata._

| Recognized tool | Example signals |
|---|---|
| Grafana | service name, labels, port 3000 |
| Prometheus | prom/prometheus image patterns |
| Argo CD | argocd namespace + service names |
| Harbor | Harbor service patterns |
| Zeus OS / v9s | Zeus, ConsoleHub, platform labels |
| Longhorn, Guacamole, Hubble, Traefik | known platform signatures |

- **Signature Recognition Engine** — Matches service names, labels, images, and ports against known signatures to identify popular tools automatically. — _Apps show up with the right name, category, and icon — usually with zero configuration._
  - **How:** Automatic during discovery; the recognized name, category, and icon appear on `/apps` cards and in `GET /api/v1/apps`.
- **Annotation Enrichment** — Optional hermes.zyvor.dev/* annotations set display name, slug, category, icon, owner, dependencies, port, scheme, and path. — _Custom in-house apps get the same polished catalog treatment as off-the-shelf tools._
  - **How:** Add `hermes.zyvor.dev/*` annotations to the Service (e.g. `hermes.zyvor.dev/name`, `/icon`, `/owner`, `/category`) — see annotations.md.
- **Environment Inference** — Labels each app production, staging, or development from annotations, or infers it from the namespace name. — _Instantly tell prod from dev without asking anyone._
  - **How:** Set `hermes.zyvor.dev/environment`, or let Hermes infer it from the namespace name (`*-prod`, `staging`, `dev`); filter by workspace in the navbar.
- **Published App Catalog** — A unified /apps catalog of published applications with categories, search, sort, filter, and view toggles. — _One browsable home for every tool your team actually uses._
  - **How:** Web UI `/apps`; REST `GET /api/v1/catalog`.
- **Catalog Export** — Download the full catalog as JSON via the API or the Cluster page action menu. — _Feed your app inventory into other systems or keep an auditable snapshot._
  - **How:** Cluster page ActionMenu → export, or `GET /api/v1/catalog/export`.

## 3. Universal Gateway

_Every published workload gets a permanent, predictable front door through one reverse proxy._

- **Stable Launchpad URLs** — Proxies apps at predictable paths like /launchpad/apps/{slug} and /a/{namespace}/{slug}, with legacy aliases. — _Links survive pod reschedules and namespace moves — no bookmark ever breaks._
  - **How:** Click an app in the launchpad, or hit `/launchpad/apps/{slug}` or `/a/{namespace}/{slug}` directly (legacy `/apps/{slug}` alias supported).
- **WebSocket Tunneling** — Proxies WebSocket upgrades for live dashboards like Grafana, Argo CD, VS Code Server, Open WebUI, and Jupyter. — _Interactive tools work fully through the gateway, not just static pages._
  - **How:** Automatic — WebSocket upgrades proxy over the same launchpad paths; no configuration.
- **SSE, HTTP/2 & gRPC Pass-Through** — Supports Server-Sent Events streaming, HTTP/2, and gRPC content types with native backend connection pools. — _Modern streaming and RPC apps proxy correctly and efficiently._
  - **How:** Automatic — the gateway proxies any HTTP method and content type on `/launchpad/apps/{slug}`.
- **Readiness-Gated Proxying** — Blocks the proxy with a clear error when a backend has no ready endpoints. — _Users never get silently routed to a dead workload._
  - **How:** Automatic — the proxy returns 403/502 when no ready endpoints exist; verify with `curl -o /dev/null -w '%{http_code}\n' $BASE/a/{namespace}/{slug}`.
- **Zero Port-Forwarding** — Replaces the kubectl port-forward workflow with search, click, launch, work. — _Developers reach any tool in seconds without touching kubectl._
  - **How:** Open the app from Spotlight (`⌘K`) or the `/apps` catalog — no `kubectl port-forward` required.

## 4. Nebula Launchpad UI

_A macOS-inspired glass launchpad that looks like applications, not namespaces and pods._

- **Command Deck Home** — A hero with fleet snapshot, a 3-metric summary, Quick Launch tiles, and Mission Control accordions. — _The one screen that answers what's running, what's healthy, and what to open._
  - **How:** Web UI `/` (the Command Deck home page).
- **Cluster Catalog View** — Every service grouped by namespace in collapsible sections with human-readable health hints. — _Explore the whole cluster's apps without a single kubectl get._
  - **How:** Web UI `/cluster`; backing data from `GET /api/v1/apps` and `GET /api/v1/cluster/summary`.
- **Spaces Organization** — Organizes published apps into category-based spaces for browsing. — _Find the monitoring stack or CI tools as a group, not a flat list._
  - **How:** Web UI Spaces view (category-grouped catalog); categories come from signature recognition or `hermes.zyvor.dev/category`.
- **Liquid Glass Design System** — A tiered translucent glass interface with shared page frames, skeleton loading, and empty states. — _A fast, polished, consistent experience across every page._
  - **How:** Applies automatically across all Nebula pages — no user action needed.
- **Keyboard Navigation & Shortcuts** — Arrow-key and Enter navigation in Spotlight plus a global keyboard shortcuts help panel. — _Power users move through the whole app without a mouse._
  - **How:** Press `⌘K` / `Ctrl+K` to open Spotlight, arrow keys + Enter to navigate; open the global shortcuts help panel from the UI.
- **Responsive Mobile Layouts** — Compact workspace switcher, stacked toolbars, and scrollable category chips below 768px. — _Launch and check apps from a phone, not just a desktop._
  - **How:** Automatic below 768px — open any Nebula page on a phone; toolbars stack and category chips scroll.

## 5. Spotlight Search

_A Command-K palette that finds apps, pages, and answers the way Spotlight finds anything._

- **Full-Text Catalog Search** — Type a few letters to match apps by name, namespace, or category across the whole cluster. — _Type gra, get Grafana — no memorizing service DNS names._
  - **How:** Press `⌘K` and type, or call `GET /api/v1/search?q=grafana`.
- **Rule-Based Intent Search** — Parses queries into intent so a namespace or category returns exactly the right apps. — _Ask for what you mean and get relevant results, not keyword noise._
  - **How:** Spotlight parses intent automatically; direct API `GET /api/v1/search/intent?q=`.
- **Natural-Language Search** — An LLM-powered search endpoint answers plain-language queries, with rule-based fallback when no LLM is set. — _Ask unhealthy apps in monitoring in English and get a real answer._
  - **How:** `GET /api/v1/search/llm?q=unhealthy+apps` — falls back to rules when no LLM is configured.
- **Spotlight AI Commands** — Built-in commands like explain, why, diagnose <app>, suggest publish, ns insight, and ai status. — _Run diagnostics and get fleet answers straight from the search bar._
  - **How:** In Spotlight (`⌘K`) type `explain`, `why`, `diagnose `, `suggest publish`, `ns insight`, `graph insight`, `owner insight`, or `ai status`.

## 6. Zyra AI Intelligence

_Natural-language insight over your application catalog — with or without an external LLM._

- **Fleet Insight** — Summarizes overall cluster application health and highlights the services that need attention. — _Understand the state of everything at a glance, in plain language._
  - **How:** Home / Health fleet panel with focus chips; REST `GET /api/v1/insights/fleet`.
- **Per-App Insight** — Generates a diagnosis and remediation narrative for a single application. — _Know why an app is unhealthy and what to do about it._
  - **How:** App detail `/apps/:id`, the Diagnose drawer, or Inspector AI tab; REST `GET /api/v1/apps/{id}/insight`.
- **Publish Suggestions** — Ranks discovery-queue candidates so you know which services are worth publishing. — _Curate the launchpad quickly instead of reviewing everything by hand._
  - **How:** Suggestions on the `/discovery` page; REST `GET /api/v1/insights/discovery`; Spotlight `suggest publish`.
- **Namespace, Owner & Graph Insight** — Health rollups per namespace and per team, plus topology insight for unresolved dependency links. — _Slice fleet intelligence by the dimension you care about._
  - **How:** REST `GET /api/v1/insights/namespace/{ns}`, `/insights/owner/{owner}`, `/insights/graph`; Spotlight `ns insight`, `owner insight`, `graph insight`.
- **Dual-Mode LLM + Rules** — Uses an OpenAI-compatible LLM when configured and falls back to deterministic rules otherwise; a status endpoint reports which is active. — _Full intelligence with no external API required — connect an LLM only if you want richer answers._
  - **How:** Set `HERMES_LLM_API_URL`, `HERMES_LLM_API_KEY`, `HERMES_LLM_MODEL`; check the active mode via `GET /api/v1/insights/status` or Spotlight `ai status`.

> Zyra AI works out of the box in rule-based mode with no API key. Point it at OpenAI, an OpenAI-compatible endpoint, or a local Ollama install (helper script included) to unlock richer natural-language answers.

## 7. Health & Diagnostics

_Real-time health for every app, translated from raw probe errors into answers humans can act on._

- **Real-Time Health Status** — Classifies every app as Healthy, Degraded, or Offline from endpoint readiness and backend probes. — _Know an app works before you send a teammate to it._
  - **How:** Status shows on `/apps` and `/health` cards; REST `GET /api/v1/health/apps`.
- **Attention Queue** — The Health page lists exactly the services that need action, with an AI summary. — _Focus on what's broken instead of scanning a wall of green._
  - **How:** Web UI `/health` (attention queue with Zyra AI summary).
- **Diagnose Drawer** — A global drawer showing route lens, suggested kubectl commands, probe errors, and Zyra AI insight for any app. — _Go from something's wrong to a fix without leaving the launchpad._
  - **How:** Click Diagnose or Inspect route on any app to open the global drawer; REST `GET /api/v1/apps/{id}/diagnosis`.
- **Friendly Probe Summaries** — Maps raw errors like context deadline exceeded into short summaries with an expandable technical view. — _Everyone understands the status; operators can still see the raw detail._
  - **How:** Automatic on cards — a short summary plus endpoint chip; expand technical details on the card or Diagnose drawer for the raw message.
- **Fleet Health Indicators** — Home hero and navbar health chip reflect the live fleet health percentage. — _A single glance tells you how the whole cluster is doing._
  - **How:** Home hero + navbar health chip; underlying data from `GET /api/v1/health/apps`.

## 8. Application Graph

_See how your applications actually connect, and where a dependency is failing._

- **Dependency Topology** — A /graph page rendering nodes and edges of app-to-app dependencies with interactive filters. — _Understand what talks to what before you change or debug something._
  - **How:** Web UI `/graph`; REST `GET /api/v1/graph` (returns `nodes` and `edges`).
- **Mesh Route Filters** — Filter the graph by service-mesh routing to focus on mesh-connected apps. — _Isolate the mesh view when tracing east-west traffic._
  - **How:** Use the filter controls on the `/graph` page to scope to mesh-routed apps.
- **AI Focus Chips** — Zyra AI highlights unresolved or broken dependency links directly on the graph. — _The graph points you at the weak link instead of leaving you to hunt._
  - **How:** Shown on `/graph`; REST `GET /api/v1/insights/graph` or Spotlight `graph insight`.
- **Declared Dependencies** — Reads depends-on annotations to draw explicit relationships like Grafana to Prometheus to Loki. — _Your intended architecture shows up as a real, navigable map._
  - **How:** Set `hermes.zyvor.dev/depends-on: "prometheus,loki"` on the Service; edges render on `/graph`.

## 9. Multi-Cluster & Teams

_Merge catalogs across clusters and organize applications by the teams that own them._

- **Federated Catalog** — Merges catalogs from remote Hermes clusters into one view with remote health. — _One launchpad spanning dev, prod, edge, and cloud clusters._
  - **How:** Web UI `/federated`; REST `GET /api/v1/catalog/federated`. Configure peers via `HERMES_FEDERATED_CLUSTERS` (JSON) / `cluster.federated` in values.yaml.
- **Cross-Cluster Publishing** — Publish apps, bulk-publish namespaces, and set recommendations on federated clusters via the API. — _Curate remote clusters without leaving your home Hermes._
  - **How:** REST `POST /api/v1/federation/publish/{cluster_id}/{id}`, `/federation/publish-namespace/{cluster_id}/{namespace}`, `PUT /federation/recommended/{cluster_id}/{id}`.
- **Team Ownership Views** — The Teams page groups applications by owner metadata with per-team health rollups. — _Instantly see which team owns what — and how their apps are doing._
  - **How:** Web UI `/teams`; REST `GET /api/v1/owners`; set the owner with `hermes.zyvor.dev/owner`.
- **Workspace Filtering** — Filter the catalog by environment workspace (dev / staging / production), with permissions via OIDC groups. — _Each person sees the environment slice that's relevant to them._
  - **How:** Use the navbar workspace chips / compact switcher; REST `GET /api/v1/workspaces`. OIDC groups gate which workspaces a user sees.
- **Cluster Registry** — Lists local and federated clusters and reports remote health and RBAC. — _A single inventory of every cluster Hermes knows about._
  - **How:** REST `GET /api/v1/clusters`; remote RBAC checked via `GET /api/v1/federation/rbac/{cluster_id}`.

## 10. Security & Access

_Internal stays internal until you say otherwise — with auth, RBAC, and network controls._

- **Explicit Publish Control** — autoPublish defaults to off, so discovered apps require an explicit publish action or published annotation. — _No workload is ever exposed by accident._
  - **How:** `autoPublish: false` by default — publish via `/discovery` (or `POST /api/v1/discovery/publish/{id}`) or set `hermes.zyvor.dev/published: "true"`.
- **API Key & OIDC Auth** — Optional authentication via static API key or OIDC single sign-on with session cookies. — _Gate the whole surface behind your existing identity provider._
  - **How:** Set `HERMES_AUTH_MODE=api_key` (send `Authorization: Bearer `) or `oidc` (sign in at `/auth/login`, session cookie).
- **Role Rules & Admin Groups** — Configurable role rules plus OIDC admin groups and admin users for elevated actions. — _Give the right people admin power without sharing a superuser._
  - **How:** Configure `HERMES_ROLE_RULES`, `HERMES_ADMIN_GROUPS`, and admin users; `GET /auth/me` reports the caller's allowed actions.
- **Kubernetes SAR RBAC** — Optional SubjectAccessReview enforcement so users only see and reach apps they're allowed to. — _Reuse your cluster's own RBAC as the source of truth for access._
  - **How:** Enable SAR enforcement via Helm values; API list and gateway routes then filter apps by SubjectAccessReview.
- **Namespace Allow-List & NetworkPolicy** — Scope discovery to specific namespaces and restrict pod-to-pod traffic with a bundled NetworkPolicy template. — _Contain Hermes to exactly the blast radius you intend._
  - **How:** Set `HERMES_ALLOWED_NAMESPACES` to scope discovery; enable the bundled NetworkPolicy Helm template to restrict pod-to-pod traffic.
- **Federation Trust & RBAC Sync** — Forwards identity groups across clusters with trust headers so RBAC stays consistent in federation. — _Access rules follow the user across every federated cluster._
  - **How:** Automatic trust-header group forwarding to federated peers; verify remote access with `GET /api/v1/federation/rbac/{cluster_id}`.

## 11. Sharing, Audit & Memory

_Time-limited share links, a full audit trail, and personal launch memory._

- **Time-Limited Share Links** — Create read-only share tokens with a TTL that proxy directly to an app; admins can list and revoke them. — _Hand someone temporary access to a dashboard without granting an account._
  - **How:** Create from `/apps/:id`; REST `POST /api/v1/shares` (body `appId`, `ttlHours`); links proxy at `/s/{token}`; revoke with `DELETE /api/v1/shares/{token}` (admins list all via `/api/v1/shares/all`).
- **Activity Audit Log** — Records launches, share access, and admin actions, viewable on the Activity page with CSV export. — _Always know who opened what, and when._
  - **How:** Web UI `/activity` (with CSV export); REST `GET /api/v1/audit?limit=`.
- **Federated Audit Aggregation** — Aggregates audit events across federated clusters into a single feed. — _One compliance view spanning every cluster._
  - **How:** REST `GET /api/v1/audit/federated?limit=`; Spotlight `activity insight` and `GET /api/v1/insights/activity` summarize patterns.
- **Favorites** — Pin the apps you use most for one-click access. — _Your daily tools are always a single click away._
  - **How:** Pin from the app card; REST `PUT /api/v1/favorites/{id}` / `DELETE /api/v1/favorites/{id}` (`GET /api/v1/favorites` lists them).
- **Recents & Recommendations** — Tracks recently opened apps and surfaces team-recommended picks on Home. — _The launchpad learns your workflow and highlights what matters._
  - **How:** Recents auto-tracked on launch (`GET /api/v1/recents`); team picks via `hermes.zyvor.dev/recommended: "true"` or `PUT /api/v1/recommended/{id}` (`GET /api/v1/recommended`).

## 12. Deployment & Operations

_Ship Hermes with a Helm chart, monitor it with Prometheus, and run it on a lean stack._

- **Helm Chart Install** — One helm install deploys the Go controller and Rust server, published as an OCI Helm chart. — _Stand up the whole application layer in a single command._
  - **How:** `helm install hermes oci://ghcr.io/zyvorai/charts/hermes --version 0.2.0 --namespace hermes-system --create-namespace`.
- **Prometheus Metrics** — Exposes a /metrics endpoint with app totals, audit counters, and uptime, plus a /api/v1/stats summary. — _Wire Hermes straight into your existing monitoring._
  - **How:** Scrape `GET /metrics` (`hermes_apps_total`, audit counters, uptime); catalog summary at `GET /api/v1/stats`.
- **Lightweight SQLite Catalog** — Controller and server share a single SQLite catalog on a PVC — no external database to run. — _Minimal moving parts and dependencies to operate._
  - **How:** Automatic — the controller and server share a SQLite catalog on a PVC; no external database to configure.
- **Remote Deploy Tooling** — Scripts for remote k3s deploy, LLM configuration, Ollama setup, and end-to-end verification. — _Get from git clone to a verified running cluster fast._
  - **How:** Run `./scripts/deploy-remote.sh  `, `./scripts/configure-llm-remote.sh  `, and `./scripts/setup-ollama-remote.sh  `.
- **Demo Apps & Smoke Tests** — Ships demo Grafana and Prometheus plus smoke and E2E verification scripts. — _Prove the install works end to end in minutes._
  - **How:** Run `./scripts/smoke-test.sh` locally and `./scripts/e2e-deploy-verify.sh https://host:31847` against a deploy; UI Playwright via `HERMES_E2E_BASE=https://host:31847 npm run test:e2e`.

## Getting started

1. **Install with Helm** — helm install hermes ./charts/hermes -n hermes-system --create-namespace --set global.domain=zeus.local, then open the ingress host or NodePort.
2. **Let discovery run** — With discoverAll on by default, Hermes watches every namespace and populates the discovery queue automatically — no manual registration.
3. **Publish your apps** — Review the Discovery page and publish the right services (or set hermes.zyvor.dev/published: "true"). Add annotations to enrich names, icons, owners, and dependencies.
4. **Launch from the launchpad** — Open the Nebula UI, hit Command-K to Spotlight-search, and click to launch any app through the gateway — no port-forward.
5. **Optional: connect Zyra AI** — Set HERMES_LLM_API_URL and HERMES_LLM_API_KEY (or run the Ollama setup script) for natural-language search and insight. Rule-based mode works with no key.

> **Good to know:** Feature availability reflects Hermes v0.2. Some capabilities are roadmap-only and not yet shipped, including in-cluster mesh policy editing and federated activity export webhooks. Discovery covers Kubernetes Services, Ingress/Gateway API routes, and Istio/Linkerd mesh routes today; discovery of arbitrary custom resources is on the roadmap. The multi-cluster registry is an early single-cluster-first MVP.

---
_Hermes is developed by ZyvorAI Labs and released under the Apache License 2.0. Contact **info@zyvor.dev** · [zyvor.dev](https://zyvor.dev)._
