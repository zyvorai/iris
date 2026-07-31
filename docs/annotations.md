# Hermes annotations

Prefix: `hermes.zyvor.dev/`

| Annotation | Required | Description |
|------------|----------|-------------|
| `enabled` | yes | `"true"` to register the service |
| `name` | no | Display name (defaults to service name) |
| `slug` | no | Canonical gateway slug (e.g. `grafana` → `/apps/grafana`) |
| `environment` | no | Environment label (`production`, `staging`, `development`) |
| `owner` | no | Team or owner (shown in catalog and search) |
| `depends-on` | no | Comma-separated dependency slugs (e.g. `prometheus,loki`) |
| `recommended` | no | `"true"` to surface in Team picks on Home |
| `description` | no | Card description |
| `icon` | no | Icon key (`grafana`, `prometheus`, etc.) |
| `category` | no | Catalog category |
| `port` | no | Service port to proxy (defaults to first HTTP port) |
| `scheme` | no | `http` or `https` (default `http`) |
| `path` | no | Backend path prefix (default `/`) |
| `auth` | no | Auth mode hint (`none`, `sso`) |
| `published` | no | `"true"` to publish immediately |
| `serve-from-sub-path` | no | `"true"` when the backend expects the full public mount path (Grafana `GF_SERVER_SERVE_FROM_SUB_PATH`, apps with a non-root `--web.route-prefix`, etc.). Sets gateway `rewrite.addPrefix` to the app route. |

When `slug` is set, Hermes exposes a stable public URL at `/apps/{slug}` in addition to the namespace-scoped route `/a/{namespace}/{service-slug}`.

### Path rewrite modes

- **Default (Mode A):** the gateway strips the launchpad mount and forwards `/…` to the backend. Use with apps that live at `/` (Prometheus with `--web.route-prefix=/`).
- **Subpath (Mode B):** set `serve-from-sub-path: "true"`. The gateway re-attaches `routePath` so the backend sees `/launchpad/a/{ns}/{slug}/…`. Required for Grafana with `GF_SERVER_SERVE_FROM_SUB_PATH=true`.

If `environment` is omitted, Hermes infers it from the namespace name (`*-prod`, `staging`, `dev`, etc.).

Example:

```yaml
metadata:
  annotations:
    hermes.zyvor.dev/enabled: "true"
    hermes.zyvor.dev/name: "Grafana"
    hermes.zyvor.dev/slug: "grafana"
    hermes.zyvor.dev/environment: "production"
    hermes.zyvor.dev/owner: "platform-team"
    hermes.zyvor.dev/depends-on: "prometheus"
    hermes.zyvor.dev/recommended: "true"
    hermes.zyvor.dev/category: "Monitoring"
    hermes.zyvor.dev/port: "80"
```
