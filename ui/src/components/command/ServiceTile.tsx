// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import AppIcon from '../AppIcon'
import { openApp, statusLabel, statusTone } from '../../services/hermesApi'
import type { HermesApp } from '../../types'

type ServiceTileVariant = 'compact' | 'detail' | 'hero'

interface ServiceTileProps {
  app: HermesApp
  variant?: ServiceTileVariant
  onInspect?: (app: HermesApp) => void
}

function routeCount(app: HermesApp): number {
  const ingress = app.meta?.ingressHosts?.length ?? 0
  const mesh = app.meta?.meshRoutes?.length ?? 0
  return ingress + mesh
}

export default function ServiceTile({ app, variant = 'detail', onInspect }: ServiceTileProps) {
  const routes = routeCount(app)
  const updated = app.updatedAt ? new Date(app.updatedAt).toLocaleString() : '—'

  const onClick = () => {
    if (onInspect) onInspect(app)
    else if (canOpen) openApp(app)
  }

  const canOpen = app.status !== 'broken' && app.readyEndpoints > 0

  if (variant === 'compact') {
    return (
      <button type="button" className="service-tile compact" onClick={onClick} title={app.displayName}>
        <AppIcon icon={app.icon} name={app.displayName} size="sm" />
        <span>{app.displayName}</span>
        <span className={`status-dot ${statusTone(app.status)}`} aria-label={statusLabel(app.status)} />
      </button>
    )
  }

  if (variant === 'hero') {
    return (
      <button type="button" className="service-tile hero zeus-glass" onClick={onClick}>
        <AppIcon icon={app.icon} name={app.displayName} size="md" />
        <div>
          <strong>{app.displayName}</strong>
          <p>{app.namespace}</p>
        </div>
        <span className={`status-chip ${statusTone(app.status)}`}>{statusLabel(app.status)}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`service-tile detail${canOpen ? '' : ' service-tile-disabled'}`}
      onClick={onClick}
      title={`${app.displayName}${app.statusMessage ? ` · ${app.statusMessage}` : ''}`}
    >
      <AppIcon icon={app.icon} name={app.displayName} size="sm" />
      <div className="service-tile-meta">
        <strong>{app.displayName}</strong>
        <span>{app.namespace}</span>
      </div>
      <span className={`status-dot ${statusTone(app.status)}`} aria-label={statusLabel(app.status)} />
      <span className="service-tile-routes">
        {app.readyEndpoints} ready · {routes} routes
        {!app.visibility.published ? ' · unpublished' : ''}
      </span>
      <span className="service-tile-updated">{updated}</span>
    </button>
  )
}
