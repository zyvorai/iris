// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Copy, ExternalLink, Info, MoreHorizontal, Route, Star, Stethoscope } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { HermesApp } from '../types'
import AppIcon from './AppIcon'
import {
  appDetailPath,
  appLaunchPath,
  appPublicUrl,
  environmentLabel,
  hermesApi,
  openApp,
  sourceLabel,
  statusLabel,
  statusTone,
} from '../services/hermesApi'

interface AppCardProps {
  app: HermesApp
  favorite?: boolean
  onPublish?: () => void
  onHide?: () => void
}

export default function AppCard({ app, favorite = false, onPublish, onHide }: AppCardProps) {
  const qc = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const favMutation = useMutation({
    mutationFn: () => (favorite ? hermesApi.removeFavorite(app.id) : hermesApi.addFavorite(app.id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['favorites'] })
    },
  })

  const launchPath = appLaunchPath(app)
  const broken = app.status === 'broken' || app.status === 'degraded'

  return (
    <article className={`app-card zeus-card ${statusTone(app.status)}${broken ? ' app-card-broken' : ''}`}>
      <div className="app-card-top">
        <AppIcon icon={app.icon} name={app.displayName} />
        <div className="app-card-badges">
          <span className={`status-chip ${statusTone(app.status)}`}>{statusLabel(app.status)}</span>
          {!app.visibility.published ? <span className="chip chip-warn">Unpublished</span> : null}
          {app.meta?.recommended ? <span className="chip chip-accent">Recommended</span> : null}
        </div>
      </div>
      <h3>
        <Link to={appDetailPath(app)} className="app-title-link">
          {app.displayName}
        </Link>
      </h3>
      <p className="app-desc">{app.description || app.category}</p>
      {broken && app.statusMessage ? <p className="app-problem">{app.statusMessage}</p> : null}
      <div className="app-meta-row">
        <span className="chip chip-muted">{app.namespace}</span>
        <span className="chip chip-muted">{sourceLabel(app.source)}</span>
        {app.meta?.environment ? (
          <span className="chip chip-env">{environmentLabel(app.meta.environment)}</span>
        ) : null}
        {app.canonicalSlug ? <span className="chip chip-accent">/{app.canonicalSlug}</span> : null}
      </div>
      <div className="app-actions">
        {broken ? (
          <Link to={appDetailPath(app, true)} className="btn btn-primary">
            <Stethoscope size={12} /> Diagnose
          </Link>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => openApp(app)}>
            <ExternalLink size={12} /> Open
          </button>
        )}
        {onPublish ? (
          <button type="button" className="btn" onClick={onPublish}>
            Publish
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => navigator.clipboard.writeText(appPublicUrl(app))}
          title="Copy gateway link"
        >
          <Copy size={12} />
        </button>
        <button type="button" className="btn btn-icon" onClick={() => favMutation.mutate()} title={favorite ? 'Unpin' : 'Pin'}>
          <Star size={12} fill={favorite ? 'currentColor' : 'none'} />
        </button>
        <div className="app-menu-wrap">
          <button
            type="button"
            className="btn btn-icon"
            title="More"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal size={12} />
          </button>
          {menuOpen ? (
            <div className="app-menu" role="menu">
              <Link to={appDetailPath(app)} className="app-menu-item" onClick={() => setMenuOpen(false)}>
                <Info size={12} /> Details
              </Link>
              <Link to={appDetailPath(app, true)} className="app-menu-item" onClick={() => setMenuOpen(false)}>
                <Route size={12} /> Inspect route
              </Link>
              <button
                type="button"
                className="app-menu-item"
                onClick={() => {
                  void navigator.clipboard.writeText(launchPath)
                  setMenuOpen(false)
                }}
              >
                <Copy size={12} /> Copy path
              </button>
              {onHide ? (
                <button
                  type="button"
                  className="app-menu-item app-menu-danger"
                  onClick={() => {
                    onHide()
                    setMenuOpen(false)
                  }}
                >
                  Hide from discovery
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
