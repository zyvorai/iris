# Iris Developer Guide

How to build, run, and extend Iris locally. For contribution workflow see [CONTRIBUTING.md](../CONTRIBUTING.md). For operators see [install.md](install.md).

## Overview

Iris has three runtime parts that share a **SQLite catalog** — no RPC between controller and server:

```text
Kubernetes cluster
       │
       ▼
iris-controller (Go)  ──writes──▶  SQLite  ◀──reads──  iris-server (Rust)
                                              │
                                              ├── REST API  /api/v1/*
                                              ├── Gateway   /a/{ns}/{slug}
                                              └── UI        /  (ui/dist)
```

| Component | Path | Language | Responsibility |
|-----------|------|----------|----------------|
| Controller | `cmd/iris-controller`, `controller/` | Go | Watch Services, Ingress, Gateway API, mesh; health polls; catalog writes |
| Server | `crates/iris-server` | Rust | HTTP server: API, gateway proxy, auth, metrics, embedded UI |
| UI | `ui/` | React + Vite | Nebula launchpad (built to `ui/dist/`) |

Rust workspace crates:

| Crate | Role |
|-------|------|
| `iris-core` | Models, SQLite (Rust), search, graph, diagnosis, Zyra AI, federation, RBAC |
| `iris-api` | Axum REST routes under `/api/v1/*` |
| `iris-gateway` | Reverse proxy to cluster backends |
| `iris-server` | Binary wiring auth, metrics, SPA fallback |

---

## Repository map

```text
iris/
├── cmd/
│   ├── iris-controller/   # K8s watcher binary
│   └── iris-seed/           # Local SQLite seed (smoke / compose)
├── controller/
│   ├── discovery/             # Informers, health, ingress/gateway/mesh
│   ├── model/                 # App, Backend, Visibility types
│   ├── signatures/            # Known-app heuristics (Grafana, Argo CD, …)
│   └── store/                 # Go SQLite layer
├── crates/
│   ├── iris-core/
│   ├── iris-api/
│   ├── iris-gateway/
│   └── iris-server/
├── ui/                        # React app
├── charts/iris/             # Helm chart (controller + server pod, shared PVC)
├── scripts/                   # smoke-test, deploy-remote, e2e-deploy-verify
├── examples/                  # Annotated Service YAML
└── docs/
```

**Note:** `api/v1alpha1/` holds an experimental AppRoute CRD — not part of the main build. The REST API lives in `crates/iris-api/`.

---

## Prerequisites

| Tool | Version | Used for |
|------|---------|----------|
| Rust | stable | Server and workspace crates |
| Go | 1.23+ | Controller and seed |
| Node.js | 20+ | UI |
| Helm | 3.x | Chart lint and deploy |
| Docker | optional | Images and `docker compose` |
| kubectl | optional | Controller against a real cluster |

---

## Local development

### Path A — smoke test (fastest)

No Kubernetes required. Seeds SQLite with Grafana, Prometheus, and Argo CD demo apps.

```bash
make build-rust          # or: cargo build -p iris-server
./scripts/smoke-test.sh
# → http://localhost:31847
```

`smoke-test.sh` builds the server, runs `go run ./cmd/iris-seed`, starts `iris-server`, and checks health, catalog, search, gateway, and WebSocket echo.

Overrides: `IRIS_PORT=31848`, `IRIS_DB_PATH=/tmp/my.db`.

### Path B — full build

```bash
make build               # controller + server + UI
./scripts/smoke-test.sh
```

### Path C — UI hot reload

Terminal 1 — API server (seed DB first or point at existing SQLite):

```bash
go run ./cmd/iris-seed /tmp/iris-dev.db
IRIS_DB_PATH=/tmp/iris-dev.db cargo run -p iris-server
```

Terminal 2 — Vite dev server (proxies API to `:31847`):

```bash
cd ui && npm ci && npm run dev
# → http://localhost:5173
```

### Path D — Docker Compose

Server + seeded SQLite, no controller:

```bash
docker compose up --build
open http://localhost:31847
```

### Path E — against a real cluster

Run controller and server with the **same** `IRIS_DB_PATH`:

```bash
export IRIS_DB_PATH=/tmp/iris.db
export KUBECONFIG=~/.kube/config

go run ./cmd/iris-controller &
IRIS_DB_PATH=$IRIS_DB_PATH cargo run -p iris-server
```

In production, Helm runs both in one pod with a shared PVC at `/data/iris/iris.db`.

---

## Makefile targets

| Target | Description |
|--------|-------------|
| `make build` | Go controller + Rust server + UI |
| `make build-go` / `build-rust` / `build-ui` | Individual components |
| `make test` | `go test`, `cargo test`, UI tests |
| `make clean` | Remove `bin/`, `ui/dist/`, `target/` |
| `make docker` | Build controller and server images |
| `make helm-template` | Render chart locally |
| `make deploy-remote` | Helm deploy to remote k3s |
| `make test-remote-smoke` | Post-deploy API checks |

Default deploy: `DEPLOY_HOST=<ephemeral-ip>`, `DEPLOY_USER=operator`, `VERSION=0.2.0`.

---

## Environment variables

Copy [.env.example](../.env.example) to `.env` for local reference.

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `IRIS_BIND` | `0.0.0.0:31847` | Listen address |
| `IRIS_DB_PATH` | `/data/iris/iris.db` | SQLite path (must match controller) |
| `IRIS_UI_DIR` | `./ui/dist` | Built UI assets |
| `IRIS_DEFAULT_USER` | `local` | User when `IRIS_AUTH_MODE=none` |
| `IRIS_AUTH_MODE` | `none` | `none` \| `api_key` \| `oidc` |
| `IRIS_API_KEY` | — | Required when mode is `api_key` |
| `IRIS_SESSION_SECRET` | dev default | **Required in production** |
| `IRIS_OIDC_*` | — | Issuer, client ID/secret, redirect URL |
| `IRIS_ALLOWED_NAMESPACES` | (all) | Comma-separated API/gateway filter |
| `IRIS_ADMIN_USERS` / `IRIS_ADMIN_GROUPS` | — | Admin bypass lists |
| `IRIS_WORKSPACE_RULES` | — | JSON workspace ACL |
| `IRIS_ROLE_RULES` | — | JSON role action rules |
| `IRIS_K8S_RBAC` | `false` | Enable Kubernetes SAR checks |
| `IRIS_CLUSTER_ID` / `IRIS_CLUSTER_NAME` | `local` | Local cluster identity |
| `IRIS_FEDERATED_CLUSTERS` | — | JSON array of peer Iris clusters |
| `IRIS_FEDERATION_TRUST_HEADERS` | `false` | Trust `x-iris-user` from peers |
| `IRIS_LLM_API_URL` / `IRIS_LLM_API_KEY` / `IRIS_LLM_MODEL` | — | Zyra AI LLM (rule fallback when unset) |
| `RUST_LOG` | `iris_server=info` | Tracing filter |

### Controller

| Variable | Default | Description |
|----------|---------|-------------|
| `IRIS_DB_PATH` | `/data/iris/iris.db` | Same SQLite file as server |
| `IRIS_PUBLIC_BASE_URL` | `http://localhost:31847` | Public URLs in catalog |
| `IRIS_PUBLIC_PATH_PREFIX` | `""` | e.g. `/launchpad` |
| `IRIS_AUTO_PUBLISH` | `false` | Auto-publish annotated services |
| `IRIS_AUTO_SUGGEST` | `true` | Signature-match without annotation |
| `IRIS_DISCOVER_ALL` | `true` | Index all eligible services |
| `IRIS_DISCOVER_INGRESS` | `true` | Ingress host discovery |
| `IRIS_DISCOVER_GATEWAY_API` | `true` | Gateway API HTTPRoutes |
| `IRIS_DISCOVER_MESH` | `true` | Istio / Linkerd mesh routes |
| `IRIS_WATCH_NAMESPACES` | (all) | Comma-separated namespace filter |
| `KUBECONFIG` | `~/.kube/config` | Local kubeconfig when not in-cluster |

Helm values mirror these under `charts/iris/values.yaml` → `controller.*` and `server.*`.

---

## Controller internals

### Discovery pipeline

1. **Service informer** — watches cluster Services (and EndpointSlices for readiness).
2. **Annotation parse** — `iris.zyvor.dev/*` keys (see [annotations.md](annotations.md)).
3. **Signature match** — `controller/signatures/` recognizes Grafana, Prometheus, Argo CD, etc.
4. **Ingress / Gateway API / mesh** — optional route metadata when `IRIS_DISCOVER_*` enabled.
5. **Health refresh** — polls backends every 30s; updates `status`, `ready_count`, diagnosis.
6. **SQLite upsert** — `controller/store` writes `apps` table; prunes stale discoveries.

### Adding a signature

Edit `controller/signatures/signatures.go`:

1. Add a `Signature` entry with namespace/name/port/label heuristics.
2. Set `Category`, `Icon`, and optional `CanonicalSlug`.
3. Run `go test ./controller/signatures/...`.
4. Resync: restart controller or wait for next informer event.

### Annotating a custom app

```yaml
metadata:
  annotations:
    iris.zyvor.dev/enabled: "true"
    iris.zyvor.dev/name: "My App"
    iris.zyvor.dev/category: "Internal"
    iris.zyvor.dev/published: "true"
    iris.zyvor.dev/port: "8080"
```

Apply `examples/grafana-service-annotated.yaml` as a template.

---

## Server & API internals

### Route assembly

`iris-server/src/main.rs` builds:

| Layer | Auth | Routes |
|-------|------|--------|
| Public | No | `/healthz`, `/metrics`, `/auth/*`, `/api/v1/ws-echo` |
| Protected | Yes | `/api/v1/*`, gateway (`/a/`, `/launchpad/`) |
| Fallback | No | SPA static files from `IRIS_UI_DIR` |

Full route catalog: **[api.md](api.md)**.

### Adding a REST endpoint

1. Add handler in `crates/iris-api/src/lib.rs`.
2. Register route in the `Router::new()` chain.
3. Use `State<ApiState>` for store / config access.
4. Add `e2e-deploy-verify.sh` check and update [api.md](api.md).
5. Wire UI in `ui/src/services/irisApi.ts` if user-facing.

### Adding a Zyra AI insight

1. Add logic in `crates/iris-core/src/insight.rs`.
2. Expose route in `iris-api` under `/api/v1/insights/…`.
3. Add hook in `ui/src/hooks/useZyraAiInsight.ts` and surface in a page or Spotlight command.

### Gateway proxy

`iris-gateway` resolves published apps from SQLite, blocks unready backends (502), and proxies to `{service}.{namespace}.svc.cluster.local`. Supports HTTP/1.1, HTTP/2 (gRPC), SSE, and WebSocket upgrade.

---

## UI development

See [ui.md](ui.md) for the Nebula design system, page primitives, and Zyra AI surfaces.

```bash
cd ui
npm ci
npm run dev          # Vite on :5173, proxies to :31847
npm run build        # → ui/dist/
npm run test:e2e     # Playwright smoke tests
```

Add a page:

1. Create `ui/src/pages/MyPage.tsx` using `PageFrame`.
2. Register route in `ui/src/App.tsx`.
3. Add navbar link in `IrisNavbar.tsx` if needed.
4. Add Playwright smoke test in `ui/tests/smoke.spec.ts`.

---

## Testing

| Layer | Command |
|-------|---------|
| Rust | `cargo test --workspace --locked` |
| Go | `go test ./...` |
| UI build | `cd ui && npm run build` |
| Local smoke | `./scripts/smoke-test.sh` |
| Playwright | `cd ui && npm run test:e2e` |
| Live deploy E2E | `./scripts/e2e-deploy-verify.sh http://host:31847` |
| Remote tiers | `make test-remote-smoke` / `test-remote-quick` / `test-remote-all` |

CI (`.github/workflows/ci.yml`): Rust test/clippy/fmt, Go test/vet, UI build, Helm lint.

---

## Troubleshooting

### Empty catalog

| Cause | Fix |
|-------|-----|
| Server only, no controller | Run `go run ./cmd/iris-seed` or `smoke-test.sh` |
| Controller not connected | Check `kubectl`, in-cluster SA, or `KUBECONFIG` |
| Namespace filter too narrow | Clear `IRIS_WATCH_NAMESPACES` |

### Gateway 403 / 502

| Code | Meaning |
|------|---------|
| 403 | App not published — publish via Discovery or `iris.zyvor.dev/published=true` |
| 502 | No ready endpoints — check Service/Endpoints in cluster |

### SQLite errors

Both processes must use the **same** `IRIS_DB_PATH`. WAL mode with 5s busy timeout is enabled on both sides.

### UI blank

Run `make build-ui` or set `IRIS_UI_DIR` to an existing `ui/dist/`.

### Zyra AI uses rules only

Check `GET /api/v1/insights/status`. Set `IRIS_LLM_*` or run `./scripts/setup-ollama-remote.sh` on deploy hosts.

### Debug commands

```bash
curl -sf http://localhost:31847/healthz
curl -s http://localhost:31847/api/v1/apps | jq .
curl -s http://localhost:31847/api/v1/insights/status | jq .

RUST_LOG=iris_server=debug,tower_http=debug cargo run -p iris-server

kubectl logs -n iris-system deploy/iris -c controller -f
kubectl logs -n iris-system deploy/iris -c server -f

sqlite3 /tmp/iris-smoke.db "SELECT id, display_name, status FROM apps;"
```

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [api.md](api.md) | HTTP route reference |
| [architecture.md](architecture.md) | High-level data flow |
| [ui.md](ui.md) | Nebula UI and Zyra AI |
| [annotations.md](annotations.md) | Service annotation reference |
| [install.md](install.md) | Helm install and operator config |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | PR workflow |
| [USER_STORIES.md](USER_STORIES.md) | Acceptance criteria |
