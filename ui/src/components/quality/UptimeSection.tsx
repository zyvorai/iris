// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import GlassPanel from '../nebula/GlassPanel'
import { irisApi } from '../../services/irisApi'
import { formatDuration, formatUptime } from '../../utils/format'
import SectionState from './SectionState'

export default function UptimeSection() {
  const [days, setDays] = useState(7)
  const uptime = useQuery({ queryKey: ['uptime', days], queryFn: () => irisApi.getUptime(days) })

  return (
    <GlassPanel className="glass-panel-section" data-testid="uptime-section">
      <div className="quality-head">
        <h2 className="section-title">Uptime</h2>
        <select className="page-toolbar-select" aria-label="Uptime window" value={days}
          onChange={(e) => setDays(Number(e.target.value))}>
          {[1, 7, 30, 90].map((d) => <option key={d} value={d}>Last {d} day(s)</option>)}
        </select>
      </div>
      <SectionState query={uptime} name="uptime" />
      {uptime.data?.apps.length === 0 ? <p className="body-text">No published apps.</p> : null}
      {uptime.data?.apps.length ? (
        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr><th>App</th><th>Uptime</th><th>Down</th><th>Changes</th><th>Now</th></tr>
            </thead>
            <tbody>
              {uptime.data.apps.map((a) => (
                <tr key={a.id}>
                  <td><Link to={`/apps/${encodeURIComponent(a.id)}`}>{a.label}</Link></td>
                  <td>{formatUptime(a.uptimePercent)}</td>
                  <td>{a.observedSeconds ? formatDuration(a.downSeconds) : '—'}</td>
                  <td>{a.transitions}</td>
                  <td>{a.currentStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </GlassPanel>
  )
}
