# Iris Documentation

The application operating layer for Kubernetes

## Start Here

| Goal | Document |
|------|----------|
| **Developer guide** | [development.md](development.md) |
| **API reference** | [api.md](api.md) |
| Architecture | [architecture.md](architecture.md) |
| Install | [install.md](install.md) |
| UI & Zyra AI | [ui.md](ui.md) |
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

Stories cover discovery, launch, health, gateway exposure, publish workflow, Zyra AI, and federation.

## Zyra AI

Iris ships fleet and per-app intelligence with LLM + rule-based fallback. Configure via `IRIS_LLM_*` env vars or `setup-ollama-remote.sh`. Full endpoint and Spotlight command reference: **[ui.md](ui.md#zyra-ai)**.

## Ecosystem

Part of the [Zyvor / Transiva platform stack](https://zyvor.dev):

| Product | Role |
|---------|------|
| **hypercluster** | Kubernetes bootstrap |
| **machina** | Bare-metal hypervisor OS |
| **zeus-os (v9s)** | Cloud / KubeVirt control plane |
| **iris** | Application layer for K8s |
| **forge** | AI infrastructure on K8s |
| **transiva / h2kvm** | VM migration |
| **guestkit** | Offline VM assurance |
| **packetwolf** | Network intelligence |
| **Axiom** | Runtime portability |
| **Veyron** | KubeVirt VM command center |
| **IronWolf** | Metal3 bare-metal automation |

See also: [../README.md](../README.md) · [../CHANGELOG.md](../CHANGELOG.md)
