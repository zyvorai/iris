#!/usr/bin/env bash
# Apply Zyra AI LLM settings to an existing Iris remote deployment (Helm only).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
usage() {
    cat <<'EOF'
Usage: configure-llm-remote.sh <host> <user> [api-key]

Requires IRIS_LLM_API_URL (and optionally IRIS_LLM_MODEL) in the environment.
The API key can be passed as the third argument or via IRIS_LLM_API_KEY.

Examples:
  IRIS_LLM_API_URL=https://api.openai.com/v1 \
  IRIS_LLM_API_KEY=sk-... \
    ./scripts/configure-llm-remote.sh <host> <user>

  IRIS_LLM_API_URL=http://<host>:11434/v1 IRIS_LLM_MODEL=llama3.2 \
    ./scripts/configure-llm-remote.sh <host> <user>

  # Or use ./scripts/setup-ollama-remote.sh (installs Ollama, binds 0.0.0.0, sets node IP URL)
EOF
}

TARGET_HOST="${1:-}"
TARGET_USER="${2:-root}"
TARGET_PASS="${3:-${IRIS_LLM_API_KEY:-}}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || -z "${TARGET_HOST}" ]]; then
    usage
    exit 0
fi

if [[ -z "${IRIS_LLM_API_URL:-}" ]]; then
    echo "IRIS_LLM_API_URL is required" >&2
    exit 1
fi

export IRIS_LLM_API_KEY="${TARGET_PASS}"
export IRIS_NAMESPACE="${IRIS_NAMESPACE:-iris-system}"
export IRIS_NODE_PORT="${IRIS_NODE_PORT:-31847}"

exec "${SCRIPT_DIR}/deploy-remote.sh" "${TARGET_HOST}" "${TARGET_USER}" --skip-sync --skip-build --skip-e2e
