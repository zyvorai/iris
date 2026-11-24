# Changelog

All notable changes to Iris are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Maturity scorecard** — `GET /api/v1/scorecard` grades published apps gold/silver/bronze/none from conformance findings and lists next steps (modelled on Cortex/OpsLevel service maturity levels)
- **Stale app report** — `GET /api/v1/stale?days=` lists apps the controller has not refreshed
- **CSV catalog export** — `GET /api/v1/catalog/export?format=csv` (formula-injection safe)
- **Per-app Prometheus series** — `iris_app_status` and `iris_app_conformance_score` on `/metrics`
- `Store::upsert_app`; first handler-level tests for iris-api and `/metrics`
- **Dependency impact analysis** — `GET /api/v1/impact` propagates degraded/broken health along `dependsOn` (effective status, `blockedBy`), reports transitive blast radius and dependency cycles; `?app=` gives upstream/downstream lists. Bounded: 2000 apps, 64 deps per app, 20000 edges, 253-char references. Surfaced on the Graph page.
- **Catalog conformance report** — `GET /api/v1/conformance` scores published apps against `IRIS_CONFORMANCE_REQUIRE` (owner, environment, description) plus no-ready-endpoints, dependency-cycle and unresolved-dependency rules; `owner`/`namespace` filters.
- [docs/RESEARCH.md](docs/RESEARCH.md) — application-operations landscape survey and ranked ideas

### Dependency upgrades
- Round 2: `cargo update` (hyper 1.13; all other Rust deps already at latest majors), Go indirect bumps (kube-openapi still pinned), `@tanstack/react-query` 5.108.4
- Rust: `cargo update`; majors rusqlite 0.32→0.43, tower-http 0.6→0.7, reqwest 0.12→0.13 (kept the ring provider: `rustls-no-provider` + `webpki-roots`, no aws-lc), tokio-tungstenite 0.29→0.30, axum-extra 0.10→0.12, axum-server 0.8→0.9, jsonwebtoken 9→12 (`rust_crypto` backend, key constructors now return `Result`), rand 0.8→0.10 (`rand::rng`)
- Go: `go get -u`; client-go/api/apimachinery 0.31→0.37, gateway-api 1.2→1.7, modernc sqlite 1.34→1.63; `go` directive 1.23→1.27. Held back: `k8s.io/kube-openapi` pinned to 20260721 (newest revision pulls structured-merge-diff/v7, which breaks apimachinery 0.37.2)
- UI: vite 6→8, @vitejs/plugin-react 4→6, typescript 5→7 (no typescript-eslint in this repo, so no peer-range block), lucide-react 0.511→1.x, plus react/react-query/react-router/playwright minors
- Docker/CI: golang 1.27-alpine, alpine 3.24, node 24-alpine, rust 1.100 on trixie, debian trixie-slim; actions checkout/setup-go/setup-node v7, setup-helm v5, buildx v4, login v4, build-push v7. Unverified and left alone: `dtolnay/rust-toolchain@stable`, `Swatinem/rust-cache@v2`
- Held back: demo images `grafana/grafana:11.3.0` (13.x exists) and `prom/prometheus:v2.55.1` (v3.x exists), because their runtime behaviour cannot be tested without containers

### Changed
- **Renamed project from Hermes to Iris** — binaries (`iris-server`, `iris-controller`), crates, Helm chart (`charts/iris`), Go module (`github.com/zyvorai/iris`), env vars (`IRIS_*`), annotations (`iris.zyvor.dev/*`), and default namespace (`iris-system`). No Hermes aliases retained.
- Relicensed Iris under **Apache License 2.0** (see `LICENSE`, `NOTICE`); removed proprietary/trial license wiring from the Helm chart and docs
- Scrubbed lab IP / default SSH user defaults from Makefile and deploy scripts; require explicit host/user
- README install path documents build-from-source / local chart install for open source use

### Added
- `SECURITY.md`, `CODE_OF_CONDUCT.md`, GitHub issue/PR templates
- Font OFL notice under `ui/public/fonts/OFL.txt`
- [docs/development.md](docs/development.md) — developer guide (repo map, local dev, extending controller/API/UI)
- [docs/api.md](docs/api.md) — HTTP route reference for REST, gateway, auth, and insights
- `Dockerfile.seed` — enables `docker compose` local dev without a cluster

## [0.2.0] — 2026-06-17

### Added
- **Zeus AI insights** — `/api/v1/apps/{id}/insight` and `/api/v1/insights/fleet` with LLM + rule-based fallback
- `ZeusAiPanel` on Home and Health; Diagnose drawer and inspector AI tab use context-aware insight
- Spotlight natural-language queries route through `/search/llm` (richer catalog context, fixed `appIds` parsing)
- Ask Zeus AI opens inspector directly on the AI tab
- Spotlight `diagnose <app>` shows Zeus AI insight preview; `explain` surfaces fleet summary with focus services
- Graph page Zeus AI focus chips and Activity fleet insight banner
- Playwright smoke tests for Spotlight explain/diagnose and Graph/Activity AI surfaces
- Discovery and namespace insight APIs; AI on Cluster, Discovery, Catalog filters, Federated, and Health attention queue
- Spotlight `why`, `suggest publish`, and `ns insight` commands; navbar health chip links to Health with AI tooltip
- Graph topology and owner team insight APIs with Spotlight commands; per-app Zeus AI on app detail; focus chips on Home/Health
- AI status endpoint, navbar Rules/AI badge, Ask Zeus hero button, and Spotlight seed context
- Helm LLM Kubernetes secret, deploy/configure-llm-remote scripts, Spotlight `ai status`, Health Ask Zeus
- Federated and activity Zeus AI insight APIs, Discovery Publish Zeus picks, Spotlight federation/activity commands
- LLM connectivity probe on `/insights/status`, Ask Zeus on Cluster/Discovery/Graph/Apps, insight panel refresh
- Teams owner insight panel, Graph ZeusAiPanel upgrade, Federated/Activity Ask Zeus + refresh
- `setup-ollama-remote.sh` — installs Ollama on the deploy host (0.0.0.0 bind) and configures Iris for k3s pod reachability

- True-empty vs filter-empty states on Catalog and Cluster pages with distinct CTAs
- Mobile toolbar stacking (`.page-toolbar-stacked`), category chip scroll shell, cluster export in `ActionMenu`
- Command palette pending row while search / AI / intent queries load
- Playwright smoke tests: health attention queue, discovery page, diagnose drawer, mobile toolbar overflow
- **Nebula UX overhaul** — unified Liquid Glass design system (`nebula-tokens`, `nebula-layout`, `nebula-components`, `axiom-bridge`)
- Shared page primitives: `PageFrame`, `PageLoading`, `PageLoadError`, `EmptyState`, `ContextBanner`, `PageToolbar`
- `HomeFleetSnapshot` — 3-metric home strip (Discovered, Published, Needs attention)
- `serviceActions.ts` — shared Open/Diagnose/Publish/copy menu for `AppCard` and `ServiceCard`
- `formatStatusMessage()` — human-readable health probe summaries with optional technical details
- `RouteDisplay` — styled launchpad paths and public URLs with copy on app detail
- Collapsible namespace groups on Cluster page (auto-expand when namespace has unhealthy services)
- Compact workspace switcher dropdown below 900px viewport
- Playwright smoke tests for skeleton loading, catalog/cluster toolbars, mobile layout
- [docs/ui.md](docs/ui.md) — UI architecture and development guide
- Axiom-style two-row top navbar replacing the three-panel left-rail shell
- `IrisNavbar` component with health chip, spotlight, refresh, help dropdown, and mobile drawer
- Blue primary color scheme (`#3B82F6`) aligned with Axiom design language
- Glass-morphism body background with blue/purple radial gradients
- GitHub Actions CI workflow (Rust, Go, UI, Helm lint)
- Network policy Helm template to restrict pod-to-pod traffic
- `LICENSE` (MIT), `.env.example`, `CHANGELOG.md`, `docker-compose.yml`
- `count_audit()` on `Store` — eliminates the full-table scan on every `/metrics` scrape
- Graceful shutdown via `tokio::signal` — drains in-flight proxy connections on SIGTERM
- OIDC pending-states expiry — state tokens now expire after 5 minutes, preventing unbounded memory growth
- Warning log when the default dev session secret is in use

### Fixed
- Teams page now waits for catalog before rendering owner app grids
- Federated page handles clusters query loading/error via `PageFrame`
- Activity page surfaces share-admin API failures with a muted banner
- App graph panel shows inline skeleton while graph loads; empty graph uses `EmptyState`
- Workspace switcher showed duplicate All/Production chips plus compact dropdown (CSS specificity vs `index.css`)
- Cluster cards exposed raw in-cluster probe URLs and Go HTTP errors to end users
- Refresh button in navbar was a no-op (dispatched a custom event with no listeners) — now calls `refreshIrisData(queryClient)`
- Health chip showed "100% healthy" while cluster data was still loading
- `statusTone` ignored `degraded` services — now correctly shows `warn` when any service is degraded
- Logout fetch reloaded on HTTP error responses — now checks `res.ok` before reloading
- `copyDiag` silently swallowed clipboard errors — now leaves the dropdown open on failure
- Duplicate `/help` route appeared in both navbar HelpMenu and "More" dropdown
- `index.css` had two conflicting `.iris-main` definitions with different bottom-padding values
- Graph edge stroke color clashed with node focus highlight (both were the same blue)
- Stale 128 px dock-clearance padding in `.iris-scroll-body` (dock is no longer rendered)
- `Makefile` hardcoded a specific deployment IP; default is now unset

### Changed
- Deleted unused Zeus shell components (`ZeusDock`, `ZeusLeftRail`, `ZeusTopBar`, `MissionControlStrip`, orphaned home sections)
- Trimmed `index.css` Zeus rail/dock blocks and legacy `.btn` bridge rules in `axiom-bridge.css`
- Help page wrapped in `PageFrame` for consistent page shell
- Home, Catalog, Cluster, Health, Spaces, Discovery, Graph, Activity, Help, and App detail migrated to Nebula components
- `AppCard` / `AttentionQueue` use `GlassPanel` + primary action + overflow menu (max two visible actions)
- Quick Launch capped at 6 tiles; Mission Control uses flat space accordions
- Design tokens consolidated into `nebula-tokens.css`; `zeus-v9s-tokens.css` deprecated
- Grafana demo app startup probe relaxed in Helm chart for slow DB migrations
- `deploy-remote.sh` — box-drawn banner, numbered steps with elapsed timing, spinner for long SSH operations, rich summary box
- `e2e-deploy-verify.sh` — category sections, failure list in summary, `check_gateway` overwrites waiting line with `\r`
- `smoke-test.sh` — consistent banner, section headers, pass/fail collector

## [0.1.0] — 2026-05-01

### Added
- Initial release: service launchpad for Kubernetes clusters
- Auto-discovery of services via annotations, Ingress, Gateway API, and service mesh
- Catalog browser, health monitoring, dependency graph
- Federated catalog across multiple clusters
- Share links with TTL for read-only app access
- OIDC, API key, and unauthenticated auth modes
- Helm chart for K3s and standard Kubernetes deployment
- Prometheus `/metrics` endpoint
- Command palette (⌘K), keyboard shortcuts, service inspector drawer
