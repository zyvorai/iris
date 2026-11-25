// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import GlassPanel from '../nebula/GlassPanel'
import { irisApi } from '../../services/irisApi'
import SectionState from './SectionState'

const LEVELS = ['none', 'bronze', 'silver', 'gold'] as const

export default function ScorecardSection() {
  const [level, setLevel] = useState('')
  const scorecard = useQuery({ queryKey: ['scorecard'], queryFn: () => irisApi.getScorecard() })
  const apps = (scorecard.data?.apps ?? []).filter((a) => !level || a.level === level)

  return (
    <GlassPanel className="glass-panel-section" data-testid="scorecard-section">
      <h2 className="section-title">Maturity scorecard</h2>
      <SectionState query={scorecard} name="scorecard" />
      {scorecard.data ? (
        <>
          <div className="mission-control-filters">
            <button type="button" className={`filter-chip ${level ? '' : 'active'}`} onClick={() => setLevel('')}>
              All
            </button>
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                className={`filter-chip ${level === l ? 'active' : ''}`}
                onClick={() => setLevel(level === l ? '' : l)}
              >
                {l} ({scorecard.data.summary[l]})
              </button>
            ))}
          </div>
          {apps.length ? (
            <div className="audit-table-wrap">
              <table className="audit-table">
                <thead>
                  <tr><th>App</th><th>Owner</th><th>Level</th><th>Score</th><th>Next steps</th></tr>
                </thead>
                <tbody>
                  {apps.map((a) => (
                    <tr key={a.id}>
                      <td><Link to={`/apps/${encodeURIComponent(a.id)}`}>{a.label}</Link></td>
                      <td>{a.owner || '—'}</td>
                      <td>{a.level}</td>
                      <td>{a.score}</td>
                      <td>{a.nextSteps.join('; ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="body-text">No published apps at this level.</p>
          )}
        </>
      ) : null}
    </GlassPanel>
  )
}
