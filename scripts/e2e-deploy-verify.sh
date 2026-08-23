#!/usr/bin/env bash
# Hermes — post-deploy E2E verification
set -euo pipefail

BASE="${1:-${HERMES_E2E_BASE:-https://127.0.0.1:31847}}"
BASE="${BASE%/}"
NS="${HERMES_NAMESPACE:-hermes-system}"
START=$SECONDS

# hermes-server terminates TLS with a self-signed cert unless HERMES_TLS_CERT/
# HERMES_TLS_KEY point at a real one — skip verification for this script's own checks.
curl() { command curl -k "$@"; }

pass=0; fail=0
FAILED=()

# ── Colors ────────────────────────────────────────────────────────────────────
_use_color() { [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; }
if _use_color; then
    C_OK=$'\033[32m'; C_FAIL=$'\033[31m'; C_WARN=$'\033[33m'
    C_DIM=$'\033[2m'; C_BOLD=$'\033[1m'; C_INFO=$'\033[36m'; C_RST=$'\033[0m'
else
    C_OK=; C_FAIL=; C_WARN=; C_DIM=; C_BOLD=; C_INFO=; C_RST=
fi

hr()      { printf "  ${C_DIM}──────────────────────────────────────────────────────────${C_RST}\n"; }
section() { printf "\n  ${C_DIM}%s${C_RST}\n" "$1"; }

check() {
    local name="$1" cmd="$2"
    if eval "$cmd" >/dev/null 2>&1; then
        printf "  ${C_OK}✓${C_RST}  %s\n" "$name"
        pass=$((pass + 1))
    else
        printf "  ${C_FAIL}✗${C_RST}  %s\n" "$name"
        FAILED+=("$name"); fail=$((fail + 1))
    fi
}

check_gateway() {
    local name="$1" url="$2"
    local is_ok=false code=""
    printf "  ${C_DIM}·${C_RST}  %-54s\r" "$name"
    for _ in $(seq 1 30); do
        code="$(curl -s -o /dev/null -w '%{http_code}' "${url}" 2>/dev/null || true)"
        if echo "${code}" | grep -qE '^(200|301|302|307|308)$'; then is_ok=true; break; fi
        sleep 2
    done
    if [ "${is_ok}" = true ]; then
        printf "  ${C_OK}✓${C_RST}  %s\n" "$name"
        pass=$((pass + 1))
    else
        printf "  ${C_FAIL}✗${C_RST}  %-54s ${C_DIM}HTTP %s${C_RST}\n" "$name" "${code:-timeout}"
        FAILED+=("$name"); fail=$((fail + 1))
    fi
}

# ── Banner ────────────────────────────────────────────────────────────────────
printf "\n"
printf "  ${C_BOLD}╔══════════════════════════════════════════════════════════╗${C_RST}\n"
printf "  ${C_BOLD}║${C_RST}                                                          ${C_BOLD}║${C_RST}\n"
printf "  ${C_BOLD}║${C_RST}  ${C_INFO}◈${C_RST}  ${C_BOLD}H E R M E S   E 2 E   V E R I F Y${C_RST}                 ${C_BOLD}║${C_RST}\n"
printf "  ${C_BOLD}║${C_RST}     ${C_DIM}%-52s${C_RST} ${C_BOLD}║${C_RST}\n" "${BASE}"
printf "  ${C_BOLD}║${C_RST}                                                          ${C_BOLD}║${C_RST}\n"
printf "  ${C_BOLD}╚══════════════════════════════════════════════════════════╝${C_RST}\n"
printf "\n"

# ── API endpoints ─────────────────────────────────────────────────────────────
section "API endpoints"

check "healthz"                "curl -sf '${BASE}/healthz'"
check "apps"                   "curl -sf '${BASE}/api/v1/apps'"
check "catalog"                "curl -sf '${BASE}/api/v1/catalog'"
check "cluster summary"        "curl -sf '${BASE}/api/v1/cluster/summary'"
check "graph (nodes)"          "curl -sf '${BASE}/api/v1/graph' | grep -q '\"nodes\"'"
check "workspaces"             "curl -sf '${BASE}/api/v1/workspaces'"
check "owners"                 "curl -sf '${BASE}/api/v1/owners'"
check "search"                 "curl -sf '${BASE}/api/v1/search?q=gra'"
check "search intent"          "curl -sf '${BASE}/api/v1/search/intent?q=unhealthy' | grep -q '\"intent\"'"
check "federated catalog"      "curl -sf '${BASE}/api/v1/catalog/federated' | grep -q '\"clusterId\"'"
check "search LLM"             "curl -sf '${BASE}/api/v1/search/llm?q=grafana' | grep -q '\"intent\"'"
check "clusters"               "curl -sf '${BASE}/api/v1/clusters' | grep -q '\"status\"'"
check "health summary"         "curl -sf '${BASE}/api/v1/health/apps'"
check "app diagnosis"          "curl -sf '${BASE}/api/v1/apps/hermes-demo/grafana/diagnosis' | grep -q '\"chain\"'"
check "app insight"            "curl -sf '${BASE}/api/v1/apps/hermes-demo/grafana/insight' | grep -q '\"explanation\"'"
check "fleet insight"          "curl -sf '${BASE}/api/v1/insights/fleet' | grep -q '\"summary\"'"
check "discovery insight"      "curl -sf '${BASE}/api/v1/insights/discovery' | grep -q '\"summary\"'"
check "namespace insight"      "curl -sf '${BASE}/api/v1/insights/namespace/hermes-demo' | grep -q '\"namespace\"'"
check "graph insight"          "curl -sf '${BASE}/api/v1/insights/graph' | grep -q '\"summary\"'"
check "owner insight"          "curl -sf '${BASE}/api/v1/insights/owner/platform' | grep -q '\"owner\"'"
check "federated insight"      "curl -sf '${BASE}/api/v1/insights/federated' | grep -q '\"summary\"'"
check "activity insight"       "curl -sf '${BASE}/api/v1/insights/activity' | grep -q '\"summary\"'"
check "ai status"                "curl -sf '${BASE}/api/v1/insights/status' | grep -q '\"defaultSource\"'"
check "recommended"            "curl -sf '${BASE}/api/v1/recommended'"
check "shares"                 "curl -sf '${BASE}/api/v1/shares'"
check "shares admin"           "curl -sf '${BASE}/api/v1/shares/all' | grep -q '^\\['"
check "audit"                  "curl -sf '${BASE}/api/v1/audit?limit=5'"
check "federated audit"        "curl -sf '${BASE}/api/v1/audit/federated?limit=5' | grep -q '\"clusterId\"'"
check "stats"                  "curl -sf '${BASE}/api/v1/stats'"
check "metrics"                "curl -sf '${BASE}/metrics' | grep -q hermes_apps_total"
check "federation publish 404" "curl -sf -X POST '${BASE}/api/v1/federation/publish/_missing_/demo/app' | grep -q '\"ok\"' || test \"\$(curl -s -o /dev/null -w '%{http_code}' -X POST '${BASE}/api/v1/federation/publish/_missing_/demo/app')\" = '404'"
check "federation rbac 404"    "curl -sf '${BASE}/api/v1/federation/rbac/_missing_' >/dev/null 2>&1 || test \"\$(curl -s -o /dev/null -w '%{http_code}' '${BASE}/api/v1/federation/rbac/_missing_')\" = '404'"

# ── Gateway routes ────────────────────────────────────────────────────────────
section "Gateway routes"

check_gateway "launchpad gateway"  "${BASE}/launchpad/a/hermes-demo/grafana"
check_gateway "launchpad trailing slash" "${BASE}/launchpad/a/hermes-demo/grafana/"
check "launchpad canonical"        "code=\$(curl -s -o /dev/null -w '%{http_code}' '${BASE}/launchpad/apps/grafana'); test \"\$code\" != '404'"
check_gateway "legacy gateway"     "${BASE}/a/hermes-demo/grafana"

# Assert redirects stay under the launchpad mount (not SPA fallback).
loc="$(curl -sI "${BASE}/launchpad/a/hermes-demo/grafana" 2>/dev/null | tr -d '\r' | awk 'BEGIN{IGNORECASE=1} $1=="location:"{print $2; exit}')"
if [ -n "${loc}" ]; then
    case "${loc}" in
        */launchpad/a/hermes-demo/grafana*|*/a/hermes-demo/grafana*)
            printf "  ${C_OK}✓${C_RST}  grafana Location under mount\n"; pass=$((pass + 1)) ;;
        *)
            printf "  ${C_FAIL}✗${C_RST}  grafana Location under mount ${C_DIM}%s${C_RST}\n" "${loc}"
            FAILED+=("grafana Location under mount"); fail=$((fail + 1)) ;;
    esac
else
    # 200 with no redirect is also fine once slash routes are fixed.
    code="$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/launchpad/a/hermes-demo/grafana/" 2>/dev/null || true)"
    if echo "${code}" | grep -qE '^(200|301|302)$'; then
        printf "  ${C_OK}✓${C_RST}  grafana root reachable\n"; pass=$((pass + 1))
    else
        printf "  ${C_FAIL}✗${C_RST}  grafana root reachable ${C_DIM}HTTP %s${C_RST}\n" "${code:-none}"
        FAILED+=("grafana root reachable"); fail=$((fail + 1))
    fi
fi

# Proxied JSON APIs must not return the Hermes SPA.
check "grafana api health via gateway" \
    "curl -sf '${BASE}/launchpad/a/hermes-demo/grafana/api/health' | grep -q '\"database\"'"
check "prometheus query via gateway" \
    "curl -sf --get '${BASE}/launchpad/a/hermes-demo/prometheus-server/api/v1/query' --data-urlencode 'query=up' | grep -q '\"status\"'"
check "prometheus trailing-slash root not SPA" \
    "! curl -s '${BASE}/launchpad/a/hermes-demo/prometheus-server/' | grep -q 'Hermes Dock'"

# ── Share link flow ───────────────────────────────────────────────────────────
section "Share link  (create → access → revoke)"

SHARE_JSON="$(curl -sf -X POST "${BASE}/api/v1/shares" \
    -H 'Content-Type: application/json' \
    -d '{"appId":"hermes-demo/grafana","ttlMinutes":30}' 2>/dev/null || true)"
if [ -n "${SHARE_JSON}" ] && echo "${SHARE_JSON}" | grep -q '"token"'; then
    SHARE_TOKEN="$(echo "${SHARE_JSON}" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null || true)"
    if [ -n "${SHARE_TOKEN}" ]; then
        check_gateway "share gateway" "${BASE}/launchpad/s/${SHARE_TOKEN}"
        if curl -sf -X DELETE "${BASE}/api/v1/shares/${SHARE_TOKEN}" >/dev/null 2>&1; then
            printf "  ${C_OK}✓${C_RST}  share revoke\n"; pass=$((pass + 1))
        else
            printf "  ${C_FAIL}✗${C_RST}  share revoke\n"; FAILED+=("share revoke"); fail=$((fail + 1))
        fi
    else
        printf "  ${C_FAIL}✗${C_RST}  share token parse\n"; FAILED+=("share token parse"); fail=$((fail + 1))
    fi
else
    printf "  ${C_FAIL}✗${C_RST}  share create\n"; FAILED+=("share create"); fail=$((fail + 1))
fi

# ── Demo app discovery ────────────────────────────────────────────────────────
section "Demo app discovery  (waiting up to 90s for controller sync)"

found_demo=false
for i in $(seq 1 45); do
    if curl -sf "${BASE}/api/v1/apps" | grep -qi grafana; then
        printf "  ${C_OK}✓${C_RST}  Grafana in catalog\n"; pass=$((pass + 1)); found_demo=true; break
    fi
    printf "  ${C_DIM}·  Grafana syncing... %ds${C_RST}   \r" "$((i * 2))"
    sleep 2
done
[ "$found_demo" = true ] || printf "  ${C_WARN}!${C_RST}  Grafana not in catalog yet (controller still syncing)\n"

if curl -sf "${BASE}/api/v1/apps" | grep -qi prometheus; then
    printf "  ${C_OK}✓${C_RST}  Prometheus in catalog\n"; pass=$((pass + 1))
fi
if curl -sf "${BASE}/api/v1/graph" | grep -q '"resolved":true'; then
    printf "  ${C_OK}✓${C_RST}  graph dependency edge resolved\n"; pass=$((pass + 1))
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
