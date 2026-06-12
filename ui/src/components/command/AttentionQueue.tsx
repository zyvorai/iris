// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useState } from 'react'
import { ChevronDown, ExternalLink, Stethoscope } from 'lucide-react'
import AppIcon from '../AppIcon'
import { appDetailPath, openApp, statusLabel, statusTone } from '../../services/hermesApi'
import { useZeusAiInsight } from '../../hooks/useZeusAiInsight'
import type { HermesApp } from '../../types'

interface AttentionQueueProps {
  apps: HermesApp[]
  onInspect: (app: HermesApp) => void
}

function AttentionCard({ app, onInspect }: { app: HermesApp; onInspect: (app: HermesApp) => void }) {
  const [expanded, setExpanded] = useState(false)
  const insight = useZeusAiInsight(app.id, app.displayName, expanded)

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
        <button type="button" className="btn btn-primary" onClick={() => onInspect(app)}>
          <Stethoscope size={14} /> Diagnose
        </button>
        <button type="button" className="btn" onClick={() => openApp(app)}>
          <ExternalLink size={14} /> Open
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
  if (!apps.length) return null

  return (
    <section className="glass-section attention-queue" id="attention-queue" data-testid="attention-queue">
      <div className="section-head">
        <h2>Attention Queue</h2>
        <span className="chip chip-warn">{apps.length}</span>
      </div>
      <div className="attention-list">
        {apps.map((app) => (
          <AttentionCard key={app.id} app={app} onInspect={onInspect} />
        ))}
      </div>
    </section>
  )
}
