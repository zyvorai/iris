// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import AppCard from '../components/AppCard'
import { appLaunchPath, appPublicUrl, environmentLabel, hermesApi, openApp, statusTone } from '../services/hermesApi'

export default function AppDetailPage() {
  const { id } = useParams<{ id: string }>()
  const app = useQuery({
    queryKey: ['app', id],
    queryFn: () => hermesApi.getApp(decodeURIComponent(id ?? '')),
    enabled: Boolean(id),
  })

  if (app.isLoading) return <div className="empty">Loading...</div>
  if (app.error || !app.data) return <div className="empty">App not found</div>

  const a = app.data

  return (
    <section className={`glass-section ${statusTone(a.status)}`}>
      <h2>{a.displayName}</h2>
      <div className="detail-grid">
        <div className="detail-row">
          <span>Status</span>
          <span>{a.status}{a.statusMessage ? ` — ${a.statusMessage}` : ''}</span>
        </div>
        <div className="detail-row">
          <span>Namespace</span>
          <span>{a.namespace}</span>
        </div>
        <div className="detail-row">
          <span>Route</span>
          <span>{appLaunchPath(a)}</span>
        </div>
        {a.canonicalSlug ? (
          <div className="detail-row">
            <span>Canonical slug</span>
            <span>{a.canonicalSlug}</span>
          </div>
        ) : null}
        <div className="detail-row">
          <span>Public URL</span>
          <span>{appPublicUrl(a)}</span>
        </div>
        {a.meta?.environment ? (
          <div className="detail-row">
            <span>Environment</span>
            <span>{environmentLabel(a.meta.environment)}</span>
          </div>
        ) : null}
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
        <div className="detail-row">
          <span>Backend</span>
          <span>
            {a.backend.kind}/{a.backend.name}:{a.backend.port}
          </span>
        </div>
        <div className="detail-row">
          <span>Endpoints ready</span>
          <span>{a.readyEndpoints}</span>
        </div>
        <div className="detail-row">
          <span>Auth</span>
          <span>{a.authMode}</span>
        </div>
      </div>
      <div className="app-actions" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn btn-primary" onClick={() => openApp(a)}>
          Open
        </button>
        <Link to="/apps" className="btn">
          Back to catalog
        </Link>
      </div>
    </section>
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
