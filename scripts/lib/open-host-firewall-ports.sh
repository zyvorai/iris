#!/usr/bin/env bash
# Open Hermes NodePort on host firewall (iptables/firewalld/ufw).
open_hermes_firewall_ports() {
    local port="${HERMES_NODE_PORT:-30880}"
    if command -v firewall-cmd >/dev/null 2>&1; then
        sudo firewall-cmd --permanent --add-port="${port}/tcp" 2>/dev/null || true
        sudo firewall-cmd --reload 2>/dev/null || true
    fi
    if command -v ufw >/dev/null 2>&1; then
        sudo ufw allow "${port}/tcp" 2>/dev/null || true
    fi
    if command -v iptables >/dev/null 2>&1; then
        sudo iptables -C INPUT -p tcp --dport "${port}" -j ACCEPT 2>/dev/null \
            || sudo iptables -I INPUT -p tcp --dport "${port}" -j ACCEPT 2>/dev/null || true
    fi
}
