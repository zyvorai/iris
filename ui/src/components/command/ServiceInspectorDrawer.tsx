// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, Link2, Route, Sparkles, Star, Stethoscope, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import AppIcon from '../AppIcon'
import MeshPolicyPanel from '../MeshPolicyPanel'
import RouteLens from '../RouteLens'
import ShareLinksPanel from '../ShareLinksPanel'
import {
  appDetailPath,
  appLaunchPath,
  appPublicUrl,
  copyAppUrl,
  hermesApi,
  openApp,
  statusLabel,
  statusTone,
} from '../../services/hermesApi'
import { useZeusAiInsight } from '../../hooks/useZeusAiInsight'
import { useInspector } from '../../utils/inspectorContext'
import type { SuggestedAction } from '../../types'

interface ServiceInspectorDrawerProps {
  appId: string | null
  onClose: () => void
}

type InspectorTab = 'overview' | 'route' | 'share' | 'deps' | 'ai'

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
  const [tab, setTab] = useState<InspectorTab>('overview')
  const { openInspector } = useInspector()
  const qc = useQueryClient()
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: hermesApi.listFavorites, enabled: !!appId })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog, enabled: !!appId })
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
  const insight = useZeusAiInsight(appId, app.data?.displayName ?? '', !!appId && tab === 'ai')
  const publish = useMutation({
    mutationFn: () => hermesApi.publish(appId!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['app', appId] })
      void qc.invalidateQueries({ queryKey: ['catalog'] })
      void qc.invalidateQueries({ queryKey: ['apps'] })
      void qc.invalidateQueries({ queryKey: ['cluster-summary'] })
    },
  })

  const deps = useMemo(() => {
    const list = app.data?.meta?.dependsOn ?? []
    const apps = catalog.data ?? []
    return list.map((dep) => ({
      dep,
      app: apps.find((a) => a.id === dep || a.slug === dep || a.canonicalSlug === dep || a.backend.name === dep),
    }))
  }, [app.data?.meta?.dependsOn, catalog.data])

  if (!appId) return null

  const canOpen = app.data ? app.data.status !== 'broken' && app.data.readyEndpoints > 0 : false
  const isFavorite = favorites.data?.some((f) => f.id === app.data?.id) ?? false

  const toggleFavorite = async () => {
    if (!app.data) return
    if (isFavorite) await hermesApi.removeFavorite(app.data.id)
    else await hermesApi.addFavorite(app.data.id)
    void qc.invalidateQueries({ queryKey: ['favorites'] })
  }

  const tabs: { id: InspectorTab; label: string; icon: typeof Route }[] = [
    { id: 'overview', label: 'Overview', icon: Stethoscope },
    { id: 'route', label: 'Route', icon: Route },
    { id: 'share', label: 'Share', icon: Link2 },
    { id: 'deps', label: 'Deps', icon: Sparkles },
    { id: 'ai', label: 'Zeus AI', icon: Sparkles },
  ]

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

        <div className="inspector-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && app.data ? (
          <>
            <div className="inspector-status-strip">
              <span className={`status-chip ${statusTone(app.data.status)}`}>{statusLabel(app.data.status)}</span>
              <span>{app.data.namespace}</span>
              {!app.data.visibility.published ? <span className="chip chip-warn">Unpublished</span> : null}
            </div>
            <div className="inspector-facts zeus-glass">
              <div className="inspector-fact">
                <span>Gateway path</span>
                <code>{appLaunchPath(app.data)}</code>
              </div>
              <div className="inspector-fact">
                <span>Public URL</span>
                <code>{appPublicUrl(app.data)}</code>
              </div>
              <div className="inspector-fact">
                <span>Cluster port</span>
                <code>:{app.data.backend.port}</code>
              </div>
              <div className="inspector-fact">
                <span>Ready endpoints</span>
                <strong>{app.data.readyEndpoints}</strong>
              </div>
            </div>
            <div className="inspector-actions">
              {!app.data.visibility.published ? (
                <button type="button" className="btn btn-primary" disabled={publish.isPending} onClick={() => void publish.mutate()}>
                  Publish
                </button>
              ) : null}
              <button type="button" className="btn btn-primary" disabled={!canOpen} onClick={() => void openApp(app.data!)}>
                <ExternalLink size={14} /> Open
              </button>
              <button type="button" className="btn" onClick={() => void toggleFavorite()}>
                <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} /> {isFavorite ? 'Unpin' : 'Pin'}
              </button>
              <button type="button" className="btn" onClick={() => void copyAppUrl(app.data!)}>
                <Copy size={14} /> Copy URL
              </button>
              <Link to={appDetailPath(app.data, true)} className="btn">
                Full detail
              </Link>
            </div>
          </>
        ) : null}

        {tab === 'route' ? (
          <>
            {diagnosis.data ? <RouteLens diagnosis={diagnosis.data} /> : <p className="empty">Loading route chain…</p>}
            {app.data?.meta?.meshPolicies?.length || app.data?.meta?.meshRoutes?.length ? (
              <MeshPolicyPanel routes={app.data.meta?.meshRoutes} policies={app.data.meta?.meshPolicies} />
            ) : null}
          </>
        ) : null}

        {tab === 'share' && app.data ? <ShareLinksPanel app={app.data} /> : null}

        {tab === 'deps' ? (
          <div className="inspector-deps zeus-glass">
            <h3>Dependencies</h3>
            {!deps.length ? <p className="empty">No declared dependencies.</p> : null}
            <ul className="inspector-dep-list">
              {deps.map(({ dep, app: depApp }) => (
                <li key={dep}>
                  {depApp ? (
                    <button type="button" className="zeus-rail-fav" onClick={() => openInspector(depApp.id)}>
                      <AppIcon icon={depApp.icon} name={depApp.displayName} size="sm" />
                      <span>{depApp.displayName}</span>
                    </button>
                  ) : (
                    <code>{dep}</code>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {tab === 'ai' ? (
          <div className="inspector-ai zeus-glass">
            <h3>Zeus AI diagnosis</h3>
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
        ) : null}
      </aside>
    </div>
  )
}
