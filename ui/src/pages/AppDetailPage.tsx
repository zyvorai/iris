// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Copy, ExternalLink, Route, Sparkles, Star, Stethoscope } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import AppCard from '../components/AppCard'
import DiagnosePanel from '../components/DiagnosePanel'
import ShareLinksPanel from '../components/ShareLinksPanel'
import MeshPolicyPanel from '../components/MeshPolicyPanel'
import { AppGraphPanel } from '../pages/GraphPage'
import {
  appDetailPath,
  appLaunchPath,
  appPublicUrl,
  copyAppUrl,
  environmentLabel,
  hermesApi,
  openApp,
  sourceLabel,
  statusLabel,
  statusTone,
} from '../services/hermesApi'

export default function AppDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [techOpen, setTechOpen] = useState(false)
  const [diagnoseOpen, setDiagnoseOpen] = useState(() => searchParams.get('diagnose') === '1')
  const qc = useQueryClient()

  const app = useQuery({
    queryKey: ['app', id],
    queryFn: () => hermesApi.getApp(decodeURIComponent(id ?? '')),
    enabled: Boolean(id),
  })

  const favorites = useQuery({ queryKey: ['favorites'], queryFn: hermesApi.listFavorites })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog })
  const isFavorite = favorites.data?.some((f) => f.id === app.data?.id) ?? false

  const favMutation = useMutation({
    mutationFn: () =>
      isFavorite ? hermesApi.removeFavorite(app.data!.id) : hermesApi.addFavorite(app.data!.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['favorites'] }),
  })

  const recommendMutation = useMutation({
    mutationFn: (recommended: boolean) => hermesApi.setRecommended(app.data!.id, recommended),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['app', id] })
      void qc.invalidateQueries({ queryKey: ['catalog'] })
      void qc.invalidateQueries({ queryKey: ['recommended'] })
    },
  })

  const dependencyLinks = useMemo(() => {
    const deps = app.data?.meta?.dependsOn ?? []
    const apps = catalog.data ?? []
    return deps.map((dep) => {
      const match =
        apps.find((a) => a.id === dep || a.slug === dep || a.canonicalSlug === dep) ??
        apps.find((a) => a.backend.name === dep)
      return { dep, app: match }
    })
  }, [app.data?.meta?.dependsOn, catalog.data])

  useEffect(() => {
    setDiagnoseOpen(searchParams.get('diagnose') === '1')
  }, [searchParams])

  const openDiagnose = () => {
    setDiagnoseOpen(true)
    setSearchParams({ diagnose: '1' }, { replace: true })
  }

  const closeDiagnose = () => {
    setDiagnoseOpen(false)
    setSearchParams({}, { replace: true })
  }

  if (app.isLoading) return <div className="empty">Loading…</div>
  if (app.error || !app.data) return <div className="empty">App not found</div>

  const a = app.data
  const broken = a.status === 'broken' || a.status === 'degraded'
  const canOpen = a.status !== 'broken' && a.readyEndpoints > 0

  return (
    <>
      <section className={`glass-section app-detail-hero ${statusTone(a.status)}`}>
        <div className="app-detail-head">
          <div>
            <p className="hero-kicker">{a.category}</p>
            <h2>{a.displayName}</h2>
            <p className="hero-sub">{a.description || 'Infrastructure application'}</p>
            <div className="app-meta-row">
              <span className={`status-chip ${statusTone(a.status)}`}>{statusLabel(a.status)}</span>
              {a.meta?.environment ? (
                <span className="chip chip-env">{environmentLabel(a.meta.environment)}</span>
              ) : null}
            </div>
            {broken && a.statusMessage ? <p className="app-problem">{a.statusMessage}</p> : null}
          </div>
          <div className="app-actions app-detail-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canOpen}
              title={canOpen ? undefined : 'Publish and ensure endpoints are ready before opening'}
              onClick={() => void openApp(a)}
            >
              <ExternalLink size={12} /> {canOpen ? 'Open' : 'Cannot open'}
            </button>
            <button type="button" className="btn" onClick={() => void favMutation.mutate()}>
              <Star size={12} fill={isFavorite ? 'currentColor' : 'none'} /> {isFavorite ? 'Unpin' : 'Pin'}
            </button>
            <button
              type="button"
              className={`btn ${a.meta?.recommended ? 'btn-accent' : ''}`}
              onClick={() => void recommendMutation.mutate(!a.meta?.recommended)}
            >
              <Sparkles size={12} /> {a.meta?.recommended ? 'Team pick' : 'Mark team pick'}
            </button>
            <button type="button" className="btn" onClick={() => void copyAppUrl(a)}>
              <Copy size={12} /> Copy URL
            </button>
            <button type="button" className="btn" onClick={openDiagnose}>
              <Route size={12} /> Inspect route
            </button>
            {broken ? (
              <button type="button" className="btn btn-warn" onClick={openDiagnose}>
                <Stethoscope size={12} /> Diagnose
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="glass-section">
        <div className="detail-grid detail-grid-human">
          <div className="detail-row">
            <span>Gateway path</span>
            <code>{appLaunchPath(a)}</code>
          </div>
          <div className="detail-row">
            <span>Public URL</span>
            <code>{appPublicUrl(a)}</code>
          </div>
          <div className="detail-row">
            <span>Cluster service port</span>
            <code>:{a.backend.port}</code>
            <span className="detail-hint">In-cluster only — not a browser URL</span>
          </div>
          {a.meta?.ingressHosts?.length ? (
            <div className="detail-row">
              <span>Ingress hosts</span>
              <span className="ingress-host-list">
                {a.meta.ingressHosts.map((host) => (
                  <code key={host}>{host}</code>
                ))}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      {a.meta?.meshRoutes?.length || a.meta?.meshPolicies?.length ? (
        <MeshPolicyPanel routes={a.meta.meshRoutes} policies={a.meta.meshPolicies} />
      ) : null}

      <section className="glass-section">
        <button type="button" className="tech-toggle" onClick={() => setTechOpen((v) => !v)}>
          Technical details
          <span>{techOpen ? 'Hide' : 'Show'}</span>
        </button>
        {techOpen ? (
          <div className="detail-grid detail-grid-tech">
            <div className="detail-row">
              <span>Namespace</span>
              <span>{a.namespace}</span>
            </div>
            <div className="detail-row">
              <span>Service</span>
              <span>
                {a.backend.name}:{a.backend.port}
              </span>
            </div>
            <div className="detail-row">
              <span>Source</span>
              <span>{sourceLabel(a.source)}</span>
            </div>
            <div className="detail-row">
              <span>Ready endpoints</span>
              <span>{a.readyEndpoints}</span>
            </div>
            <div className="detail-row">
              <span>Auth</span>
              <span>{a.authMode}</span>
            </div>
            {a.meta?.owner ? (
              <div className="detail-row">
                <span>Owner</span>
                <span>{a.meta.owner}</span>
              </div>
            ) : null}
            {dependencyLinks.length ? (
              <div className="detail-row">
                <span>Depends on</span>
                <span className="dep-links">
                  {dependencyLinks.map(({ dep, app: depApp }) =>
                    depApp ? (
                      <Link key={dep} to={appDetailPath(depApp)}>
                        {depApp.displayName}
                      </Link>
                    ) : (
                      <span key={dep}>{dep}</span>
                    ),
                  )}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <ShareLinksPanel app={a} />

      <AppGraphPanel appId={a.id} />

      <div className="app-actions" style={{ marginTop: '0.5rem' }}>
        <Link to="/apps" className="btn">
          Back to catalog
        </Link>
      </div>

      <DiagnosePanel app={a} open={diagnoseOpen} onClose={closeDiagnose} />
    </>
  )
}

export function HealthPage() {
  const cluster = useQuery({ queryKey: ['cluster-summary'], queryFn: hermesApi.clusterSummary, refetchInterval: 15000 })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog, refetchInterval: 15000 })
  const publishedHealth = useQuery({ queryKey: ['health'], queryFn: hermesApi.healthSummary, refetchInterval: 15000 })

  const unhealthy = useMemo(() => {
    const rank = (s: string) => (s === 'broken' ? 0 : s === 'degraded' ? 1 : 2)
    return [...(catalog.data ?? [])]
      .filter((a) => a.status !== 'healthy')
      .sort((a, b) => rank(a.status) - rank(b.status) || a.displayName.localeCompare(b.displayName))
  }, [catalog.data])

  const serviceCount = cluster.data?.total ?? catalog.data?.length ?? 0
  const healthy = cluster.data?.healthy ?? catalog.data?.filter((a) => a.status === 'healthy').length ?? 0
  const degraded = cluster.data?.degraded ?? catalog.data?.filter((a) => a.status === 'degraded').length ?? 0
  const broken = cluster.data?.broken ?? catalog.data?.filter((a) => a.status === 'broken').length ?? 0

  return (
    <>
      <section className="glass-section">
        <h2>Discovered services</h2>
        <p className="hero-sub">Full cluster catalog health — not limited to launchpad-published apps.</p>
        <div className="hero-stats">
          <div className="stat-pill">
            <strong>{serviceCount}</strong> discovered
          </div>
          <div className="stat-pill">
            <strong>{healthy}</strong> healthy
          </div>
          <div className="stat-pill">
            <strong>{degraded}</strong> degraded
          </div>
          <div className="stat-pill">
            <strong>{broken}</strong> broken
          </div>
        </div>
      </section>
      <section className="glass-section">
        <h2>Needs attention ({unhealthy.length})</h2>
        {unhealthy.length ? (
          <div className="app-grid">
            {unhealthy.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        ) : (
          <div className="empty">All discovered services are healthy.</div>
        )}
      </section>
      <section className="glass-section">
        <h2>Published launchpad health</h2>
        <p className="hero-sub">
          Gateway probes only apps published to the launchpad ({publishedHealth.data?.total ?? 0} published).
        </p>
        <div className="hero-stats">
          <div className="stat-pill">
            <strong>{publishedHealth.data?.healthy ?? '—'}</strong> healthy
          </div>
          <div className="stat-pill">
            <strong>{publishedHealth.data?.degraded ?? '—'}</strong> degraded
          </div>
          <div className="stat-pill">
            <strong>{publishedHealth.data?.broken ?? '—'}</strong> broken
          </div>
        </div>
        {publishedHealth.data?.apps.length ? (
          <div className="app-grid">
            {publishedHealth.data.apps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        ) : (
          <div className="empty">All published apps are healthy.</div>
        )}
      </section>
    </>
  )
}
