// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Stethoscope } from 'lucide-react'
import AppIcon from './AppIcon'
import GlassPanel from './nebula/GlassPanel'
import { accentColorFor } from '../utils/iconColor'
import StatusBadge from './nebula/StatusBadge'
import Button from './nebula/Button'
import ActionMenu from './nebula/ActionMenu'
import ServiceStatusMessage from './nebula/ServiceStatusMessage'
import { buildServiceMenuItems, canOpenApp, isUnhealthy } from './nebula/serviceActions'
import {
  appDetailPath,
  appLaunchPath,
  hermesApi,
  openApp,
  statusLabel,
  statusTone,
} from '../services/hermesApi'
import { useInspector } from '../utils/inspectorContext'
import type { HermesApp } from '../types'

interface AppCardProps {
  app: HermesApp
  favorite?: boolean
  onPublish?: () => void
  onHide?: () => void
  compact?: boolean
}

function panelTone(status: string): 'default' | 'healthy' | 'warning' | 'critical' {
  if (status === 'broken') return 'critical'
  if (status === 'degraded') return 'warning'
  if (status === 'healthy') return 'healthy'
  return 'default'
}

export default function AppCard({ app, favorite = false, onPublish, onHide, compact = false }: AppCardProps) {
  const { openDiagnose, openInspector } = useInspector()
  const qc = useQueryClient()
  const publish = useMutation({
    mutationFn: () => hermesApi.publish(app.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['catalog'] })
      void qc.invalidateQueries({ queryKey: ['cluster-summary'] })
      void qc.invalidateQueries({ queryKey: ['apps'] })
    },
  })
  const favMutation = useMutation({
    mutationFn: () => (favorite ? hermesApi.removeFavorite(app.id) : hermesApi.addFavorite(app.id)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['favorites'] }),
  })

  const canOpen = canOpenApp(app)
  const unhealthy = isUnhealthy(app)
  const showStatusMessage = Boolean(app.statusMessage?.trim()) && app.status !== 'healthy'

  const handlePublish = onPublish ?? (() => void publish.mutate())

  const menuItems = buildServiceMenuItems(app, {
    onDiagnose: () => openDiagnose(app.id),
    onInspector: () => openInspector(app.id, 'ai'),
    onPublish: !app.visibility.published ? handlePublish : undefined,
    onHide,
    onPin: () => void favMutation.mutate(),
    favorite,
  })

  const accentStyle = { '--card-accent': accentColorFor(app.displayName, app.icon) } as CSSProperties

  return (
    <GlassPanel
      tone={panelTone(app.status)}
      className={`service-card app-card-nebula card-accent ${statusTone(app.status)}`}
      style={accentStyle}
    >
      <div className="service-card-head">
        <AppIcon icon={app.icon} name={app.displayName} size="sm" />
        <div className="service-card-meta">
          <strong>
            <Link to={appDetailPath(app)} className="app-title-link">
              {app.displayName}
            </Link>
          </strong>
          <span>{app.namespace}{!compact && app.category ? ` · ${app.category}` : ''}</span>
        </div>
        <StatusBadge status={app.status} />
      </div>

      {!compact && app.description ? <p className="body-text app-card-desc">{app.description}</p> : null}

      {app.visibility.published && !compact ? (
        <p className="service-route-hint" title="Launchpad path">
          {appLaunchPath(app)}
        </p>
      ) : null}

      {showStatusMessage ? (
        <ServiceStatusMessage message={app.statusMessage} status={app.status} compact={compact} fallback={unhealthy ? statusLabel(app.status) : undefined} />
      ) : null}

      <div className="action-row">
        <div className="action-row-primary">
          {unhealthy || !canOpen ? (
            <Button variant="primary" className="nebula-btn-compact" onClick={() => openDiagnose(app.id)}>
              <Stethoscope size={13} /> Diagnose
            </Button>
          ) : (
            <Button variant="primary" className="nebula-btn-compact" onClick={() => void openApp(app)}>
              <ExternalLink size={13} /> Open
            </Button>
          )}
          {!app.visibility.published ? (
            <Button
              variant="secondary"
              className="nebula-btn-compact"
              disabled={publish.isPending}
              onClick={onPublish ?? (() => void publish.mutate())}
            >
              Publish
            </Button>
          ) : null}
        </div>
        <ActionMenu items={menuItems} label={`Actions for ${app.displayName}`} />
      </div>
    </GlassPanel>
  )
}
