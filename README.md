# Hermes

**Application Operating Layer for Kubernetes**

Built by [Zyvor Labs](https://zyvor.dev) — auto-discovers every service on your cluster, surfaces LLM-powered insights, and gives teams a shared launchpad. No manual inventory, no YAML registration.

---

## Features

- **Auto-discovery** — Deployments, StatefulSets, DaemonSets, Ingresses, Gateway API, service mesh endpoints
- **Shared launchpad** — team-facing portal with health status, links, and documentation
- **Zeus AI** — LLM-powered insights: ask "what is unhealthy?" in plain text
- **RBAC workspaces** — scope teams to namespaces they own
- **Multi-cluster federation** — federate across dev, staging, and prod clusters
- **4 auth modes** — none, API key, OIDC, trust-header federation
- **40+ REST endpoints** — full API, OpenAPI spec included
- **Persistent catalog** — SQLite-backed store for discovered apps, share links, AI summaries

---

## Quick Install (30-day free trial — no sign-up required)

**Prerequisites:** Kubernetes 1.28+, Helm 3.8+

```bash
helm install hermes oci://ghcr.io/hypersdk/charts/hermes \
  --version 0.2.0 \
  --namespace hermes-system \
  --create-namespace
```

Wait for the pod:

```bash
kubectl -n hermes-system rollout status deployment/hermes
```

UI and API at **`http://<node-ip>:31847`**

---

## Install with LLM (Zeus AI)

```bash
kubectl create secret generic hermes-llm \
  --from-literal=apiKey="sk-..." \
  -n hermes-system

helm install hermes oci://ghcr.io/hypersdk/charts/hermes \
  --version 0.2.0 \
  --namespace hermes-system \
  --create-namespace \
  --set server.llm.apiUrl="https://api.openai.com/v1" \
  --set server.llm.existingSecret="hermes-llm" \
  --set server.llm.model="gpt-4o-mini"
```

---

## Apply a Licence Key (after trial)

```bash
kubectl create secret generic hermes-license \
  --from-literal=license.key="<your-key>" \
  -n hermes-system

helm upgrade hermes oci://ghcr.io/hypersdk/charts/hermes \
  --version 0.2.0 \
  --reuse-values \
  --set license.existingSecret="hermes-license" \
  -n hermes-system
```

Contact [sales@zyvor.dev](mailto:sales@zyvor.dev) for a commercial licence.

---

## Documentation

- [Full docs & quickstart](https://zyvor.dev/docs/hermes)
- [Product page](https://zyvor.dev/hermes)
- [After-trial upgrade guide](docs/AFTER-TRIAL.md)

---

*Hermes is proprietary software. Source code is not public. Binaries distributed via OCI Helm charts.*
