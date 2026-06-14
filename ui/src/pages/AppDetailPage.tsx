// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, HeartPulse, Stethoscope } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import AppCard from '../components/AppCard'
import AttentionQueue from '../components/command/AttentionQueue'
import HomeFleetSnapshot from '../components/command/HomeFleetSnapshot'
import GlassPanel from '../components/nebula/GlassPanel'
import HealthRing from '../components/nebula/HealthRing'
import PageFrame from '../components/nebula/PageFrame'
import EmptyState from '../components/nebula/EmptyState'
import Button from '../components/nebula/Button'
import ZeusAiPanel from '../components/nebula/ZeusAiPanel'
import ZeusAiFocusChips from '../components/nebula/ZeusAiFocusChips'
import { useFleetInsight, useZeusAiInsight } from '../hooks/useZeusAiInsight'
import ActionMenu from '../components/nebula/ActionMenu'
import StatusBadge from '../components/nebula/StatusBadge'
import RouteDisplay from '../components/nebula/RouteDisplay'
import ServiceStatusMessage from '../components/nebula/ServiceStatusMessage'
import ShareLinksPanel from '../components/ShareLinksPanel'
import MeshPolicyPanel from '../components/MeshPolicyPanel'
import { AppGraphPanel } from '../pages/GraphPage'
import { useInspector } from '../utils/inspectorContext'
import {
  appDetailPath,
  appLaunchPath,
  appPublicUrl,
  copyAppUrl,
  environmentLabel,
  hermesApi,
  openApp,
  sourceLabel,
  statusTone,
} from '../services/hermesApi'

export default function AppDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [techOpen, setTechOpen] = useState(false)
  const { openDiagnose, diagnoseAppId } = useInspector()
  const qc = useQueryClient()
  const appId = id ? decodeURIComponent(id) : ''

  const app = useQuery({
    queryKey: ['app', id],
    queryFn: () => hermesApi.getApp(appId),
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

  const appInsight = useZeusAiInsight(appId, Boolean(appId))

  useEffect(() => {
    if (searchParams.get('diagnose') === '1' && appId && diagnoseAppId !== appId) {
      openDiagnose(appId)
    }
  }, [searchParams, appId, diagnoseAppId, openDiagnose])

  useEffect(() => {
    if (!diagnoseAppId && searchParams.get('diagnose') === '1') {
      setSearchParams({}, { replace: true })
    }
  }, [diagnoseAppId, searchParams, setSearchParams])

  const handleOpenDiagnose = () => {
    if (!appId) return
    openDiagnose(appId)
    setSearchParams({ diagnose: '1' }, { replace: true })
  }

  if (app.isLoading) {
    return (
      <PageFrame loading error={false} hasData={false} onRetry={() => void app.refetch()}>
        <div />
      </PageFrame>
    )
  }
  if (app.error || !app.data) {
    return (
      <PageFrame
        loading={false}
        error
        hasData={false}
        onRetry={() => void app.refetch()}
        errorTitle="App not found"
      >
        <div />
      </PageFrame>
    )
  }

  const a = app.data
  const broken = a.status === 'broken' || a.status === 'degraded'
  const canOpen = a.status !== 'broken' && a.readyEndpoints > 0

  const overflowItems = [
    { label: isFavorite ? 'Unpin' : 'Pin', onClick: () => void favMutation.mutate() },
    {
      label: a.meta?.recommended ? 'Remove team pick' : 'Mark team pick',
      onClick: () => void recommendMutation.mutate(!a.meta?.recommended),
    },
    { label: 'Copy URL', onClick: () => void copyAppUrl(a), disabled: !canOpen },
    { label: 'Inspect route', onClick: handleOpenDiagnose },
  ]

  return (
    <PageFrame loading={false} error={false} hasData onRetry={() => void app.refetch()}>
      <div className="page-grid">
        <GlassPanel className={`glass-panel-section app-detail-hero-nebula ${statusTone(a.status)}`}>
          <div className="app-detail-head">
            <div>
              <p className="page-kicker">{a.category}</p>
              <h1 className="page-title">{a.displayName}</h1>
              <p className="body-text">{a.description || 'Infrastructure application'}</p>
              <div className="app-meta-row">
                <StatusBadge status={a.status} />
                {a.meta?.environment ? (
                  <span className="chip chip-env">{environmentLabel(a.meta.environment)}</span>
                ) : null}
              </div>
              {broken && a.statusMessage ? (
                <ServiceStatusMessage message={a.statusMessage} status={a.status} />
              ) : null}
            </div>
            <div className="app-detail-actions-nebula">
              {broken ? (
                <Button variant="danger" onClick={handleOpenDiagnose}>
                  <Stethoscope size={14} /> Diagnose
                </Button>
              ) : (
                <Button variant="primary" disabled={!canOpen} onClick={() => void openApp(a)}>
                  <ExternalLink size={14} /> {canOpen ? 'Open' : 'Cannot open'}
                </Button>
              )}
              <ActionMenu items={overflowItems} label="App actions" />
            </div>
          </div>
        </GlassPanel>

        <ZeusAiPanel
          title="Zeus AI service insight"
          summary={appInsight.summary || undefined}
          explanation={appInsight.explanation}
          source={appInsight.source}
          remediation={appInsight.remediation}
          loading={appInsight.loading}
          compact
          action={
            broken ? (
              <Button variant="ai" onClick={handleOpenDiagnose}>
                Ask Zeus AI
              </Button>
            ) : undefined
          }
        />

        <GlassPanel className="glass-panel-section">
          <p className="section-label">Routing</p>
          <div className="route-display-list">
            <RouteDisplay label="Launchpad path" path={appLaunchPath(a)} href={appPublicUrl(a)} />
            <RouteDisplay label="Public URL" path={appPublicUrl(a)} href={appPublicUrl(a)} />
            <RouteDisplay
              label="In-cluster service"
              path={`${a.backend.name}.${a.namespace}:${a.backend.port}`}
              hint="Cluster DNS — not a browser URL"
            />
            {a.meta?.ingressHosts?.length ? (
              <div className="route-display-row">
                <span className="route-display-label">Ingress hosts</span>
                <div className="route-display-hosts">
                  {a.meta.ingressHosts.map((host) => (
                    <code key={host} className="route-display-path">{host}</code>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </GlassPanel>

        {a.meta?.meshRoutes?.length || a.meta?.meshPolicies?.length ? (
          <MeshPolicyPanel routes={a.meta.meshRoutes} policies={a.meta.meshPolicies} />
        ) : null}

        <GlassPanel className="glass-panel-section">
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
        </GlassPanel>

        <ShareLinksPanel app={a} />

        <AppGraphPanel appId={a.id} />

        <div className="app-detail-footer-actions">
          <Button variant="ghost" to="/apps">
            Back to catalog
          </Button>
        </div>
      </div>
    </PageFrame>
  )
}

export function HealthPage() {
  const { openDiagnose } = useInspector()
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
  const issueCount = degraded + broken
  const publishedCount = cluster.data?.published ?? catalog.data?.filter((a) => a.visibility.published).length ?? 0
  const namespaceCount = cluster.data?.namespaces ?? 0

  const loading = (catalog.isLoading && !catalog.data) || (cluster.isLoading && !cluster.data)
  const hasData = Boolean(catalog.data || cluster.data)
  const fleetInsight = useFleetInsight(hasData)

  return (
    <PageFrame
      loading={loading}
      error={catalog.isError || cluster.isError}
      hasData={Boolean(catalog.data || cluster.data)}
      onRetry={() => {
        void catalog.refetch()
        void cluster.refetch()
      }}
      errorTitle="Could not load health data"
    >
      <div className="page-grid">
        <GlassPanel className="glass-panel-section hero-command-panel aura-warning">
          <div className="hero-aura" aria-hidden />
          <div className="hero-layout">
            <div className="hero-command-copy">
              <p className="page-kicker">Health dashboard</p>
              <h1 className="page-title">Cluster health overview</h1>
              <p className="hero-command-stats body-text">
                {serviceCount} discovered · {healthy} healthy · {degraded} degraded · {broken} broken
              </p>
            </div>
            <HealthRing healthy={healthy} total={serviceCount} attentionCount={issueCount} />
          </div>
        </GlassPanel>

        <HomeFleetSnapshot
          serviceCount={serviceCount}
          publishedCount={publishedCount}
          namespaceCount={namespaceCount}
          issueCount={issueCount}
          brokenCount={broken}
        />

        {hasData ? (
          <ZeusAiPanel
            title="Zeus AI fleet summary"
            summary={fleetInsight.data?.summary}
            explanation={fleetInsight.data?.explanation ?? 'Analyzing cluster health patterns…'}
            source={fleetInsight.data?.source}
            remediation={fleetInsight.data?.highlights}
            loading={fleetInsight.isLoading}
            action={
              <ZeusAiFocusChips
                appIds={fleetInsight.data?.focusAppIds ?? []}
                catalog={catalog.data ?? []}
                onSelect={openDiagnose}
              />
            }
          />
        ) : null}

        <AttentionQueue apps={unhealthy} />

        <GlassPanel className="glass-panel-section">
          <p className="section-label">Published launchpad health</p>
          <p className="body-text">
            Gateway probes only apps published to the launchpad ({publishedHealth.data?.total ?? 0} published).
          </p>
          {publishedHealth.data?.apps.length ? (
            <div className="app-grid" style={{ marginTop: '1rem' }}>
              {publishedHealth.data.apps.map((app) => (
                <AppCard key={app.id} app={app} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<HeartPulse size={22} />} title="All published apps are healthy" />
          )}
        </GlassPanel>
      </div>
    </PageFrame>
  )
}
