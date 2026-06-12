// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { GitBranch } from 'lucide-react'
import AppGraphView from '../components/AppGraphView'
import { hermesApi } from '../services/hermesApi'

export default function GraphPage() {
  const graph = useQuery({ queryKey: ['graph'], queryFn: hermesApi.getGraph, refetchInterval: 15000 })

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
          {graph.data ? (
            <span className="chip chip-muted">
              {graph.data.nodes.length} apps · {graph.data.edges.length} links
            </span>
          ) : null}
          <Link to="/apps" className="section-link">
            Catalog
          </Link>
        </div>
        {graph.isLoading ? (
          <div className="empty">Loading graph…</div>
        ) : graph.error ? (
          <div className="empty">Could not load application graph.</div>
        ) : graph.data ? (
          <AppGraphView graph={graph.data} />
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
