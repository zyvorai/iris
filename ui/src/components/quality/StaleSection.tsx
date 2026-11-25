// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import GlassPanel from '../nebula/GlassPanel'
import { irisApi } from '../../services/irisApi'
import SectionState from './SectionState'

export default function StaleSection() {
  const [days, setDays] = useState(30)
  const stale = useQuery({ queryKey: ['stale', days], queryFn: () => irisApi.getStale(days) })

  return (
    <GlassPanel className="glass-panel-section" data-testid="stale-section">
      <div className="quality-head">
        <h2 className="section-title">Stale apps</h2>
        <select className="page-toolbar-select" aria-label="Stale window" value={days}
          onChange={(e) => setDays(Number(e.target.value))}>
          {[1, 7, 30, 90, 365].map((d) => <option key={d} value={d}>Not refreshed in {d} day(s)</option>)}
        </select>
      </div>
      <SectionState query={stale} name="stale apps" />
      {stale.data ? (
        <>
          {stale.data.apps.length ? (
            <ul>
              {stale.data.apps.map((a) => (
                <li key={a.id} className="body-text">
                  <strong>{a.label}</strong> ({a.namespace}) — {a.ageDays} days{a.owner ? ` · ${a.owner}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="body-text">Every app was refreshed within {stale.data.days} day(s).</p>
          )}
          {stale.data.unknown > 0 ? (
            <p className="body-text">{stale.data.unknown} app(s) have no readable update time.</p>
          ) : null}
        </>
      ) : null}
    </GlassPanel>
  )
}
