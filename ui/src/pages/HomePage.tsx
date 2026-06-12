// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import AppCard from '../components/AppCard'
import MissionControlStrip from '../components/MissionControlStrip'
import SpaceGrid from '../components/SpaceGrid'
import { hermesApi } from '../services/hermesApi'
import { useWorkspace } from '../utils/workspaceContext'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function HomePage() {
  const apps = useQuery({ queryKey: ['apps'], queryFn: hermesApi.listApps })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog, refetchInterval: 15000 })
  const cluster = useQuery({ queryKey: ['cluster-summary'], queryFn: hermesApi.clusterSummary, refetchInterval: 15000 })
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: hermesApi.listFavorites })
  const recents = useQuery({ queryKey: ['recents'], queryFn: hermesApi.listRecents })
  const health = useQuery({ queryKey: ['health'], queryFn: hermesApi.healthSummary })
  const recommendedQ = useQuery({ queryKey: ['recommended'], queryFn: hermesApi.listRecommended })
  const { matchesWorkspace, workspaceId } = useWorkspace()

  const favIds = new Set(favorites.data?.map((a) => a.id) ?? [])
  const filterWs = (list: typeof apps.data) => (list ?? []).filter(matchesWorkspace)
  const unhealthy = filterWs(health.data?.apps)
  const recommended = useMemo(
    () => filterWs(recommendedQ.data).slice(0, 6),
    [recommendedQ.data, matchesWorkspace],
  )
  const publishedApps = useMemo(() => filterWs(apps.data).slice(0, 8), [apps.data, matchesWorkspace])
  const spaceApps = useMemo(
    () => filterWs(catalog.data?.filter((a) => a.visibility.published)),
    [catalog.data, matchesWorkspace],
  )

  return (
    <>
      <section className="glass-hero home-hero">
        <div className="hero-copy">
          <div className="hero-kicker">{greeting()}</div>
          <h2 className="hero-title">Your cluster at a glance</h2>
          <p className="hero-sub">
            Hermes discovers every service across the cluster — Zeus OS, monitoring stacks, and custom workloads.
            Open anything through one gateway.
          </p>
          <Link to="/cluster" className="btn btn-primary hero-cta">
            Browse cluster <ChevronRight size={14} />
          </Link>
        </div>
        <div className="hero-metrics">
          <div className="metric-tile">
            <span className="metric-value">{cluster.data?.total ?? catalog.data?.length ?? '—'}</span>
            <span className="metric-label">Cluster services</span>
          </div>
          <div className="metric-tile">
            <span className="metric-value">{cluster.data?.namespaces ?? '—'}</span>
            <span className="metric-label">Namespaces</span>
          </div>
          <div className="metric-tile metric-ok">
            <span className="metric-value">{health.data?.healthy ?? '—'}</span>
            <span className="metric-label">Healthy</span>
          </div>
          <div className="metric-tile metric-warn">
            <span className="metric-value">{unhealthy.length}</span>
            <span className="metric-label">Need attention</span>
          </div>
        </div>
      </section>

      <MissionControlStrip apps={filterWs(apps.data)} />

      {workspaceId ? (
        <section className="glass-section workspace-banner">
          <p className="hero-sub">
            Showing <strong>{workspaceId}</strong> workspace apps only. Clear the workspace chip in the header to see
            everything.
          </p>
        </section>
      ) : null}

      {unhealthy.length > 0 ? (
        <section className="glass-section">
          <div className="section-head">
            <h2>Needs attention</h2>
            <span className="chip chip-warn">{unhealthy.length}</span>
          </div>
          <div className="app-grid">
            {unhealthy.slice(0, 4).map((app) => (
              <AppCard key={app.id} app={app} favorite={favIds.has(app.id)} />
            ))}
          </div>
        </section>
      ) : null}

      {recommended.length > 0 ? (
        <section className="glass-section">
          <div className="section-head">
            <h2>Team picks</h2>
            <span className="chip chip-accent">{recommended.length}</span>
          </div>
          <div className="app-grid">
            {recommended.map((app) => (
              <AppCard key={app.id} app={app} favorite={favIds.has(app.id)} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="glass-section">
        <div className="section-head">
          <h2>Spaces</h2>
          <Link to="/spaces" className="section-link">
            View all <ChevronRight size={14} />
          </Link>
        </div>
        <SpaceGrid apps={spaceApps} />
      </section>

      <section className="glass-section">
        <div className="section-head">
          <h2>Favorites</h2>
          <span className="chip chip-muted">{favorites.data?.length ?? 0}</span>
        </div>
        {favorites.isLoading ? (
          <div className="empty">Loading…</div>
        ) : favorites.data?.length ? (
          <div className="app-grid">
            {favorites.data.map((app) => (
              <AppCard key={app.id} app={app} favorite />
            ))}
          </div>
        ) : (
          <div className="empty">Pin apps from Cluster or Apps to see them here.</div>
        )}
      </section>

      <section className="glass-section">
        <div className="section-head">
          <h2>Recently opened</h2>
        </div>
        {recents.data?.length ? (
          <div className="app-grid">
            {recents.data.map((app) => (
              <AppCard key={app.id} app={app} favorite={favIds.has(app.id)} />
            ))}
          </div>
        ) : (
          <div className="empty">Open a service to populate recents.</div>
        )}
      </section>

      <section className="glass-section">
        <div className="section-head">
          <h2>Published apps</h2>
          <Link to="/apps" className="section-link">
            View all <ChevronRight size={14} />
          </Link>
        </div>
        {apps.isLoading ? (
          <div className="empty">Loading…</div>
        ) : (
          <div className="app-grid">
            {(publishedApps).map((app) => (
              <AppCard key={app.id} app={app} favorite={favIds.has(app.id)} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
