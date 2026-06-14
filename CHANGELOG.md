# Changelog

All notable changes to Hermes are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
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
