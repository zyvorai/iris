// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { GitBranch } from 'lucide-react'
import AppGraphView from '../components/AppGraphView'
import AskZeusButton from '../components/nebula/AskZeusButton'
import GlassPanel from '../components/nebula/GlassPanel'
import PageFrame from '../components/nebula/PageFrame'
import PageToolbar from '../components/nebula/PageToolbar'
import EmptyState from '../components/nebula/EmptyState'
import PageLoading from '../components/nebula/PageLoading'
import ZeusAiPanel from '../components/nebula/ZeusAiPanel'
import ZeusAiFocusChips from '../components/nebula/ZeusAiFocusChips'
import { hermesApi } from '../services/hermesApi'
import { useGraphInsight } from '../hooks/useZeusAiInsight'
import { useInspector } from '../utils/inspectorContext'
import type { AppGraph } from '../types'

function filterGraph(
  graph: AppGraph,
  nsFilter: string,
  ownerFilter: string,
  statusFilter: string,
  brokenOnly: boolean,
  meshOnly: boolean,
): AppGraph {
  let nodes = graph.nodes
  if (nsFilter) nodes = nodes.filter((n) => n.namespace === nsFilter)
  if (ownerFilter) nodes = nodes.filter((n) => (n.owner ?? '') === ownerFilter)
  if (statusFilter) nodes = nodes.filter((n) => n.status === statusFilter)
  if (meshOnly) nodes = nodes.filter((n) => (n.meshRoutes?.length ?? 0) > 0)

  const ids = new Set(nodes.map((n) => n.id))
  let edges = graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to))
  if (brokenOnly) {
    edges = edges.filter((e) => !e.resolved || nodes.some((n) => n.id === e.to && n.status === 'broken'))
    const edgeIds = new Set<string>()
    for (const e of edges) {
      edgeIds.add(e.from)
      edgeIds.add(e.to)
    }
    nodes = nodes.filter((n) => edgeIds.has(n.id) || n.status === 'broken')
  }

  return { nodes, edges }
}

export default function GraphPage() {
  const [nsFilter, setNsFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [brokenOnly, setBrokenOnly] = useState(false)
  const [meshOnly, setMeshOnly] = useState(false)

  const graph = useQuery({ queryKey: ['graph'], queryFn: hermesApi.getGraph, refetchInterval: 15000 })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog })
  const graphInsight = useGraphInsight(Boolean(graph.data))
  const { openDiagnose } = useInspector()

  const namespaces = useMemo(() => {
    const set = new Set((graph.data?.nodes ?? []).map((n) => n.namespace))
    return [...set].sort()
  }, [graph.data])

  const owners = useMemo(() => {
    const set = new Set<string>()
    for (const node of graph.data?.nodes ?? []) {
      if (node.owner) set.add(node.owner)
    }
    return [...set].sort()
  }, [graph.data])

  const filtered = useMemo(
    () =>
      graph.data
        ? filterGraph(graph.data, nsFilter, ownerFilter, statusFilter, brokenOnly, meshOnly)
        : null,
    [graph.data, nsFilter, ownerFilter, statusFilter, brokenOnly, meshOnly],
  )

  const brokenDeps = (graph.data?.edges ?? []).filter((e) => !e.resolved).length
  const loading = graph.isLoading && !graph.data

  return (
    <PageFrame
      loading={loading}
      error={graph.isError}
      hasData={Boolean(graph.data)}
      onRetry={() => void graph.refetch()}
      errorTitle="Could not load application graph"
    >
      <div className="page-grid">
        {graph.data ? (
          <ZeusAiPanel
            title="Topology insight"
            summary={graphInsight.data?.summary}
            explanation={graphInsight.data?.explanation ?? 'Zeus AI is analyzing dependency topology…'}
            source={graphInsight.data?.source}
            remediation={graphInsight.data?.highlights}
            loading={graphInsight.isLoading}
            compact
            onRefresh={() => void graphInsight.refetch()}
            refreshing={graphInsight.isFetching && !graphInsight.isLoading}
            action={
              <ZeusAiFocusChips
                appIds={graphInsight.data?.focusAppIds ?? []}
                catalog={catalog.data ?? []}
                onSelect={openDiagnose}
              />
            }
          />
        ) : null}

        <GlassPanel className="glass-panel-section">
          <div className="section-head-nebula">
            <div>
              <p className="section-label">
                <GitBranch size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Application graph
              </p>
              <p className="body-text">Dependency links between published catalog apps</p>
            </div>
            {filtered ? (
              <span className="nebula-status-badge status-unknown">
                {filtered.nodes.length} apps · {filtered.edges.length} links
                {brokenDeps ? ` · ${brokenDeps} unresolved` : ''}
              </span>
            ) : null}
            <Link to="/apps" className="section-link-nebula">
              Catalog
            </Link>
            <AskZeusButton compact command="graph insight" />
          </div>

          <PageToolbar className="graph-filters-toolbar glass-toolbar">
            <select className="page-toolbar-select" value={nsFilter} onChange={(e) => setNsFilter(e.target.value)} aria-label="Namespace filter">
              <option value="">All namespaces</option>
              {namespaces.map((ns) => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
            <select className="page-toolbar-select" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} aria-label="Owner filter">
              <option value="">All owners</option>
              {owners.map((owner) => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
            <select className="page-toolbar-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status filter">
              <option value="">All statuses</option>
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="broken">Broken</option>
            </select>
            <label className="graph-broken-toggle body-text">
              <input type="checkbox" checked={brokenOnly} onChange={(e) => setBrokenOnly(e.target.checked)} />
              Broken deps
            </label>
            <label className="graph-broken-toggle body-text">
              <input type="checkbox" checked={meshOnly} onChange={(e) => setMeshOnly(e.target.checked)} />
              Mesh only
            </label>
          </PageToolbar>

          {filtered && !filtered.nodes.length ? (
            <EmptyState
              icon={<GitBranch size={22} />}
              title="No graph nodes match"
              description="Publish more apps or clear filters to see dependency links."
            />
          ) : filtered ? (
            <AppGraphView graph={filtered} />
          ) : null}
        </GlassPanel>
      </div>
    </PageFrame>
  )
}

export function AppGraphPanel({ appId }: { appId: string }) {
  const graph = useQuery({ queryKey: ['graph'], queryFn: hermesApi.getGraph })

  if (graph.isLoading && !graph.data) {
    return (
      <GlassPanel className="glass-panel-section">
        <PageLoading rows={2} />
      </GlassPanel>
    )
  }

  if (!graph.data) return null
  const related = graph.data.edges.some(
    (e) => (e.resolved && (e.from === appId || e.to === appId)) || (!e.resolved && e.to === appId),
  )
  if (!related) return null

  return (
    <GlassPanel className="glass-panel-section">
      <div className="section-head-nebula">
        <p className="section-label">Dependency neighborhood</p>
        <Link to="/graph" className="section-link-nebula">
          Full graph
        </Link>
      </div>
      <AppGraphView graph={graph.data} focusId={appId} />
    </GlassPanel>
  )
}
