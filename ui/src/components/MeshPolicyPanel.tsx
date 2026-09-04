// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { Copy, Network } from 'lucide-react'
import GlassPanel from './nebula/GlassPanel'
import Button from './nebula/Button'
import type { MeshPolicy } from '../types'

function meshKind(route: string): { kind: string; label: string; tone: string } {
  if (route.startsWith('istio:')) {
    return { kind: 'istio', label: route.slice(6), tone: 'mesh-istio' }
  }
  if (route.startsWith('linkerd:')) {
    return { kind: 'linkerd', label: route.slice(8), tone: 'mesh-linkerd' }
  }
  return { kind: 'mesh', label: route, tone: 'mesh-generic' }
}

function policyKey(policy: MeshPolicy): string {
  return `${policy.kind}|${policy.namespace}|${policy.name}|${policy.destination}|${policy.detail}`
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text)
}

export default function MeshPolicyPanel({
  routes,
  policies = [],
}: {
  routes?: string[]
  policies?: MeshPolicy[]
}) {
  const structured = policies.length > 0
  const routeList = routes ?? []
  if (!structured && !routeList.length) return null

  const kinds = new Set(
    structured ? policies.map((p) => p.kind) : routeList.map((route) => meshKind(route).kind),
  )

  return (
    <GlassPanel className="glass-panel-section mesh-policy-panel-nebula">
      <div className="section-head-nebula">
        <div>
          <p className="section-label">
            <Network size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Service mesh
          </p>
          <span className="nebula-status-badge status-unknown">{[...kinds].join(' · ')}</span>
        </div>
      </div>
      {structured ? (
        <ul className="mesh-route-list">
          {policies.map((policy) => (
            <li key={policyKey(policy)} className={`mesh-route-item mesh-${policy.kind}`}>
              <span className="mesh-route-kind">{policy.kind}</span>
              <div className="mesh-policy-body">
                <strong>{policy.name || policy.destination || 'Policy'}</strong>
                {policy.namespace ? <span className="mesh-policy-ns">{policy.namespace}</span> : null}
                {policy.hosts?.length ? (
                  <div className="mesh-policy-row">
                    <span>Hosts</span>
                    <code>{policy.hosts.join(', ')}</code>
                  </div>
                ) : null}
                {policy.destination ? (
                  <div className="mesh-policy-row">
                    <span>Destination</span>
                    <code>{policy.destination}</code>
                  </div>
                ) : null}
                {policy.weight ? (
                  <div className="mesh-policy-row">
                    <span>Weight</span>
                    <code>{policy.weight}</code>
                  </div>
                ) : null}
                {policy.detail ? <p className="mesh-policy-detail">{policy.detail}</p> : null}
                {policy.kind === 'istio' && policy.name && policy.namespace ? (
                  <code className="mesh-kubectl">
                    kubectl get virtualservice {policy.name} -n {policy.namespace}
                  </code>
                ) : null}
                <Button
                  variant="ghost"
                  className="nebula-btn-compact mesh-copy-btn"
                  onClick={() =>
                    copyText(
                      [
                        policy.kind,
                        policy.namespace,
                        policy.name,
                        policy.hosts?.join(','),
                        policy.destination,
                        policy.weight ? `weight=${policy.weight}` : '',
                        policy.detail,
                      ]
                        .filter(Boolean)
                        .join(' | '),
                    )
                  }
                >
                  <Copy size={12} /> Copy
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mesh-route-list">
          {routeList.map((route) => {
            const { kind, label, tone } = meshKind(route)
            return (
              <li key={route} className={`mesh-route-item ${tone}`}>
                <span className="mesh-route-kind">{kind}</span>
                <code>{label}</code>
              </li>
            )
          })}
        </ul>
      )}
    </GlassPanel>
  )
}
