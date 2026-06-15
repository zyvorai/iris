#!/usr/bin/env bash
# Install Ollama on the Hermes remote host and configure Hermes to use it (Helm only).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_HOST="${1:-}"
TARGET_USER="${2:-root}"

usage() {
  cat <<'EOF'
Usage: setup-ollama-remote.sh <host> <user>

Installs Ollama via the official script, binds it on 0.0.0.0:11434 (reachable from k3s pods),
pulls llama3.2, and runs configure-llm-remote.sh with:
  HERMES_LLM_API_URL=http://<host>:11434/v1
  HERMES_LLM_MODEL=llama3.2

Requires sudo on the remote host for the Ollama install step.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || -z "${TARGET_HOST}" ]]; then
  usage
  exit 0
fi

echo "→ Installing Ollama on ${TARGET_USER}@${TARGET_HOST} (if missing)…"
ssh "${TARGET_USER}@${TARGET_HOST}" bash <<'REMOTE'
set -euo pipefail
if ! command -v ollama >/dev/null 2>&1; then
  curl -fsSL https://ollama.com/install.sh | sh
fi
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/override.conf >/dev/null <<'OVERRIDE'
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
OVERRIDE
sudo systemctl daemon-reload
sudo systemctl enable --now ollama 2>/dev/null || true
sudo systemctl restart ollama
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf --max-time 3 http://127.0.0.1:11434/v1/models >/dev/null; then
    break
  fi
  sleep 2
done
ollama pull llama3.2 || ollama pull llama3.2:1b
REMOTE

export HERMES_LLM_API_URL="http://${TARGET_HOST}:11434/v1"
export HERMES_LLM_MODEL=llama3.2
exec "${SCRIPT_DIR}/configure-llm-remote.sh" "${TARGET_HOST}" "${TARGET_USER}"
