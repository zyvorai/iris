# Changelog

All notable changes to Hermes are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Zeus AI insights** — `/api/v1/apps/{id}/insight` and `/api/v1/insights/fleet` with LLM + rule-based fallback
- `ZeusAiPanel` on Home and Health; Diagnose drawer and inspector AI tab use context-aware insight
- Spotlight natural-language queries route through `/search/llm` (richer catalog context, fixed `appIds` parsing)
- Ask Zeus AI opens inspector directly on the AI tab
- Spotlight `diagnose <app>` shows Zeus AI insight preview; `explain` surfaces fleet summary with focus services
- Graph page Zeus AI focus chips and Activity fleet insight banner

- True-empty vs filter-empty states on Catalog and Cluster pages with distinct CTAs
- Mobile toolbar stacking (`.page-toolbar-stacked`), category chip scroll shell, cluster export in `ActionMenu`
- Command palette pending row while search / AI / intent queries load
- Playwright smoke tests: health attention queue, discovery page, diagnose drawer, mobile toolbar overflow
- **Nebula UX overhaul** — unified Liquid Glass design system (`nebula-tokens`, `nebula-layout`, `nebula-components`, `aether-bridge`)
- Shared page primitives: `PageFrame`, `PageLoading`, `PageLoadError`, `EmptyState`, `ContextBanner`, `PageToolbar`
- `HomeFleetSnapshot` — 3-metric home strip (Discovered, Published, Needs attention)
- `serviceActions.ts` — shared Open/Diagnose/Publish/copy menu for `AppCard` and `ServiceCard`
- `formatStatusMessage()` — human-readable health probe summaries with optional technical details
- `RouteDisplay` — styled launchpad paths and public URLs with copy on app detail
- Collapsible namespace groups on Cluster page (auto-expand when namespace has unhealthy services)
- Compact workspace switcher dropdown below 900px viewport
- Playwright smoke tests for skeleton loading, catalog/cluster toolbars, mobile layout
- [docs/ui.md](docs/ui.md) — UI architecture and development guide
- Aether-style two-row top navbar replacing the three-panel left-rail shell
- `HermesNavbar` component with health chip, spotlight, refresh, help dropdown, and mobile drawer
- Blue primary color scheme (`#3B82F6`) aligned with Aether design language
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
- Refresh button in navbar was a no-op (dispatched a custom event with no listeners) — now calls `refreshHermesData(queryClient)`
- Health chip showed "100% healthy" while cluster data was still loading
- `statusTone` ignored `degraded` services — now correctly shows `warn` when any service is degraded
- Logout fetch reloaded on HTTP error responses — now checks `res.ok` before reloading
- `copyDiag` silently swallowed clipboard errors — now leaves the dropdown open on failure
- Duplicate `/help` route appeared in both navbar HelpMenu and "More" dropdown
- `index.css` had two conflicting `.hermes-main` definitions with different bottom-padding values
- Graph edge stroke color clashed with node focus highlight (both were the same blue)
- Stale 128 px dock-clearance padding in `.hermes-scroll-body` (dock is no longer rendered)
- `Makefile` hardcoded a specific deployment IP; default is now unset

### Changed
- Deleted unused Zeus shell components (`ZeusDock`, `ZeusLeftRail`, `ZeusTopBar`, `MissionControlStrip`, orphaned home sections)
- Trimmed `index.css` Zeus rail/dock blocks and legacy `.btn` bridge rules in `aether-bridge.css`
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
