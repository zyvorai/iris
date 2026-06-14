# Hermes UI (Nebula)

Hermes ships a single-page React application aligned with the Aether Liquid Glass design language. The UI lives under `ui/` and is embedded in `hermes-server` at runtime.

## Design system

| Layer | Path | Role |
|-------|------|------|
| Tokens | `ui/src/styles/nebula-tokens.css` | Colors, radii, typography, Zeus/Hermes CSS variable bridge |
| Layout | `ui/src/styles/nebula-layout.css` | App shell, scroll areas, page grid |
| Components | `ui/src/styles/nebula-components.css` | Glass panels, cards, toolbars, skeletons, empty states |
| Legacy bridge | `ui/src/styles/aether-bridge.css` | Maps remaining legacy classes to Nebula surfaces |
| Legacy | `ui/src/index.css` | Older Hermes styles (being retired incrementally) |

Load order is defined in `ui/src/main.tsx`: tokens → layout → components → `index.css` → bridge.

## Page primitives

Shared building blocks under `ui/src/components/nebula/`:

| Component | Purpose |
|-----------|---------|
| `PageFrame` | Loading skeleton, error + retry, optional toolbar/banner/empty slot |
| `PageLoading` | Pulse skeleton for hero + metrics + card grid |
| `PageLoadError` | Glass error panel with retry |
| `EmptyState` | Icon, title, description, optional CTA |
| `ContextBanner` | Workspace filter notice with clear action |
| `PageToolbar` | Unified search / sort / filter / view-toggle bar |
| `GlassPanel` | Primary surface card |
| `Button` / `ActionMenu` | Actions (max two visible on service cards) |
| `RouteDisplay` | Launchpad path and public URL with copy |
| `ServiceStatusMessage` | Human-readable health probe summaries |

## Key pages

| Route | Behavior |
|-------|----------|
| `/` | Command deck — hero, 3-metric fleet snapshot, Quick Launch (max 6), Mission Control accordions |
| `/apps` | Published catalog with unified toolbar and category filters |
| `/cluster` | Full cluster catalog — metrics row, sticky filters, collapsible namespace groups (auto-expand when unhealthy) |
| `/health` | Fleet health + attention queue |
| `/graph` | Dependency graph with filters |

## Status messages

Raw probe errors from the controller (e.g. `Get "http://svc.ns.svc.cluster.local:9090/": context deadline exceeded`) are **never shown verbatim** on cards by default.

`ui/src/utils/statusMessage.ts` maps them to short summaries:

- **Summary** — e.g. "Health check timed out"
- **Endpoint chip** — e.g. `cdi-prometheus-metrics.cdi:9090`
- **Technical details** — expandable raw message for operators

## Navbar

- **Desktop (>900px):** workspace chips (All, Production, …) in the top bar
- **Tablet/mobile:** compact environment dropdown; health chip shows dot only
- Spotlight: `⌘K` / `Ctrl+K`

## Development

```bash
cd ui
npm ci
npm run dev          # Vite dev server (proxies API to HERMES_API or localhost:31847)
npm run build        # Production bundle → ui/dist/
npm run test:e2e     # Playwright smoke tests (starts preview server if HERMES_E2E_BASE unset)
```

Run smoke tests against a live deploy:

```bash
HERMES_E2E_BASE=http://your-host:31847 npm run test:e2e
```

## Deployment

The UI is baked into the `hermes-server` image. After UI changes:

```bash
./scripts/deploy-remote.sh <host> <user>
```

Or skip image rebuild if only Helm values changed: `--skip-build`.
