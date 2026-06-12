# Install Hermes

Hermes indexes all cluster services by default (`controller.discoverAll: true`). Annotated and signature-matched applications receive richer metadata; everything else appears in the Cluster and Discovery views.

```bash
helm install hermes ./charts/hermes \
  -n hermes-system \
  --create-namespace \
  --set global.domain=zeus.local \
  --set ingress.host=hermes.zeus.local
```

## Prerequisites

- Kubernetes 1.28+
- Helm 3
- Ingress controller (optional but recommended)

## Annotate services

Apply examples:

```bash
kubectl apply -f examples/grafana-service-annotated.yaml
kubectl apply -f examples/prometheus-service-annotated.yaml
```

Hermes controller discovers annotated services and writes them to the shared SQLite catalog.

## Local development

```bash
make build
./scripts/smoke-test.sh
```

Open http://localhost:8080

## Configuration

| Variable | Component | Description |
|----------|-----------|-------------|
| `HERMES_DB_PATH` | both | SQLite path (default `/data/hermes/hermes.db`) |
| `HERMES_PUBLIC_BASE_URL` | controller | Public URL prefix for app links |
| `HERMES_AUTO_PUBLISH` | controller | Auto-publish annotated services |
| `HERMES_AUTO_SUGGEST` | controller | Suggest known apps without annotation |
| `HERMES_DISCOVER_ALL` | controller | Index all eligible cluster services (default `true`) |
| `HERMES_BIND` | server | Listen address (default `0.0.0.0:8080`) |
