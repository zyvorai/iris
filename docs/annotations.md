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

When `slug` is set, Hermes exposes a stable public URL at `/apps/{slug}` in addition to the namespace-scoped route `/a/{namespace}/{service-slug}`.

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
