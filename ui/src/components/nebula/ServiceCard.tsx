// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Stethoscope } from 'lucide-react'
import AppIcon from '../AppIcon'
import GlassPanel from './GlassPanel'
import StatusBadge from './StatusBadge'
import Button from './Button'
import ActionMenu from './ActionMenu'
import ServiceStatusMessage from './ServiceStatusMessage'
import { buildServiceMenuItems, canOpenApp } from './serviceActions'
import {
  hermesApi,
  openApp,
  statusLabel,
} from '../../services/hermesApi'
import { useInspector } from '../../utils/inspectorContext'
import type { HermesApp } from '../../types'

interface ServiceCardProps {
  app: HermesApp
}

function panelTone(status: string): 'default' | 'healthy' | 'warning' | 'critical' {
  if (status === 'broken') return 'critical'
  if (status === 'degraded') return 'warning'
  if (status === 'healthy') return 'healthy'
  return 'default'
}

export default function ServiceCard({ app }: ServiceCardProps) {
  const { openDiagnose, openInspector } = useInspector()
  const qc = useQueryClient()
  const publish = useMutation({
    mutationFn: () => hermesApi.publish(app.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['catalog'] })
      void qc.invalidateQueries({ queryKey: ['cluster-summary'] })
    },
  })

  const canOpen = canOpenApp(app)
  const showStatusMessage = Boolean(app.statusMessage?.trim()) && app.status !== 'healthy'
  const probed = app.updatedAt ? `probed ${new Date(app.updatedAt).toLocaleTimeString()}` : null

  const menuItems = buildServiceMenuItems(app, {
    onDiagnose: () => openDiagnose(app.id),
    onInspector: () => openInspector(app.id, 'ai'),
    onPublish: !app.visibility.published ? () => void publish.mutate() : undefined,
  })

  return (
    <GlassPanel tone={panelTone(app.status)} className="service-card">
      <div className="service-card-head">
        <AppIcon icon={app.icon} name={app.displayName} size="sm" />
        <div className="service-card-meta">
          <strong>{app.displayName}</strong>
          <span>
            {app.namespace}
            {probed ? ` · ${probed}` : ''}
          </span>
        </div>
        <StatusBadge status={app.status} />
      </div>

      {showStatusMessage ? (
        <ServiceStatusMessage message={app.statusMessage} status={app.status} fallback={app.status !== 'healthy' ? statusLabel(app.status) : undefined} />
      ) : null}

      <div className="action-row">
        <div className="action-row-primary">
          <Button variant="primary" className="nebula-btn-compact" onClick={() => openDiagnose(app.id)}>
            <Stethoscope size={13} /> Diagnose
          </Button>
          <Button variant="secondary" className="nebula-btn-compact" onClick={() => void openApp(app)} disabled={!canOpen}>
            <ExternalLink size={13} /> {canOpen ? 'Open' : 'No endpoints'}
          </Button>
          {!app.visibility.published ? (
            <Button variant="secondary" className="nebula-btn-compact" disabled={publish.isPending} onClick={() => void publish.mutate()}>
              Publish
            </Button>
          ) : null}
        </div>
        <ActionMenu items={menuItems} label={`Actions for ${app.displayName}`} />
      </div>
    </GlassPanel>
  )
}
