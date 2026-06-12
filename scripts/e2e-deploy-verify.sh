#!/usr/bin/env bash
# Post-deploy verification for Hermes (run from laptop or CI).
set -euo pipefail

BASE="${1:-${HERMES_E2E_BASE:-http://127.0.0.1:31847}}"
BASE="${BASE%/}"
NS="${HERMES_NAMESPACE:-hermes-system}"

pass=0
fail=0

check() {
    local name="$1" cmd="$2"
    if eval "$cmd" >/dev/null 2>&1; then
        echo "  ✅ $name"
        pass=$((pass + 1))
    else
        echo "  ❌ $name"
        fail=$((fail + 1))
    fi
}

check_gateway() {
    local name="$1" url="$2"
    local ok=false
    for _ in $(seq 1 30); do
        code="$(curl -s -o /dev/null -w '%{http_code}' "${url}" 2>/dev/null || true)"
        if echo "${code}" | grep -qE '^(200|301|302|307|308)$'; then
            ok=true
            break
        fi
        sleep 2
    done
    if [ "${ok}" = true ]; then
        echo "  ✅ ${name}"
        pass=$((pass + 1))
    else
        echo "  ❌ ${name} (last code: ${code:-none})"
        fail=$((fail + 1))
    fi
}

echo "Hermes E2E verify → ${BASE}"
echo ""

check "healthz" "curl -sf '${BASE}/healthz'"
check "apps API" "curl -sf '${BASE}/api/v1/apps'"
check "catalog API" "curl -sf '${BASE}/api/v1/catalog'"
check "cluster summary" "curl -sf '${BASE}/api/v1/cluster/summary'"
check "graph API" "curl -sf '${BASE}/api/v1/graph' | grep -q '\"nodes\"'"
check "search API" "curl -sf '${BASE}/api/v1/search?q=gra'"
check "health summary" "curl -sf '${BASE}/api/v1/health/apps'"
check "app diagnosis API" "curl -sf '${BASE}/api/v1/apps/hermes-demo/grafana/diagnosis' | grep -q '\"chain\"'"
check "recommended API" "curl -sf '${BASE}/api/v1/recommended'"
check "shares API" "curl -sf '${BASE}/api/v1/shares'"
check "audit API" "curl -sf '${BASE}/api/v1/audit?limit=5'"
check "stats API" "curl -sf '${BASE}/api/v1/stats'"
check "metrics" "curl -sf '${BASE}/metrics' | grep -q hermes_apps_total"

check_gateway "launchpad gateway route" "${BASE}/launchpad/a/hermes-demo/grafana"
check "launchpad canonical route" "code=\$(curl -s -o /dev/null -w '%{http_code}' '${BASE}/launchpad/apps/grafana'); test \"\$code\" != '404'"
check_gateway "legacy gateway route" "${BASE}/a/hermes-demo/grafana"

# Share link smoke: create → access → revoke
SHARE_JSON="$(curl -sf -X POST "${BASE}/api/v1/shares" \
    -H 'Content-Type: application/json' \
    -d '{"appId":"hermes-demo/grafana","ttlMinutes":30}' 2>/dev/null || true)"
if [ -n "${SHARE_JSON}" ] && echo "${SHARE_JSON}" | grep -q '"token"'; then
    SHARE_TOKEN="$(echo "${SHARE_JSON}" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null || true)"
    if [ -n "${SHARE_TOKEN}" ]; then
        check_gateway "share gateway route" "${BASE}/launchpad/s/${SHARE_TOKEN}"
        if curl -sf -X DELETE "${BASE}/api/v1/shares/${SHARE_TOKEN}" >/dev/null 2>&1; then
            echo "  ✅ share revoke"
            pass=$((pass + 1))
        else
            echo "  ❌ share revoke"
            fail=$((fail + 1))
        fi
    else
        echo "  ❌ share token parse"
        fail=$((fail + 1))
    fi
else
    echo "  ❌ share create"
    fail=$((fail + 1))
fi

# Wait for demo apps (Grafana/Prometheus) to appear in catalog
found_demo=false
for i in $(seq 1 45); do
    if curl -sf "${BASE}/api/v1/apps" | grep -qi grafana; then
        echo "  ✅ Grafana in catalog"
        pass=$((pass + 1))
        found_demo=true
        break
    fi
    sleep 2
done
if [ "$found_demo" != true ]; then
    echo "  ⚠️  Grafana not in catalog yet (controller may still be syncing)"
fi

if curl -sf "${BASE}/api/v1/apps" | grep -qi prometheus; then
    echo "  ✅ Prometheus in catalog"
    pass=$((pass + 1))
fi

# Graph should include grafana → prometheus dependency when demo apps are synced
if curl -sf "${BASE}/api/v1/graph" | grep -q '"resolved":true'; then
    echo "  ✅ graph dependency edge"
    pass=$((pass + 1))
fi

echo ""
echo "Results: ${pass} passed, ${fail} failed"
[ "$fail" -eq 0 ]
