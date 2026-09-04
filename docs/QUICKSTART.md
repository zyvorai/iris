# Hermes Quickstart

## 1. Install

```bash
helm install hermes oci://ghcr.io/zyvorai/charts/hermes \
  --version 0.2.0 \
  --namespace hermes-system \
  --create-namespace
```

## 2. Verify

```bash
kubectl -n hermes-system get pods
kubectl -n hermes-system rollout status deployment/hermes
```

## 3. Open the UI

Visit `https://<node-ip>:31847` — Hermes auto-discovers all services on your cluster. Use https (self-signed by default); accept the browser trust warning.

## 4. Enable Zyra AI (optional)

```bash
kubectl create secret generic hermes-llm --from-literal=apiKey="sk-..." -n hermes-system
helm upgrade hermes oci://ghcr.io/zyvorai/charts/hermes --reuse-values \
  --set server.llm.apiUrl="https://api.openai.com/v1" \
  --set server.llm.existingSecret="hermes-llm" \
  --set server.llm.model="gpt-4o-mini" -n hermes-system
```

## 5. Next steps

- Enable authentication before exposing Hermes on the public internet (`server.auth.mode`).
- See [docs/development.md](development.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).
- Hermes is licensed under Apache License 2.0 — see [LICENSE](../LICENSE).
