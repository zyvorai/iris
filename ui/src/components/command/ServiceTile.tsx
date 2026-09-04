// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import AppIcon from '../AppIcon'
import { openApp, statusLabel, statusTone } from '../../services/irisApi'
import type { IrisApp } from '../../types'

type ServiceTileVariant = 'compact' | 'detail' | 'hero'

interface ServiceTileProps {
  app: IrisApp
  variant?: ServiceTileVariant
  onInspect?: (app: IrisApp) => void
}

function routeCount(app: IrisApp): number {
  const ingress = app.meta?.ingressHosts?.length ?? 0
  const mesh = app.meta?.meshRoutes?.length ?? 0
  return ingress + mesh
}

function endpointLabel(app: IrisApp): string {
  const routes = routeCount(app)
  if (routes > 0) return `${routes} routes`
  return `:${app.backend.port}`
}

export default function ServiceTile({ app, variant = 'detail', onInspect }: ServiceTileProps) {
  const updated = app.updatedAt ? new Date(app.updatedAt).toLocaleString() : '—'
  const canOpen = app.status !== 'broken' && app.readyEndpoints > 0

  const onClick = () => {
    if (onInspect) onInspect(app)
    else if (canOpen) void openApp(app)
  }

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
        {app.readyEndpoints} ready · {endpointLabel(app)}
        {!app.visibility.published ? ' · unpublished' : ''}
      </span>
      <span className="service-tile-updated">{updated}</span>
    </button>
  )
}
