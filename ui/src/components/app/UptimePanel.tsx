// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import GlassPanel from '../nebula/GlassPanel'
import { irisApi } from '../../services/irisApi'
import { formatDuration, formatUptime } from '../../utils/format'

/** Status transitions and uptime of one app, from /api/v1/history. */
export default function UptimePanel({ appId }: { appId: string }) {
  const [days, setDays] = useState(7)
  const history = useQuery({
    queryKey: ['history', appId, days],
    queryFn: () => irisApi.getHistory(appId, days),
    refetchInterval: 30000,
  })
  const h = history.data

  return (
    <GlassPanel className="glass-panel-section" data-testid="uptime-panel">
      <div className="quality-head">
        <p className="section-label">Status history</p>
        <select
          className="page-toolbar-select"
          aria-label="History window"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={1}>Last 24 hours</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>
      {history.isError ? <p className="body-text" role="alert">Could not load status history.</p> : null}
      {h ? (
        <>
          <p className="body-text">
            Uptime <strong>{formatUptime(h.uptimePercent)}</strong>
            {h.observedSeconds > 0
              ? ` · ${formatDuration(h.downSeconds)} down of ${formatDuration(h.observedSeconds)} observed · ${h.transitions} change(s)`
              : ''}
          </p>
          {h.events.length ? (
            <ul className="quality-events">
              {h.events.slice(0, 20).map((e) => (
                <li key={`${e.at}-${e.status}`} className="body-text">
                  <time dateTime={e.at}>{new Date(e.at).toLocaleString()}</time> — <strong>{e.status}</strong>
                  {e.message ? ` (${e.message})` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="body-text">No status changes in this window.</p>
          )}
        </>
      ) : null}
    </GlassPanel>
  )
}
