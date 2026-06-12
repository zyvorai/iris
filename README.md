# Hermes

**Every service, one elegant doorway.**

Hermes is the Kubernetes app memory layer for Zeus OS. It discovers cluster services, organizes them into a beautiful app dock, and proxies HTTP/WebSocket traffic through stable URLs — no ports, no port-forwards, no tribal knowledge.

## What Hermes does

- Discovers Kubernetes Services via annotations and known-app signatures
- Publishes apps into **Hermes Dock** — a glass-style app launcher
- Proxies traffic at `/a/{namespace}/{slug}` with WebSocket support
- Tracks favorites, recents, and health status

## Quick start

```bash
# Build locally
make build

# Install into cluster
helm install hermes ./charts/hermes \
  -n hermes-system \
  --create-namespace \
  --set global.domain=zeus.local \
  --set ingress.host=hermes.zeus.local
```

Then open `https://hermes.zeus.local/`.

## Annotate a service

```yaml
metadata:
  annotations:
    hermes.zyvor.dev/enabled: "true"
    hermes.zyvor.dev/name: "Grafana"
    hermes.zyvor.dev/category: "Monitoring"
    hermes.zyvor.dev/icon: "grafana"
    hermes.zyvor.dev/port: "80"
```

See [docs/annotations.md](docs/annotations.md) for the full annotation reference.

## Components

| Component | Language | Role |
|-----------|----------|------|
| `hermes-controller` | Go | Service discovery, health polling |
| `hermes-server` | Rust | REST API, gateway proxy, embedded UI |
| Hermes Dock UI | React | App launcher |

## License

Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
