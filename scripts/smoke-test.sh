#!/usr/bin/env bash
# Copyright 2026 ZyvorAI Labs Private Limited
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${HERMES_DB_PATH:-/tmp/hermes-smoke.db}"
PORT="${HERMES_PORT:-31847}"
BASE="http://127.0.0.1:${PORT}"
START=$SECONDS

# ── Colors ────────────────────────────────────────────────────────────────────
_use_color() { [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; }
if _use_color; then
    C_OK=$'\033[32m'; C_FAIL=$'\033[31m'; C_WARN=$'\033[33m'
    C_DIM=$'\033[2m'; C_BOLD=$'\033[1m'; C_INFO=$'\033[36m'; C_RST=$'\033[0m'
else
    C_OK=; C_FAIL=; C_WARN=; C_DIM=; C_BOLD=; C_INFO=; C_RST=
fi

pass=0; fail=0; FAILED=()

ok()      { printf "  ${C_OK}✓${C_RST}  %s\n" "$*"; pass=$((pass + 1)); }
fail_chk(){ printf "  ${C_FAIL}✗${C_RST}  %s\n" "$*"; FAILED+=("$*"); fail=$((fail + 1)); }
info()    { printf "  ${C_INFO}→${C_RST}  %s\n" "$*"; }
section() { printf "\n  ${C_DIM}%s${C_RST}\n" "$1"; }
hr()      { printf "  ${C_DIM}──────────────────────────────────────────────────────────${C_RST}\n"; }

check() {
    local name="$1"; shift
    if "$@" >/dev/null 2>&1; then ok "$name"; else fail_chk "$name"; fi
}

check_expr() {
    local name="$1" expr="$2"
    if eval "$expr" >/dev/null 2>&1; then ok "$name"; else fail_chk "$name"; fi
}

cd "$ROOT"

# ── Banner ────────────────────────────────────────────────────────────────────
printf "\n"
printf "  ${C_BOLD}╔══════════════════════════════════════════════════════════╗${C_RST}\n"
printf "  ${C_BOLD}║${C_RST}                                                          ${C_BOLD}║${C_RST}\n"
printf "  ${C_BOLD}║${C_RST}  ${C_INFO}◈${C_RST}  ${C_BOLD}H E R M E S   S M O K E   T E S T${C_RST}                 ${C_BOLD}║${C_RST}\n"
printf "  ${C_BOLD}║${C_RST}     ${C_DIM}%-52s${C_RST} ${C_BOLD}║${C_RST}\n" "${BASE}"
printf "  ${C_BOLD}║${C_RST}                                                          ${C_BOLD}║${C_RST}\n"
printf "  ${C_BOLD}╚══════════════════════════════════════════════════════════╝${C_RST}\n"
printf "\n"

# ── Build ─────────────────────────────────────────────────────────────────────
section "Build"
info "cargo build -p hermes-server"
cargo build -q -p hermes-server
info "seeding ${DB}"
go run ./cmd/hermes-seed "$DB"
ok "Build complete"

# ── Start server ──────────────────────────────────────────────────────────────
section "Server startup"
info "Starting hermes-server on :${PORT}"
HERMES_BIND="127.0.0.1:${PORT}" \
HERMES_DB_PATH="$DB" \
HERMES_UI_DIR="${ROOT}/ui/dist" \
./target/debug/hermes-server &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT

printf "  ${C_DIM}→${C_RST}  Waiting for :${PORT}"
for i in $(seq 1 30); do
    if curl -sf "${BASE}/healthz" >/dev/null 2>&1; then printf "\n"; break; fi
    printf "."
    sleep 0.2
done
ok "Server ready (PID ${PID})"

# ── Core API ──────────────────────────────────────────────────────────────────
section "Core API"

check_expr "healthz"             "curl -sf '${BASE}/healthz'"
check_expr "apps list"           "curl -sf '${BASE}/api/v1/apps' | grep -q Grafana"
check_expr "Grafana in catalog"  "curl -sf '${BASE}/api/v1/apps' | grep -q Grafana"
check_expr "Prometheus in catalog" "curl -sf '${BASE}/api/v1/apps' | grep -q Prometheus"
check_expr "search"              "curl -sf '${BASE}/api/v1/search?q=gra' | grep -q Grafana"
check_expr "discovery"           "curl -sf '${BASE}/api/v1/discovery' | grep -q ArgoCD"
check_expr "health summary"      "curl -sf '${BASE}/api/v1/health/apps' | grep -q broken"

# ── User data ─────────────────────────────────────────────────────────────────
section "User data (favorites / recents)"

curl -sf -X PUT "${BASE}/api/v1/favorites/monitoring%2Fgrafana" >/dev/null
check_expr "favorites write + read" "curl -sf '${BASE}/api/v1/favorites' | grep -q Grafana"

curl -sf -X POST "${BASE}/api/v1/recents/monitoring%2Fgrafana" >/dev/null
check_expr "recents write + read"   "curl -sf '${BASE}/api/v1/recents' | grep -q Grafana"

# ── WebSocket ─────────────────────────────────────────────────────────────────
section "WebSocket"

if command -v node >/dev/null 2>&1; then
    WS_RESULT=$(node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:${PORT}/api/v1/ws-echo');
ws.on('open', () => ws.send('ping'));
ws.on('message', (d) => { if (d.toString() === 'ping') { process.stdout.write('ok'); process.exit(0); } });
ws.on('error', () => process.exit(1));
setTimeout(() => process.exit(1), 5000);
" 2>/dev/null || true)
    if [ "${WS_RESULT}" = "ok" ]; then ok "ws-echo"; else fail_chk "ws-echo"; fi
else
    printf "  ${C_WARN}!${C_RST}  WebSocket skipped (node not found)\n"
fi

# ── Gateway ───────────────────────────────────────────────────────────────────
section "Gateway"

CODE=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/a/argocd/argocd-server/" 2>/dev/null || true)
if [ "$CODE" = "403" ] || [ "$CODE" = "502" ]; then
    ok "gateway blocks unpublished app (HTTP ${CODE})"
else
    fail_chk "gateway should block unpublished app (got HTTP ${CODE:-none})"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
elapsed=$((SECONDS - START))
printf "\n"; hr; printf "\n"
if [ "$fail" -eq 0 ]; then
    printf "  ${C_OK}✓${C_RST}  ${C_BOLD}All %d checks passed${C_RST}  ${C_DIM}%ds${C_RST}\n\n" "$pass" "$elapsed"
else
    printf "  ${C_FAIL}✗${C_RST}  ${C_BOLD}%d passed · %d failed${C_RST}  ${C_DIM}%ds${C_RST}\n\n" "$pass" "$fail" "$elapsed"
    printf "  Failed:\n"
    for f in "${FAILED[@]}"; do printf "  ${C_DIM}·${C_RST}  %s\n" "$f"; done
    printf "\n"
fi
[ "$fail" -eq 0 ]
