// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, Star, X } from 'lucide-react'
import AppIcon from '../AppIcon'
import MeshPolicyPanel from '../MeshPolicyPanel'
import RouteLens from '../RouteLens'
import { copyAppUrl, hermesApi, openApp, statusLabel, statusTone } from '../../services/hermesApi'
import { useZeusAiInsight } from '../../hooks/useZeusAiInsight'
import type { SuggestedAction } from '../../types'

interface ServiceInspectorDrawerProps {
  appId: string | null
  onClose: () => void
}

function ActionLink({ action }: { action: SuggestedAction }) {
  if (action.href.startsWith('#copy:')) {
    const cmd = action.href.slice('#copy:'.length)
    return (
      <button type="button" className="btn" onClick={() => void navigator.clipboard.writeText(cmd)}>
        <Copy size={12} /> {action.label}
      </button>
    )
  }
  if (action.href.startsWith('/') && !action.href.startsWith('//')) {
    return <a href={action.href}>{action.label}</a>
  }
  return (
    <a href={action.href} target="_blank" rel="noreferrer">
      {action.label}
    </a>
  )
}

export default function ServiceInspectorDrawer({ appId, onClose }: ServiceInspectorDrawerProps) {
  const qc = useQueryClient()
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: hermesApi.listFavorites, enabled: !!appId })
  const app = useQuery({
    queryKey: ['app', appId],
    queryFn: () => hermesApi.getApp(appId!),
    enabled: !!appId,
  })
  const diagnosis = useQuery({
    queryKey: ['diagnosis', appId],
    queryFn: () => hermesApi.getDiagnosis(appId!),
    enabled: !!appId,
  })
  const insight = useZeusAiInsight(appId, app.data?.displayName ?? '', !!appId)

  if (!appId) return null

  const isFavorite = favorites.data?.some((f) => f.id === app.data?.id) ?? false

  const toggleFavorite = async () => {
    if (!app.data) return
    if (isFavorite) await hermesApi.removeFavorite(app.data.id)
    else await hermesApi.addFavorite(app.data.id)
    void qc.invalidateQueries({ queryKey: ['favorites'] })
  }

  return (
    <div className="inspector-backdrop" onClick={onClose} role="presentation">
      <aside
        className="service-inspector-drawer zeus-glass"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Service inspector"
        data-testid="service-inspector-drawer"
      >
        <header className="inspector-header">
          {app.data ? (
            <div className="inspector-title">
              <AppIcon icon={app.data.icon} name={app.data.displayName} size="md" />
              <div>
                <h2>{app.data.displayName}</h2>
                <p>{app.data.category}</p>
              </div>
            </div>
          ) : (
            <h2>Loading…</h2>
          )}
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        {app.data ? (
          <>
            <div className="inspector-status-strip">
              <span className={`status-chip ${statusTone(app.data.status)}`}>{statusLabel(app.data.status)}</span>
              <span>{app.data.namespace}</span>
            </div>
            <div className="inspector-actions">
              <button type="button" className="btn btn-primary" onClick={() => openApp(app.data!)}>
                <ExternalLink size={14} /> Open
              </button>
              <button type="button" className="btn" onClick={() => void toggleFavorite()}>
                <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} /> {isFavorite ? 'Unpin' : 'Favorite'}
              </button>
              <button type="button" className="btn" onClick={() => void copyAppUrl(app.data!)}>
                <Copy size={14} /> Copy URL
              </button>
            </div>
          </>
        ) : null}

        {diagnosis.data ? <RouteLens diagnosis={diagnosis.data} /> : null}
        {app.data?.meta?.meshPolicies?.length || app.data?.meta?.meshRoutes?.length ? (
          <MeshPolicyPanel routes={app.data.meta?.meshRoutes} policies={app.data.meta?.meshPolicies} />
        ) : null}

        <div className="inspector-ai zeus-glass">
          <h3>Zeus AI</h3>
          {insight.loading ? <p className="empty">Analyzing service…</p> : <p>{insight.explanation}</p>}
          {insight.suggestedActions.length ? (
            <ul className="diagnose-action-list">
              {insight.suggestedActions.map((action) => (
                <li key={action.label}>
                  <ActionLink action={action} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
