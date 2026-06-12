// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Compass,
  Download,
  Link2,
  Rocket,
  Search,
  Sparkles,
  Star,
  Trash2,
  Users,
} from 'lucide-react'
import { actionLabel, hermesApi } from '../services/hermesApi'
import type { AuditEvent } from '../types'

const actionIcons: Record<string, typeof Rocket> = {
  launch: Rocket,
  search: Search,
  favorite: Star,
  unfavorite: Star,
  recent: Rocket,
  publish: Compass,
  publish_namespace: Compass,
  hide: Trash2,
  recommend: Sparkles,
  unrecommend: Sparkles,
  share_create: Link2,
  share_revoke: Trash2,
  share_access: Link2,
}

type ActionFilter = 'all' | 'launch' | 'share' | 'discovery' | 'personal'

const filterActions: Record<ActionFilter, Set<string> | null> = {
  all: null,
  launch: new Set(['launch', 'recent', 'share_access']),
  share: new Set(['share_create', 'share_revoke', 'share_access']),
  discovery: new Set(['publish', 'publish_namespace', 'hide', 'search']),
  personal: new Set(['favorite', 'unfavorite', 'recommend', 'unrecommend']),
}

function exportAuditCsv(events: AuditEvent[]) {
  const header = ['id', 'userId', 'action', 'appId', 'detail', 'createdAt']
  const rows = events.map((e) =>
    [e.id, e.userId, e.action, e.appId, e.detail, e.createdAt]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  )
  const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hermes-activity-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ActivityPage() {
  const [filter, setFilter] = useState<ActionFilter>('all')
  const [search, setSearch] = useState('')
  const qc = useQueryClient()

  const audit = useQuery({
    queryKey: ['audit'],
    queryFn: () => hermesApi.listAudit(200),
    refetchInterval: 10000,
  })

  const adminShares = useQuery({
    queryKey: ['shares', 'all'],
    queryFn: hermesApi.listAllShares,
    retry: false,
  })

  const revokeShare = useMutation({
    mutationFn: hermesApi.revokeShare,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shares'] })
      void qc.invalidateQueries({ queryKey: ['shares', 'all'] })
    },
  })

  const events = useMemo(() => {
    const allowed = filterActions[filter]
    const q = search.trim().toLowerCase()
    return (audit.data ?? []).filter((e) => {
      if (allowed && !allowed.has(e.action)) return false
      if (!q) return true
      return (
        e.userId.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.appId.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q)
      )
    })
  }, [audit.data, filter, search])

  return (
    <>
      <section className="glass-section">
        <div className="section-head">
          <h2>Activity</h2>
          <span className="chip chip-muted">{events.length} events</span>
          <button type="button" className="btn" onClick={() => exportAuditCsv(events)} disabled={!events.length}>
            <Download size={12} /> Export CSV
          </button>
        </div>

        <div className="filter-bar activity-filters">
          {(
            [
              ['all', 'All'],
              ['launch', 'Launches'],
              ['share', 'Shares'],
              ['discovery', 'Discovery'],
              ['personal', 'Pins & picks'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn ${filter === id ? 'btn-accent' : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
          <input
            type="search"
            className="activity-search"
            placeholder="Search activity…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search activity"
          />
        </div>

        {audit.isLoading ? (
          <div className="empty">Loading activity…</div>
        ) : events.length ? (
          <ol className="activity-timeline">
            {events.map((event) => {
              const Icon = actionIcons[event.action] ?? Users
              return (
                <li key={event.id} className="activity-item">
                  <span className="activity-icon" aria-hidden>
                    <Icon size={14} />
                  </span>
                  <div className="activity-body">
                    <div className="activity-head">
                      <strong>{actionLabel(event.action)}</strong>
                      <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
                    </div>
                    <p className="activity-meta">
                      <span>{event.userId}</span>
                      {event.appId ? (
                        <>
                          {' · '}
                          <Link to={`/apps/${encodeURIComponent(event.appId)}`}>{event.appId}</Link>
                        </>
                      ) : null}
                    </p>
                    {event.detail ? <p className="activity-detail">{event.detail}</p> : null}
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <div className="empty">No activity yet. Launch apps, search, or pin favorites to populate the audit log.</div>
        )}
      </section>

      {adminShares.data ? (
        <section className="glass-section share-admin-panel">
          <div className="section-head">
            <h2>Share admin</h2>
            <span className="chip chip-muted">{adminShares.data.length} active links</span>
          </div>
          {adminShares.data.length ? (
            <ul className="share-list">
              {adminShares.data.map((share) => (
                <li key={share.token} className="share-item">
                  <div>
                    <strong>{share.appId}</strong>
                    <code>{`/launchpad/s/${share.token}`}</code>
                    <span className="share-expiry">
                      by {share.createdBy ?? 'unknown'} · expires {new Date(share.expiresAt).toLocaleString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-warn"
                    disabled={revokeShare.isPending}
                    onClick={() => void revokeShare.mutate(share.token)}
                  >
                    <Trash2 size={12} /> Revoke
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">No active share links.</div>
          )}
        </section>
      ) : null}
    </>
  )
}
