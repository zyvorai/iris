# Hermes User Stories

**Product:** The application operating layer for Kubernetes

Cross-reference: [Documentation index](README.md) · [Main README](../README.md) · [UI guide](ui.md)

## Personas

| Persona | Name | Focus |
|---------|------|-------|
| Developer | Alex | Launch Grafana without `kubectl port-forward` |
| Platform Team | Morgan | Auto-discover apps across namespaces |
| Security | Jordan | Control which apps are exposed via gateway |

---

### Story 1 — Discover cluster apps

**As Morgan** (Platform Team), I want Hermes to automatically catalog every dashboard, API, and tool in the cluster, **so that** I stop maintaining spreadsheets of service URLs.

| Acceptance criterion | Status |
|---------------------|--------|
| Controller discovers Services cluster-wide (`discoverAll: true` default) | Shipped |
| Catalog refreshes as the cluster changes (EndpointSlice readiness) | Shipped |
| Signature recognition labels popular tools (Grafana, Prometheus, Argo CD, …) | Shipped |
| Cluster page groups services by namespace with collapsible sections | Shipped |
| Optional `hermes.zyvor.dev/*` annotations enrich custom apps | Shipped |

---

### Story 2 — Launch app in one click

**As Alex** (Developer), I want to open Grafana / Argo CD / Harbor from the launchpad without remembering URLs, **so that** I can start working immediately.

| Acceptance criterion | Status |
|---------------------|--------|
| Published apps appear on Home Quick Launch and `/apps` catalog | Shipped |
| Gateway serves stable paths at `/a/{namespace}/{slug}` | Shipped |
| WebSocket proxy works for dashboards and live UIs | Shipped |
| Spotlight (`⌘K`) finds apps by name, namespace, or category | Shipped |
| Favorites and recents persist personal launch history | Shipped |

---

### Story 3 — Health at a glance

**As Morgan** (Platform Team), I want to see which applications are healthy before sharing links, **so that** I do not send teammates to broken endpoints.

| Acceptance criterion | Status |
|---------------------|--------|
| Each app shows Healthy / Degraded / Offline with human-readable probe summaries | Shipped |
| Home hero and navbar health chip reflect fleet health percentage | Shipped |
| Health page attention queue lists services needing action | Shipped |
| Diagnose drawer shows route lens, suggested commands, and Zeus AI insight | Shipped |
| Gateway blocks proxy when no ready endpoints exist | Shipped |

---

### Story 4 — Eliminate port-forward culture

**As Alex** (Developer), I want to replace bookmark sprawl and tribal knowledge with Hermes, **so that** the cluster documents itself.

| Acceptance criterion | Status |
|---------------------|--------|
| Permanent launchpad URLs survive pod reschedules | Shipped |
| Spaces organize published apps by category | Shipped |
| Share links provide time-limited read-only access | Shipped |
| Activity audit log records launches and admin actions | Shipped |

---

### Story 5 — Control gateway exposure

**As Jordan** (Security), I want to control which apps are exposed through the gateway, **so that** internal services stay internal until explicitly published.

| Acceptance criterion | Status |
|---------------------|--------|
| `autoPublish: false` — apps require explicit publish or `published: true` annotation | Shipped |
| Discovery queue shows unpublished services separately from launchpad | Shipped |
| Namespace allow-list via `HERMES_ALLOWED_NAMESPACES` | Shipped |
| OIDC auth with admin groups (`HERMES_ADMIN_GROUPS`) and role rules (`HERMES_ROLE_RULES`) | Shipped |
| Optional Kubernetes SAR RBAC enforcement on API and gateway | Shipped |
| NetworkPolicy Helm template restricts pod-to-pod traffic | Shipped |
| Federation trust headers and cross-cluster RBAC sync | Shipped |

---

### Story 6 — Publish from discovery queue

**As Morgan** (Platform Team), I want to review discovered services and publish the right ones to the launchpad, **so that** only intentional apps get a front door.

| Acceptance criterion | Status |
|---------------------|--------|
| Discovery page lists unpublished services with publish action | Shipped |
| Bulk namespace publish via API | Shipped |
| Zeus AI ranks publish suggestions on Discovery page | Shipped |
| Spotlight `suggest publish` surfaces ranked candidates | Shipped |

---

### Story 7 — Zeus AI fleet intelligence

**As Alex** (Developer), I want natural-language answers about my cluster's applications, **so that** I can diagnose issues without reading raw probe errors.

| Acceptance criterion | Status |
|---------------------|--------|
| Fleet insight panel on Home and Health with focus-service chips | Shipped |
| Per-app insight on app detail, Diagnose drawer, and Inspector AI tab | Shipped |
| Spotlight `explain`, `diagnose <app>`, `why`, `ns insight` commands | Shipped |
| LLM search via `/api/v1/search/llm` with rule-based fallback when unset | Shipped |
| `GET /api/v1/insights/status` shows Rules vs LLM mode | Shipped |
| Ollama remote setup script for local LLM without API key | Shipped |

---

### Story 8 — Multi-cluster and team context

**As Morgan** (Platform Team), I want federated catalogs and team ownership views, **so that** I understand apps across clusters and who owns them.

| Acceptance criterion | Status |
|---------------------|--------|
| Federated page merges remote Hermes cluster catalogs | Shipped |
| Teams page groups apps by owner metadata | Shipped |
| Graph page shows dependency topology with Zeus AI focus chips | Shipped |
| Activity page aggregates audit events with fleet insight banner | Shipped |
| Workspaces filter catalog by environment (dev / staging / production) | Shipped |

---

## Validation matrix

Map each story to automated or manual checks before marking production-ready.

| Story | Playwright (`ui/tests/smoke.spec.ts`) | Remote E2E (`scripts/e2e-deploy-verify.sh`) | CI (`.github/workflows/ci.yml`) |
|-------|--------------------------------------|-----------------------------------------------|--------------------------------|
| 1 Discover | `cluster page renders toolbar` | `apps`, `catalog`, `cluster summary` | Go controller tests |
| 2 Launch | `home loads nebula command deck`, `spotlight opens from navbar` | `launchpad canonical`, `search` | Rust + UI build |
| 3 Health | `health page loads attention queue`, `home shows zeus ai fleet insight panel` | `health summary`, `app diagnosis`, `app insight`, `fleet insight` | Rust tests |
| 4 Port-forward | `footer visible after scroll`, `catalog page renders toolbar` | `recommended`, `audit`, `shares` | Helm lint |
| 5 Security | — | `federation rbac 404`, `shares admin` | Rust clippy/fmt |
| 6 Publish | `discovery page renders toolbar or empty state` | `discovery insight` | — |
| 7 Zeus AI | `spotlight explain`, `spotlight diagnose`, `graph page renders` | `search LLM`, `fleet/discovery/namespace/graph/owner/federated/activity insight`, `ai status` | Rust tests |
| 8 Federation | `spotlight federated insight shows federation summary`, `graph page renders` | `federated catalog`, `federated audit`, `graph (nodes)`, `owners`, `workspaces` | — |

**Manual lab steps**

```bash
make build && ./scripts/smoke-test.sh          # local smoke
make deploy-remote                              # remote Helm deploy
make test-remote-smoke                          # post-deploy API checks
cd ui && HERMES_E2E_BASE=http://host:31847 npm run test:e2e
```

**Not yet validated (roadmap)**

- In-cluster mesh policy editing
- Federated activity export webhooks
