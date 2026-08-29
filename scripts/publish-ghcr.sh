#!/usr/bin/env bash
# Publish Hermes Docker images + Helm chart to ghcr.io/zyvorai from the remote build server.
#
# Usage:
#   ZYVORAI_GHCR_TOKEN=<pat> ./scripts/publish-ghcr.sh [host] [user] [version]
#
# Example:
#   ZYVORAI_GHCR_TOKEN=ghp_xxx ./scripts/publish-ghcr.sh 212.8.248.187 sus 0.2.0

set -euo pipefail

HOST="${1:-212.8.248.187}"
RUSER="${2:-sus}"
VERSION="${3:-0.2.0}"
REMOTE="${RUSER}@${HOST}"
ORG="zyvorai"

if [[ -z "${ZYVORAI_GHCR_TOKEN:-}" ]]; then
  echo "Error: set ZYVORAI_GHCR_TOKEN before running" >&2
  echo "  export ZYVORAI_GHCR_TOKEN='ghp_...'" >&2
  exit 1
fi

echo "==> Publishing hermes v${VERSION} to ghcr.io/${ORG}"

# ── 1. Push Docker images ───────────────────────────────────────────────────
echo "==> [1/2] Pushing Docker images to ghcr.io/${ORG}"
ssh "$REMOTE" bash -s <<ENDSSH
set -euo pipefail
echo "${ZYVORAI_GHCR_TOKEN}" | podman login ghcr.io -u ${ORG} --password-stdin

for img in hermes-server hermes-controller; do
  podman tag docker.io/library/\${img}:latest ghcr.io/${ORG}/\${img}:${VERSION} 2>/dev/null || true
  podman tag docker.io/library/\${img}:latest ghcr.io/${ORG}/\${img}:latest 2>/dev/null || true
  podman push ghcr.io/${ORG}/\${img}:${VERSION} 2>/dev/null || echo "Skipping \${img} (not yet built locally)"
  podman push ghcr.io/${ORG}/\${img}:latest 2>/dev/null || true
done
echo "Images pushed."
ENDSSH

# ── 2. Push Helm chart ──────────────────────────────────────────────────────
echo "==> [2/2] Packaging and pushing Helm chart to oci://ghcr.io/${ORG}/charts"

CHARTS_DIR="/tmp/hermes-charts-${VERSION}"
ssh "$REMOTE" "mkdir -p ${CHARTS_DIR}"
rsync -az --delete charts/ "${REMOTE}:${CHARTS_DIR}/"

ssh "$REMOTE" bash -s <<ENDSSH
set -euo pipefail

if ! command -v helm &>/dev/null; then
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

echo "${ZYVORAI_GHCR_TOKEN}" | helm registry login ghcr.io -u ${ORG} --password-stdin

mkdir -p /tmp/helm-packages
helm package "${CHARTS_DIR}/hermes" -d /tmp/helm-packages

for tgz in /tmp/helm-packages/*.tgz; do
  echo "Pushing \$tgz"
  helm push "\$tgz" oci://ghcr.io/${ORG}/charts
done

rm -rf /tmp/helm-packages ${CHARTS_DIR}
echo "Chart pushed to oci://ghcr.io/${ORG}/charts"
ENDSSH

echo ""
echo "✓ Done. Customer install:"
echo "  helm install hermes oci://ghcr.io/${ORG}/charts/hermes --version ${VERSION} \\"
echo "    --namespace hermes-system --create-namespace"
