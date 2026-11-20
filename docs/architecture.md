# Iris architecture

Iris v0.2 is the Application Operating Layer for Kubernetes — a standalone platform with three parts:

1. **Iris Controller** (Go) — watches Services and EndpointSlices, parses annotations, applies known-app signatures, polls health, writes catalog to SQLite.
2. **Iris Server** (Rust) — REST API, reverse proxy gateway, Zyra AI insight layer, embedded React UI.
3. **Iris UI (Nebula)** (React) — glass-style launchpad with Spotlight search, favorites, discovery, and Zyra AI panels.

## Data flow

```
Service annotations → Controller → SQLite ← Server API → UI
                                      ↑
User opens app → Gateway /a/{ns}/{slug} → ClusterIP service
```

## Routes

- UI: `/`
- API: `/api/v1/*`
- Gateway: `/a/{namespace}/{slug}/*`
- Insights: `/api/v1/insights/*`, `/api/v1/apps/{id}/insight`
- Health: `/healthz`, `/api/v1/ws-echo` (WebSocket smoke test)

## Security defaults

- `autoPublish: false` — annotated apps require explicit `published: true` or Discovery publish action
- Gateway blocks proxy when no ready endpoints
- OIDC, API key, role rules (`IRIS_ROLE_RULES`), and optional Kubernetes SAR RBAC
- NetworkPolicy Helm template restricts pod-to-pod traffic

See [USER_STORIES.md](USER_STORIES.md) Story 5 for gateway exposure acceptance criteria.

For local development and extending Iris, see [development.md](development.md). Full HTTP route catalog: [api.md](api.md).
