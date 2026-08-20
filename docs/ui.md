# Hermes UI (Nebula)

Hermes ships a single-page React application aligned with the Aether Liquid Glass design language. The UI lives under `ui/` and is embedded in `hermes-server` at runtime.

## Design system

| Layer | Path | Role |
|-------|------|------|
| Tokens | `ui/src/styles/nebula-tokens.css` | Colors, radii, typography, Zeus/Hermes CSS variable bridge |
| Layout | `ui/src/styles/nebula-layout.css` | App shell, scroll areas, page grid |
| Components | `ui/src/styles/nebula-components.css` | Glass panels, cards, toolbars, skeletons, empty states, drawers |
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
| `DiagnosisDrawer` | Global diagnose flow (route lens, AI insight, retry) |
| `ZyraAiPanel` | Fleet and per-app AI summaries with rules/LLM source badge |

## Zyra AI

Configure OpenAI-compatible LLM access on the server:

| Env | Purpose |
|-----|---------|
| `HERMES_LLM_API_URL` | Chat completions base URL (e.g. `https://api.openai.com/v1`) |
| `HERMES_LLM_API_KEY` | Bearer token |
| `HERMES_LLM_MODEL` | Model name (default `gpt-4o-mini`) |

When unset, Hermes uses rule-based insight and intent search — no external API required.

**Remote deploy with LLM:**

```bash
export HERMES_LLM_API_URL=https://api.openai.com/v1
export HERMES_LLM_API_KEY=sk-...
./scripts/deploy-remote.sh 175.110.114.93 sus

# Or apply LLM settings to an existing deploy (Helm only):
./scripts/configure-llm-remote.sh 175.110.114.93 sus

# Or install Ollama on the remote host and point Hermes at it (k3s: binds 0.0.0.0, uses node IP):
./scripts/setup-ollama-remote.sh 175.110.114.93 sus
```

The API key is stored in the Kubernetes secret `hermes-llm` on the cluster (not in plain Helm values).

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/search/llm?q=` | Natural-language catalog search |
| `GET /api/v1/apps/{id}/insight` | Per-app diagnosis + remediation narrative |
| `GET /api/v1/insights/fleet` | Fleet-wide health summary and highlights |
| `GET /api/v1/insights/discovery` | Ranked publish suggestions for the discovery queue |
| `GET /api/v1/insights/namespace/{ns}` | Namespace health rollup and focus services |
| `GET /api/v1/insights/graph` | Topology insight for unresolved dependency links |
| `GET /api/v1/insights/owner/{owner}` | Team ownership health rollup |
| `GET /api/v1/insights/federated` | Federated catalog health rollup |
| `GET /api/v1/insights/activity` | Recent audit activity patterns |
| `GET /api/v1/insights/status` | Whether live LLM is configured; probes `/models` when configured |

UI: Home and Health fleet panels with diagnose chips, per-app insight on app detail, Activity audit insight, Graph topology insight, Discovery publish suggestions, Cluster namespace insight, Catalog unhealthy filter insight, Teams/Spaces/Federated summaries, navbar health tooltip, Diagnose drawer, Inspector Zyra AI tab, Spotlight `ai:`, `explain`, `why`, `diagnose`, `suggest publish`, `ns insight`, `graph insight`, `owner insight`, `federated insight`, `activity insight`, and `ai status`.

## Key pages

| Route | Behavior |
|-------|----------|
| `/` | Command deck — hero, 3-metric fleet snapshot, Quick Launch (max 6), Mission Control accordions |
| `/apps` | Published catalog with unified toolbar, category chip overflow, true-empty vs filter-empty states |
| `/cluster` | Full cluster catalog — metrics row, sticky stacked filters on mobile, Zyra AI namespace/fleet insight |
| `/health` | Fleet health + attention queue with AI summary |
| `/discovery` | Unpublished services queue with Zyra AI publish suggestions |
| `/graph` | Dependency graph with filters and Zyra AI focus chips |
| `/federated` | Merged remote catalogs |
| `/teams` | Owner metadata grouped by team |
| `/activity` | Audit log with fleet insight banner and optional share-admin panel |
| `/help` | Static guide wrapped in `PageFrame` |
| `/apps/:id` | App detail — Nebula panels, share links, mesh policies; diagnose opens global drawer |

## Diagnose flow

All **Diagnose** and **Inspect route** actions call `openDiagnose(appId)` from `inspectorContext.tsx`. The global `DiagnosisDrawer` in `Layout.tsx` is the single diagnose surface — there is no inline diagnose panel on app detail.

The drawer shows loading skeletons, error + retry, route lens, suggested kubectl commands, and Zyra AI insight.

## Mobile toolbars

Below **768px**, pages with `page-toolbar-stacked` stack search and selects full-width. Category chips on `/apps` scroll horizontally inside `.toolbar-scroll-shell` with a **More categories** overflow. Cluster export lives in an `ActionMenu` rather than a standalone toolbar button.

The workspace switcher uses a compact dropdown below **900px**; the full chip row is desktop-only.

## Status messages

Raw probe errors from the controller (e.g. `Get "http://svc.ns.svc.cluster.local:9090/": context deadline exceeded`) are **never shown verbatim** on cards by default.

`ui/src/utils/statusMessage.ts` maps them to short summaries:

- **Summary** — e.g. "Health check timed out"
- **Endpoint chip** — e.g. `cdi-prometheus-metrics.cdi:9090`
- **Technical details** — expandable raw message for operators

## Navbar

- **Desktop (>900px):** workspace chips (All, Production, …) in the top bar
- **Tablet/mobile:** compact environment dropdown; health chip shows dot only
- Spotlight: `⌘K` / `Ctrl+K` — shows a pending row while search / AI / intent queries are in flight

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
cd ui && npm run build
# rebuild/push hermes-server image and roll the deployment
```

See the repository root `Makefile` and `scripts/deploy-remote.sh` for cluster deploy helpers.

For backend and API details see [development.md](development.md) and [api.md](api.md).
