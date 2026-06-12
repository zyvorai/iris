// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import type { AppDiagnosis } from '../types'
import { routePathPublicUrl, statusLabel, statusTone } from '../services/hermesApi'

interface RouteLensProps {
  diagnosis: AppDiagnosis
}

function nodeTone(status?: string): string {
  if (!status) return 'lens-neutral'
  switch (status) {
    case 'healthy':
      return 'lens-ok'
    case 'degraded':
      return 'lens-warn'
    case 'broken':
      return 'lens-error'
    default:
      return 'lens-warn'
  }
}

export default function RouteLens({ diagnosis }: RouteLensProps) {
  return (
    <div className="route-lens" data-testid="route-lens">
      <p className="route-lens-kicker">Route chain — user to backend</p>
      <ol className="route-lens-chain">
        {diagnosis.chain.map((node) => (
          <li key={node.id} className="route-lens-node">
            <span className={`route-lens-dot ${nodeTone(node.status)}`} aria-hidden />
            <div>
              <div className="route-lens-label">{node.label}</div>
              {node.status ? (
                <span className={`status-chip ${statusTone(node.status)}`}>{statusLabel(node.status)}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <div className="route-lens-url">
        <span className="route-lens-url-label">Stable URL</span>
        <code>{routePathPublicUrl(diagnosis.routePath) || diagnosis.routePath}</code>
      </div>
    </div>
  )
}
