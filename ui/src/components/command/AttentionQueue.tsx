// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ExternalLink, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'
import AppIcon from '../AppIcon'
import { appDetailPath, hermesApi, openApp, statusLabel, statusTone } from '../../services/hermesApi'
import { useZeusAiInsight } from '../../hooks/useZeusAiInsight'
import type { HermesApp } from '../../types'

interface AttentionQueueProps {
  apps: HermesApp[]
  onInspect: (app: HermesApp) => void
}

function AttentionCard({ app, onInspect }: { app: HermesApp; onInspect: (app: HermesApp) => void }) {
  const [expanded, setExpanded] = useState(false)
  const qc = useQueryClient()
  const insight = useZeusAiInsight(app.id, app.displayName, expanded)
  const publish = useMutation({
    mutationFn: () => hermesApi.publish(app.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['catalog'] })
      void qc.invalidateQueries({ queryKey: ['apps'] })
      void qc.invalidateQueries({ queryKey: ['cluster-summary'] })
    },
  })
  const canOpen = app.readyEndpoints > 0 && app.status !== 'broken'

  return (
    <article className="attention-card zeus-glass">
      <div className="attention-card-head">
        <AppIcon icon={app.icon} name={app.displayName} size="sm" />
        <div>
          <strong>{app.displayName}</strong>
          <p>{app.statusMessage ?? statusLabel(app.status)}</p>
          <span className="attention-meta">
            {app.namespace}
            {app.updatedAt ? ` · probed ${new Date(app.updatedAt).toLocaleTimeString()}` : ''}
          </span>
        </div>
        <span className={`status-chip ${statusTone(app.status)}`}>{statusLabel(app.status)}</span>
      </div>
      <div className="attention-actions">
        {!app.visibility.published ? (
          <button type="button" className="btn btn-primary" disabled={publish.isPending} onClick={() => void publish.mutate()}>
            Publish
          </button>
        ) : null}
        <button type="button" className="btn btn-primary" onClick={() => onInspect(app)}>
          <Stethoscope size={14} /> Diagnose
        </button>
        <button type="button" className="btn" onClick={() => void openApp(app)} disabled={!canOpen}>
          <ExternalLink size={14} /> {canOpen ? 'Open' : 'No endpoints'}
        </button>
        <a className="btn" href={appDetailPath(app)}>
          Check Route
        </a>
        <button type="button" className="btn btn-ghost" onClick={() => setExpanded((v) => !v)}>
          Zeus AI <ChevronDown size={14} className={expanded ? 'rotated' : ''} />
        </button>
      </div>
      {expanded ? (
        <div className="attention-ai-block">
          {insight.loading ? <p className="empty">Analyzing…</p> : <p>{insight.explanation}</p>}
          {insight.suggestedActions.length ? (
            <details className="attention-tech-detail">
              <summary>Suggested command</summary>
              <ul>
                {insight.suggestedActions.map((action) => (
                  <li key={action.label}>{action.label}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

export default function AttentionQueue({ apps, onInspect }: AttentionQueueProps) {
  const [filter, setFilter] = useState<'all' | 'broken' | 'degraded'>('all')
  const filtered = useMemo(() => {
    if (filter === 'broken') return apps.filter((a) => a.status === 'broken')
    if (filter === 'degraded') return apps.filter((a) => a.status === 'degraded')
    return apps
  }, [apps, filter])
  const visible = filtered.slice(0, 12)
  const brokenCount = apps.filter((a) => a.status === 'broken').length
  const degradedCount = apps.filter((a) => a.status === 'degraded').length

  if (!apps.length) return null

  return (
    <section className="glass-section attention-queue" id="attention-queue" data-testid="attention-queue">
      <div className="section-head">
        <div>
          <h2>Attention Queue</h2>
          <p className="hero-sub">Discovered services that failed probes or have degraded endpoints</p>
        </div>
        <span className="chip chip-warn">{apps.length}</span>
        {apps.length > visible.length ? (
          <Link to="/health" className="section-link">
            View all in health
          </Link>
        ) : null}
      </div>
      <div className="attention-filters" role="tablist" aria-label="Filter attention queue">
        <button type="button" role="tab" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          All ({apps.length})
        </button>
        <button type="button" role="tab" className={filter === 'broken' ? 'active' : ''} onClick={() => setFilter('broken')}>
          Broken ({brokenCount})
        </button>
        <button type="button" role="tab" className={filter === 'degraded' ? 'active' : ''} onClick={() => setFilter('degraded')}>
          Degraded ({degradedCount})
        </button>
      </div>
      {!filtered.length ? <div className="empty">No {filter === 'all' ? '' : filter} services in this filter.</div> : null}
      <div className="attention-list">
        {visible.map((app) => (
          <AttentionCard key={app.id} app={app} onInspect={onInspect} />
        ))}
      </div>
    </section>
  )
}
