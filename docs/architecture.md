# Hermes architecture

Hermes v0.1 is the Application Operating Layer for Kubernetes — a standalone platform with three parts:

1. **Hermes Controller** (Go) — watches Services and EndpointSlices, parses annotations, applies known-app signatures, polls health, writes catalog to SQLite.
2. **Hermes Server** (Rust) — REST API, reverse proxy gateway, embedded React UI.
3. **Hermes Dock UI** (React) — glass-style launcher with search, favorites, discovery.

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
- Health: `/healthz`, `/api/v1/ws-echo` (WebSocket smoke test)

## Security defaults

- `autoPublish: false` — annotated apps require explicit `published: true` or Discovery publish action
- Gateway blocks proxy when no ready endpoints
- SSO middleware hooks reserved for v0.2
