// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import AppGraphView from '../AppGraphView'
import { hermesApi } from '../../services/hermesApi'

interface ServiceGalaxyProps {
  onNodeClick?: (appId: string) => void
  publishedCount?: number
}

export default function ServiceGalaxy({ onNodeClick, publishedCount = 0 }: ServiceGalaxyProps) {
  const graph = useQuery({ queryKey: ['graph'], queryFn: hermesApi.getGraph, refetchInterval: 30000 })
  const nodes = graph.data?.nodes.length ?? 0

  return (
    <section className="glass-section service-galaxy" data-testid="service-galaxy">
      <div className="section-head">
        <div>
          <h2>Published topology</h2>
          <p className="hero-sub">
            Graph includes launchpad-published apps only ({nodes} node{nodes === 1 ? '' : 's'}).
            {publishedCount > nodes ? ` ${publishedCount - nodes} published apps have no graph edges yet.` : ''}
          </p>
        </div>
        <Link to="/graph" className="section-link">
          Full graph
        </Link>
      </div>
      {graph.isLoading ? <div className="empty">Loading topology…</div> : null}
      {graph.error ? <div className="empty">Could not load graph.</div> : null}
      {!graph.isLoading && nodes === 0 ? (
        <div className="empty">
          No published apps in the graph yet.{' '}
          <Link to="/cluster">Publish services on Cluster</Link> to populate this view.
        </div>
      ) : null}
      {graph.data && nodes > 0 ? <AppGraphView graph={graph.data} onNodeClick={onNodeClick} compact /> : null}
    </section>
  )
}
