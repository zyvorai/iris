# Install Iris

Iris indexes all cluster services by default (`controller.discoverAll: true`). Annotated and signature-matched applications receive richer metadata; everything else appears in the Cluster and Discovery views.

```bash
helm install iris ./charts/iris \
  -n iris-system \
  --create-namespace \
  --set global.domain=zeus.local \
  --set ingress.host=iris.zeus.local
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

Iris controller discovers annotated services and writes them to the shared SQLite catalog.

## Local development

```bash
make build
./scripts/smoke-test.sh
```

Open http://localhost:31847

Full developer guide: [development.md](development.md) · API reference: [api.md](api.md)

## Configuration

| Variable | Component | Description |
|----------|-----------|-------------|
| `IRIS_DB_PATH` | both | SQLite path (default `/data/iris/iris.db`) |
| `IRIS_PUBLIC_BASE_URL` | controller | Public URL prefix for app links |
| `IRIS_AUTO_PUBLISH` | controller | Auto-publish annotated services |
| `IRIS_AUTO_SUGGEST` | controller | Suggest known apps without annotation |
| `IRIS_DISCOVER_ALL` | controller | Index all eligible cluster services (default `true`) |
| `IRIS_DISCOVER_INGRESS` | controller | Discover apps from Ingress hosts (default `true`) |
| `IRIS_BIND` | server | Listen address (default `0.0.0.0:31847`) |
| `IRIS_AUTH_MODE` | server | `none`, `api_key`, or `oidc` |
| `IRIS_API_KEY` | server | API key when auth mode is `api_key` |
| `IRIS_OIDC_ISSUER` | server | OIDC issuer URL (e.g. Keycloak realm) |
| `IRIS_OIDC_CLIENT_ID` | server | OIDC client id |
| `IRIS_OIDC_CLIENT_SECRET` | server | OIDC client secret (optional for public clients) |
| `IRIS_OIDC_REDIRECT_URL` | server | Callback URL (e.g. `https://iris.company.com/auth/callback`) |
| `IRIS_SESSION_SECRET` | server | HMAC secret for session cookies |
| `IRIS_DISCOVER_GATEWAY_API` | controller | Discover apps from Gateway API HTTPRoutes (default `true`) |
| `IRIS_ALLOWED_NAMESPACES` | server | Comma-separated namespace filter for API/gateway (optional) |
