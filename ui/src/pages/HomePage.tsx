// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import PlatformPulseHero from '../components/command/PlatformPulseHero'
import QuickLaunchBar from '../components/command/QuickLaunchBar'
import HomeFleetSnapshot from '../components/command/HomeFleetSnapshot'
import PageFrame from '../components/nebula/PageFrame'
import ContextBanner from '../components/nebula/ContextBanner'
import { irisApi } from '../services/irisApi'
import { useInspector } from '../utils/inspectorContext'
import { useWorkspace } from '../utils/workspaceContext'
import type { IrisApp } from '../types'

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
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: irisApi.listCatalog, refetchInterval: 15000 })
  const cluster = useQuery({ queryKey: ['cluster-summary'], queryFn: irisApi.clusterSummary, refetchInterval: 15000 })
  const auth = useQuery({ queryKey: ['auth-me'], queryFn: irisApi.authMe, retry: false })
  const { matchesWorkspace, workspaceId, setWorkspaceId } = useWorkspace()
  const { openDiagnose } = useInspector()
  const navigate = useNavigate()

  const filterWs = (list: IrisApp[] | undefined) => (list ?? []).filter(matchesWorkspace)
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

  const onResolveIssues = () => {
    if (unhealthy[0]) openDiagnose(unhealthy[0].id)
    else navigate('/mission-control')
  }

  return (
    <PageFrame
      loading={loading}
      error={error}
      hasData={hasData}
      onRetry={() => {
        void catalog.refetch()
        void cluster.refetch()
      }}
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
      <div className="hs-page">
        <PlatformPulseHero
          greeting={greeting()}
          userId={auth.data?.userId}
          serviceCount={serviceCount}
          publishedCount={publishedCount}
          healthy={healthy}
          degraded={degraded}
          broken={broken}
          onResolveIssues={onResolveIssues}
        />

        <div className="hs-wrap hs-home-body">
          <hr className="hs-home-divider" />
          <HomeFleetSnapshot
            serviceCount={serviceCount}
            publishedCount={publishedCount}
            namespaceCount={namespaceCount}
            issueCount={issueCount}
            brokenCount={broken}
          />
          <QuickLaunchBar apps={quickLaunchApps} />
          <p className="hs-home-more">
            <Link to="/mission-control">Mission Control</Link>
            <span aria-hidden> · </span>
            <Link to="/cluster">Cluster</Link>
            <span aria-hidden> · </span>
            <Link to="/help">Help</Link>
          </p>
        </div>
      </div>
    </PageFrame>
  )
}
