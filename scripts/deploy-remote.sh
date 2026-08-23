#!/usr/bin/env bash
# Hermes — Remote deployment (SSH + rsync + K3s/Helm)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=scripts/lib/k3s-image-import.sh
source "${SCRIPT_DIR}/lib/k3s-image-import.sh"

VERSION="0.2.0"
REMOTE_DIR=""
DEPLOY_PROFILE="k3s"
DEPLOY_LOG="${HERMES_DEPLOY_LOG:-${HOME}/.hermes/deploy-$(date +%Y%m%d-%H%M%S).log}"
DEPLOY_START=$SECONDS

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

# ── Usage ─────────────────────────────────────────────────────────────────────
usage() {
    cat <<'EOF'

  Usage:
    deploy-remote.sh <host> <user> [options]
    deploy-remote.sh user@host [options]

  Profiles:
    --k3s (default)    Bootstrap K3s, build images, Helm install
    --k8s              Use existing kubeconfig on remote
    --quick            Skip image rebuild when tag already exists

  Options:
    --help             Show this message
    --dry-run          Print plan only, no remote execution
    --preflight-only   SSH connectivity + disk/sudo checks
    --verify-only      Re-run verify + E2E against an existing deploy
    --skip-sync        Skip rsync
    --skip-verify      Skip remote pod/svc verify
    --skip-e2e         Skip post-deploy E2E suite
    --skip-build       Skip container image build (Helm only)
    --no-demo-apps     Do not install demo Grafana / Prometheus services
    --uninstall        Remove Hermes from cluster
    -v / --verbose     Stream remote build output

  Environment:
    HERMES_NAMESPACE   K8s namespace      (default: hermes-system)
    HERMES_NODE_PORT   NodePort           (default: 31847)
    HERMES_TAG         Image tag          (default: git short SHA)
    HERMES_SSH_RETRIES SSH retry count    (default: 3)
    HERMES_LLM_API_URL OpenAI-compatible chat completions base URL
    HERMES_LLM_API_KEY Bearer token (stored in K8s secret hermes-llm on remote)
    HERMES_LLM_MODEL   Model name         (default: gpt-4o-mini)
    HERMES_OIDC_ISSUER        OIDC issuer URL (sets server.auth.mode=oidc when non-empty)
    HERMES_OIDC_CLIENT_ID     OIDC client id
    HERMES_OIDC_CLIENT_SECRET OIDC client secret (stored in K8s secret hermes-oidc on remote)
    HERMES_OIDC_REDIRECT_URL  OIDC redirect URL (default: <public-url>/auth/callback)

  Examples:
    HERMES_LLM_API_URL=https://api.openai.com/v1 HERMES_LLM_API_KEY=sk-... deploy-remote.sh 212.8.252.194 sus
    HERMES_OIDC_ISSUER=http://212.8.252.194:30180/realms/hermes \
      HERMES_OIDC_CLIENT_ID=hermes HERMES_OIDC_CLIENT_SECRET=... deploy-remote.sh 212.8.252.194 sus
    deploy-remote.sh 212.8.252.194 sus
    deploy-remote.sh sus@212.8.252.194 --k8s --skip-build
    deploy-remote.sh 212.8.252.194 sus --quick --skip-e2e

EOF
}

# ── Arg parsing ───────────────────────────────────────────────────────────────
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

# ── Colors ────────────────────────────────────────────────────────────────────
_use_color() { [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; }
if _use_color; then
    C_OK=$'\033[32m'; C_FAIL=$'\033[31m'; C_WARN=$'\033[33m'
    C_INFO=$'\033[36m'; C_BLUE=$'\033[34m'
    C_DIM=$'\033[2m'; C_BOLD=$'\033[1m'; C_RST=$'\033[0m'
else
    C_OK=; C_FAIL=; C_WARN=; C_INFO=; C_BLUE=; C_DIM=; C_BOLD=; C_RST=
fi

# ── Logging ───────────────────────────────────────────────────────────────────
_log() {
    mkdir -p "$(dirname "$DEPLOY_LOG")" 2>/dev/null || true
    printf '[%s] %s\n' "$(date -Iseconds)" "$*" >>"$DEPLOY_LOG" 2>/dev/null || true
}

_STEP_START=0

ok()   { local e=$((SECONDS-_STEP_START)); printf "  ${C_OK}✓${C_RST}  %-52s ${C_DIM}%ds${C_RST}\n" "$*" "$e"; _log "OK $*"; }
fail() { _spin_stop 2>/dev/null || true; printf "\n  ${C_FAIL}✗${C_RST}  %s\n\n" "$*" >&2; _log "FAIL $*"; exit 1; }
info() { printf "  ${C_INFO}→${C_RST}  %s\n" "$*"; _log "INFO $*"; }
warn() { printf "  ${C_WARN}!${C_RST}  %s\n" "$*"; _log "WARN $*"; }
dim()  { printf "    ${C_DIM}%s${C_RST}\n" "$*"; }
hr()   { printf "\n  ${C_DIM}──────────────────────────────────────────────────────────${C_RST}\n\n"; }

step() {
    local n="$1" total="$2" label="$3"
    _STEP_START=$SECONDS
    printf "\n  ${C_BOLD}[%d/%d]${C_RST}  ${C_BOLD}%s${C_RST}\n" "$n" "$total" "$label"
}

# ── Spinner ───────────────────────────────────────────────────────────────────
_SPIN_PID=""

_spin_start() {
    _use_color || return 0
    local label="${1:-Working}"
    (
        local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
        local i=0 t=0
        while true; do
            printf "  \033[36m%s\033[0m  %s  \033[2m%ds\033[0m    \r" "${frames[i]}" "$label" "$t"
            sleep 0.1
            i=$(( (i + 1) % 10 ))
            [[ $i -eq 0 ]] && t=$((t + 1))
        done
    ) &
    _SPIN_PID=$!
}

_spin_stop() {
    [[ -n "${_SPIN_PID:-}" ]] || return 0
    kill "$_SPIN_PID" 2>/dev/null || true
    wait "$_SPIN_PID" 2>/dev/null || true
    _SPIN_PID=""
    printf "\r%-72s\r" ""
}

trap '_spin_stop 2>/dev/null || true' EXIT INT TERM

# ── SSH helpers ───────────────────────────────────────────────────────────────
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
        if [ "$ec" -ne 255 ] || [ "$n" -ge "${SSH_RETRIES}" ]; then
            return "$ec"
        fi
        n=$((n + 1))
        local _d=$(( 2 * (n - 1) )); _d=$(( _d < 2 ? 2 : _d > 30 ? 30 : _d ))
        warn "SSH retry ${n}/${SSH_RETRIES}"; sleep "${_d}"
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

# ── Banner ────────────────────────────────────────────────────────────────────
print_banner() {
    echo ""
    printf "  ${C_BOLD}╔══════════════════════════════════════════════════════════╗${C_RST}\n"
    printf "  ${C_BOLD}║${C_RST}                                                          ${C_BOLD}║${C_RST}\n"
    printf "  ${C_BOLD}║${C_RST}  ${C_BLUE}◈${C_RST}  ${C_BOLD}H E R M E S   D E P L O Y${C_RST}                         ${C_BOLD}║${C_RST}\n"
    printf "  ${C_BOLD}║${C_RST}     ${C_DIM}Remote Kubernetes / K3s  ·  v%s${C_RST}                ${C_BOLD}║${C_RST}\n" "$VERSION"
    printf "  ${C_BOLD}║${C_RST}                                                          ${C_BOLD}║${C_RST}\n"
    printf "  ${C_BOLD}╚══════════════════════════════════════════════════════════╝${C_RST}\n"
    echo ""
    printf "  ${C_DIM}%-16s${C_RST}%s\n" "target"    "${TARGET_USER}@${TARGET_HOST}"
    printf "  ${C_DIM}%-16s${C_RST}%s\n" "profile"   "${DEPLOY_PROFILE}"
    printf "  ${C_DIM}%-16s${C_RST}%s\n" "image tag" "${HERMES_TAG}"
    printf "  ${C_DIM}%-16s${C_RST}%s\n" "namespace" "${HERMES_NAMESPACE}"
    printf "  ${C_DIM}%-16s${C_RST}%s\n" "log"       "${DEPLOY_LOG}"
    [ "$DRY_RUN" = true ] && printf "\n  ${C_WARN}!${C_RST}  ${C_BOLD}DRY RUN${C_RST} — no remote commands will execute\n"
    hr
}

# ── Validate ──────────────────────────────────────────────────────────────────
validate() {
    [ -n "${TARGET_HOST}" ] || { usage; exit 1; }
    [ -f "${PROJECT_DIR}/charts/hermes/Chart.yaml" ] || fail "Not in hermes repo root"
}

# ── Steps ─────────────────────────────────────────────────────────────────────
check_connectivity() {
    step 1 7 "SSH Connectivity"
    info "Connecting to ${TARGET_USER}@${TARGET_HOST}"
    if [ "$DRY_RUN" = true ]; then
        REMOTE_DIR="${HOME}/.deployments/hermes"
        ok "Dry-run — skipping live SSH"
        return 0
    fi
    _spin_start "Testing SSH connection"
    _ssh "echo ok" >/dev/null || { _spin_stop; fail "SSH failed — run: ssh-copy-id ${TARGET_USER}@${TARGET_HOST}"; }
    local rh
    rh=$(_ssh "echo \$HOME" | tr -d '\r')
    _spin_stop
    REMOTE_DIR="${rh}/.deployments/hermes"
    ok "SSH OK  ·  remote dir ${REMOTE_DIR}"
}

preflight_remote() {
    step 2 7 "Preflight"
    [ "$DRY_RUN" = true ] && ok "Skipped (dry-run)" && return 0
    _spin_start "Inspecting remote host"
    local out
    out=$(_ssh bash <<'REMOTE'
set -e
echo "host:  $(hostname -f 2>/dev/null || hostname)"
echo "os:    $(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || uname -s)"
echo "arch:  $(uname -m)"
echo "mem:   $(free -h 2>/dev/null | awk '/^Mem:/{print $2}' || echo n/a)"
echo "disk:  $(df -h / 2>/dev/null | awk 'NR==2{print $4 " free"}' || echo n/a)"
if [ "$(id -u)" -ne 0 ] && ! sudo -n true 2>/dev/null; then
    echo "ERROR: passwordless sudo required for k3s/helm"
    exit 1
fi
REMOTE
    ) || { _spin_stop; fail "Preflight failed — check sudo / disk / memory"; }
    _spin_stop
    while IFS= read -r line; do dim "$line"; done <<< "$out"
    ok "Preflight passed"
}

ensure_remote_dir() {
    _ssh "mkdir -p '${REMOTE_DIR}'" || fail "Could not create remote dir ${REMOTE_DIR}"
}

sync_files() {
    step 3 7 "Sync Sources"
    if [ "$SKIP_SYNC" = true ]; then ok "Skipped (--skip-sync)"; return 0; fi
    ensure_remote_dir
    info "rsync → ${TARGET_HOST}:${REMOTE_DIR}"
    _rsync \
        --exclude '.git' --exclude 'target' --exclude 'ui/node_modules' --exclude 'ui/dist' \
        --exclude 'bin' --exclude '.hermes' \
        "${PROJECT_DIR}/" "${TARGET_USER}@${TARGET_HOST}:${REMOTE_DIR}/"
    ok "Sources synced"
}

setup_k3s() {
    step 4 7 "K3s / Cluster Setup"
    if [ "$SKIP_CLUSTER_SETUP" = true ]; then ok "Skipped (--k8s)"; return 0; fi
    info "Ensuring K3s + kubectl + helm on remote"
    _spin_start "Bootstrapping K3s"
    _ssh bash <<'REMOTE' || { _spin_stop; fail "K3s setup failed"; }
set -e
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
if ! command -v k3s >/dev/null 2>&1; then
    curl -sfL https://get.k3s.io | $SUDO INSTALL_K3S_EXEC="--disable=traefik" sh -
    for i in $(seq 1 60); do $SUDO kubectl get nodes &>/dev/null && break; sleep 2; done
fi
command -v helm >/dev/null || curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
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
    _spin_stop
    ok "Cluster ready"
}

build_images_remote() {
    step 5 7 "Build Images"
    if [ "$SKIP_BUILD" = true ]; then ok "Skipped (--skip-build)"; return 0; fi
    info "Building hermes-server:${HERMES_TAG} + hermes-controller:${HERMES_TAG}"
    _ssh env REMOTE_DIR="${REMOTE_DIR}" HERMES_TAG="${HERMES_TAG}" bash <<'REMOTE' || fail "Remote image build failed"
set -e
cd "${REMOTE_DIR}"
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"

if command -v dnf >/dev/null; then
    $SUDO dnf install -y gcc make git curl 2>/dev/null || true
elif command -v apt-get >/dev/null; then
    $SUDO apt-get update -qq && $SUDO apt-get install -y -qq build-essential git curl 2>/dev/null || true
fi

if ! command -v go >/dev/null; then
    curl -fsSL "https://go.dev/dl/go1.23.6.linux-amd64.tar.gz" | $SUDO tar -C /usr/local -xz
    export PATH="/usr/local/go/bin:$PATH"
fi

if ! command -v cargo >/dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi
source "$HOME/.cargo/env" 2>/dev/null || true

_nv=$(node -v 2>/dev/null | cut -c2- | cut -d. -f1 || echo 0)
if [ "${_nv:-0}" -lt 18 ]; then
    if command -v apt-get >/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO bash - 2>/dev/null || true
        $SUDO apt-get install -y -qq nodejs 2>/dev/null || true
    else
        curl -fsSL https://rpm.nodesource.com/setup_22.x | $SUDO bash - 2>/dev/null || true
        $SUDO dnf install -y nodejs 2>/dev/null || true
    fi
fi

DOCKER_BIN=""
command -v podman >/dev/null && DOCKER_BIN=podman
command -v docker >/dev/null && docker info >/dev/null 2>&1 && DOCKER_BIN=docker
[ -n "$DOCKER_BIN" ] || { echo "Install podman or docker"; exit 1; }

echo "── UI"
(cd ui && npm ci --silent && npm run build)

echo "── Rust server"
cargo build --release -p hermes-server 2>&1 | tail -3

echo "── Go controller"
(cd cmd/hermes-controller && go build -o /tmp/hermes-controller .)

TAG="${HERMES_TAG}"
if ! $DOCKER_BIN build -f Dockerfile.server -t "hermes-server:${TAG}" . 2>&1; then
    echo "── Falling back to runtime Dockerfile"
    $DOCKER_BIN build -f Dockerfile.server.runtime -t "hermes-server:${TAG}" .
fi
$DOCKER_BIN build -f Dockerfile.controller -t "hermes-controller:${TAG}" .

if [ -f "scripts/lib/k3s-image-import.sh" ]; then
    source "scripts/lib/k3s-image-import.sh"
    k3s_import_oci_image "hermes-controller:${TAG}" "$DOCKER_BIN"
    k3s_import_oci_image "hermes-server:${TAG}" "$DOCKER_BIN"
fi
echo "── hermes-server:${TAG}  hermes-controller:${TAG}"
REMOTE
    ok "Images built and imported"
}

deploy_helm() {
    step 6 7 "Helm Deploy"
    info "helm upgrade --install hermes ./charts/hermes -n ${HERMES_NAMESPACE}"
    ensure_remote_dir
    _spin_start "Applying Helm release (up to 8 min)"
    _ssh env \
        REMOTE_DIR="${REMOTE_DIR}" \
        HELM_NS="${HERMES_NAMESPACE}" \
        HERMES_TAG="${HERMES_TAG}" \
        HERMES_PUBLIC_HOST="${TARGET_HOST}" \
        HERMES_NODE_PORT="${HERMES_NODE_PORT}" \
        HERMES_USE_NODEPORT=1 \
        HERMES_DEMO_APPS="${WITH_DEMO_APPS}" \
        HERMES_LLM_API_URL="${HERMES_LLM_API_URL:-}" \
        HERMES_LLM_API_KEY="${HERMES_LLM_API_KEY:-}" \
        HERMES_LLM_MODEL="${HERMES_LLM_MODEL:-}" \
        HERMES_OIDC_ISSUER="${HERMES_OIDC_ISSUER:-}" \
        HERMES_OIDC_CLIENT_ID="${HERMES_OIDC_CLIENT_ID:-}" \
        HERMES_OIDC_CLIENT_SECRET="${HERMES_OIDC_CLIENT_SECRET:-}" \
        HERMES_OIDC_REDIRECT_URL="${HERMES_OIDC_REDIRECT_URL:-}" \
        bash <<'REMOTE' || { _spin_stop; fail "Helm deploy failed"; }
set -euo pipefail
cd "${REMOTE_DIR}"
source scripts/lib/open-host-firewall-ports.sh
open_hermes_firewall_ports || true
export HERMES_TAG HELM_NS HERMES_PUBLIC_HOST="${HERMES_PUBLIC_HOST}" HERMES_NODE_PORT
bash scripts/lib/helm-hermes-remote.sh
cd /
REMOTE
    _spin_stop
    ok "Helm release applied"
}

restart_hermes_pods() {
    [ "$SKIP_BUILD" = true ] && return 0
    info "Rolling restart to pick up new images"
    _spin_start "Waiting for rollout"
    _ssh env HELM_NS="${HERMES_NAMESPACE}" bash <<'REMOTE' || { _spin_stop; fail "Pod restart failed"; }
set -euo pipefail
if [ -f /etc/rancher/k3s/k3s.yaml ]; then
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    [ -r /etc/rancher/k3s/k3s.yaml ] || export KUBECONFIG="$HOME/.kube/hermes-k3s.yaml"
fi
kubectl -n "${HELM_NS}" rollout restart deploy/hermes
kubectl -n "${HELM_NS}" rollout status deploy/hermes --timeout=5m
REMOTE
    _spin_stop
    ok "Pods restarted"
}

require_hermes_ready() {
    step 7 7 "Verify"
    info "Checking Hermes pods in ${HERMES_NAMESPACE}"
    _spin_start "Waiting for rollout to complete"
    _ssh env HELM_NS="${HERMES_NAMESPACE}" bash <<'REMOTE' || { _spin_stop; fail "Hermes did not become ready"; }
set -euo pipefail
if [ -f /etc/rancher/k3s/k3s.yaml ]; then
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    [ -r /etc/rancher/k3s/k3s.yaml ] || export KUBECONFIG="$HOME/.kube/hermes-k3s.yaml"
fi
helm status hermes -n "${HELM_NS}" >/dev/null 2>&1 || { echo "Helm release 'hermes' not found in ${HELM_NS}"; exit 1; }
kubectl -n "${HELM_NS}" rollout status deploy/hermes --timeout=5m
kubectl -n "${HELM_NS}" get pods,svc
REMOTE
    _spin_stop
    ok "Hermes is ready"
}

verify_remote() {
    [ "$SKIP_VERIFY" = true ] && return 0
    [ "$DRY_RUN" = true ] && return 0
    _ssh env HELM_NS="${HERMES_NAMESPACE}" bash <<'REMOTE' || fail "Remote verification failed"
set -e
if [ -f /etc/rancher/k3s/k3s.yaml ]; then
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    [ -r /etc/rancher/k3s/k3s.yaml ] || export KUBECONFIG="$HOME/.kube/hermes-k3s.yaml"
fi
echo "── pods ──"
kubectl -n "${HELM_NS}" get pods -o wide
echo "── service ──"
kubectl -n "${HELM_NS}" get svc hermes-server
REMOTE
}

run_e2e() {
    [ "$SKIP_E2E" = true ] && return 0
    local e2e="${SCRIPT_DIR}/e2e-deploy-verify.sh"
    [ -f "$e2e" ] || return 0
    chmod +x "$e2e"
    echo ""
    HERMES_E2E_BASE="https://${TARGET_HOST}:${HERMES_NODE_PORT}" \
        HERMES_NAMESPACE="${HERMES_NAMESPACE}" \
        "$e2e" || warn "E2E reported issues — see above"
}

do_uninstall() {
    info "Uninstalling Hermes from ${HERMES_NAMESPACE}"
    _ssh env HELM_NS="${HERMES_NAMESPACE}" bash <<'REMOTE'
set -e
if [ -f /etc/rancher/k3s/k3s.yaml ]; then
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
    [ -r /etc/rancher/k3s/k3s.yaml ] || export KUBECONFIG="$HOME/.kube/hermes-k3s.yaml"
fi
helm uninstall hermes -n "${HELM_NS}" 2>/dev/null || true
kubectl delete namespace hermes-demo --ignore-not-found 2>/dev/null || true
REMOTE
    ok "Hermes uninstalled"
}

print_summary() {
    local total=$((SECONDS - DEPLOY_START))
    local url="https://${TARGET_HOST}:${HERMES_NODE_PORT}"
    # shellcheck source=lib/resolve-zyvor-sibling.sh
    source "${SCRIPT_DIR}/lib/resolve-zyvor-sibling.sh" 2>/dev/null || true
    local smoke="./scripts/test-all-features-remote.sh ${TARGET_HOST} ${TARGET_USER}"
    local stack="./scripts/test-zyvor-stack-remote.sh ${TARGET_HOST} 30151 ${TARGET_USER}"
    if declare -F resolve_zyvor_script >/dev/null 2>&1; then
        local vmrogue_script
        vmrogue_script="$(resolve_zyvor_script "${PROJECT_DIR}" VMRogue "scripts/test-zyvor-stack-remote.sh" 2>/dev/null || true)"
        if [ -n "${vmrogue_script}" ]; then
            stack="${vmrogue_script} ${TARGET_HOST} 30151 ${TARGET_USER}"
        fi
    fi
    hr
    printf "  ${C_OK}✓${C_RST}  ${C_BOLD}Deploy complete${C_RST}  ${C_DIM}%ds total${C_RST}\n\n" "$total"
    printf "  ${C_BOLD}┌──────────────────────────────────────────────────────────┐${C_RST}\n"
    printf "  ${C_BOLD}│${C_RST}  ${C_BOLD}%-14s${C_RST}  %s/%-30s${C_BOLD}│${C_RST}\n"  "Hermes"    "${url}" ""
    printf "  ${C_BOLD}│${C_RST}  %-14s  ${C_DIM}curl -skf %s/healthz%-19s${C_RST}${C_BOLD}│${C_RST}\n"  "Health"    "${url}" ""
    printf "  ${C_BOLD}│${C_RST}  %-14s  ${C_DIM}curl -skf %s/api/v1/apps%-13s${C_RST}${C_BOLD}│${C_RST}\n" "API"       "${url}" ""
    printf "  ${C_BOLD}│${C_RST}  %-14s  ${C_DIM}%-42s${C_RST}${C_BOLD}│${C_RST}\n"       "Namespace" "${HERMES_NAMESPACE}"
    printf "  ${C_BOLD}│${C_RST}  %-14s  ${C_DIM}%-42s${C_RST}${C_BOLD}│${C_RST}\n"       "Log"       "${DEPLOY_LOG}"
    printf "  ${C_BOLD}└──────────────────────────────────────────────────────────┘${C_RST}\n\n"
    printf "  ${C_INFO}🧪${C_RST}  ${C_DIM}Next:${C_RST}  ${C_BOLD}%s${C_RST}\n" "${smoke}"
    printf "  ${C_DIM}       ${C_RST}%s\n" "${stack}"
    printf "  ${C_DIM}       ${C_RST}./scripts/e2e-deploy-verify.sh %s\n" "${url}"
    printf "  ${C_DIM}       ${C_RST}kubectl -n %s get pods\n\n" "${HERMES_NAMESPACE}"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
    print_banner
    validate
    check_connectivity
    preflight_remote

    if [ "$PREFLIGHT_ONLY" = true ]; then echo ""; ok "Preflight-only done"; echo ""; exit 0; fi
    if [ "$UNINSTALL"      = true ]; then do_uninstall; exit 0; fi
    if [ "$VERIFY_ONLY"    = true ]; then
        require_hermes_ready
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
