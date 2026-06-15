#!/usr/bin/env bash
# ============================================================================
# test-all-features-remote.sh — orchestrate Hermes E2E tiers from laptop
# ============================================================================
#
# Usage:
#   ./scripts/test-all-features-remote.sh <host> [ssh_user]
#
# Environment:
#   HERMES_TEST_TIERS   Comma list, or preset: quick | full
#     quick → smoke
#     full  → smoke,verify-remote
#   HERMES_E2E_BASE     Base URL (default http://HOST:31847)
#   HERMES_E2E_REPORT_JSON  Optional path for JSON summary
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
HOST="${1:-${HERMES_REMOTE_HOST:-${DEPLOY_HOST:-}}}"
USER="${2:-${HERMES_REMOTE_USER:-${DEPLOY_USER:-sus}}}"
NODE_PORT="${HERMES_NODE_PORT:-31847}"
TIERS_RAW="${HERMES_TEST_TIERS:-smoke}"

if [[ -z "${HOST}" ]]; then
  echo "Usage: $0 <host> [ssh_user]" >&2
  exit 1
fi

case "${TIERS_RAW}" in
  quick) TIERS="smoke" ;;
  full) TIERS="smoke,verify-remote" ;;
  *) TIERS="${TIERS_RAW}" ;;
esac

export HERMES_E2E_BASE="${HERMES_E2E_BASE:-http://${HOST}:${NODE_PORT}}"
export HERMES_REMOTE_HOST="${HOST}"
export HERMES_REMOTE_USER="${USER}"
export DEPLOY_HOST="${HOST}"
export DEPLOY_USER="${USER}"

FAIL=0
PASS_TIERS=0
SUITE_START=$(date +%s)
TIER_RESULTS=()

B='\033[1m'
G='\033[0;32m'
R='\033[0;31m'
N='\033[0m'

tier_enabled() {
  echo "${TIERS}" | tr ',' '\n' | grep -qx "${1}"
}

record_tier() {
  local name="$1" status="$2" elapsed="$3"
  TIER_RESULTS+=("${name}:${status}:${elapsed}")
}

run_tier_cmd() {
  local name="$1"
  shift
  local start end elapsed rc
  start=$(date +%s)
  echo ""
  echo -e "${B}══════════════════════════════════════════════${N}"
  echo -e "${B}  Tier: ${name}${N}"
  echo -e "${B}══════════════════════════════════════════════${N}"
  set +e
  "$@"
  rc=$?
  set -e
  end=$(date +%s)
  elapsed=$((end - start))
  if [[ "${rc}" -eq 0 ]]; then
    echo -e "${G}  Tier ${name}: PASSED (${elapsed}s)${N}"
    PASS_TIERS=$((PASS_TIERS + 1))
    record_tier "${name}" "passed" "${elapsed}"
    return 0
  fi
  echo -e "${R}  Tier ${name}: FAILED (${elapsed}s)${N}"
  FAIL=$((FAIL + 1))
  record_tier "${name}" "failed" "${elapsed}"
  return 1
}

write_report_json() {
  local report="${HERMES_E2E_REPORT_JSON:-}"
  [[ -z "${report}" ]] && return 0
  local total_elapsed=$(( $(date +%s) - SUITE_START ))
  {
    echo "{"
    echo "  \"product\": \"hermes\","
    echo "  \"host\": \"${HOST}\","
    echo "  \"api\": \"${HERMES_E2E_BASE}\","
    echo "  \"tiers\": \"${TIERS}\","
    echo "  \"passed_tiers\": ${PASS_TIERS},"
    echo "  \"failed_tiers\": ${FAIL},"
    echo "  \"elapsed_seconds\": ${total_elapsed},"
    echo "  \"results\": ["
    local i=0
    for entry in "${TIER_RESULTS[@]}"; do
      IFS=':' read -r name status elapsed <<< "${entry}"
      [[ $i -gt 0 ]] && echo ","
      printf '    {"tier":"%s","status":"%s","elapsed_seconds":%s}' "${name}" "${status}" "${elapsed}"
      i=$((i + 1))
    done
    echo ""
    echo "  ]"
    echo "}"
  } > "${report}"
  echo "  Report: ${report}"
}

echo -e "${B}Hermes feature test suite${N}"
echo "  API:    ${HERMES_E2E_BASE}"
echo "  SSH:    ${USER}@${HOST}"
echo "  Tiers:  ${TIERS}"
echo ""

if tier_enabled smoke; then
  run_tier_cmd smoke env HERMES_E2E_BASE="${HERMES_E2E_BASE}" \
    "${SCRIPT_DIR}/e2e-deploy-verify.sh" "${HERMES_E2E_BASE}" || true
fi

if tier_enabled verify-remote; then
  run_tier_cmd verify-remote "${SCRIPT_DIR}/deploy-remote.sh" "${HOST}" "${USER}" --verify-only --skip-e2e || true
fi

write_report_json

echo ""
echo -e "${B}══════════════════════════════════════════════${N}"
if [[ "${FAIL}" -eq 0 ]]; then
  echo -e "${G}${B}  ALL TIERS PASSED${N}"
  exit 0
fi
echo -e "${R}${B}  ${FAIL} tier(s) failed${N}"
exit 1
