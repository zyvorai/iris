// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Copy, ExternalLink, MoreHorizontal, Star } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { HermesApp } from '../types'
import { hermesApi, openApp, sourceLabel, statusLabel, statusTone } from '../services/hermesApi'

interface AppCardProps {
  app: HermesApp
  favorite?: boolean
  onPublish?: () => void
}

function iconLetter(icon: string, name: string) {
  const map: Record<string, string> = {
    grafana: 'Gr',
    prometheus: 'Pr',
    zeus: 'Z',
    argocd: 'Ar',
    ui: 'Ui',
    api: 'Ap',
  }
  if (map[icon]) return map[icon]
  if (icon && icon !== 'app') return icon.slice(0, 2).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function AppCard({ app, favorite = false, onPublish }: AppCardProps) {
  const qc = useQueryClient()
  const favMutation = useMutation({
    mutationFn: () => (favorite ? hermesApi.removeFavorite(app.id) : hermesApi.addFavorite(app.id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['favorites'] })
    },
  })

  return (
    <article className={`app-card zeus-card ${statusTone(app.status)}`}>
      <div className="app-card-top">
        <div className={`app-icon icon-${app.icon}`}>{iconLetter(app.icon, app.displayName)}</div>
        <div className="app-card-badges">
          <span className={`status-chip ${statusTone(app.status)}`}>{statusLabel(app.status)}</span>
          {!app.visibility.published ? <span className="chip chip-warn">Unpublished</span> : null}
        </div>
      </div>
      <h3>{app.displayName}</h3>
      <p className="app-desc">{app.description || `${app.backend.name}:${app.backend.port}`}</p>
      <div className="app-meta-row">
        <span className="chip chip-muted">{app.namespace}</span>
        <span className="chip chip-muted">{sourceLabel(app.source)}</span>
      </div>
      <div className="app-actions">
        <button type="button" className="btn btn-primary" onClick={() => openApp(app)}>
          <ExternalLink size={12} />
          Open
        </button>
        {onPublish ? (
          <button type="button" className="btn" onClick={onPublish}>
            Publish
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => navigator.clipboard.writeText(window.location.origin + app.routePath)}
          title="Copy gateway link"
        >
          <Copy size={12} />
        </button>
        <button type="button" className="btn btn-icon" onClick={() => favMutation.mutate()} title={favorite ? 'Unpin' : 'Pin'}>
          <Star size={12} fill={favorite ? 'currentColor' : 'none'} />
        </button>
        <button type="button" className="btn btn-icon" title="More">
          <MoreHorizontal size={12} />
        </button>
      </div>
    </article>
  )
}
