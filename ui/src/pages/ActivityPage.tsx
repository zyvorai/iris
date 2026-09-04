// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  Compass,
  Download,
  Globe,
  Link2,
  Rocket,
  Search,
  Sparkles,
  Star,
  Trash2,
  Users,
} from 'lucide-react'
import GlassPanel from '../components/nebula/GlassPanel'
import GlyphTile from '../components/nebula/GlyphTile'
import PageFrame from '../components/nebula/PageFrame'
import PageToolbar from '../components/nebula/PageToolbar'
import EmptyState from '../components/nebula/EmptyState'
import AskZyraButton from '../components/nebula/AskZyraButton'
import Button from '../components/nebula/Button'
import ZyraAiPanel from '../components/nebula/ZyraAiPanel'
import { actionLabel, hermesApi } from '../services/hermesApi'
import { useActivityInsight } from '../hooks/useZyraAiInsight'
import type { AuditEvent, FederatedAuditEvent } from '../types'

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
  cluster_offline: Globe,
}

type ActionFilter = 'all' | 'launch' | 'share' | 'discovery' | 'personal'

const filterActions: Record<ActionFilter, Set<string> | null> = {
  all: null,
  launch: new Set(['launch', 'recent', 'share_access']),
  share: new Set(['share_create', 'share_revoke', 'share_access']),
  discovery: new Set(['publish', 'publish_namespace', 'hide', 'search']),
  personal: new Set(['favorite', 'unfavorite', 'recommend', 'unrecommend']),
}

function exportAuditCsv(events: Array<AuditEvent & { clusterId?: string; clusterName?: string }>) {
  const header = ['id', 'clusterId', 'clusterName', 'userId', 'action', 'appId', 'detail', 'createdAt']
  const rows = events.map((e) =>
    [e.id, e.clusterId ?? 'local', e.clusterName ?? 'Local', e.userId, e.action, e.appId, e.detail, e.createdAt]
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
  const [federated, setFederated] = useState(false)
  const qc = useQueryClient()

  const audit = useQuery({
    queryKey: ['audit', federated],
    queryFn: () => (federated ? hermesApi.listFederatedAudit(200) : hermesApi.listAudit(200)),
    refetchInterval: 10000,
  })
  const activityInsight = useActivityInsight()

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

  const loading = audit.isLoading && !audit.data

  return (
    <PageFrame
      loading={loading}
      error={audit.isError}
      hasData={Boolean(audit.data)}
      onRetry={() => void audit.refetch()}
      errorTitle="Could not load activity"
    >
      <div className="hs-page">
        <section className="hs-hero">
          <div className="hs-wrap">
            <p className="hs-eyebrow">Activity</p>
            <h1 className="h-hero" style={{ maxWidth: '12ch' }}>Audit log</h1>
            <p className="hs-lede">Launches, discovery, shares, and pins</p>
          </div>
        </section>
      <div className="page-grid">
        {audit.data ? (
          <ZyraAiPanel
            title="Activity insight"
            summary={activityInsight.data?.summary}
            explanation={activityInsight.data?.explanation ?? 'Zyra AI is summarizing recent platform activity…'}
            source={activityInsight.data?.source}
            remediation={activityInsight.data?.highlights}
            loading={activityInsight.isLoading}
            compact
            onRefresh={() => void activityInsight.refetch()}
            refreshing={activityInsight.isFetching && !activityInsight.isLoading}
          />
        ) : null}

        <GlassPanel className="glass-panel-section">
          <div className="section-head-nebula">
            <GlyphTile tone="brand" icon={<Activity size={14} />} size="sm" />
            <div>
              <p className="hs-eyebrow">Timeline</p>
              <h2 className="h-tile">Recent events</h2>
            </div>
            <span className="nebula-status-badge status-unknown">{events.length} loaded</span>
            <AskZyraButton compact command="activity insight" />
            <Button variant="ghost" className="nebula-btn-compact" onClick={() => exportAuditCsv(events)} disabled={!events.length}>
              <Download size={12} /> Export
            </Button>
          </div>

          <PageToolbar className="activity-filters-toolbar glass-toolbar">
            {(
              [
                ['all', 'All'],
                ['launch', 'Launches'],
                ['share', 'Shares'],
                ['discovery', 'Discovery'],
                ['personal', 'Pins'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" className={`filter-chip ${filter === id ? 'active' : ''}`} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
            <label className="graph-broken-toggle body-text">
              <input type="checkbox" checked={federated} onChange={(e) => setFederated(e.target.checked)} />
              Federated
            </label>
            <input
              type="search"
              className="page-toolbar-search"
              placeholder="Search activity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search activity"
            />
          </PageToolbar>

          {events.length ? (
            <ol className="activity-timeline" style={{ marginTop: '1rem' }}>
              {events.map((event) => {
                const Icon = actionIcons[event.action] ?? Users
                const cluster = (event as FederatedAuditEvent).clusterName
                return (
                  <li key={`${(event as FederatedAuditEvent).clusterId ?? 'local'}-${event.id}-${event.createdAt}`} className="activity-item">
                    <span className="activity-icon" aria-hidden>
                      <Icon size={14} />
                    </span>
                    <div className="activity-body">
                      <div className="activity-head">
                        <strong>{actionLabel(event.action)}</strong>
                        {federated && cluster ? <span className="nebula-status-badge status-unknown">{cluster}</span> : null}
                        <time dateTime={event.createdAt}>{event.createdAt ? new Date(event.createdAt).toLocaleString() : '—'}</time>
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
            <EmptyState
              icon={<Activity size={22} />}
              title="No activity yet"
              description="Launch apps, search, or pin favorites to populate the audit log."
            />
          )}
        </GlassPanel>

        {adminShares.isError ? (
          <GlassPanel className="glass-panel-section context-banner-muted">
            <p className="body-text">Share admin panel unavailable — admin access required or the shares API is temporarily unreachable.</p>
          </GlassPanel>
        ) : null}

        {adminShares.data ? (
          <GlassPanel className="glass-panel-section share-admin-panel">
            <div className="section-head-nebula">
              <p className="section-label">Share admin</p>
              <span className="nebula-status-badge status-unknown">{adminShares.data.length} active links</span>
            </div>
            {adminShares.data.length ? (
              <ul className="share-list" style={{ marginTop: '1rem' }}>
                {adminShares.data.map((share) => (
                  <li key={share.token} className="share-item">
                    <div>
                      <strong>{share.appId}</strong>
                      <code>{`/launchpad/s/${share.token}`}</code>
                      <span className="share-expiry">
                        by {share.createdBy ?? 'unknown'} · expires {new Date(share.expiresAt).toLocaleString()}
                      </span>
                    </div>
                    <Button variant="danger" className="nebula-btn-compact" disabled={revokeShare.isPending} onClick={() => void revokeShare.mutate(share.token)}>
                      <Trash2 size={12} /> Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Link2 size={22} />} title="No active share links" />
            )}
          </GlassPanel>
        ) : null}
      </div>
      </div>
    </PageFrame>
  )
}
