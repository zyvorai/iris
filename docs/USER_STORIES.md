# hermes User Stories

**Product:** The application operating layer for Kubernetes

Cross-reference: [Documentation index](README.md) · [Main README](../README.md)

## Personas

| Persona | Name | Focus |
|---------|------|-------|
| Developer | Alex | Launch Grafana without kubectl port-forward |
| Platform Team | Morgan | Auto-discover apps across namespaces |
| Security | Jordan | Control which apps are exposed via gateway |

---

### Story 1 — Discover cluster apps

**As Morgan** (Platform Team), I want automatically catalog every dashboard, api, and tool in the cluster, **so that** I deliver reliable outcomes.

| Criterion | Notes |
|-----------|-------|
| Core capability | Hermes discovery, application catalog |

---

### Story 2 — Launch app in one click

**As Alex** (Developer), I want open grafana/argocd/harbor from launchpad without remembering urls, **so that** I deliver reliable outcomes.

| Criterion | Notes |
|-----------|-------|
| Core capability | Application gateway, permanent front door |

---

### Story 3 — Health at a glance

**As Morgan** (Platform Team), I want see which applications are healthy before sharing links, **so that** I deliver reliable outcomes.

| Criterion | Notes |
|-----------|-------|
| Core capability | Health monitoring, app status |

---

### Story 4 — Eliminate port-forward culture

**As Alex** (Developer), I want replace bookmark sprawl and tribal knowledge with hermes, **so that** I deliver reliable outcomes.

| Criterion | Notes |
|-----------|-------|
| Core capability | Zeus OS application layer |

---

## Validation

Map each story to smoke tests, CI jobs, or manual lab steps before marking production-ready.
