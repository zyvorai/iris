// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Compass,
  Link2,
  Rocket,
  Search,
  Sparkles,
  Star,
  Trash2,
  Users,
} from 'lucide-react'
import { actionLabel, hermesApi } from '../services/hermesApi'

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

export default function ActivityPage() {
  const [filter, setFilter] = useState<ActionFilter>('all')
  const audit = useQuery({
    queryKey: ['audit'],
    queryFn: () => hermesApi.listAudit(100),
    refetchInterval: 10000,
  })

  const events = useMemo(() => {
    const allowed = filterActions[filter]
    return (audit.data ?? []).filter((e) => !allowed || allowed.has(e.action))
  }, [audit.data, filter])

  return (
    <section className="glass-section">
      <div className="section-head">
        <h2>Activity</h2>
        <span className="chip chip-muted">{events.length} events</span>
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
  )
}
