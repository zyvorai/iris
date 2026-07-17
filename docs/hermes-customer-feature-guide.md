# Hermes — Feature Guide

> **The application operating layer for Kubernetes — Every Application. One Door.**

Hermes turns Kubernetes from an infrastructure platform into an application platform. It continuously discovers every dashboard, API, and internal tool running in your cluster, recognizes what each one is, monitors its health, and gives users a permanent front door to launch software — no more kubectl port-forward, bookmark sprawl, or namespace archaeology. Think macOS Launchpad and Spotlight, but for your clusters.

**40+** REST & gateway endpoints · **11** Nebula UI pages · **8** Zeus AI insight APIs · **15+** recognized platform tools · **3** discovery sources (Service, Ingress/Gateway API, mesh) · **0** port-forwards needed

This is the customer-facing feature reference. A print-ready PDF of the same content sits alongside this file. Generated from the product's actual capabilities.

## Contents

1. [Continuous Discovery](#1-continuous-discovery)
2. [Recognition & Catalog](#2-recognition-catalog)
3. [Universal Gateway](#3-universal-gateway)
4. [Nebula Launchpad UI](#4-nebula-launchpad-ui)
5. [Spotlight Search](#5-spotlight-search)
6. [Zeus AI Intelligence](#6-zeus-ai-intelligence)
7. [Health & Diagnostics](#7-health-diagnostics)
8. [Application Graph](#8-application-graph)
9. [Multi-Cluster & Teams](#9-multi-cluster-teams)
10. [Security & Access](#10-security-access)
11. [Sharing, Audit & Memory](#11-sharing,-audit-memory)
12. [Deployment & Operations](#12-deployment-operations)

## 1. Continuous Discovery

_Hermes watches the cluster and builds a living application catalog for you — no manual registration._

- **Cluster-Wide Service Discovery** — Continuously watches Kubernetes Services across every namespace and adds them to the catalog automatically. — _Stop maintaining spreadsheets of service URLs — the cluster documents itself._
- **Ingress & Gateway API Routes** — Discovers routing from Ingress objects and Gateway API HTTPRoutes, including ingress host metadata on each app. — _See the real public entry point for an app, not just its internal service name._
- **Service Mesh Route Discovery** — Reads Istio VirtualServices and Linkerd annotations to map mesh-based routing into the catalog. — _Mesh-routed apps become as discoverable as everything else._
- **Automatic Catalog Refresh** — Correlates EndpointSlice readiness and updates the catalog live as the cluster changes. — _The catalog is always current without any human upkeep._
- **Discovery Queue** — Surfaces newly found but unpublished services in a dedicated review queue separate from the live launchpad. — _Nothing gets a front door by accident — you decide what goes live._

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
- **Annotation Enrichment** — Optional hermes.zyvor.dev/* annotations set display name, slug, category, icon, owner, dependencies, port, scheme, and path. — _Custom in-house apps get the same polished catalog treatment as off-the-shelf tools._
- **Environment Inference** — Labels each app production, staging, or development from annotations, or infers it from the namespace name. — _Instantly tell prod from dev without asking anyone._
- **Published App Catalog** — A unified /apps catalog of published applications with categories, search, sort, filter, and view toggles. — _One browsable home for every tool your team actually uses._
- **Catalog Export** — Download the full catalog as JSON via the API or the Cluster page action menu. — _Feed your app inventory into other systems or keep an auditable snapshot._

## 3. Universal Gateway

_Every published workload gets a permanent, predictable front door through one reverse proxy._

- **Stable Launchpad URLs** — Proxies apps at predictable paths like /launchpad/apps/{slug} and /a/{namespace}/{slug}, with legacy aliases. — _Links survive pod reschedules and namespace moves — no bookmark ever breaks._
- **WebSocket Tunneling** — Proxies WebSocket upgrades for live dashboards like Grafana, Argo CD, VS Code Server, Open WebUI, and Jupyter. — _Interactive tools work fully through the gateway, not just static pages._
- **SSE, HTTP/2 & gRPC Pass-Through** — Supports Server-Sent Events streaming, HTTP/2, and gRPC content types with native backend connection pools. — _Modern streaming and RPC apps proxy correctly and efficiently._
- **Readiness-Gated Proxying** — Blocks the proxy with a clear error when a backend has no ready endpoints. — _Users never get silently routed to a dead workload._
- **Zero Port-Forwarding** — Replaces the kubectl port-forward workflow with search, click, launch, work. — _Developers reach any tool in seconds without touching kubectl._

## 4. Nebula Launchpad UI

_A macOS-inspired glass launchpad that looks like applications, not namespaces and pods._

- **Command Deck Home** — A hero with fleet snapshot, a 3-metric summary, Quick Launch tiles, and Mission Control accordions. — _The one screen that answers what's running, what's healthy, and what to open._
- **Cluster Catalog View** — Every service grouped by namespace in collapsible sections with human-readable health hints. — _Explore the whole cluster's apps without a single kubectl get._
- **Spaces Organization** — Organizes published apps into category-based spaces for browsing. — _Find the monitoring stack or CI tools as a group, not a flat list._
- **Liquid Glass Design System** — A tiered translucent glass interface with shared page frames, skeleton loading, and empty states. — _A fast, polished, consistent experience across every page._
- **Keyboard Navigation & Shortcuts** — Arrow-key and Enter navigation in Spotlight plus a global keyboard shortcuts help panel. — _Power users move through the whole app without a mouse._
- **Responsive Mobile Layouts** — Compact workspace switcher, stacked toolbars, and scrollable category chips below 768px. — _Launch and check apps from a phone, not just a desktop._

## 5. Spotlight Search

_A Command-K palette that finds apps, pages, and answers the way Spotlight finds anything._

- **Full-Text Catalog Search** — Type a few letters to match apps by name, namespace, or category across the whole cluster. — _Type gra, get Grafana — no memorizing service DNS names._
- **Rule-Based Intent Search** — Parses queries into intent so a namespace or category returns exactly the right apps. — _Ask for what you mean and get relevant results, not keyword noise._
- **Natural-Language Search** — An LLM-powered search endpoint answers plain-language queries, with rule-based fallback when no LLM is set. — _Ask unhealthy apps in monitoring in English and get a real answer._
- **Spotlight AI Commands** — Built-in commands like explain, why, diagnose <app>, suggest publish, ns insight, and ai status. — _Run diagnostics and get fleet answers straight from the search bar._

## 6. Zeus AI Intelligence

_Natural-language insight over your application catalog — with or without an external LLM._

- **Fleet Insight** — Summarizes overall cluster application health and highlights the services that need attention. — _Understand the state of everything at a glance, in plain language._
- **Per-App Insight** — Generates a diagnosis and remediation narrative for a single application. — _Know why an app is unhealthy and what to do about it._
- **Publish Suggestions** — Ranks discovery-queue candidates so you know which services are worth publishing. — _Curate the launchpad quickly instead of reviewing everything by hand._
- **Namespace, Owner & Graph Insight** — Health rollups per namespace and per team, plus topology insight for unresolved dependency links. — _Slice fleet intelligence by the dimension you care about._
- **Dual-Mode LLM + Rules** — Uses an OpenAI-compatible LLM when configured and falls back to deterministic rules otherwise; a status endpoint reports which is active. — _Full intelligence with no external API required — connect an LLM only if you want richer answers._

> Zeus AI works out of the box in rule-based mode with no API key. Point it at OpenAI, an OpenAI-compatible endpoint, or a local Ollama install (helper script included) to unlock richer natural-language answers.

## 7. Health & Diagnostics

_Real-time health for every app, translated from raw probe errors into answers humans can act on._

- **Real-Time Health Status** — Classifies every app as Healthy, Degraded, or Offline from endpoint readiness and backend probes. — _Know an app works before you send a teammate to it._
- **Attention Queue** — The Health page lists exactly the services that need action, with an AI summary. — _Focus on what's broken instead of scanning a wall of green._
- **Diagnose Drawer** — A global drawer showing route lens, suggested kubectl commands, probe errors, and Zeus AI insight for any app. — _Go from something's wrong to a fix without leaving the launchpad._
- **Friendly Probe Summaries** — Maps raw errors like context deadline exceeded into short summaries with an expandable technical view. — _Everyone understands the status; operators can still see the raw detail._
- **Fleet Health Indicators** — Home hero and navbar health chip reflect the live fleet health percentage. — _A single glance tells you how the whole cluster is doing._

## 8. Application Graph

_See how your applications actually connect, and where a dependency is failing._

- **Dependency Topology** — A /graph page rendering nodes and edges of app-to-app dependencies with interactive filters. — _Understand what talks to what before you change or debug something._
- **Mesh Route Filters** — Filter the graph by service-mesh routing to focus on mesh-connected apps. — _Isolate the mesh view when tracing east-west traffic._
- **AI Focus Chips** — Zeus AI highlights unresolved or broken dependency links directly on the graph. — _The graph points you at the weak link instead of leaving you to hunt._
- **Declared Dependencies** — Reads depends-on annotations to draw explicit relationships like Grafana to Prometheus to Loki. — _Your intended architecture shows up as a real, navigable map._

## 9. Multi-Cluster & Teams

_Merge catalogs across clusters and organize applications by the teams that own them._

- **Federated Catalog** — Merges catalogs from remote Hermes clusters into one view with remote health. — _One launchpad spanning dev, prod, edge, and cloud clusters._
- **Cross-Cluster Publishing** — Publish apps, bulk-publish namespaces, and set recommendations on federated clusters via the API. — _Curate remote clusters without leaving your home Hermes._
- **Team Ownership Views** — The Teams page groups applications by owner metadata with per-team health rollups. — _Instantly see which team owns what — and how their apps are doing._
- **Workspace Filtering** — Filter the catalog by environment workspace (dev / staging / production), with permissions via OIDC groups. — _Each person sees the environment slice that's relevant to them._
- **Cluster Registry** — Lists local and federated clusters and reports remote health and RBAC. — _A single inventory of every cluster Hermes knows about._

## 10. Security & Access

_Internal stays internal until you say otherwise — with auth, RBAC, and network controls._

- **Explicit Publish Control** — autoPublish defaults to off, so discovered apps require an explicit publish action or published annotation. — _No workload is ever exposed by accident._
- **API Key & OIDC Auth** — Optional authentication via static API key or OIDC single sign-on with session cookies. — _Gate the whole surface behind your existing identity provider._
- **Role Rules & Admin Groups** — Configurable role rules plus OIDC admin groups and admin users for elevated actions. — _Give the right people admin power without sharing a superuser._
- **Kubernetes SAR RBAC** — Optional SubjectAccessReview enforcement so users only see and reach apps they're allowed to. — _Reuse your cluster's own RBAC as the source of truth for access._
- **Namespace Allow-List & NetworkPolicy** — Scope discovery to specific namespaces and restrict pod-to-pod traffic with a bundled NetworkPolicy template. — _Contain Hermes to exactly the blast radius you intend._
- **Federation Trust & RBAC Sync** — Forwards identity groups across clusters with trust headers so RBAC stays consistent in federation. — _Access rules follow the user across every federated cluster._

## 11. Sharing, Audit & Memory

_Time-limited share links, a full audit trail, and personal launch memory._

- **Time-Limited Share Links** — Create read-only share tokens with a TTL that proxy directly to an app; admins can list and revoke them. — _Hand someone temporary access to a dashboard without granting an account._
- **Activity Audit Log** — Records launches, share access, and admin actions, viewable on the Activity page with CSV export. — _Always know who opened what, and when._
- **Federated Audit Aggregation** — Aggregates audit events across federated clusters into a single feed. — _One compliance view spanning every cluster._
- **Favorites** — Pin the apps you use most for one-click access. — _Your daily tools are always a single click away._
- **Recents & Recommendations** — Tracks recently opened apps and surfaces team-recommended picks on Home. — _The launchpad learns your workflow and highlights what matters._

## 12. Deployment & Operations

_Ship Hermes with a Helm chart, monitor it with Prometheus, and run it on a lean stack._

- **Helm Chart Install** — One helm install deploys the Go controller and Rust server, published as an OCI Helm chart. — _Stand up the whole application layer in a single command._
- **Prometheus Metrics** — Exposes a /metrics endpoint with app totals, audit counters, and uptime, plus a /api/v1/stats summary. — _Wire Hermes straight into your existing monitoring._
- **Lightweight SQLite Catalog** — Controller and server share a single SQLite catalog on a PVC — no external database to run. — _Minimal moving parts and dependencies to operate._
- **Remote Deploy Tooling** — Scripts for remote k3s deploy, LLM configuration, Ollama setup, and end-to-end verification. — _Get from git clone to a verified running cluster fast._
- **Demo Apps & Smoke Tests** — Ships demo Grafana and Prometheus plus smoke and E2E verification scripts. — _Prove the install works end to end in minutes._

## Getting started

1. **Install with Helm** — helm install hermes ./charts/hermes -n hermes-system --create-namespace --set global.domain=zeus.local, then open the ingress host or NodePort.
2. **Let discovery run** — With discoverAll on by default, Hermes watches every namespace and populates the discovery queue automatically — no manual registration.
3. **Publish your apps** — Review the Discovery page and publish the right services (or set hermes.zyvor.dev/published: "true"). Add annotations to enrich names, icons, owners, and dependencies.
4. **Launch from the launchpad** — Open the Nebula UI, hit Command-K to Spotlight-search, and click to launch any app through the gateway — no port-forward.
5. **Optional: connect Zeus AI** — Set HERMES_LLM_API_URL and HERMES_LLM_API_KEY (or run the Ollama setup script) for natural-language search and insight. Rule-based mode works with no key.

> **Good to know:** Feature availability reflects Hermes v0.2. Some capabilities are roadmap-only and not yet shipped, including in-cluster mesh policy editing and federated activity export webhooks. Discovery covers Kubernetes Services, Ingress/Gateway API routes, and Istio/Linkerd mesh routes today; discovery of arbitrary custom resources is on the roadmap. The multi-cluster registry is an early single-cluster-first MVP. Hermes ships with a 30-day trial license (HMAC-SHA256 enforced); continued use requires a commercial license from sales@zyvor.dev.

---
_Hermes is developed by ZyvorAI Labs. Contact **info@zyvor.dev** · Proprietary & Confidential._
