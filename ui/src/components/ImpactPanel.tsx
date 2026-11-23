// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import { useQuery } from '@tanstack/react-query'
import GlassPanel from './nebula/GlassPanel'
import { irisApi } from '../services/irisApi'

/** Dependency blast radius and catalog conformance, from /impact and /conformance. */
export default function ImpactPanel() {
  const impact = useQuery({ queryKey: ['impact'], queryFn: irisApi.getImpact, refetchInterval: 15000 })
  const conformance = useQuery({ queryKey: ['conformance'], queryFn: () => irisApi.getConformance(), refetchInterval: 30000 })

  if (impact.isError && conformance.isError) return null
  const risky = (impact.data?.apps ?? []).filter((a) => a.dependents > 0 || a.effectiveStatus !== a.ownStatus).slice(0, 8)
  const worst = (conformance.data?.apps ?? []).filter((a) => a.findings.length > 0).slice(0, 8)

  return (
    <GlassPanel data-testid="impact-panel" className="graph-impact-panel">
      <h3 className="section-title">Dependency impact</h3>
      {impact.data && impact.data.cycles.length > 0 && (
        <p className="body-text" role="alert">
          {impact.data.cycles.length} dependency cycle(s): {impact.data.cycles.map((c) => c.join(' ↔ ')).join('; ')}
        </p>
      )}
      {risky.length === 0 ? (
        <p className="body-text">No dependency chains to report.</p>
      ) : (
        <ul>
          {risky.map((a) => (
            <li key={a.id} className="body-text">
              <strong>{a.label}</strong> — {a.dependents} dependent(s)
              {a.effectiveStatus !== a.ownStatus && ` · ${a.effectiveStatus} via ${a.blockedBy.join(', ')}`}
            </li>
          ))}
        </ul>
      )}
      <h3 className="section-title">Catalog conformance {conformance.data ? `(${conformance.data.summary.score}/100)` : ''}</h3>
      {worst.length === 0 ? (
        <p className="body-text">All published apps conform.</p>
      ) : (
        <ul>
          {worst.map((a) => (
            <li key={a.id} className="body-text">
              <strong>{a.label}</strong> ({a.score}): {a.findings.map((f) => f.rule).join(', ')}
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  )
}
