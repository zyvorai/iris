// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import AppCard from '../components/AppCard'
import AttentionQueue from '../components/command/AttentionQueue'
import MissionControlSpaces from '../components/command/MissionControlSpaces'
import PlatformPulseHero from '../components/command/PlatformPulseHero'
import ServiceGalaxy from '../components/command/ServiceGalaxy'
import { hermesApi } from '../services/hermesApi'
import { useInspector } from '../utils/inspectorContext'
import { useWorkspace } from '../utils/workspaceContext'
import type { HermesApp } from '../types'

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
  const auth = useQuery({ queryKey: ['auth-me'], queryFn: hermesApi.authMe, retry: false })
  const { matchesWorkspace, workspaceId } = useWorkspace()
  const { openInspector } = useInspector()

  const favIds = new Set(favorites.data?.map((a) => a.id) ?? [])
  const filterWs = (list: HermesApp[] | undefined) => (list ?? []).filter(matchesWorkspace)
  const unhealthy = filterWs(health.data?.apps)
  const allApps = filterWs(apps.data)
  const serviceCount = cluster.data?.total ?? catalog.data?.length ?? allApps.length
  const namespaceCount = cluster.data?.namespaces ?? 0

  const pinnedAndRecent = useMemo(() => {
    const seen = new Set<string>()
    const merged: HermesApp[] = []
    for (const app of [...(favorites.data ?? []), ...(recents.data ?? [])]) {
      if (seen.has(app.id) || !matchesWorkspace(app)) continue
      seen.add(app.id)
      merged.push(app)
    }
    return merged.slice(0, 8)
  }, [favorites.data, recents.data, matchesWorkspace])

  const onInspect = (app: HermesApp) => openInspector(app.id)
  const onResolveIssues = () => {
    if (unhealthy[0]) openInspector(unhealthy[0].id)
    else document.getElementById('attention-queue')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <PlatformPulseHero
        greeting={greeting()}
        userId={auth.data?.userId}
        serviceCount={serviceCount}
        namespaceCount={namespaceCount}
        attentionCount={unhealthy.length}
        healthy={health.data?.healthy ?? 0}
        onResolveIssues={onResolveIssues}
      />

      <MissionControlSpaces apps={allApps} onInspect={onInspect} />

      {workspaceId ? (
        <section className="glass-section workspace-banner">
          <p className="hero-sub">
            Showing <strong>{workspaceId}</strong> workspace apps only. Clear the cluster chip in the top bar to see
            everything.
          </p>
        </section>
      ) : null}

      <AttentionQueue apps={unhealthy} onInspect={onInspect} />

      <ServiceGalaxy onNodeClick={(id) => openInspector(id)} />

      {pinnedAndRecent.length > 0 ? (
        <section className="glass-section">
          <div className="section-head">
            <h2>Recent &amp; Pinned</h2>
            <Link to="/apps" className="section-link">
              Catalog <ChevronRight size={14} />
            </Link>
          </div>
          <div className="app-grid">
            {pinnedAndRecent.map((app) => (
              <AppCard key={app.id} app={app} favorite={favIds.has(app.id)} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}
