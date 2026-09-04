#!/usr/bin/env bash
# Full remote deploy (rsync + K3s + images + Helm + E2E).
#
# Examples:
#   ./scripts/deploy-all-remote.sh <host> <user>
#   ./scripts/deploy-all-remote.sh <user>@<host> --quick
#   make deploy-all-remote
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DEFAULT_HOST="${DEPLOY_HOST:-${IRIS_HOST:-}}"
DEFAULT_USER="${DEPLOY_USER:-${IRIS_USER:-}}"

ARGS=()
if [[ $# -eq 0 ]]; then
  ARGS=("${DEFAULT_HOST}" "${DEFAULT_USER}")
elif [[ "${1}" != --* && "${1}" != "-h" && "${1}" != "--help" ]]; then
  ARGS=("$@")
else
  ARGS=("${DEFAULT_HOST}" "${DEFAULT_USER}" "$@")
fi

exec "${SCRIPT_DIR}/deploy-remote.sh" "${ARGS[@]}"
