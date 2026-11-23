# Application-operations research

Survey of the application-operations layer for Kubernetes, and what it means for Iris.
Facts marked **[U]** were not read from a fetched page in this research pass (they come from
prior knowledge and should be re-verified before being relied on). Everything else was read
from the linked page.

## What others do

| Project | What it does | Source |
|---------|--------------|--------|
| Argo CD | Per-resource health (Healthy, Progressing, Degraded, Suspended, Missing, Unknown); an Application takes the **worst** child status; custom Lua health checks; `ignore-healthcheck` annotation to exclude a child. ApplicationSet Progressive Syncs (RollingSync) gate stages on Healthy, still alpha. | https://argo-cd.readthedocs.io/en/stable/operator-manual/health/ , https://argo-cd.readthedocs.io/en/release-3.1/operator-manual/applicationset/Progressive-Syncs/ |
| Flux | `Kustomization.dependsOn` applies a unit only after dependencies are Ready, optional CEL `readyExpr`; `healthChecks`/`wait`; drift detection by server-side-apply dry-run each interval; per-object `ssa` policy (Override, Merge, IfNotPresent, Ignore); `spec.ignore` paths. Cycles are documented as never applying. | https://fluxcd.io/flux/components/kustomize/kustomizations/ |
| Backstage | Software catalog descriptor: `owner` and `lifecycle` required, `system`, `dependsOn`, `providesApis/consumesApis`; relations are derived and are the authoritative read model; owner is display-only, not authorization. | https://backstage.io/docs/features/software-catalog/descriptor-format |
| Score | Workload spec independent of platform: containers, service ports, named `resources` resolved by the implementation; dependencies are `${resources.X.out}` placeholders provisioned as an acyclic graph. | https://docs.score.dev/docs/score-specification/score-spec-reference/ |
| KubeVela / OAM | Application = components + traits + policies + workflow steps (CUE), Helm/Terraform as components. Component `dependsOn` and trait details not confirmed on the fetched page. | https://kubevela.io/docs/ |
| Keptn | Application lifecycle orchestration, deployment validation, metrics; KeptnApp-level pre/post checks. Details not on fetched landing page **[U]**. | https://keptn.sh/stable/docs/ |
| Helm / Kustomize | Packaging and overlay; Helm `dependencies`, hooks, and release history **[U]**. | - |
| Crossplane | Compositions that turn a claim into managed resources, with Ready/Synced conditions rolled up **[U]**. | - |
| Kratix | Promise-based platform APIs; requests fulfilled by pipelines **[U]**. | - |
| Radius | Application graph as a first-class resource, recipes for infrastructure **[U]**. | - |
| Humanitec | Score-driven orchestrator; environment types and resource graphs **[U]**. | - |
| Porter | Cloud-native application bundles (CNAB) **[U]**. | - |
| Knative | Serverless serving with revisions and traffic splitting **[U]**. | - |
| Argo Rollouts / Flagger | Progressive delivery with analysis gates **[U]**. | - |
| Kyverno / OPA Gatekeeper | Admission-time policy attached to resources; policy reports as CRDs **[U]**. | - |

## What Iris has and lacks

Iris discovers Services into a catalog, health-probes them, shows a dependency graph from
`dependsOn`, and publishes selected apps through a gateway. Before this work it:

- drew dependency edges but never **propagated health along them** (a healthy app whose database is broken showed healthy);
- never reported **blast radius** (what breaks if X fails) or **dependency cycles**;
- had no **metadata policy**: no way to see which apps lack an owner/environment, in the Backstage sense;
- has no drift detection, environment promotion, SLO model or cost labels.

## Ranked ideas

1. **Dependency health propagation and blast radius** (built). Argo CD aggregates worst-of, Flux gates on dependency Ready, Score/Flux both require acyclic graphs. Cheap, pure function over the existing catalog, and directly answers "what is actually affected".
2. **Catalog conformance report** (built). Backstage requires owner/lifecycle; Kyverno/OPA attach policy to resources. Read-only, configurable (`IRIS_CONFORMANCE_REQUIRE`), reuses idea 1 for cycle and unresolved-dependency findings.
3. **Environment promotion diff**: compare the same app across `meta.environment` values (image, ports, replicas) as Flux/Argo promotion tooling does. Needs controller changes to record more spec data; not testable headlessly with the current model. Rejected for now.
4. **Drift detection**: needs live cluster server-side-apply dry-run (Flux) or a GitOps source of truth; out of scope for a discovery-based catalog. Rejected.
5. **SLO / error-budget health model** (Keptn/Sloth style) needs a metrics backend; rejected until Iris has one.
6. **Ownership/cost labels**: ownership done by idea 2; cost needs a billing source (OpenCost) **[U]**; deferred.
7. **Progressive-sync style gating on health**: Iris does not deploy, so not applicable.
