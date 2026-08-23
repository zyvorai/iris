// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LayoutGrid } from 'lucide-react'
import PlatformPulseHero from '../components/command/PlatformPulseHero'
import QuickLaunchBar from '../components/command/QuickLaunchBar'
import HomeFleetSnapshot from '../components/command/HomeFleetSnapshot'
import ServiceGalaxy from '../components/command/ServiceGalaxy'
import PageFrame from '../components/nebula/PageFrame'
import ContextBanner from '../components/nebula/ContextBanner'
import GlassPanel from '../components/nebula/GlassPanel'
import GlyphTile from '../components/nebula/GlyphTile'
import Button from '../components/nebula/Button'
import Pips from '../components/nebula/Pips'
import { hermesApi } from '../services/hermesApi'
import { useFleetInsight } from '../hooks/useZyraAiInsight'
import ZyraAiPanel from '../components/nebula/ZyraAiPanel'
import ZyraAiFocusChips from '../components/nebula/ZyraAiFocusChips'
import { useInspector } from '../utils/inspectorContext'
import { useSpotlight } from '../utils/spotlightContext'
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
  const { openSpotlight } = useSpotlight()
  const navigate = useNavigate()

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
    else navigate('/mission-control')
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
          onAskZyra={() => openSpotlight(issueCount > 0 ? 'explain' : 'suggest publish')}
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
          <ZyraAiPanel
            title="Fleet insight"
            summary={fleetInsight.data?.summary}
            explanation={fleetInsight.data?.explanation ?? 'Zyra AI is summarizing fleet health…'}
            source={fleetInsight.data?.source}
            remediation={fleetInsight.data?.highlights}
            loading={fleetInsight.isLoading}
            compact
            onRefresh={() => void fleetInsight.refetch()}
            refreshing={fleetInsight.isFetching && !fleetInsight.isLoading}
            action={
              <ZyraAiFocusChips
                appIds={fleetInsight.data?.focusAppIds ?? []}
                catalog={catalogApps}
                onSelect={openDiagnose}
              />
            }
          />
        ) : null}

        <GlassPanel className="glass-panel-section">
          <div className="section-head-nebula">
            <GlyphTile tone="brand" icon={<LayoutGrid size={14} />} size="sm" />
            <div>
              <p className="section-label">Mission Control</p>
              <h2 className="section-title">
                {issueCount > 0 ? `${issueCount} of ${serviceCount} services need attention` : 'Every space is healthy'}
              </h2>
              <p className="body-text">The live departures board across every space in the cluster.</p>
            </div>
            <Button variant="primary" to="/mission-control">
              Open Mission Control
            </Button>
          </div>
          <div className="board-footer">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-faint)' }}>
              Fleet at a glance
            </span>
            <span className="gap" />
            <Pips apps={catalogApps} />
          </div>
        </GlassPanel>

        <ServiceGalaxy
          onNodeClick={(id) => openDiagnose(id)}
          publishedCount={publishedCount}
          publishedApps={publishedApps}
        />
      </div>
    </PageFrame>
  )
}
