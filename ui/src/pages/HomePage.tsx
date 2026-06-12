// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import AppCard from '../components/AppCard'
import AttentionQueue from '../components/command/AttentionQueue'
import QuickLaunchBar from '../components/command/QuickLaunchBar'
import TeamPicksSection from '../components/command/TeamPicksSection'
import HomeActivityFeed from '../components/command/HomeActivityFeed'
import HomeMetricsStrip from '../components/command/HomeMetricsStrip'
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

function statusRank(status: string): number {
  if (status === 'broken') return 0
  if (status === 'degraded') return 1
  return 2
}

export default function HomePage() {
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog, refetchInterval: 15000 })
  const cluster = useQuery({ queryKey: ['cluster-summary'], queryFn: hermesApi.clusterSummary, refetchInterval: 15000 })
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: hermesApi.listFavorites })
  const recents = useQuery({ queryKey: ['recents'], queryFn: hermesApi.listRecents })
  const recommended = useQuery({ queryKey: ['recommended'], queryFn: hermesApi.listRecommended })
  const auth = useQuery({ queryKey: ['auth-me'], queryFn: hermesApi.authMe, retry: false })
  const { matchesWorkspace, workspaceId } = useWorkspace()
  const { openInspector } = useInspector()

  const favIds = new Set(favorites.data?.map((a) => a.id) ?? [])
  const filterWs = (list: HermesApp[] | undefined) => (list ?? []).filter(matchesWorkspace)
  const catalogApps = filterWs(catalog.data)
  const serviceCount = cluster.data?.total ?? catalogApps.length
  const namespaceCount = cluster.data?.namespaces ?? 0
  const healthy = cluster.data?.healthy ?? catalogApps.filter((a) => a.status === 'healthy').length
  const degraded = cluster.data?.degraded ?? catalogApps.filter((a) => a.status === 'degraded').length
  const broken = cluster.data?.broken ?? catalogApps.filter((a) => a.status === 'broken').length
  const publishedCount = cluster.data?.published ?? catalogApps.filter((a) => a.visibility.published).length

  const unhealthy = useMemo(
    () =>
      [...catalogApps]
        .filter((a) => a.status !== 'healthy')
        .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.displayName.localeCompare(b.displayName)),
    [catalogApps],
  )

  const issueCount = degraded + broken

  const quickLaunchApps = useMemo(
    () =>
      catalogApps
        .filter((a) => a.visibility.published && a.readyEndpoints > 0 && a.status !== 'broken')
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .slice(0, 12),
    [catalogApps],
  )

  const teamPicks = useMemo(
    () => (recommended.data ?? []).filter(matchesWorkspace).slice(0, 6),
    [recommended.data, matchesWorkspace],
  )

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
        publishedCount={publishedCount}
        healthy={healthy}
        degraded={degraded}
        broken={broken}
        onResolveIssues={onResolveIssues}
      />

      <QuickLaunchBar apps={quickLaunchApps} />

      <HomeMetricsStrip
        serviceCount={serviceCount}
        publishedCount={publishedCount}
        namespaceCount={namespaceCount}
        issueCount={issueCount}
        brokenCount={broken}
      />

      <MissionControlSpaces apps={catalogApps} onInspect={onInspect} />

      <TeamPicksSection apps={teamPicks} favoriteIds={favIds} />

      <HomeActivityFeed />

      {workspaceId ? (
        <section className="glass-section workspace-banner">
          <p className="hero-sub">
            Showing <strong>{workspaceId}</strong> workspace apps only. Clear the cluster chip in the top bar to see
            everything.
          </p>
        </section>
      ) : null}

      <AttentionQueue apps={unhealthy} onInspect={onInspect} />

      <ServiceGalaxy onNodeClick={(id) => openInspector(id)} publishedCount={publishedCount} />

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
