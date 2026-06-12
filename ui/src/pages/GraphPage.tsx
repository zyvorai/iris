// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { GitBranch } from 'lucide-react'
import AppGraphView from '../components/AppGraphView'
import { hermesApi } from '../services/hermesApi'
import type { AppGraph } from '../types'

function filterGraph(
  graph: AppGraph,
  nsFilter: string,
  ownerFilter: string,
  statusFilter: string,
  brokenOnly: boolean,
): AppGraph {
  let nodes = graph.nodes
  if (nsFilter) nodes = nodes.filter((n) => n.namespace === nsFilter)
  if (ownerFilter) nodes = nodes.filter((n) => (n.owner ?? '') === ownerFilter)
  if (statusFilter) nodes = nodes.filter((n) => n.status === statusFilter)

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

  const graph = useQuery({ queryKey: ['graph'], queryFn: hermesApi.getGraph, refetchInterval: 15000 })

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
    () => (graph.data ? filterGraph(graph.data, nsFilter, ownerFilter, statusFilter, brokenOnly) : null),
    [graph.data, nsFilter, ownerFilter, statusFilter, brokenOnly],
  )

  const brokenDeps = (graph.data?.edges ?? []).filter((e) => !e.resolved).length

  return (
    <>
      <section className="glass-section">
        <div className="section-head">
          <div>
            <h2>
              <GitBranch size={16} /> Application graph
            </h2>
            <p className="hero-sub">Dependency links between published catalog apps</p>
          </div>
          {filtered ? (
            <span className="chip chip-muted">
              {filtered.nodes.length} apps · {filtered.edges.length} links
              {brokenDeps ? ` · ${brokenDeps} unresolved` : ''}
            </span>
          ) : null}
          <Link to="/apps" className="section-link">
            Catalog
          </Link>
        </div>

        <div className="filter-bar graph-filters">
          <select value={nsFilter} onChange={(e) => setNsFilter(e.target.value)} aria-label="Namespace filter">
            <option value="">All namespaces</option>
            {namespaces.map((ns) => (
              <option key={ns} value={ns}>
                {ns}
              </option>
            ))}
          </select>
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} aria-label="Owner filter">
            <option value="">All owners</option>
            {owners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status filter">
            <option value="">All statuses</option>
            <option value="healthy">Healthy</option>
            <option value="degraded">Degraded</option>
            <option value="broken">Broken</option>
          </select>
          <label className="graph-broken-toggle">
            <input type="checkbox" checked={brokenOnly} onChange={(e) => setBrokenOnly(e.target.checked)} />
            Broken deps only
          </label>
        </div>

        {graph.isLoading ? (
          <div className="empty">Loading graph…</div>
        ) : graph.error ? (
          <div className="empty">Could not load application graph.</div>
        ) : filtered ? (
          <AppGraphView graph={filtered} />
        ) : null}
      </section>
    </>
  )
}

export function AppGraphPanel({ appId }: { appId: string }) {
  const graph = useQuery({ queryKey: ['graph'], queryFn: hermesApi.getGraph })
  if (!graph.data) return null
  const related = graph.data.edges.some(
    (e) => (e.resolved && (e.from === appId || e.to === appId)) || (!e.resolved && e.to === appId),
  )
  if (!related) return null

  return (
    <section className="glass-section">
      <div className="section-head">
        <h3>Dependency neighborhood</h3>
        <Link to="/graph" className="section-link">
          Full graph
        </Link>
      </div>
      <AppGraphView graph={graph.data} focusId={appId} />
    </section>
  )
}
