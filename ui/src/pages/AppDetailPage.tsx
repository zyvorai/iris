// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Copy, ExternalLink, Route, Star, Stethoscope } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import AppCard from '../components/AppCard'
import DiagnosePanel from '../components/DiagnosePanel'
import {
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
  const isFavorite = favorites.data?.some((f) => f.id === app.data?.id) ?? false

  const favMutation = useMutation({
    mutationFn: () =>
      isFavorite ? hermesApi.removeFavorite(app.data!.id) : hermesApi.addFavorite(app.data!.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['favorites'] }),
  })

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
            <button type="button" className="btn btn-primary" onClick={() => openApp(a)}>
              <ExternalLink size={12} /> Open
            </button>
            <button type="button" className="btn" onClick={() => void favMutation.mutate()}>
              <Star size={12} fill={isFavorite ? 'currentColor' : 'none'} /> {isFavorite ? 'Unpin' : 'Pin'}
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
        </div>
      </section>

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
            {a.meta?.dependsOn?.length ? (
              <div className="detail-row">
                <span>Depends on</span>
                <span>{a.meta.dependsOn.join(', ')}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

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
  const health = useQuery({ queryKey: ['health'], queryFn: hermesApi.healthSummary })

  return (
    <>
      <div className="hero-stats">
        <div className="stat-pill">
          <strong>{health.data?.total ?? '—'}</strong> total
        </div>
        <div className="stat-pill">
          <strong>{health.data?.healthy ?? '—'}</strong> healthy
        </div>
        <div className="stat-pill">
          <strong>{health.data?.degraded ?? '—'}</strong> degraded
        </div>
        <div className="stat-pill">
          <strong>{health.data?.broken ?? '—'}</strong> broken
        </div>
      </div>
      <section className="glass-section">
        <h2>Unhealthy apps</h2>
        {health.data?.apps.length ? (
          <div className="app-grid">
            {health.data.apps.map((app) => (
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
