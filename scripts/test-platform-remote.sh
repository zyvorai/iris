#!/usr/bin/env bash
# Delegate Aether + Hermes platform E2E to the Aether orchestrator.
#
# Usage:
#   ./scripts/test-platform-remote.sh <host> [ssh_user]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=lib/resolve-zyvor-sibling.sh
source "${SCRIPT_DIR}/lib/resolve-zyvor-sibling.sh"

PLATFORM_SCRIPT="$(resolve_zyvor_script "${REPO_ROOT}" Aether "scripts/test-platform-remote.sh")" || {
  echo "ERROR: Aether platform orchestrator not found. Clone sibling Aether/ or set AETHER_REPO." >&2
  exit 1
}

exec "${PLATFORM_SCRIPT}" "$@"
