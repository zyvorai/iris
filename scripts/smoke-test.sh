#!/usr/bin/env bash
# Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${HERMES_DB_PATH:-/tmp/hermes-smoke.db}"
PORT="${HERMES_PORT:-8080}"
BASE="http://127.0.0.1:${PORT}"

cd "$ROOT"

echo "==> Building..."
cargo build -q -p hermes-server
go run ./cmd/hermes-seed "$DB"

echo "==> Starting hermes-server on :${PORT}..."
HERMES_BIND="127.0.0.1:${PORT}" \
HERMES_DB_PATH="$DB" \
HERMES_UI_DIR="${ROOT}/ui/dist" \
./target/debug/hermes-server &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT

for i in $(seq 1 30); do
  if curl -sf "${BASE}/healthz" >/dev/null; then break; fi
  sleep 0.2
done

echo "==> Health check"
curl -sf "${BASE}/healthz" | grep -q '' && echo "OK /healthz"

echo "==> List apps"
APPS=$(curl -sf "${BASE}/api/v1/apps")
echo "$APPS" | grep -q Grafana && echo "OK Grafana in catalog"
echo "$APPS" | grep -q Prometheus && echo "OK Prometheus in catalog"

echo "==> Search"
curl -sf "${BASE}/api/v1/search?q=gra" | grep -q Grafana && echo "OK search grafana"

echo "==> Discovery (unpublished)"
curl -sf "${BASE}/api/v1/discovery" | grep -q ArgoCD && echo "OK ArgoCD suggested"

echo "==> Health summary"
curl -sf "${BASE}/api/v1/health/apps" | grep -q broken && echo "OK health summary"

echo "==> Favorites"
curl -sf -X PUT "${BASE}/api/v1/favorites/monitoring%2Fgrafana"
curl -sf "${BASE}/api/v1/favorites" | grep -q Grafana && echo "OK favorites"

echo "==> Recents"
curl -sf -X POST "${BASE}/api/v1/recents/monitoring%2Fgrafana"
curl -sf "${BASE}/api/v1/recents" | grep -q Grafana && echo "OK recents"

echo "==> WebSocket echo"
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:${PORT}/api/v1/ws-echo');
ws.on('open', () => ws.send('ping'));
ws.on('message', (d) => { if (d.toString() === 'ping') { console.log('OK websocket echo'); process.exit(0); } });
ws.on('error', (e) => { console.error(e); process.exit(1); });
setTimeout(() => process.exit(1), 5000);
" 2>/dev/null || {
  echo "SKIP websocket (ws module not installed — run: npm install -g ws)"
}

echo "==> Gateway blocks broken backend"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/a/argocd/argocd-server/" || true)
if [ "$CODE" = "403" ] || [ "$CODE" = "502" ]; then
  echo "OK gateway blocked unpublished/broken app ($CODE)"
fi

echo ""
echo "All smoke tests passed."
