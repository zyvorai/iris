// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Network } from 'lucide-react'

function meshKind(route: string): { kind: string; label: string; tone: string } {
  if (route.startsWith('istio:')) {
    return { kind: 'istio', label: route.slice(6), tone: 'mesh-istio' }
  }
  if (route.startsWith('linkerd:')) {
    return { kind: 'linkerd', label: route.slice(8), tone: 'mesh-linkerd' }
  }
  return { kind: 'mesh', label: route, tone: 'mesh-generic' }
}

export default function MeshPolicyPanel({ routes }: { routes: string[] }) {
  if (!routes.length) return null

  const kinds = new Set(routes.map((route) => meshKind(route).kind))

  return (
    <section className="glass-section mesh-policy-panel">
      <div className="section-head">
        <h3>
          <Network size={16} /> Service mesh
        </h3>
        <span className="chip chip-muted">{[...kinds].join(' · ')}</span>
      </div>
      <ul className="mesh-route-list">
        {routes.map((route) => {
          const { kind, label, tone } = meshKind(route)
          return (
            <li key={route} className={`mesh-route-item ${tone}`}>
              <span className="mesh-route-kind">{kind}</span>
              <code>{label}</code>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
