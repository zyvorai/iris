#!/usr/bin/env bash
# Delegate Axiom + Hermes platform E2E to the Axiom orchestrator.
#
# Usage:
#   ./scripts/test-platform-remote.sh <host> [ssh_user]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=lib/resolve-zyvor-sibling.sh
source "${SCRIPT_DIR}/lib/resolve-zyvor-sibling.sh"

PLATFORM_SCRIPT="$(resolve_zyvor_script "${REPO_ROOT}" Axiom "scripts/test-platform-remote.sh")" || {
  echo "ERROR: Axiom platform orchestrator not found. Clone sibling axiom/ or set AXIOM_REPO." >&2
  exit 1
}

exec "${PLATFORM_SCRIPT}" "$@"
