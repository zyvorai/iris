// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers, Rocket, Server, Compass } from 'lucide-react'
import DeparturesRow from '../components/nebula/DeparturesBoard'
import GlassPanel from '../components/nebula/GlassPanel'
import GlyphTile from '../components/nebula/GlyphTile'
import PageFrame from '../components/nebula/PageFrame'
import PageToolbar from '../components/nebula/PageToolbar'
import ContextBanner from '../components/nebula/ContextBanner'
import EmptyState from '../components/nebula/EmptyState'
import MetricCard from '../components/nebula/MetricCard'
import AskZyraButton from '../components/nebula/AskZyraButton'
import Button from '../components/nebula/Button'
import ActionMenu from '../components/nebula/ActionMenu'
import ZyraAiPanel from '../components/nebula/ZyraAiPanel'
import ZyraAiFocusChips from '../components/nebula/ZyraAiFocusChips'
import CollapsibleGroup from '../components/nebula/CollapsibleGroup'
import { hermesApi } from '../services/hermesApi'
import { useFleetInsight, useNamespaceInsight } from '../hooks/useZyraAiInsight'
import { useWorkspace } from '../utils/workspaceContext'
import { useInspector } from '../utils/inspectorContext'
import { groupBy } from '../utils/groupBy'
import { useStatusFlip } from '../hooks/useStatusFlip'
import { useToast } from '../components/Toast'

export default function ClusterPage() {
  const [nsFilter, setNsFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [view, setView] = useState<'grid' | 'namespace'>('namespace')
  const qc = useQueryClient()
  const { workspaceId, setWorkspaceId, matchesWorkspace } = useWorkspace()
  const [searchParams] = useSearchParams()
  const { openDiagnose } = useInspector()
  const toast = useToast()

  useEffect(() => {
    const ns = searchParams.get('ns')
    if (ns) setNsFilter(ns)
  }, [searchParams])

  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog, refetchInterval: 15000 })
  const summary = useQuery({ queryKey: ['cluster-summary'], queryFn: hermesApi.clusterSummary, refetchInterval: 15000 })
  const clusters = useQuery({ queryKey: ['clusters'], queryFn: hermesApi.listClusters, refetchInterval: 15000 })
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: hermesApi.listFavorites })
  const favIds = new Set(favorites.data?.map((a) => a.id) ?? [])

  const publish = useMutation({
    mutationFn: hermesApi.publish,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['catalog'] })
      void qc.invalidateQueries({ queryKey: ['discovery'] })
      void qc.invalidateQueries({ queryKey: ['apps'] })
      void qc.invalidateQueries({ queryKey: ['cluster-summary'] })
      toast('Service published')
    },
    onError: () => toast('Could not publish service', 'error'),
  })

  const namespaces = useMemo(() => {
    const set = new Set((catalog.data ?? []).map((a) => a.namespace))
    return [...set].sort()
  }, [catalog.data])

  const publishNs = useMutation({
    mutationFn: hermesApi.publishNamespace,
    onSuccess: (_data, ns) => {
      void qc.invalidateQueries({ queryKey: ['catalog'] })
      void qc.invalidateQueries({ queryKey: ['discovery'] })
      void qc.invalidateQueries({ queryKey: ['apps'] })
      void qc.invalidateQueries({ queryKey: ['cluster-summary'] })
      toast(`Published all services in ${ns}`)
    },
    onError: () => toast('Could not publish namespace', 'error'),
  })

  const filtered = useMemo(() => {
    return (catalog.data ?? []).filter((a) => {
      if (!matchesWorkspace(a)) return false
      if (nsFilter && a.namespace !== nsFilter) return false
      if (statusFilter && a.status !== statusFilter) return false
      return true
    })
  }, [catalog.data, nsFilter, statusFilter, matchesWorkspace])

  const byNamespace = useMemo(() => {
    const map = groupBy(filtered, (a) => a.namespace)
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const flipped = useStatusFlip(filtered)

  const loading = catalog.isLoading && !catalog.data
  const error = catalog.isError
  const hasData = Boolean(catalog.data)

  const clearFilters = () => {
    setNsFilter('')
    setStatusFilter('')
  }

  const exportCatalog = () => {
    void hermesApi.exportCatalog().then((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'hermes-catalog.json'
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const catalogCount = catalog.data?.length ?? 0
  const hasActiveFilters = Boolean(nsFilter || statusFilter)
  const isTrulyEmpty = hasData && catalogCount === 0
  const isFilterEmpty = hasData && catalogCount > 0 && !filtered.length
  const issueCount = (catalog.data ?? []).filter((a) => a.status !== 'healthy' && matchesWorkspace(a)).length
  const fleetInsight = useFleetInsight(hasData && issueCount > 0)
  const namespaceInsight = useNamespaceInsight(nsFilter || null, hasData && Boolean(nsFilter))
  const askCommand = nsFilter
    ? `ns insight ${nsFilter}`
    : issueCount > 0
      ? 'explain'
      : (summary.data?.discovery ?? 0) > 0
        ? 'suggest publish'
        : 'ai status'

  return (
    <PageFrame
      loading={loading}
      error={error}
      hasData={hasData}
      onRetry={() => void catalog.refetch()}
      errorTitle="Could not load cluster catalog"
      contextBanner={
        workspaceId ? (
          <ContextBanner
            label={`Workspace filter: ${workspaceId}`}
            detail="Change workspace in the top bar"
            onClear={() => setWorkspaceId('')}
          />
        ) : undefined
      }
      isEmpty={isTrulyEmpty || isFilterEmpty}
      empty={
        <GlassPanel className="glass-panel-section">
          {isTrulyEmpty ? (
            <EmptyState
              icon={<Server size={22} />}
              title="No services discovered yet"
              description="Hermes scans your cluster continuously. Check discovery settings or wait for the controller to finish its first pass."
              action={
                <>
                  <Button variant="primary" to="/discovery">
                    Open discovery
                  </Button>
                  <Button variant="secondary" onClick={() => void catalog.refetch()}>
                    Refresh
                  </Button>
                </>
              }
            />
          ) : (
            <EmptyState
              icon={<Server size={22} />}
              title="No services match your filters"
              description="Clear filters or wait for the controller to finish scanning the cluster."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          )}
        </GlassPanel>
      }
    >
      <div className="page-grid">
        <GlassPanel className="glass-panel-section hero-command-panel">
          <div className="section-head-nebula">
            <GlyphTile tone="brand" icon={<Server size={14} />} size="sm" />
            <div>
              <p className="section-label">Cluster catalog</p>
              <h2 className="section-title">Every service, cluster-wide</h2>
              <p className="body-text">
                Publish to add apps to your launchpad.
                {clusters.data?.[0] ? ` Connected to ${clusters.data[0].name}.` : ''}
              </p>
            </div>
            <AskZyraButton compact command={askCommand} />
          </div>
          <div className="metric-strip metric-strip-4" style={{ marginTop: '1rem' }}>
            <MetricCard icon={Layers} label="Services" value={String(summary.data?.total ?? '—')} sub="Discovered" tone="cyan" />
            <MetricCard icon={Server} label="Namespaces" value={String(summary.data?.namespaces ?? '—')} sub="Active" tone="purple" />
            <MetricCard icon={Rocket} label="Published" value={String(summary.data?.published ?? '—')} sub="On launchpad" tone="green" />
            <MetricCard icon={Compass} label="Unpublished" value={String(summary.data?.discovery ?? '—')} sub="Awaiting publish" to="/discovery" tone="orange" />
          </div>
        </GlassPanel>

        {nsFilter && (namespaceInsight.data || namespaceInsight.isLoading) ? (
          <ZyraAiPanel
            title={`Namespace · ${nsFilter}`}
            summary={namespaceInsight.data?.summary}
            explanation={namespaceInsight.data?.explanation ?? 'Zyra AI is analyzing this namespace…'}
            source={namespaceInsight.data?.source}
            remediation={namespaceInsight.data?.highlights}
            loading={namespaceInsight.isLoading}
            compact
            onRefresh={() => void namespaceInsight.refetch()}
            refreshing={namespaceInsight.isFetching && !namespaceInsight.isLoading}
            action={
              <ZyraAiFocusChips
                appIds={namespaceInsight.data?.focusAppIds ?? []}
                catalog={catalog.data ?? []}
                onSelect={openDiagnose}
              />
            }
          />
        ) : issueCount > 0 && (fleetInsight.data || fleetInsight.isLoading) ? (
          <ZyraAiPanel
            title="Fleet insight"
            summary={fleetInsight.data?.summary}
            explanation={fleetInsight.data?.explanation ?? 'Zyra AI is summarizing cluster health…'}
            source={fleetInsight.data?.source}
            remediation={fleetInsight.data?.highlights}
            loading={fleetInsight.isLoading}
            compact
            onRefresh={() => void fleetInsight.refetch()}
            refreshing={fleetInsight.isFetching && !fleetInsight.isLoading}
            action={
              <ZyraAiFocusChips
                appIds={fleetInsight.data?.focusAppIds ?? []}
                catalog={catalog.data ?? []}
                onSelect={openDiagnose}
              />
            }
          />
        ) : null}

        <PageToolbar className="page-toolbar-sticky page-toolbar-stacked" data-testid="cluster-toolbar">
          <select className="page-toolbar-select" value={nsFilter} onChange={(e) => setNsFilter(e.target.value)} aria-label="Namespace filter">
            <option value="">All namespaces</option>
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
          </select>
          <select className="page-toolbar-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status filter">
            <option value="">All statuses</option>
            <option value="healthy">Healthy</option>
            <option value="degraded">Degraded</option>
            <option value="broken">Broken</option>
            <option value="unknown">Unknown</option>
          </select>
          {nsFilter ? (
            <Button variant="secondary" className="nebula-btn-compact" disabled={publishNs.isPending} onClick={() => publishNs.mutate(nsFilter)}>
              Publish all in {nsFilter}
            </Button>
          ) : null}
          <ActionMenu
            className="cluster-export-menu"
            label="Cluster actions"
            items={[{ label: 'Export catalog JSON', onClick: exportCatalog }]}
          />
          <div className="view-toggle">
            <button type="button" className={view === 'namespace' ? 'active' : ''} onClick={() => setView('namespace')}>
              By namespace
            </button>
            <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
              Grid
            </button>
          </div>
          <span className="body-text filter-count">
            {filtered.length} services{hasActiveFilters && catalogCount > 0 ? ` · ${catalogCount} total` : ''}
          </span>
        </PageToolbar>

        {view === 'grid' ? (
          <GlassPanel className="glass-panel-section">
            <p className="section-label">All services</p>
            <div className="board" style={{ marginTop: '1rem' }}>
              {filtered.map((app) => (
                <DeparturesRow
                  key={app.id}
                  app={app}
                  favorite={favIds.has(app.id)}
                  flipped={flipped.has(app.id)}
                  onPublish={!app.visibility.published ? () => publish.mutate(app.id) : undefined}
                />
              ))}
            </div>
          </GlassPanel>
        ) : (
          byNamespace.map(([ns, nsApps]) => (
            <CollapsibleGroup
              key={ns}
              label={ns}
              apps={nsApps}
              wrap
              renderApp={(app) => (
                <DeparturesRow
                  key={app.id}
                  app={app}
                  compact
                  favorite={favIds.has(app.id)}
                  flipped={flipped.has(app.id)}
                  onPublish={!app.visibility.published ? () => publish.mutate(app.id) : undefined}
                />
              )}
            />
          ))
        )}
      </div>
    </PageFrame>
  )
}
