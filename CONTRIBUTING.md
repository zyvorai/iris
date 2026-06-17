# Contributing to Hermes

Thank you for helping improve Hermes. This guide covers local development, testing, and the review bar we use before merging.

## Prerequisites

| Tool | Version | Used for |
|------|---------|----------|
| Rust | stable | `hermes-server`, `hermes-core`, `hermes-api` |
| Go | 1.22+ | `hermes-controller` |
| Node.js | 20+ | React UI (`ui/`) |
| Helm | 3.x | Chart lint and deploy |
| Docker | optional | Image builds |

## Build

```bash
make build          # Go controller + Rust server + UI bundle
make build-go       # Controller only
make build-rust     # Server only
make build-ui       # UI only → ui/dist/
```

## Test

```bash
# Unit / integration
cargo test --workspace --locked
go test ./...
cd ui && npm ci && npm run build

# Local smoke (requires running server)
./scripts/smoke-test.sh

# Playwright UI smoke
cd ui && npm run test:e2e
# Against a live deploy:
HERMES_E2E_BASE=http://host:31847 npm run test:e2e

# Remote post-deploy API checks
make test-remote-smoke
```

CI runs Rust tests/clippy/fmt, Go tests/vet, UI build, and Helm lint on every push to `main` and on pull requests (see `.github/workflows/ci.yml`).

## User stories & acceptance

Feature work should map to a story in [docs/USER_STORIES.md](docs/USER_STORIES.md). Add or extend:

1. Acceptance criteria rows
2. Playwright smoke test (when UI-facing)
3. `e2e-deploy-verify.sh` check (when API-facing)

## Docs

| Change type | Update |
|-------------|--------|
| UI behavior | [docs/ui.md](docs/ui.md) |
| New API route | [docs/architecture.md](docs/architecture.md) + changelog |
| Install / deploy | [docs/install.md](docs/install.md) |
| User-facing feature | [docs/USER_STORIES.md](docs/USER_STORIES.md) + [CHANGELOG.md](CHANGELOG.md) |

## Pull request checklist

- [ ] `cargo test`, `go test`, and `npm run build` pass locally
- [ ] Playwright smoke updated if UI behavior changed
- [ ] Changelog entry under `[Unreleased]`
- [ ] User story acceptance criteria updated when applicable

## Code style

- **Rust:** `cargo fmt` + `cargo clippy -- -D warnings`
- **Go:** `go vet ./...`
- **UI:** Match existing Nebula components (`PageFrame`, `GlassPanel`, `Button`) — avoid new legacy `glass-section` / `.btn` patterns

## Questions

Open an issue or see [docs/README.md](docs/README.md) for architecture and install guides.
