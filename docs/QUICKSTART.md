# Iris Quickstart

## 1. Install

```bash
helm install iris oci://ghcr.io/zyvorai/charts/iris \
  --version 0.2.0 \
  --namespace iris-system \
  --create-namespace
```

## 2. Verify

```bash
kubectl -n iris-system get pods
kubectl -n iris-system rollout status deployment/iris
```

## 3. Open the UI

Visit `https://<node-ip>:31847` — Iris auto-discovers all services on your cluster. Use https (self-signed by default); accept the browser trust warning.

## 4. Enable Zyra AI (optional)

```bash
kubectl create secret generic iris-llm --from-literal=apiKey="sk-..." -n iris-system
helm upgrade iris oci://ghcr.io/zyvorai/charts/iris --reuse-values \
  --set server.llm.apiUrl="https://api.openai.com/v1" \
  --set server.llm.existingSecret="iris-llm" \
  --set server.llm.model="gpt-4o-mini" -n iris-system
```

## 5. Next steps

- Enable authentication before exposing Iris on the public internet (`server.auth.mode`).
- See [docs/development.md](development.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).
- Iris is licensed under Apache License 2.0 — see [LICENSE](../LICENSE).
