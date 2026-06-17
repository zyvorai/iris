# Hermes Documentation

The application operating layer for Kubernetes

## Start Here

| Goal | Document |
|------|----------|
| **Developer guide** | [development.md](development.md) |
| **API reference** | [api.md](api.md) |
| Architecture | [architecture.md](architecture.md) |
| Install | [install.md](install.md) |
| UI & Zeus AI | [ui.md](ui.md) |
| Annotations | [annotations.md](annotations.md) |
| **User journeys & acceptance criteria** | [User Stories](USER_STORIES.md) |
| Full product deep dive | [FULL_README_LEGACY.md](FULL_README_LEGACY.md) |
| Contributing | [../CONTRIBUTING.md](../CONTRIBUTING.md) |

## User Stories

Persona-based journeys with acceptance criteria and a validation matrix: **[USER_STORIES.md](USER_STORIES.md)**

| Persona | Focus |
|---------|-------|
| Alex (Developer) | Launch Grafana without kubectl port-forward |
| Morgan (Platform Team) | Auto-discover apps across namespaces |
| Jordan (Security) | Control which apps are exposed via gateway |

Stories cover discovery, launch, health, gateway exposure, publish workflow, Zeus AI, and federation.

## Zeus AI

Hermes ships fleet and per-app intelligence with LLM + rule-based fallback. Configure via `HERMES_LLM_*` env vars or `setup-ollama-remote.sh`. Full endpoint and Spotlight command reference: **[ui.md](ui.md#zeus-ai)**.

## Ecosystem

Part of the [Zyvor / HyperSDK platform stack](https://zyvor.dev):

| Product | Role |
|---------|------|
| **hypercluster** | Kubernetes bootstrap |
| **machina** | Bare-metal hypervisor OS |
| **zeus-os (v9s)** | Cloud / KubeVirt control plane |
| **hermes** | Application layer for K8s |
| **forge** | AI infrastructure on K8s |
| **hypersdk / hyper2kvm** | VM migration |
| **guestkit** | Offline VM assurance |
| **packetwolf** | Network intelligence |
| **Aether** | Runtime portability |
| **Veyron** | KubeVirt VM command center |
| **IronWolf** | Metal3 bare-metal automation |

See also: [../README.md](../README.md) · [../CHANGELOG.md](../CHANGELOG.md)
