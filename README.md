<div align="center">

# Hermes

### Application Operating Layer for Kubernetes

[![Helm OCI](https://img.shields.io/badge/helm-oci%3A%2F%2Fghcr.io%2Fhypersdk-blue?logo=helm&logoColor=white)](https://github.com/hypersdk/hermes)
[![Version](https://img.shields.io/badge/version-0.2.0-blue)](https://github.com/hypersdk/hermes)
[![Trial](https://img.shields.io/badge/trial-30%20days%20free-green)](https://zyvor.dev/hermes)
[![License](https://img.shields.io/badge/license-proprietary-red)](https://zyvor.dev/contact)
[![Platform](https://img.shields.io/badge/Kubernetes-1.28%2B-326CE5?logo=kubernetes)](https://zyvor.dev/docs/hermes)

**[Website](https://zyvor.dev/hermes)** · **[Docs](https://zyvor.dev/docs/hermes)** · **[Contact Sales](mailto:sales@zyvor.dev)**

</div>

---

## What is Hermes?

Hermes is an **application operating layer** for Kubernetes — it auto-discovers every service on your cluster, builds a living catalog, and gives every team a shared launchpad to access what they own.

No more "where does the staging API live?" No more manual inventory spreadsheets. Hermes watches your cluster and keeps the catalog current — with Zeus AI to explain what's unhealthy and why.

---

## The Problem it Solves

| Before Hermes | After Hermes |
|---------------|-------------|
| Teams hunt Confluence for service URLs | Single launchpad — auto-discovered, always current |
| Ops manually updates the service list | Controller watches every namespace, no registration needed |
| Incidents start with "what's even running?" | Zeus AI answers in plain text: "3 services are unhealthy because..." |
| Dev can see prod services they shouldn't | RBAC workspaces scope teams to their namespaces |
| 4 separate clusters, 4 separate contexts | Federation: one UI across dev, staging, and prod |

---

## How it Works

```
Kubernetes cluster                    Hermes
────────────────────    auto-detect   ──────────────────────
Deployments         ──────────────▶  Service catalog
StatefulSets        ──────────────▶  Health status
Ingresses           ──────────────▶  Public URLs
Gateway API routes  ──────────────▶  Routing map
Service mesh        ──────────────▶  Dependency graph
                                      │
                                      ▼
                                     Web UI (port 31847)
                                     REST API (40+ routes)
                                     Zeus AI assistant
```

---

## Install in 30 Seconds — No Account Required

> The 30-day trial is baked into the binary at build time. No key, no sign-up, no credit card.

**Prerequisites:** Kubernetes 1.28+, Helm 3.8+

```bash
helm install hermes oci://ghcr.io/hypersdk/charts/hermes \
  --version 0.2.0 \
  --namespace hermes-system \
  --create-namespace
```

```bash
# Wait for startup
kubectl -n hermes-system rollout status deployment/hermes

# Open the launchpad
open http://$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[0].address}'):31847
```

Hermes starts discovering services immediately. Refresh after ~30 seconds.

---

## Add Zeus AI (optional)

```bash
# Store your LLM API key
kubectl create secret generic hermes-llm \
  --from-literal=apiKey="sk-..." \
  -n hermes-system

helm upgrade hermes oci://ghcr.io/hypersdk/charts/hermes \
  --version 0.2.0 --reuse-values \
  --set server.llm.apiUrl="https://api.openai.com/v1" \
  --set server.llm.existingSecret="hermes-llm" \
  --set server.llm.model="gpt-4o-mini" \
  -n hermes-system
```

Ask Zeus: *"What services restarted in the last hour?"* or *"Which teams have services without health checks?"*

Also works with **Ollama** (self-hosted) and **OpenRouter** — any OpenAI-compatible endpoint.

---

## Auth Modes

```bash
# API key auth
helm upgrade hermes ... \
  --set server.auth.mode=api_key \
  --set server.auth.apiKey="my-secure-key"

# OIDC (Google, Okta, Keycloak)
helm upgrade hermes ... \
  --set server.auth.mode=oidc \
  --set server.auth.oidc.issuer="https://accounts.google.com" \
  --set server.auth.oidc.clientId="<id>" \
  --set server.auth.oidc.clientSecret="<secret>"
```

---

## Multi-Cluster Federation

```bash
# On the hub cluster
helm upgrade hermes ... \
  --set 'cluster.federated[0].id=prod' \
  --set 'cluster.federated[0].name=Production' \
  --set 'cluster.federated[0].url=http://hermes.prod.example.com:31847' \
  --set server.federation.trustHeaders=true
```

One UI across all your clusters. Share links work cross-cluster.

---

## Apply a Licence Key (after trial)

```bash
kubectl create secret generic hermes-license \
  --from-literal=license.key="<your-key>" \
  -n hermes-system

helm upgrade hermes oci://ghcr.io/hypersdk/charts/hermes \
  --version 0.2.0 --reuse-values \
  --set license.existingSecret="hermes-license" \
  -n hermes-system
```

Contact **[sales@zyvor.dev](mailto:sales@zyvor.dev)** for a commercial licence.

---

## Suite Context

- **[Veyron](https://github.com/hypersdk/veyron)** — KubeVirt VM management (Hermes discovers VM workloads too)
- **[Ragnarok](https://github.com/hypersdk/ragnarok)** — AI operations (Ragnarok's agents surface via Hermes launchpad)
- **[Forge](https://github.com/hypersdk/forge)** — GPU cluster (Hermes catalogs GPU inference endpoints)

---

<div align="center">

**Built by [Zyvor Labs](https://zyvor.dev)**

[Website](https://zyvor.dev) · [Docs](https://zyvor.dev/docs/hermes) · [Contact](mailto:sales@zyvor.dev)

*Hermes is proprietary software. Source code is not public. Binaries are distributed via OCI Helm charts.*

</div>
