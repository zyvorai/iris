#!/usr/bin/env bash
# Import OCI images from podman/docker into k3s containerd.
set -euo pipefail

k3s_bin_path() {
    if command -v k3s >/dev/null 2>&1; then
        command -v k3s
        return 0
    fi
    if [ -x /usr/local/bin/k3s ]; then
        echo /usr/local/bin/k3s
        return 0
    fi
    return 1
}

k3s_ctr() {
    local k3s_bin
    k3s_bin="$(k3s_bin_path)" || return 1
    sudo "${k3s_bin}" ctr -n k8s.io "$@"
}

k3s_image_present() {
    local ref="$1"
    k3s_ctr images ls -q 2>/dev/null | grep -Fx "${ref}" >/dev/null
}

k3s_import_oci_image() {
    local ref="${1:?image ref required}"
    local docker_bin="${2:-}"
    local source_ref="${ref}"
    local library_ref="${ref}"
    local base="${ref%%:*}"
    local tag_part="${ref#*:}"

    if [ -z "${docker_bin}" ]; then
        if command -v podman >/dev/null 2>&1; then
            docker_bin=podman
        elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
            docker_bin=docker
        else
            echo "k3s import: no podman/docker" >&2
            return 1
        fi
    fi

    k3s_bin_path >/dev/null || {
        echo "k3s import: k3s binary not found" >&2
        return 1
    }

    if ! "${docker_bin}" image inspect "${ref}" >/dev/null 2>&1; then
        if "${docker_bin}" image inspect "localhost/${ref}" >/dev/null 2>&1; then
            source_ref="localhost/${ref}"
        else
            echo "k3s import: image not found: ${ref}" >&2
            return 1
        fi
    fi

    if [[ "${ref}" != */* ]]; then
        library_ref="docker.io/library/${ref}"
    fi

    echo "k3s import: importing ${source_ref} → ${ref}..."
    cd / || true
    if ! "${docker_bin}" save "${source_ref}" | k3s_ctr images import -; then
        echo "k3s import: failed to import ${source_ref}" >&2
        return 1
    fi

    # Podman may import hyphenated names with spaces (hermes-controller → hermes controller)
    local spaced="${base//-/\ }"
    local imported_ref=""
    while IFS= read -r candidate; do
        [ -z "${candidate}" ] && continue
        case "${candidate}" in
            "localhost/${ref}"|"localhost/${spaced}:${tag_part}"|localhost/*"${base}"*:*"${tag_part}"*)
                imported_ref="${candidate}"
                break
                ;;
        esac
    done < <(k3s_ctr images ls -q 2>/dev/null | grep "^localhost/" || true)

    if [ -z "${imported_ref}" ]; then
        imported_ref="$(k3s_ctr images ls -q 2>/dev/null | grep "^localhost/" | grep -i "${base//-/}" | head -1 || true)"
    fi

    if [ -n "${imported_ref}" ]; then
        k3s_ctr images tag "${imported_ref}" "${ref}" 2>/dev/null || true
        if [[ "${library_ref}" != "${ref}" ]]; then
            k3s_ctr images tag "${imported_ref}" "${library_ref}" 2>/dev/null || true
        fi
    fi

    if k3s_image_present "${ref}" || k3s_image_present "${library_ref}"; then
        echo "k3s import: ok ${ref}"
        return 0
    fi

    echo "k3s import: ${ref} not visible after import" >&2
    k3s_ctr images ls 2>/dev/null | grep -i hermes || true
    return 1
}
