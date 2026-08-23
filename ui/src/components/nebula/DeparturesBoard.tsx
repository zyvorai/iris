// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'
import AppIcon from '../AppIcon'
import StatusBadge from './StatusBadge'
import ActionMenu from './ActionMenu'
import { buildServiceMenuItems, canOpenApp, isUnhealthy } from './serviceActions'
import { appDetailPath, appLaunchPath, hermesApi, openApp, statusTone } from '../../services/hermesApi'
import { useInspector } from '../../utils/inspectorContext'
import { useToast } from '../Toast'
import type { HermesApp } from '../../types'

interface DeparturesRowProps {
  app: HermesApp
  favorite?: boolean
  onPublish?: () => void
  onHide?: () => void
  compact?: boolean
  flipped?: boolean
}

/** One departures-board row — the dense table-row replacement for AppCard's
 * grid card, used across every app-listing page. Same drop-in props as
 * AppCard so it slots into existing app-grid/CollapsibleGroup call sites. */
export default function DeparturesRow({ app, favorite = false, onPublish, onHide, compact = false, flipped = false }: DeparturesRowProps) {
  const { openDiagnose, openInspector } = useInspector()
  const qc = useQueryClient()
  const toast = useToast()
  const publish = useMutation({
    mutationFn: () => hermesApi.publish(app.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['catalog'] })
      void qc.invalidateQueries({ queryKey: ['cluster-summary'] })
      void qc.invalidateQueries({ queryKey: ['apps'] })
      toast(`${app.displayName} published`)
    },
    onError: () => toast(`Could not publish ${app.displayName}`, 'error'),
  })
  const favMutation = useMutation({
    mutationFn: () => (favorite ? hermesApi.removeFavorite(app.id) : hermesApi.addFavorite(app.id)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['favorites'] }),
  })

  const canOpen = canOpenApp(app)
  const unhealthy = isUnhealthy(app)
  const handlePublish = onPublish ?? (() => void publish.mutate())

  const menuItems = buildServiceMenuItems(app, {
    onDiagnose: () => openDiagnose(app.id),
    onInspector: () => openInspector(app.id, 'ai'),
    onPublish: !app.visibility.published ? handlePublish : undefined,
    onHide,
    onPin: () => void favMutation.mutate(),
    favorite,
  })

  const hint = unhealthy && app.statusMessage?.trim()
    ? app.statusMessage.trim()
    : app.visibility.published
      ? appLaunchPath(app)
      : 'Not published'

  return (
    <div
      className={`dep dep-${statusTone(app.status)}${compact ? ' dep-compact' : ''}${flipped ? ' dep-flip' : ''}`}
      onClick={() => openInspector(app.id)}
      role="row"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') openInspector(app.id)
      }}
    >
      <span className="dep-chit">
        <AppIcon icon={app.icon} name={app.displayName} size="sm" />
      </span>
      <div className="dep-id">
        <Link
          to={appDetailPath(app)}
          className="dep-name"
          title={app.displayName}
          onClick={(e) => e.stopPropagation()}
        >
          {app.displayName}
        </Link>
        <span className="dep-terminal">{app.namespace}{!compact && app.category ? ` · ${app.category}` : ''}</span>
      </div>
      <StatusBadge status={app.status} className="dep-flag" />
      <span className={`dep-hint${unhealthy ? ' dep-hint-warn' : ''}`} title={hint}>
        {hint}
      </span>
      <div className="dep-actions" onClick={(e) => e.stopPropagation()}>
        {unhealthy || !canOpen ? (
          <button type="button" className="dep-action-btn" title="Diagnose" onClick={() => openDiagnose(app.id)}>
            <Stethoscope size={13} />
          </button>
        ) : (
          <button type="button" className="dep-action-btn" title="Open" onClick={() => void openApp(app)}>
            <ExternalLink size={13} />
          </button>
        )}
        {!app.visibility.published ? (
          <button
            type="button"
            className="dep-action-btn dep-action-btn-publish"
            title="Publish"
            disabled={publish.isPending}
            onClick={onPublish ?? (() => void publish.mutate())}
          >
            Publish
          </button>
        ) : null}
        <ActionMenu items={menuItems} label={`Actions for ${app.displayName}`} />
      </div>
    </div>
  )
}
