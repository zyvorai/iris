# Hermes API Reference

HTTP surface for `hermes-server`. All paths are relative to the server origin (default `http://localhost:31847`).

**Auth:** When `HERMES_AUTH_MODE` is `api_key` or `oidc`, protected routes require a valid session cookie or `Authorization: Bearer <api_key>`. Public routes: `/healthz`, `/metrics`, `/auth/*`, `/api/v1/ws-echo`.

**Source:** Routes are registered in `crates/hermes-server/src/main.rs`, `crates/hermes-api/src/lib.rs`, `crates/hermes-gateway/src/lib.rs`, `crates/hermes-server/src/auth.rs`, and `crates/hermes-server/src/metrics.rs`.

---

## Public endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Liveness probe (200 OK) |
| GET | `/metrics` | Prometheus metrics (`hermes_apps_total`, audit counters, uptime) |
| GET | `/api/v1/ws-echo` | WebSocket echo test (upgrade + message echo) |

### Auth (`/auth/*`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/login` | Start OIDC login (redirect to IdP) |
| GET | `/auth/callback` | OIDC callback; sets session cookie |
| POST | `/auth/logout` | Clear session (204) |
| GET | `/auth/me` | Current user, auth mode, groups, workspaces, allowed actions |

---

## REST API (`/api/v1/*`)

All routes below require auth when auth mode is enabled.

### Apps & catalog

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/apps` | List all apps (RBAC/workspace filtered) |
| GET | `/api/v1/apps/{id}` | Get app by ID (`namespace/slug`) |
| GET | `/api/v1/apps/{id}/diagnosis` | Diagnosis chain (route lens, probe errors, suggestions) |
| GET | `/api/v1/apps/{id}/insight` | Zyra AI per-app insight |
| GET | `/api/v1/catalog` | Published catalog for current user |
| GET | `/api/v1/catalog/federated` | Merged catalog across federated clusters |
| GET | `/api/v1/catalog/export` | Download catalog as JSON |
| GET | `/api/v1/stats` | Catalog statistics (totals, published, recommended) |
| GET | `/api/v1/cluster/summary` | Cluster-level counts by status and visibility |
| GET | `/api/v1/clusters` | Local + federated cluster registry |
| GET | `/api/v1/graph` | Dependency graph (`nodes`, `edges`) |
| GET | `/api/v1/workspaces` | Workspace groupings |
| GET | `/api/v1/owners` | Team/owner groupings |
| GET | `/api/v1/health/apps` | Fleet health summary (healthy/degraded/broken counts) |

### Discovery & publishing

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/discovery` | Unpublished / discovery-queue apps |
| POST | `/api/v1/discovery/publish/{id}` | Publish single app (`namespace/slug`) |
| POST | `/api/v1/discovery/publish-namespace/{namespace}` | Bulk-publish all apps in namespace |
| POST | `/api/v1/discovery/hide/{id}` | Hide app from discovery queue |

### Search

| Method | Path | Query params | Description |
|--------|------|--------------|-------------|
| GET | `/api/v1/search` | `q`, `limit` | Full-text catalog search |
| GET | `/api/v1/search/intent` | `q`, `limit` | Rule-based intent parsing |
| GET | `/api/v1/search/llm` | `q`, `limit` | LLM-powered intent search (rules fallback) |

### Zyra AI insights

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/insights/status` | LLM availability (`defaultSource`: `rules` or `llm`) |
| GET | `/api/v1/insights/fleet` | Fleet-wide health summary and focus services |
| GET | `/api/v1/insights/discovery` | Ranked publish suggestions |
| GET | `/api/v1/insights/namespace/{namespace}` | Namespace health rollup |
| GET | `/api/v1/insights/graph` | Topology / dependency insight |
| GET | `/api/v1/insights/owner/{owner}` | Team ownership health rollup |
| GET | `/api/v1/insights/federated` | Cross-cluster federated insight |
| GET | `/api/v1/insights/activity` | Audit activity patterns |

Configure LLM via `HERMES_LLM_API_URL`, `HERMES_LLM_API_KEY`, `HERMES_LLM_MODEL`. See [ui.md](ui.md#zyra-ai).

### Federation (write)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/federation/publish/{cluster_id}/{id}` | Remote publish on federated cluster |
| POST | `/api/v1/federation/publish-namespace/{cluster_id}/{namespace}` | Remote bulk publish |
| PUT | `/api/v1/federation/recommended/{cluster_id}/{id}` | Set recommended flag remotely |
| GET | `/api/v1/federation/rbac/{cluster_id}` | Check RBAC on remote cluster |

Peers configured via `HERMES_FEDERATED_CLUSTERS` (JSON). See `charts/hermes/values.yaml` → `cluster.federated`.

### User preferences

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/favorites` | User favorites |
| PUT | `/api/v1/favorites/{id}` | Add favorite |
| DELETE | `/api/v1/favorites/{id}` | Remove favorite |
| GET | `/api/v1/recents` | Recently opened apps |
| POST | `/api/v1/recents/{id}` | Record app open |
| GET | `/api/v1/recommended` | Team-recommended apps |
| PUT | `/api/v1/recommended/{id}` | Set/unset recommended flag |

### Share links & audit

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/shares` | User's share links |
| POST | `/api/v1/shares` | Create time-limited share link (body: `appId`, `ttlHours`) |
| GET | `/api/v1/shares/all` | All share links (admin only) |
| DELETE | `/api/v1/shares/{token}` | Revoke share link |
| GET | `/api/v1/audit` | Local audit log (`?limit=`) |
| GET | `/api/v1/audit/federated` | Federated audit log (`?limit=`) |

---

## Gateway (reverse proxy)

Gateway routes accept **any HTTP method** and proxy to Kubernetes backend services. WebSocket upgrades, SSE, HTTP/2, and gRPC are supported.

**Requirements:** App must be **published** and have ready endpoints (otherwise 403 or 502).

### Launchpad prefix (preferred)

| Method | Path | Description |
|--------|------|-------------|
| ANY | `/launchpad/apps/{slug}` | Proxy by canonical slug (root) |
| ANY | `/launchpad/apps/{slug}/` | Same (trailing slash) |
| ANY | `/launchpad/apps/{slug}/{*rest}` | Proxy by canonical slug (subpath) |
| ANY | `/launchpad/a/{namespace}/{slug}` | Proxy by namespace + slug (root) |
| ANY | `/launchpad/a/{namespace}/{slug}/` | Same (trailing slash) |
| ANY | `/launchpad/a/{namespace}/{slug}/{*rest}` | Proxy by namespace + slug (subpath) |
| ANY | `/launchpad/s/{token}` | Share-link proxy (root) |
| ANY | `/launchpad/s/{token}/` | Same (trailing slash) |
| ANY | `/launchpad/s/{token}/{*rest}` | Share-link proxy (subpath) |

The gateway also:

- Forwards the request query string
- Rewrites `Location` / `Refresh` redirects under the app mount
- Scopes `Set-Cookie` `Path` to the mount
- Sets `X-Forwarded-Proto` / `Host` / `Prefix` from the client request (not hardcoded HTTPS)
- Honors `rewrite.addPrefix` when `hermes.zyvor.dev/serve-from-sub-path=true`

### Legacy aliases (same handlers)

| Method | Path |
|--------|------|
| ANY | `/apps/{slug}` |
| ANY | `/apps/{slug}/{*rest}` |
| ANY | `/a/{namespace}/{slug}` |
| ANY | `/a/{namespace}/{slug}/{*rest}` |
| ANY | `/s/{token}` |
| ANY | `/s/{token}/{*rest}` |

Gateway records audit events (`launch`, `share_access`) on successful proxy.

---

## SPA fallback

Unmatched paths serve static files from `HERMES_UI_DIR` (`ui/dist/`). Unknown routes return `index.html` for client-side routing.

---

## Examples

```bash
BASE=http://localhost:31847

# Health & catalog
curl -s "$BASE/healthz"
curl -s "$BASE/api/v1/apps" | jq '.[0]'
curl -s "$BASE/api/v1/catalog" | jq 'length'

# Search
curl -s "$BASE/api/v1/search?q=grafana" | jq .
curl -s "$BASE/api/v1/search/llm?q=unhealthy+apps" | jq .

# Zyra AI
curl -s "$BASE/api/v1/insights/status" | jq .
curl -s "$BASE/api/v1/insights/fleet" | jq .
curl -s "$BASE/api/v1/apps/monitoring/grafana/insight" | jq .

# Publish from discovery
curl -s -X POST "$BASE/api/v1/discovery/publish/monitoring/grafana"

# Gateway (published app)
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/a/monitoring/grafana"

# With API key auth
curl -s -H "Authorization: Bearer $HERMES_API_KEY" "$BASE/api/v1/apps"
```

Post-deploy verification: `./scripts/e2e-deploy-verify.sh http://host:31847` exercises most endpoints.

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [development.md](development.md) | Local dev, extending routes |
| [architecture.md](architecture.md) | Data flow and security defaults |
| [ui.md](ui.md) | UI integration and Spotlight commands |
| [annotations.md](annotations.md) | Service metadata for discovery |
