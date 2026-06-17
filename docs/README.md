# hermes Documentation

The application operating layer for Kubernetes

## Start Here

| Goal | Document |
|------|----------|
| Architecture | [architecture.md](architecture.md) |
| Install | [install.md](install.md) |
| UI guide | [ui.md](ui.md) |
| Annotations | [annotations.md](annotations.md) |
| **User journeys & acceptance criteria** | [User Stories](USER_STORIES.md) |

## User Stories

Persona-based journeys with acceptance criteria: **[USER_STORIES.md](USER_STORIES.md)**

| Persona | Focus |
|---------|-------|
| Alex (Developer) | Launch Grafana without kubectl port-forward |
| Morgan (Platform Team) | Auto-discover apps across namespaces |
| Jordan (Security) | Control which apps are exposed via gateway |

## Ecosystem

Part of the [Zyvor / HyperSDK platform stack](https://zyvor.dev):

| Product | Role |
|---------|------|
| **hypercluster** | Kubernetes bootstrap |
| **machina** | Bare-metal hypervisor OS |
| **zeus-os (v9s)** | Cloud / KubeVirt control plane |
| **forge** | AI infrastructure on K8s |
| **hypersdk / hyper2kvm** | VM migration |
| **guestkit** | Offline VM assurance |
| **packetwolf** | Network intelligence |
| **Aether** | Runtime portability |
| **hermes** | Application layer for K8s |

See also: [../README.md](../README.md)
