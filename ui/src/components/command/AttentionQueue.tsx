// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HeartPulse, Sparkles } from 'lucide-react'
import ServiceCard from '../nebula/ServiceCard'
import GlassPanel from '../nebula/GlassPanel'
import EmptyState from '../nebula/EmptyState'
import { useFleetInsight } from '../../hooks/useZyraAiInsight'
import type { HermesApp } from '../../types'

interface AttentionQueueProps {
  apps: HermesApp[]
  onInspect?: (app: HermesApp) => void
}

export default function AttentionQueue({ apps }: AttentionQueueProps) {
  const [filter, setFilter] = useState<'all' | 'broken' | 'degraded'>('all')
  const fleetInsight = useFleetInsight(apps.length > 0)
  const filtered = useMemo(() => {
    if (filter === 'broken') return apps.filter((a) => a.status === 'broken')
    if (filter === 'degraded') return apps.filter((a) => a.status === 'degraded')
    return apps
  }, [apps, filter])
  const visible = filtered.slice(0, 12)
  const brokenCount = apps.filter((a) => a.status === 'broken').length
  const degradedCount = apps.filter((a) => a.status === 'degraded').length

  if (!apps.length) {
    return (
      <GlassPanel className="glass-panel-section" id="attention-queue" data-testid="attention-queue">
        <EmptyState
          icon={<HeartPulse size={22} />}
          title="All services healthy"
          description="No degraded or broken services in the catalog."
          tone="ok"
        />
      </GlassPanel>
    )
  }

  return (
    <GlassPanel className="glass-panel-section attention-queue" id="attention-queue" data-testid="attention-queue">
      <div className="section-head-nebula">
        <div>
          <p className="section-label">Attention Queue</p>
          <p className="body-text">Discovered services that failed probes or have degraded endpoints</p>
        </div>
        <span className="nebula-status-badge status-warn">{apps.length}</span>
        {apps.length > visible.length ? (
          <Link to="/health" className="section-link-nebula">
            View all
          </Link>
        ) : null}
      </div>
      {fleetInsight.data?.summary ? (
        <p className="body-text zyra-ai-explanation attention-queue-ai" data-testid="attention-queue-ai">
          <Sparkles size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          {fleetInsight.data.summary}
        </p>
      ) : null}
      <div className="mission-control-filters" role="tablist" aria-label="Filter attention queue">
        <button type="button" role="tab" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          All ({apps.length})
        </button>
        <button type="button" role="tab" className={filter === 'broken' ? 'active' : ''} onClick={() => setFilter('broken')}>
          Broken ({brokenCount})
        </button>
        <button type="button" role="tab" className={filter === 'degraded' ? 'active' : ''} onClick={() => setFilter('degraded')}>
          Degraded ({degradedCount})
        </button>
      </div>
      {!filtered.length ? (
        <EmptyState
          icon={<HeartPulse size={22} />}
          title="No matches"
          description={`No ${filter === 'all' ? '' : filter} services in this filter.`}
        />
      ) : (
        <div className="mission-control-group-body">
          {visible.map((app) => (
            <ServiceCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </GlassPanel>
  )
}
