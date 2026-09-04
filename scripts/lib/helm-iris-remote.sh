#!/usr/bin/env bash
# Helm install/upgrade for Iris on remote cluster.
set -euo pipefail

HELM_NS="${HELM_NS:-iris-system}"
REMOTE_DIR="${REMOTE_DIR:?REMOTE_DIR required}"
IRIS_TAG="${IRIS_TAG:-0.1.0}"
IRIS_PUBLIC_HOST="${IRIS_PUBLIC_HOST:-}"
IRIS_NODE_PORT="${IRIS_NODE_PORT:-31847}"
USE_NODEPORT="${IRIS_USE_NODEPORT:-1}"

cd "${REMOTE_DIR}"

if [ -z "${IRIS_PUBLIC_HOST}" ]; then
    echo "IRIS_PUBLIC_HOST is required (public IP or DNS name reachable by clients)" >&2
    exit 1
fi
PUBLIC_BASE="https://${IRIS_PUBLIC_HOST}:${IRIS_NODE_PORT}"

SYS_K3S="/etc/rancher/k3s/k3s.yaml"
if [ -f "${SYS_K3S}" ]; then
    if [ -r "${SYS_K3S}" ]; then
        export KUBECONFIG="${SYS_K3S}"
    else
        mkdir -p "${HOME}/.kube"
        KCFG="${HOME}/.kube/iris-k3s.yaml"
        sudo cat "${SYS_K3S}" > "${KCFG}"
        chmod 600 "${KCFG}"
        export KUBECONFIG="${KCFG}"
    fi
fi

kubectl cluster-info >/dev/null
kubectl create namespace "${HELM_NS}" --dry-run=client -o yaml | kubectl apply -f -

helm_args=(
    upgrade --install iris ./charts/iris
    -n "${HELM_NS}"
    --create-namespace
    --wait --timeout 8m
    --set "global.domain=${IRIS_PUBLIC_HOST}"
    --set "image.controller.repository=iris-controller"
    --set "image.server.repository=iris-server"
    --set "image.controller.tag=${IRIS_TAG}"
    --set "image.server.tag=${IRIS_TAG}"
    --set "image.controller.pullPolicy=Never"
    --set "image.server.pullPolicy=Never"
    --set "controller.publicBaseUrl=${PUBLIC_BASE}"
    --set "global.publicPathPrefix=/launchpad"
    --set "controller.publicPathPrefix=/launchpad"
    --set "controller.autoSuggest=true"
    --set "controller.discoverAll=true"
    --set "controller.autoPublish=false"
    --set "service.type=NodePort"
    --set "service.nodePort=${IRIS_NODE_PORT}"
    --set "ingress.enabled=false"
    --set "demoApps.enabled=${IRIS_DEMO_APPS:-true}"
)

if [ "${USE_NODEPORT}" = "1" ]; then
    helm_args+=(--set "ingress.enabled=false")
else
    helm_args+=(
        --set "ingress.enabled=true"
        --set "ingress.host=iris.${IRIS_PUBLIC_HOST}"
    )
fi

if [ -n "${IRIS_LLM_API_URL:-}" ]; then
    helm_args+=(--set "server.llm.apiUrl=${IRIS_LLM_API_URL}")
fi
if [ -n "${IRIS_LLM_MODEL:-}" ]; then
    helm_args+=(--set "server.llm.model=${IRIS_LLM_MODEL}")
fi
if [ -n "${IRIS_LLM_API_KEY:-}" ]; then
    kubectl create secret generic iris-llm \
        --from-literal=apiKey="${IRIS_LLM_API_KEY}" \
        -n "${HELM_NS}" \
        --dry-run=client -o yaml | kubectl apply -f -
    helm_args+=(--set "server.llm.existingSecret=iris-llm")
    helm_args+=(--set "server.llm.apiKey=")
fi

if [ -n "${IRIS_OIDC_ISSUER:-}" ]; then
    OIDC_REDIRECT_URL="${IRIS_OIDC_REDIRECT_URL:-${PUBLIC_BASE}/auth/callback}"
    helm_args+=(
        --set "server.auth.mode=oidc"
        --set "server.auth.oidc.issuer=${IRIS_OIDC_ISSUER}"
        --set "server.auth.oidc.clientId=${IRIS_OIDC_CLIENT_ID:-}"
        --set "server.auth.oidc.redirectUrl=${OIDC_REDIRECT_URL}"
    )
    if [ -n "${IRIS_OIDC_CLIENT_SECRET:-}" ]; then
        kubectl create secret generic iris-oidc \
            --from-literal=clientSecret="${IRIS_OIDC_CLIENT_SECRET}" \
            -n "${HELM_NS}" \
            --dry-run=client -o yaml | kubectl apply -f -
        helm_args+=(--set "server.auth.oidc.existingSecret=iris-oidc")
    fi
fi

helm "${helm_args[@]}"

echo ""
echo "Iris release:"
kubectl -n "${HELM_NS}" get pods,svc,pvc
echo ""
echo "Public URL: ${PUBLIC_BASE}"
