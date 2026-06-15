#!/usr/bin/env bash
# Full remote deploy (rsync + K3s + images + Helm + E2E).
#
# Examples:
#   ./scripts/deploy-all-remote.sh 212.8.252.194 sus
#   ./scripts/deploy-all-remote.sh sus@212.8.252.194 --quick
#   make deploy-all-remote
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DEFAULT_HOST="${DEPLOY_HOST:-${HERMES_HOST:-212.8.252.194}}"
DEFAULT_USER="${DEPLOY_USER:-${HERMES_USER:-sus}}"

ARGS=()
if [[ $# -eq 0 ]]; then
  ARGS=("${DEFAULT_HOST}" "${DEFAULT_USER}")
elif [[ "${1}" != --* && "${1}" != "-h" && "${1}" != "--help" ]]; then
  ARGS=("$@")
else
  ARGS=("${DEFAULT_HOST}" "${DEFAULT_USER}" "$@")
fi

exec "${SCRIPT_DIR}/deploy-remote.sh" "${ARGS[@]}"
