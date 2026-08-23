// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, Link2, Route, Star, X } from 'lucide-react'
import AppIcon from '../AppIcon'
import MeshPolicyPanel from '../MeshPolicyPanel'
import RouteLens from '../RouteLens'
import ShareLinksPanel from '../ShareLinksPanel'
import Button from '../nebula/Button'
import StatusBadge from '../nebula/StatusBadge'
import EmptyState from '../nebula/EmptyState'
import ZyraAiPanel from '../nebula/ZyraAiPanel'
import {
  appDetailPath,
  appLaunchPath,
  appPublicUrl,
  copyAppUrl,
  hermesApi,
  openApp,
} from '../../services/hermesApi'
import { useZyraAiInsight } from '../../hooks/useZyraAiInsight'
import { useInspector, type InspectorTab } from '../../utils/inspectorContext'
import type { SuggestedAction } from '../../types'

interface ServiceInspectorDrawerProps {
  appId: string | null
  initialTab?: InspectorTab
  onClose: () => void
}

function ActionLink({ action }: { action: SuggestedAction }) {
  if (action.href.startsWith('#copy:')) {
    const cmd = action.href.slice('#copy:'.length)
    return (
      <Button variant="ghost" className="nebula-btn-compact" onClick={() => void navigator.clipboard.writeText(cmd)}>
        <Copy size={12} /> {action.label}
      </Button>
    )
  }
  if (action.href.startsWith('/') && !action.href.startsWith('//')) {
    return (
      <Button variant="ghost" className="nebula-btn-compact" href={action.href}>
        {action.label}
      </Button>
    )
  }
  return (
    <Button variant="ghost" className="nebula-btn-compact" href={action.href} target="_blank" rel="noreferrer">
      {action.label}
    </Button>
  )
}

export default function ServiceInspectorDrawer({ appId, initialTab = 'overview', onClose }: ServiceInspectorDrawerProps) {
  const [tab, setTab] = useState<InspectorTab>(initialTab)
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
  const insight = useZyraAiInsight(appId, !!appId && tab === 'ai')
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

  useEffect(() => {
    if (appId) setTab(initialTab)
  }, [appId, initialTab])

  if (!appId) return null

  const canOpen = app.data ? app.data.status !== 'broken' && app.data.readyEndpoints > 0 : false
  const isFavorite = favorites.data?.some((f) => f.id === app.data?.id) ?? false

  const toggleFavorite = async () => {
    if (!app.data) return
    if (isFavorite) await hermesApi.removeFavorite(app.data.id)
    else await hermesApi.addFavorite(app.data.id)
    void qc.invalidateQueries({ queryKey: ['favorites'] })
  }

  const tabs: { id: InspectorTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'route', label: 'Route' },
    { id: 'share', label: 'Share' },
    { id: 'deps', label: 'Deps' },
    { id: 'ai', label: 'Zyra AI' },
  ]

  return (
    <div className="inspector-backdrop diagnosis-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="service-inspector-drawer diagnosis-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Service inspector"
        data-testid="service-inspector-drawer"
      >
        <header className="diagnosis-drawer-header inspector-header">
          {app.data ? (
            <div className="inspector-title">
              <AppIcon icon={app.data.icon} name={app.data.displayName} size="md" />
              <div>
                <h2>{app.data.displayName}</h2>
                <p className="body-text">{app.data.category}</p>
              </div>
            </div>
          ) : app.isLoading ? (
            <div className="page-loading-skeleton page-loading-skeleton-compact">
              <div className="skeleton-toolbar" />
            </div>
          ) : (
            <h2>Service unavailable</h2>
          )}
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </header>

        <div className="inspector-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`inspector-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="diagnosis-drawer-body">
          {tab === 'overview' && app.data ? (
            <>
              <div className="inspector-status-strip">
                <StatusBadge status={app.data.status} />
                <span className="body-text">{app.data.namespace}</span>
                {!app.data.visibility.published ? (
                  <span className="nebula-status-badge status-warn">Unpublished</span>
                ) : null}
              </div>
              <div className="diagnosis-drawer-facts">
                <div className="diagnosis-drawer-fact">
                  <span>Gateway path</span>
                  <code>{appLaunchPath(app.data)}</code>
                </div>
                <div className="diagnosis-drawer-fact">
                  <span>Public URL</span>
                  <code>{appPublicUrl(app.data)}</code>
                </div>
                <div className="diagnosis-drawer-fact">
                  <span>Cluster port</span>
                  <code>:{app.data.backend.port}</code>
                </div>
                <div className="diagnosis-drawer-fact">
                  <span>Ready endpoints</span>
                  <strong>{app.data.readyEndpoints}</strong>
                </div>
              </div>
              <div className="diagnosis-drawer-actions">
                {!app.data.visibility.published ? (
                  <Button variant="secondary" disabled={publish.isPending} onClick={() => void publish.mutate()}>
                    Publish
                  </Button>
                ) : null}
                <Button variant="primary" disabled={!canOpen} onClick={() => void openApp(app.data!)}>
                  <ExternalLink size={14} /> Open
                </Button>
                <Button variant="ghost" onClick={() => void toggleFavorite()}>
                  <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} /> {isFavorite ? 'Unpin' : 'Pin'}
                </Button>
                <Button variant="ghost" onClick={() => void copyAppUrl(app.data!)}>
                  <Copy size={14} /> Copy URL
                </Button>
                <Button variant="ghost" to={appDetailPath(app.data, true)}>
                  Full detail
                </Button>
              </div>
            </>
          ) : null}

          {tab === 'route' ? (
            <>
              {diagnosis.isLoading ? (
                <div className="page-loading-skeleton page-loading-skeleton-compact">
                  <div className="skeleton-card" style={{ height: 80 }} />
                </div>
              ) : diagnosis.isError ? (
                <EmptyState
                  icon={<Route size={22} />}
                  title="Could not load route"
                  tone="critical"
                  action={
                    <Button variant="secondary" onClick={() => void diagnosis.refetch()}>
                      Retry
                    </Button>
                  }
                />
              ) : diagnosis.data ? (
                <RouteLens diagnosis={diagnosis.data} />
              ) : null}
              {app.data?.meta?.meshPolicies?.length || app.data?.meta?.meshRoutes?.length ? (
                <MeshPolicyPanel routes={app.data.meta?.meshRoutes} policies={app.data.meta?.meshPolicies} />
              ) : null}
            </>
          ) : null}

          {tab === 'share' && app.data ? <ShareLinksPanel app={app.data} /> : null}

          {tab === 'deps' ? (
            <div className="inspector-deps">
              {!deps.length ? (
                <EmptyState icon={<Link2 size={22} />} title="No declared dependencies" />
              ) : (
                <ul className="inspector-dep-list">
                  {deps.map(({ dep, app: depApp }) => (
                    <li key={dep}>
                      {depApp ? (
                        <button type="button" className="inspector-dep-link" onClick={() => openInspector(depApp.id)}>
                          <AppIcon icon={depApp.icon} name={depApp.displayName} size="sm" />
                          <span>{depApp.displayName}</span>
                        </button>
                      ) : (
                        <code>{dep}</code>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {tab === 'ai' ? (
            <ZyraAiPanel
              summary={insight.summary}
              explanation={insight.explanation}
              source={insight.source}
              remediation={insight.remediation}
              loading={insight.loading}
              compact
              action={
                insight.suggestedActions.length ? (
                  <ul className="diagnose-action-list">
                    {insight.suggestedActions.map((action) => (
                      <li key={action.label}>
                        <ActionLink action={action} />
                      </li>
                    ))}
                  </ul>
                ) : undefined
              }
            />
          ) : null}
        </div>
      </aside>
    </div>
  )
}
