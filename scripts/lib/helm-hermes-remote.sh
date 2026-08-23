#!/usr/bin/env bash
# Helm install/upgrade for Hermes on remote cluster.
set -euo pipefail

HELM_NS="${HELM_NS:-hermes-system}"
REMOTE_DIR="${REMOTE_DIR:?REMOTE_DIR required}"
HERMES_TAG="${HERMES_TAG:-0.1.0}"
HERMES_PUBLIC_HOST="${HERMES_PUBLIC_HOST:-}"
HERMES_NODE_PORT="${HERMES_NODE_PORT:-31847}"
USE_NODEPORT="${HERMES_USE_NODEPORT:-1}"

cd "${REMOTE_DIR}"

if [ -z "${HERMES_PUBLIC_HOST}" ]; then
    HERMES_PUBLIC_HOST="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi
PUBLIC_BASE="https://${HERMES_PUBLIC_HOST}:${HERMES_NODE_PORT}"

SYS_K3S="/etc/rancher/k3s/k3s.yaml"
if [ -f "${SYS_K3S}" ]; then
    if [ -r "${SYS_K3S}" ]; then
        export KUBECONFIG="${SYS_K3S}"
    else
        mkdir -p "${HOME}/.kube"
        KCFG="${HOME}/.kube/hermes-k3s.yaml"
        sudo cat "${SYS_K3S}" > "${KCFG}"
        chmod 600 "${KCFG}"
        export KUBECONFIG="${KCFG}"
    fi
fi

kubectl cluster-info >/dev/null
kubectl create namespace "${HELM_NS}" --dry-run=client -o yaml | kubectl apply -f -

helm_args=(
    upgrade --install hermes ./charts/hermes
    -n "${HELM_NS}"
    --create-namespace
    --wait --timeout 8m
    --set "global.domain=${HERMES_PUBLIC_HOST}"
    --set "image.controller.repository=hermes-controller"
    --set "image.server.repository=hermes-server"
    --set "image.controller.tag=${HERMES_TAG}"
    --set "image.server.tag=${HERMES_TAG}"
    --set "image.controller.pullPolicy=Never"
    --set "image.server.pullPolicy=Never"
    --set "controller.publicBaseUrl=${PUBLIC_BASE}"
    --set "global.publicPathPrefix=/launchpad"
    --set "controller.publicPathPrefix=/launchpad"
    --set "controller.autoSuggest=true"
    --set "controller.discoverAll=true"
    --set "controller.autoPublish=false"
    --set "service.type=NodePort"
    --set "service.nodePort=${HERMES_NODE_PORT}"
    --set "ingress.enabled=false"
    --set "demoApps.enabled=${HERMES_DEMO_APPS:-true}"
)

if [ "${USE_NODEPORT}" = "1" ]; then
    helm_args+=(--set "ingress.enabled=false")
else
    helm_args+=(
        --set "ingress.enabled=true"
        --set "ingress.host=hermes.${HERMES_PUBLIC_HOST}"
    )
fi

if [ -n "${HERMES_LLM_API_URL:-}" ]; then
    helm_args+=(--set "server.llm.apiUrl=${HERMES_LLM_API_URL}")
fi
if [ -n "${HERMES_LLM_MODEL:-}" ]; then
    helm_args+=(--set "server.llm.model=${HERMES_LLM_MODEL}")
fi
if [ -n "${HERMES_LLM_API_KEY:-}" ]; then
    kubectl create secret generic hermes-llm \
        --from-literal=apiKey="${HERMES_LLM_API_KEY}" \
        -n "${HELM_NS}" \
        --dry-run=client -o yaml | kubectl apply -f -
    helm_args+=(--set "server.llm.existingSecret=hermes-llm")
    helm_args+=(--set "server.llm.apiKey=")
fi

helm "${helm_args[@]}"

echo ""
echo "Hermes release:"
kubectl -n "${HELM_NS}" get pods,svc,pvc
echo ""
echo "Public URL: ${PUBLIC_BASE}"
