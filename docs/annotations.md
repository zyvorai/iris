# Hermes annotations

Prefix: `hermes.zyvor.dev/`

| Annotation | Required | Description |
|------------|----------|-------------|
| `enabled` | yes | `"true"` to register the service |
| `name` | no | Display name (defaults to service name) |
| `description` | no | Card description |
| `icon` | no | Icon key (`grafana`, `prometheus`, etc.) |
| `category` | no | Catalog category |
| `port` | no | Service port to proxy (defaults to first HTTP port) |
| `scheme` | no | `http` or `https` (default `http`) |
| `path` | no | Backend path prefix (default `/`) |
| `auth` | no | Auth mode hint (`none`, `sso`) |
| `published` | no | `"true"` to publish immediately |

Example:

```yaml
metadata:
  annotations:
    hermes.zyvor.dev/enabled: "true"
    hermes.zyvor.dev/name: "Grafana"
    hermes.zyvor.dev/category: "Monitoring"
    hermes.zyvor.dev/port: "80"
```
