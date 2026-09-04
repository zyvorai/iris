#!/usr/bin/env bash
# Open Iris NodePort on host firewall (iptables/firewalld/ufw).
# Returns 0 if at least one backend reported success, 1 if none applied.
open_iris_firewall_ports() {
    local port="${IRIS_NODE_PORT:-31847}"
    local opened=0

    if command -v firewall-cmd >/dev/null 2>&1; then
        if sudo firewall-cmd --permanent --add-port="${port}/tcp" 2>/dev/null \
            && sudo firewall-cmd --reload 2>/dev/null; then
            echo "Opened firewalld port ${port}/tcp"
            opened=1
        else
            echo "WARNING: firewalld could not open ${port}/tcp" >&2
        fi
    fi
    if command -v ufw >/dev/null 2>&1; then
        if sudo ufw allow "${port}/tcp" 2>/dev/null; then
            echo "Opened ufw port ${port}/tcp"
            opened=1
        else
            echo "WARNING: ufw could not open ${port}/tcp" >&2
        fi
    fi
    if command -v iptables >/dev/null 2>&1; then
        if sudo iptables -C INPUT -p tcp --dport "${port}" -j ACCEPT 2>/dev/null; then
            echo "iptables already allows ${port}/tcp"
            opened=1
        elif sudo iptables -I INPUT -p tcp --dport "${port}" -j ACCEPT 2>/dev/null; then
            echo "Opened iptables port ${port}/tcp"
            opened=1
        else
            echo "WARNING: iptables could not open ${port}/tcp" >&2
        fi
    fi

    if [ "${opened}" -eq 0 ]; then
        echo "WARNING: no host firewall rule applied for ${port}/tcp — ensure cloud security groups allow inbound TCP ${port}" >&2
        return 1
    fi
    echo "Note: also ensure cloud security groups / external firewalls allow TCP ${port}"
    return 0
}
