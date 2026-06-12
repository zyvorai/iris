#!/usr/bin/env bash
# Hermes — Remote deployment (SSH + rsync + K3s/Helm)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=scripts/lib/k3s-image-import.sh
source "${SCRIPT_DIR}/lib/k3s-image-import.sh"

VERSION="0.1.0"
REMOTE_DIR=""
DEPLOY_PROFILE="k3s"
DEPLOY_LOG="${HERMES_DEPLOY_LOG:-${HOME}/.hermes/deploy-$(date +%Y%m%d-%H%M%S).log}"

HERMES_NAMESPACE="${HERMES_NAMESPACE:-hermes-system}"
HERMES_NODE_PORT="${HERMES_NODE_PORT:-31847}"
HERMES_TAG="${HERMES_TAG:-$(git -C "${PROJECT_DIR}" rev-parse --short HEAD 2>/dev/null || echo 0.1.0)}"

K3S_MODE=true
SKIP_CLUSTER_SETUP=false
QUICK_MODE=false
UNINSTALL=false
DRY_RUN=false
SKIP_SYNC=false
SKIP_VERIFY=false
SKIP_E2E=false
SKIP_BUILD=false
VERIFY_ONLY=false
PREFLIGHT_ONLY=false
WITH_DEMO_APPS=true
VERBOSE=false
SSH_RETRIES="${HERMES_SSH_RETRIES:-3}"
DEPLOY_AND_TEST=false
POSITIONAL=()

usage() {
    cat <<EOF
Hermes remote deploy v${VERSION}

Usage:
  $0 <host> <user> [options]
  $0 user@host [options]

Profiles:
  --k3s (default)   Bootstrap K3s if needed, build images, Helm install
  --k8s             Use existing cluster kubeconfig on remote
  --quick           Skip image rebuild when tags already exist

Options:
  --help            Show help
  --dry-run         Print plan only
  --preflight-only  SSH + disk checks
  --verify-only     Run verify + E2E only
  --skip-sync       Skip rsync
  --skip-verify     Skip remote verify
  --skip-e2e        Skip post-deploy E2E
  --skip-build      Skip podman/docker build (helm only)
  --no-demo-apps    Do not install Grafana/Prometheus demo services
  --uninstall       Remove Hermes from cluster

Environment:
  HERMES_NAMESPACE     K8s namespace (default: hermes-system)
  HERMES_NODE_PORT     NodePort (default: 31847)
  HERMES_TAG           Image tag (default: 0.1.0)

Examples:
  $0 212.8.252.194 sus deploy
  $0 sus@212.8.252.194 --k8s
  $0 212.8.252.194 sus --skip-build
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        --k3s) K3S_MODE=true; SKIP_CLUSTER_SETUP=false; DEPLOY_PROFILE=k3s; shift ;;
        --k8s) K3S_MODE=true; SKIP_CLUSTER_SETUP=true; DEPLOY_PROFILE=k8s; shift ;;
        --quick) QUICK_MODE=true; shift ;;
        --uninstall) UNINSTALL=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --skip-sync) SKIP_SYNC=true; shift ;;
        --skip-verify) SKIP_VERIFY=true; shift ;;
        --skip-e2e) SKIP_E2E=true; shift ;;
        --skip-build) SKIP_BUILD=true; shift ;;
        --verify-only) VERIFY_ONLY=true; shift ;;
        --preflight-only) PREFLIGHT_ONLY=true; shift ;;
        --no-demo-apps) WITH_DEMO_APPS=false; shift ;;
        -v|--verbose) VERBOSE=true; shift ;;
        deploy) DEPLOY_AND_TEST=true; shift ;;
        *) POSITIONAL+=("$1"); shift ;;
    esac
done

TARGET_HOST="${POSITIONAL[0]:-}"
TARGET_USER="${POSITIONAL[1]:-root}"
TARGET_PASS="${POSITIONAL[2]:-}"

if [[ -n "${TARGET_HOST}" && "${TARGET_HOST}" == *"@"* ]]; then
    TARGET_USER="${TARGET_HOST%%@*}"
    TARGET_HOST="${TARGET_HOST#*@}"
fi

_use_color() { [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; }
if _use_color; then
    C_OK=$'\033[32m'; C_FAIL=$'\033[31m'; C_INFO=$'\033[36m'; C_WARN=$'\033[33m'
    C_DIM=$'\033[2m'; C_BOLD=$'\033[1m'; C_RST=$'\033[0m'
else
    C_OK= C_FAIL= C_INFO= C_WARN= C_DIM= C_BOLD= C_RST=
fi

_log() { mkdir -p "$(dirname "$DEPLOY_LOG")" 2>/dev/null || true; echo "[$(date -Iseconds)] $*" >>"$DEPLOY_LOG" 2>/dev/null || true; }
ok()   { echo "${C_OK}  ✅ $*${C_RST}"; _log "OK $*"; }
fail() { echo "${C_FAIL}  ❌ $*${C_RST}" >&2; _log "FAIL $*"; exit 1; }
info() { echo "${C_INFO}  💡 $*${C_RST}"; _log "INFO $*"; }
warn() { echo "${C_WARN}  ⚠️  $*${C_RST}"; _log "WARN $*"; }

SSH_OPTS="-o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=20 -o ServerAliveInterval=30"
[ -z "${TARGET_PASS}" ] && SSH_OPTS+=" -o BatchMode=yes -o PreferredAuthentications=publickey"

_ssh() {
    local n=1 ec=1
    while [ "$n" -le "${SSH_RETRIES}" ]; do
        if [ -n "${TARGET_PASS}" ] && command -v sshpass &>/dev/null; then
            SSHPASS="${TARGET_PASS}" sshpass -e ssh ${SSH_OPTS} "${TARGET_USER}@${TARGET_HOST}" "$@"
        else
            ssh ${SSH_OPTS} "${TARGET_USER}@${TARGET_HOST}" "$@"
        fi
        ec=$?
        [ "$ec" -eq 0 ] && return 0
        # Only retry transport failures (255); re-running failed remote commands hides real errors.
        if [ "$ec" -ne 255 ] || [ "$n" -ge "${SSH_RETRIES}" ]; then
            return "$ec"
        fi
        n=$((n + 1))
        warn "SSH connection retry ${n}/${SSH_RETRIES}" && sleep 2
    done
    return "$ec"
}

_rsync() {
    local opts=(-az)
    [ "$VERBOSE" = true ] && opts+=(--progress) || opts+=(--delete)
    if [ -n "${TARGET_PASS}" ] && command -v sshpass &>/dev/null; then
        SSHPASS="${TARGET_PASS}" rsync "${opts[@]}" -e "sshpass -e ssh ${SSH_OPTS}" "$@"
    else
        rsync "${opts[@]}" -e "ssh ${SSH_OPTS}" "$@"
    fi
}

print_banner() {
    echo ""
    echo "${C_BOLD}  Hermes Remote Deploy v${VERSION}${C_RST}"
    echo "${C_DIM}  ${TARGET_USER}@${TARGET_HOST} · profile=${DEPLOY_PROFILE} · log=${DEPLOY_LOG}${C_RST}"
    echo ""
}

validate() {
    [ -n "${TARGET_HOST}" ] || { usage; exit 1; }
    [ -f "${PROJECT_DIR}/charts/hermes/Chart.yaml" ] || fail "Not in hermes repo"
}

check_connectivity() {
    info "Connecting SSH → ${TARGET_USER}@${TARGET_HOST}"
    if [ "$DRY_RUN" = true ]; then
        REMOTE_DIR="${HOME}/.deployments/hermes"
        return 0
    fi
    _ssh "echo ok" >/dev/null || fail "SSH failed — try: ssh-copy-id ${TARGET_USER}@${TARGET_HOST}"
    local rh
    rh=$(_ssh "echo \$HOME" | tr -d '\r')
    REMOTE_DIR="${rh}/.deployments/hermes"
    ok "SSH OK · remote=${REMOTE_DIR}"
}

preflight_remote() {
    info "Preflight checks..."
    [ "$DRY_RUN" = true ] && return 0
    _ssh bash <<'REMOTE' || fail "Preflight failed"
set -e
echo "  host: $(hostname -f 2>/dev/null || hostname)"
echo "  os:   $(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || uname -s)"
echo "  arch: $(uname -m)"
echo "  mem:  $(free -h 2>/dev/null | awk '/^Mem:/{print $2}' || echo n/a)"
echo "  disk: $(df -h / 2>/dev/null | awk 'NR==2{print $4 " free"}' || echo n/a)"
if [ "$(id -u)" -ne 0 ] && ! sudo -n true 2>/dev/null; then
    echo "  ❌ passwordless sudo required for k3s/helm"
    exit 1
fi
REMOTE
    ok "Preflight passed"
}

ensure_remote_dir() {
    _ssh "mkdir -p '${REMOTE_DIR}'" || fail "Could not create remote dir ${REMOTE_DIR}"
}

sync_files() {
    [ "$SKIP_SYNC" = true ] && info "Skipping sync" && return 0
    ensure_remote_dir
    _rsync \
        --exclude '.git' --exclude 'target' --exclude 'ui/node_modules' --exclude 'ui/dist' \
        --exclude 'bin' --exclude '.hermes' \
        "${PROJECT_DIR}/" "${TARGET_USER}@${TARGET_HOST}:${REMOTE_DIR}/"
    ok "Sources synced"
}

setup_k3s() {
    [ "$SKIP_CLUSTER_SETUP" = true ] && info "Skipping K3s bootstrap (--k8s)" && return 0
    info "Ensuring K3s + kubectl + helm..."
    _ssh bash <<'REMOTE'
set -e
SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"
if ! command -v k3s >/dev/null 2>&1; then
    echo "Installing K3s..."
    curl -sfL https://get.k3s.io | $SUDO INSTALL_K3S_EXEC="--disable=traefik" sh -
    for i in $(seq 1 60); do
        $SUDO kubectl get nodes &>/dev/null && break
        sleep 2
    done
fi
if ! command -v helm >/dev/null 2>&1; then
    curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi
if [ -f /etc/rancher/k3s/k3s.yaml ]; then
    mkdir -p "$HOME/.kube"
    if [ -r /etc/rancher/k3s/k3s.yaml ]; then
        export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    else
        $SUDO cat /etc/rancher/k3s/k3s.yaml > "$HOME/.kube/hermes-k3s.yaml"
        chmod 600 "$HOME/.kube/hermes-k3s.yaml"
        export KUBECONFIG="$HOME/.kube/hermes-k3s.yaml"
    fi
fi
kubectl get nodes
REMOTE
    ok "Cluster ready"
}

build_images_remote() {
    [ "$SKIP_BUILD" = true ] && info "Skipping image build" && return 0
    info "Building Hermes images on remote..."
    _ssh env REMOTE_DIR="${REMOTE_DIR}" HERMES_TAG="${HERMES_TAG}" bash <<'REMOTE' || fail "Remote image build failed"
set -e
mkdir -p "${REMOTE_DIR}"
cd "${REMOTE_DIR}" || { echo "REMOTE_DIR missing: ${REMOTE_DIR}"; exit 1; }
SUDO=""
[ "$(id -u)" -ne 0 ] && SUDO="sudo"

if command -v dnf >/dev/null; then
    $SUDO dnf install -y gcc make git curl 2>/dev/null || true
elif command -v apt-get >/dev/null; then
    $SUDO apt-get update -qq && $SUDO apt-get install -y -qq build-essential git curl 2>/dev/null || true
fi

if ! command -v go >/dev/null; then
    GO_VER=1.23.6
    curl -fsSL "https://go.dev/dl/go${GO_VER}.linux-amd64.tar.gz" | $SUDO tar -C /usr/local -xz
    export PATH="/usr/local/go/bin:$PATH"
fi

if ! command -v cargo >/dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi
source "$HOME/.cargo/env" 2>/dev/null || true

if ! command -v node >/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash - 2>/dev/null || true
    $SUDO dnf install -y nodejs 2>/dev/null || $SUDO apt-get install -y nodejs npm 2>/dev/null || true
fi

DOCKER_BIN=""
command -v podman >/dev/null && DOCKER_BIN=podman
command -v docker >/dev/null && docker info >/dev/null 2>&1 && DOCKER_BIN=docker
[ -n "$DOCKER_BIN" ] || { echo "Install podman or docker"; exit 1; }

echo "Building UI..."
(cd "${REMOTE_DIR}/ui" && npm ci && npm run build)

echo "Building Rust server..."
(cd "${REMOTE_DIR}" && cargo build --release -p hermes-server)

echo "Building Go controller..."
(cd "${REMOTE_DIR}/cmd/hermes-controller" && go build -o /tmp/hermes-controller .)

TAG="${HERMES_TAG}"
mkdir -p "${REMOTE_DIR}"
if ! (cd "${REMOTE_DIR}" && $DOCKER_BIN build -f Dockerfile.server -t "hermes-server:${TAG}" .) 2>&1; then
    echo "Full server image build failed — using runtime Dockerfile with local artifacts"
    mkdir -p "${REMOTE_DIR}"
    (cd "${REMOTE_DIR}" && $DOCKER_BIN build -f Dockerfile.server.runtime -t "hermes-server:${TAG}" .)
fi
mkdir -p "${REMOTE_DIR}"
(cd "${REMOTE_DIR}" && $DOCKER_BIN build -f Dockerfile.controller -t "hermes-controller:${TAG}" .)

if [ -f "${REMOTE_DIR}/scripts/lib/k3s-image-import.sh" ]; then
    source "${REMOTE_DIR}/scripts/lib/k3s-image-import.sh"
    k3s_import_oci_image "hermes-controller:${TAG}" "$DOCKER_BIN"
    k3s_import_oci_image "hermes-server:${TAG}" "$DOCKER_BIN"
fi
echo "Images: hermes-controller:${TAG} hermes-server:${TAG}"
REMOTE
    ok "Images built and imported"
}

deploy_helm() {
    info "Helm install/upgrade..."
    ensure_remote_dir
    [ "$SKIP_SYNC" = true ] || sync_files
    _ssh env \
        REMOTE_DIR="${REMOTE_DIR}" \
        HELM_NS="${HERMES_NAMESPACE}" \
        HERMES_TAG="${HERMES_TAG}" \
        HERMES_PUBLIC_HOST="${TARGET_HOST}" \
        HERMES_NODE_PORT="${HERMES_NODE_PORT}" \
        HERMES_USE_NODEPORT=1 \
        HERMES_DEMO_APPS="${WITH_DEMO_APPS}" \
        bash <<'REMOTE' || fail "Helm deploy failed"
set -euo pipefail
cd "${REMOTE_DIR}"
source scripts/lib/open-host-firewall-ports.sh
open_hermes_firewall_ports || true
export HERMES_TAG HELM_NS HERMES_PUBLIC_HOST="${HERMES_PUBLIC_HOST}" HERMES_NODE_PORT
bash scripts/lib/helm-hermes-remote.sh
cd /
REMOTE
    ok "Helm release applied"
}

restart_hermes_pods() {
    [ "$SKIP_BUILD" = true ] && return 0
    info "Restarting Hermes pods to pick up rebuilt images..."
    _ssh env HELM_NS="${HERMES_NAMESPACE}" bash <<'REMOTE' || fail "Pod restart failed"
set -euo pipefail
if [ -f /etc/rancher/k3s/k3s.yaml ]; then
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    [ -r /etc/rancher/k3s/k3s.yaml ] || export KUBECONFIG="$HOME/.kube/hermes-k3s.yaml"
fi
kubectl -n "${HELM_NS}" rollout restart deploy/hermes
kubectl -n "${HELM_NS}" rollout status deploy/hermes --timeout=5m
REMOTE
    ok "Pods restarted with fresh images"
}

require_hermes_ready() {
    info "Waiting for Hermes pods..."
    _ssh env HELM_NS="${HERMES_NAMESPACE}" bash <<'REMOTE' || fail "Hermes did not become ready"
set -euo pipefail
if [ -f /etc/rancher/k3s/k3s.yaml ]; then
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    [ -r /etc/rancher/k3s/k3s.yaml ] || export KUBECONFIG="$HOME/.kube/hermes-k3s.yaml"
fi
if ! helm status hermes -n "${HELM_NS}" >/dev/null 2>&1; then
    echo "Helm release 'hermes' not found in ${HELM_NS}"
    exit 1
fi
kubectl -n "${HELM_NS}" rollout status deploy/hermes --timeout=5m
kubectl -n "${HELM_NS}" get pods,svc
REMOTE
    ok "Hermes is ready"
}

verify_remote() {
    info "Verifying Hermes on ${TARGET_HOST}..."
    [ "$DRY_RUN" = true ] && return 0
    _ssh env HELM_NS="${HERMES_NAMESPACE}" bash <<'REMOTE' || fail "Remote verification failed"
set -e
if [ -f /etc/rancher/k3s/k3s.yaml ]; then
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    [ -r /etc/rancher/k3s/k3s.yaml ] || export KUBECONFIG="$HOME/.kube/hermes-k3s.yaml"
fi
echo "=== Pods ==="
kubectl -n "${HELM_NS}" get pods -o wide
echo "=== Service ==="
kubectl -n "${HELM_NS}" get svc hermes-server
REMOTE
}

run_e2e() {
    [ "$SKIP_E2E" = true ] && return 0
    local e2e="${SCRIPT_DIR}/e2e-deploy-verify.sh"
    [ -f "$e2e" ] || return 0
    chmod +x "$e2e"
    info "Post-deploy E2E..."
    HERMES_E2E_BASE="http://${TARGET_HOST}:${HERMES_NODE_PORT}" \
        HERMES_NAMESPACE="${HERMES_NAMESPACE}" \
        "$e2e" || warn "E2E reported issues (see above)"
}

do_uninstall() {
    info "Uninstalling Hermes..."
    _ssh env HELM_NS="${HERMES_NAMESPACE}" bash <<'REMOTE'
set -e
if [ -f /etc/rancher/k3s/k3s.yaml ]; then
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    [ -r /etc/rancher/k3s/k3s.yaml ] || export KUBECONFIG="$HOME/.kube/hermes-k3s.yaml"
fi
helm uninstall hermes -n "${HELM_NS}" 2>/dev/null || true
kubectl delete namespace hermes-demo --ignore-not-found 2>/dev/null || true
echo "Hermes removed"
REMOTE
    ok "Uninstalled"
}

print_summary() {
    echo ""
    ok "Deploy complete"
    echo ""
    echo "  Hermes Dock:  http://${TARGET_HOST}:${HERMES_NODE_PORT}/"
    echo "  Health:       curl -sf http://${TARGET_HOST}:${HERMES_NODE_PORT}/healthz"
    echo "  API:          curl -sf http://${TARGET_HOST}:${HERMES_NODE_PORT}/api/v1/apps"
    echo "  Namespace:    ${HERMES_NAMESPACE}"
    echo "  Log:          ${DEPLOY_LOG}"
    echo ""
    echo "  kubectl -n ${HERMES_NAMESPACE} get pods"
    echo "  ./scripts/e2e-deploy-verify.sh http://${TARGET_HOST}:${HERMES_NODE_PORT}"
    echo ""
}

main() {
    print_banner
    validate
    check_connectivity
    preflight_remote

    if [ "$PREFLIGHT_ONLY" = true ]; then ok "Preflight-only done"; exit 0; fi
    if [ "$UNINSTALL" = true ]; then do_uninstall; exit 0; fi
    if [ "$VERIFY_ONLY" = true ]; then
        verify_remote
        run_e2e
        print_summary
        exit 0
    fi

    sync_files
    setup_k3s
    if [ "$QUICK_MODE" != true ] || [ "$SKIP_BUILD" != true ]; then
        build_images_remote
    fi
    deploy_helm
    restart_hermes_pods
    require_hermes_ready
    [ "$SKIP_VERIFY" != true ] && verify_remote
    run_e2e
    print_summary
}

main "$@"
