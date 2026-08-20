#!/usr/bin/env bash
# Apply Zyra AI LLM settings to an existing Hermes remote deployment (Helm only).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
usage() {
    cat <<'EOF'
Usage: configure-llm-remote.sh <host> <user> [api-key]

Requires HERMES_LLM_API_URL (and optionally HERMES_LLM_MODEL) in the environment.
The API key can be passed as the third argument or via HERMES_LLM_API_KEY.

Examples:
  HERMES_LLM_API_URL=https://api.openai.com/v1 \
  HERMES_LLM_API_KEY=sk-... \
    ./scripts/configure-llm-remote.sh 175.110.114.93 sus

  HERMES_LLM_API_URL=http://175.110.114.93:11434/v1 HERMES_LLM_MODEL=llama3.2 \
    ./scripts/configure-llm-remote.sh 175.110.114.93 sus

  # Or use ./scripts/setup-ollama-remote.sh (installs Ollama, binds 0.0.0.0, sets node IP URL)
EOF
}

TARGET_HOST="${1:-}"
TARGET_USER="${2:-root}"
TARGET_PASS="${3:-${HERMES_LLM_API_KEY:-}}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || -z "${TARGET_HOST}" ]]; then
    usage
    exit 0
fi

if [[ -z "${HERMES_LLM_API_URL:-}" ]]; then
    echo "HERMES_LLM_API_URL is required" >&2
    exit 1
fi

export HERMES_LLM_API_KEY="${TARGET_PASS}"
export HERMES_NAMESPACE="${HERMES_NAMESPACE:-hermes-system}"
export HERMES_NODE_PORT="${HERMES_NODE_PORT:-31847}"

exec "${SCRIPT_DIR}/deploy-remote.sh" "${TARGET_HOST}" "${TARGET_USER}" --skip-sync --skip-build --skip-e2e
