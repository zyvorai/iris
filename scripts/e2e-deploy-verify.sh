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

echo "Hermes E2E verify → ${BASE}"
echo ""

check "healthz" "curl -sf '${BASE}/healthz'"
check "apps API" "curl -sf '${BASE}/api/v1/apps'"
check "catalog API" "curl -sf '${BASE}/api/v1/catalog'"
check "cluster summary" "curl -sf '${BASE}/api/v1/cluster/summary'"
check "search API" "curl -sf '${BASE}/api/v1/search?q=gra'"
check "health summary" "curl -sf '${BASE}/api/v1/health/apps'"
check "audit API" "curl -sf '${BASE}/api/v1/audit?limit=5'"
check "stats API" "curl -sf '${BASE}/api/v1/stats'"
check "metrics" "curl -sf '${BASE}/metrics' | grep -q hermes_apps_total"

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

echo ""
echo "Results: ${pass} passed, ${fail} failed"
[ "$fail" -eq 0 ]
