// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import PlatformPulseHero from '../components/command/PlatformPulseHero'
import QuickLaunchBar from '../components/command/QuickLaunchBar'
import HomeFleetSnapshot from '../components/command/HomeFleetSnapshot'
import MissionControlSpaces from '../components/command/MissionControlSpaces'
import ServiceGalaxy from '../components/command/ServiceGalaxy'
import PageFrame from '../components/nebula/PageFrame'
import ContextBanner from '../components/nebula/ContextBanner'
import { hermesApi } from '../services/hermesApi'
import { useFleetInsight } from '../hooks/useZeusAiInsight'
import ZeusAiPanel from '../components/nebula/ZeusAiPanel'
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

function buildAiHint(apps: HermesApp[]): string | undefined {
  const unhealthy = apps.filter((a) => a.status !== 'healthy')
  if (!unhealthy.length) return undefined

  const timeouts = unhealthy.filter((a) => /timeout|deadline exceeded/i.test(a.statusMessage ?? '')).length
  const stacks = new Map<string, number>()
  for (const app of unhealthy) {
    const key = app.namespace.split('-')[0] ?? app.namespace
    stacks.set(key, (stacks.get(key) ?? 0) + 1)
  }
  const topStack = [...stacks.entries()].sort((a, b) => b[1] - a[1])[0]

  const parts: string[] = [`${unhealthy.length} services need attention`]
  if (timeouts > 0) parts.push(`Most failures are timeout-related (${timeouts})`)
  if (topStack && topStack[1] >= 2) parts.push(`${topStack[0]} stack appears unreachable`)
  return parts.join(' · ')
}

export default function HomePage() {
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog, refetchInterval: 15000 })
  const cluster = useQuery({ queryKey: ['cluster-summary'], queryFn: hermesApi.clusterSummary, refetchInterval: 15000 })
  const auth = useQuery({ queryKey: ['auth-me'], queryFn: hermesApi.authMe, retry: false })
  const { matchesWorkspace, workspaceId, setWorkspaceId } = useWorkspace()
  const { openDiagnose } = useInspector()

  const filterWs = (list: HermesApp[] | undefined) => (list ?? []).filter(matchesWorkspace)
  const catalogApps = filterWs(catalog.data)
  const serviceCount = cluster.data?.total ?? catalogApps.length
  const namespaceCount = cluster.data?.namespaces ?? 0
  const healthy = cluster.data?.healthy ?? catalogApps.filter((a) => a.status === 'healthy').length
  const degraded = cluster.data?.degraded ?? catalogApps.filter((a) => a.status === 'degraded').length
  const broken = cluster.data?.broken ?? catalogApps.filter((a) => a.status === 'broken').length
  const publishedCount = cluster.data?.published ?? catalogApps.filter((a) => a.visibility.published).length
  const issueCount = degraded + broken

  const loading = (catalog.isLoading && !catalog.data) || (cluster.isLoading && !cluster.data)
  const error = catalog.isError || cluster.isError
  const hasData = Boolean(catalog.data || cluster.data)

  const unhealthy = useMemo(
    () =>
      [...catalogApps]
        .filter((a) => a.status !== 'healthy')
        .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.displayName.localeCompare(b.displayName)),
    [catalogApps],
  )

  const quickLaunchApps = useMemo(
    () =>
      catalogApps
        .filter((a) => a.visibility.published && a.readyEndpoints > 0 && a.status !== 'broken')
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .slice(0, 6),
    [catalogApps],
  )

  const publishedApps = useMemo(
    () => catalogApps.filter((a) => a.visibility.published),
    [catalogApps],
  )

  const fleetInsight = useFleetInsight(hasData)

  const aiHint = useMemo(() => {
    if (fleetInsight.data?.summary) {
      const extra = fleetInsight.data.highlights?.[0]
      return extra ? `${fleetInsight.data.summary} · ${extra}` : fleetInsight.data.summary
    }
    return buildAiHint(catalogApps)
  }, [fleetInsight.data, catalogApps])

  const onResolveIssues = () => {
    if (unhealthy[0]) openDiagnose(unhealthy[0].id)
    else document.getElementById('mission-control')?.scrollIntoView({ behavior: 'smooth' })
  }

  const onRetry = () => {
    void catalog.refetch()
    void cluster.refetch()
  }

  return (
    <PageFrame
      loading={loading}
      error={error}
      hasData={hasData}
      onRetry={onRetry}
      errorTitle="Could not load platform overview"
      contextBanner={
        workspaceId ? (
          <ContextBanner
            label={`Showing ${workspaceId} workspace only`}
            detail="Clear the filter to see all cluster services"
            onClear={() => setWorkspaceId('')}
          />
        ) : undefined
      }
    >
      <div className="page-grid">
        <PlatformPulseHero
          greeting={greeting()}
          userId={auth.data?.userId}
          serviceCount={serviceCount}
          namespaceCount={namespaceCount}
          publishedCount={publishedCount}
          healthy={healthy}
          degraded={degraded}
          broken={broken}
          aiHint={aiHint}
          onResolveIssues={onResolveIssues}
        />

        <HomeFleetSnapshot
          serviceCount={serviceCount}
          publishedCount={publishedCount}
          namespaceCount={namespaceCount}
          issueCount={issueCount}
          brokenCount={broken}
        />

        <QuickLaunchBar apps={quickLaunchApps} />

        {hasData ? (
          <ZeusAiPanel
            title="Fleet insight"
            summary={fleetInsight.data?.summary}
            explanation={fleetInsight.data?.explanation ?? 'Zeus AI is summarizing fleet health…'}
            source={fleetInsight.data?.source}
            remediation={fleetInsight.data?.highlights}
            loading={fleetInsight.isLoading}
            compact
          />
        ) : null}

        <MissionControlSpaces apps={catalogApps} />

        <ServiceGalaxy
          onNodeClick={(id) => openDiagnose(id)}
          publishedCount={publishedCount}
          publishedApps={publishedApps}
        />
      </div>
    </PageFrame>
  )
}
