// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, Server, Star } from 'lucide-react'
import AppCard from '../components/AppCard'
import { hermesApi, openApp, sourceLabel, statusLabel, statusTone } from '../services/hermesApi'

export default function ClusterPage() {
  const [nsFilter, setNsFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [view, setView] = useState<'grid' | 'namespace'>('namespace')
  const [envFilter, setEnvFilter] = useState('')
  const qc = useQueryClient()

  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog, refetchInterval: 15000 })
  const summary = useQuery({ queryKey: ['cluster-summary'], queryFn: hermesApi.clusterSummary, refetchInterval: 15000 })
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: hermesApi.listFavorites })
  const favIds = new Set(favorites.data?.map((a) => a.id) ?? [])

  const publish = useMutation({
    mutationFn: hermesApi.publish,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['catalog'] })
      void qc.invalidateQueries({ queryKey: ['discovery'] })
      void qc.invalidateQueries({ queryKey: ['apps'] })
      void qc.invalidateQueries({ queryKey: ['cluster-summary'] })
    },
  })

  const favMutation = useMutation({
    mutationFn: ({ id, fav }: { id: string; fav: boolean }) =>
      fav ? hermesApi.removeFavorite(id) : hermesApi.addFavorite(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['favorites'] }),
  })

  const namespaces = useMemo(() => {
    const set = new Set((catalog.data ?? []).map((a) => a.namespace))
    return [...set].sort()
  }, [catalog.data])

  const publishNs = useMutation({
    mutationFn: hermesApi.publishNamespace,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['catalog'] })
      void qc.invalidateQueries({ queryKey: ['discovery'] })
      void qc.invalidateQueries({ queryKey: ['apps'] })
      void qc.invalidateQueries({ queryKey: ['cluster-summary'] })
    },
  })

  const environments = useMemo(() => {
    const set = new Set<string>()
    for (const app of catalog.data ?? []) {
      if (app.meta?.environment) set.add(app.meta.environment)
    }
    return [...set].sort()
  }, [catalog.data])

  const filtered = useMemo(() => {
    return (catalog.data ?? []).filter((a) => {
      if (nsFilter && a.namespace !== nsFilter) return false
      if (statusFilter && a.status !== statusFilter) return false
      if (envFilter && a.meta?.environment !== envFilter) return false
      return true
    })
  }, [catalog.data, nsFilter, statusFilter, envFilter])

  const byNamespace = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const app of filtered) {
      const list = map.get(app.namespace) ?? []
      list.push(app)
      map.set(app.namespace, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  return (
    <>
      <section className="glass-hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <Server size={16} /> Cluster catalog
          </div>
          <h2 className="hero-title">Every service in your cluster</h2>
          <p className="hero-sub">
            Hermes watches all Kubernetes services cluster-wide — including Zeus OS, monitoring, and everything else.
            Publish to pin services in your dock.
          </p>
        </div>
        <div className="hero-metrics">
          <div className="metric-tile">
            <span className="metric-value">{summary.data?.total ?? '—'}</span>
            <span className="metric-label">Services</span>
          </div>
          <div className="metric-tile">
            <span className="metric-value">{summary.data?.namespaces ?? '—'}</span>
            <span className="metric-label">Namespaces</span>
          </div>
          <div className="metric-tile">
            <span className="metric-value">{summary.data?.published ?? '—'}</span>
            <span className="metric-label">Published</span>
          </div>
          <div className="metric-tile">
            <span className="metric-value">{summary.data?.discovery ?? '—'}</span>
            <span className="metric-label">Unpublished</span>
          </div>
        </div>
      </section>

      <div className="filter-bar cluster-filters">
        <select value={nsFilter} onChange={(e) => setNsFilter(e.target.value)} aria-label="Namespace filter">
          <option value="">All namespaces</option>
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>
              {ns}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status filter">
          <option value="">All statuses</option>
          <option value="healthy">Healthy</option>
          <option value="degraded">Degraded</option>
          <option value="broken">Broken</option>
          <option value="unknown">Unknown</option>
        </select>
        <select value={envFilter} onChange={(e) => setEnvFilter(e.target.value)} aria-label="Environment filter">
          <option value="">All environments</option>
          {environments.map((env) => (
            <option key={env} value={env}>
              {env}
            </option>
          ))}
        </select>
        {nsFilter ? (
          <button
            type="button"
            className="btn"
            onClick={() => publishNs.mutate(nsFilter)}
            disabled={publishNs.isPending}
          >
            Publish all in {nsFilter}
          </button>
        ) : null}
        <button
          type="button"
          className="btn"
          onClick={() => {
            void hermesApi.exportCatalog().then((blob) => {
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'hermes-catalog.json'
              a.click()
              URL.revokeObjectURL(url)
            })
          }}
        >
          Export JSON
        </button>
        <div className="view-toggle">
          <button type="button" className={view === 'namespace' ? 'active' : ''} onClick={() => setView('namespace')}>
            By namespace
          </button>
          <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
            Grid
          </button>
        </div>
        <span className="filter-count">{filtered.length} services</span>
      </div>

      {catalog.isLoading ? (
        <div className="empty glass-section">Scanning cluster services…</div>
      ) : filtered.length === 0 ? (
        <div className="empty glass-section">No services match your filters.</div>
      ) : view === 'grid' ? (
        <section className="glass-section">
          <h2>All services</h2>
          <div className="app-grid">
            {filtered.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                favorite={favIds.has(app.id)}
                onPublish={!app.visibility.published ? () => publish.mutate(app.id) : undefined}
              />
            ))}
          </div>
        </section>
      ) : (
        byNamespace.map(([ns, apps]) => (
          <section key={ns} className="glass-section namespace-section">
            <div className="section-head">
              <h2>{ns}</h2>
              <span className="chip chip-muted">{apps.length} services</span>
            </div>
            <div className="cluster-table">
              <div className="cluster-row cluster-head">
                <span>Service</span>
                <span>Status</span>
                <span>Port</span>
                <span>Source</span>
                <span>Actions</span>
              </div>
              {apps.map((app) => (
                <div key={app.id} className={`cluster-row ${statusTone(app.status)}`}>
                  <span className="cluster-name">
                    <strong>{app.displayName}</strong>
                    <small>{app.backend.name}</small>
                  </span>
                  <span>
                    <span className="status-chip">{statusLabel(app.status)}</span>
                    {app.readyEndpoints > 0 ? (
                      <small className="ready-count">{app.readyEndpoints} ready</small>
                    ) : null}
                  </span>
                  <span>{app.backend.port}</span>
                  <span className="chip chip-muted">{sourceLabel(app.source)}</span>
                  <span className="cluster-actions">
                    {!app.visibility.published ? (
                      <button type="button" className="btn btn-primary" onClick={() => publish.mutate(app.id)}>
                        Publish
                      </button>
                    ) : (
                      <span className="chip chip-ok">Published</span>
                    )}
                    <button type="button" className="btn" onClick={() => openApp(app)} title="Open">
                      <ExternalLink size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => navigator.clipboard.writeText(window.location.origin + app.routePath)}
                      title="Copy link"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => favMutation.mutate({ id: app.id, fav: favIds.has(app.id) })}
                      title="Pin"
                    >
                      <Star size={12} fill={favIds.has(app.id) ? 'currentColor' : 'none'} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  )
}
