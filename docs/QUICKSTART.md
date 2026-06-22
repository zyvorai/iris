# Hermes Quickstart

## 1. Install

```bash
helm install hermes oci://ghcr.io/hypersdk/charts/hermes \
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

Visit `http://<node-ip>:31847` — Hermes auto-discovers all services on your cluster.

## 4. Enable Zeus AI (optional)

```bash
kubectl create secret generic hermes-llm --from-literal=apiKey="sk-..." -n hermes-system
helm upgrade hermes oci://ghcr.io/hypersdk/charts/hermes --reuse-values \
  --set server.llm.apiUrl="https://api.openai.com/v1" \
  --set server.llm.existingSecret="hermes-llm" \
  --set server.llm.model="gpt-4o-mini" -n hermes-system
```

## 5. After the 30-day trial

Contact [sales@zyvor.dev](mailto:sales@zyvor.dev)
