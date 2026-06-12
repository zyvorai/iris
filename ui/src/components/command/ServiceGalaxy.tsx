// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useQuery } from '@tanstack/react-query'
import AppGraphView from '../AppGraphView'
import { hermesApi } from '../../services/hermesApi'

interface ServiceGalaxyProps {
  onNodeClick?: (appId: string) => void
}

export default function ServiceGalaxy({ onNodeClick }: ServiceGalaxyProps) {
  const graph = useQuery({ queryKey: ['graph'], queryFn: hermesApi.getGraph, refetchInterval: 30000 })

  return (
    <section className="glass-section service-galaxy" data-testid="service-galaxy">
      <div className="section-head">
        <h2>Service Galaxy</h2>
        <span className="chip chip-muted">{graph.data?.nodes.length ?? 0} nodes</span>
      </div>
      {graph.isLoading ? <div className="empty">Loading topology…</div> : null}
      {graph.error ? <div className="empty">Could not load graph.</div> : null}
      {graph.data ? <AppGraphView graph={graph.data} onNodeClick={onNodeClick} compact /> : null}
    </section>
  )
}
