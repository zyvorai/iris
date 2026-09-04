// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Network } from 'lucide-react'
import GlassPanel from '../nebula/GlassPanel'
import AppGraphView from '../AppGraphView'
import StatusBadge from '../nebula/StatusBadge'
import Button from '../nebula/Button'
import EmptyState from '../nebula/EmptyState'
import AppIcon from '../AppIcon'
import { hermesApi, openApp } from '../../services/hermesApi'
import { useInspector } from '../../utils/inspectorContext'
import type { HermesApp } from '../../types'

interface ServiceGalaxyProps {
  onNodeClick?: (appId: string) => void
  publishedCount?: number
  publishedApps?: HermesApp[]
}

function ConstellationFallback({ apps, onNodeClick }: { apps: HermesApp[]; onNodeClick?: (id: string) => void }) {
  const { openDiagnose } = useInspector()
  if (!apps.length) return null

  return (
    <div className="topology-constellation">
      {apps.map((app) => (
        <GlassPanel key={app.id} className="topology-constellation-node">
          <AppIcon icon={app.icon} name={app.displayName} size="md" />
          <strong>{app.displayName}</strong>
          <span className="quick-launch-tile-ns">{app.namespace}</span>
          <StatusBadge status={app.status} />
          <div className="quick-launch-tile-actions">
            <Button variant="primary" onClick={() => void openApp(app)}>
              Open
            </Button>
            <Button variant="ghost" onClick={() => (onNodeClick ? onNodeClick(app.id) : openDiagnose(app.id))}>
              Inspect
            </Button>
          </div>
        </GlassPanel>
      ))}
    </div>
  )
}

export default function ServiceGalaxy({
  onNodeClick,
  publishedCount = 0,
  publishedApps = [],
}: ServiceGalaxyProps) {
  const graph = useQuery({ queryKey: ['graph'], queryFn: hermesApi.getGraph, refetchInterval: 30000 })
  const nodes = graph.data?.nodes.length ?? 0
  const edges = graph.data?.edges.filter((e) => e.resolved).length ?? 0

  const fallbackApps = useMemo(
    () => publishedApps.filter((a) => a.visibility.published).slice(0, 12),
    [publishedApps],
  )

  return (
    <GlassPanel className="glass-panel-section service-galaxy" data-testid="service-galaxy">
      <div className="section-head-nebula">
        <div>
          <p className="section-label">Published Topology</p>
          <p className="body-text">
            {nodes > 0
              ? `${nodes} published node${nodes === 1 ? '' : 's'}${edges > 0 ? ` · ${edges} connection${edges === 1 ? '' : 's'}` : ''}`
              : 'Service universe for launchpad-published apps'}
          </p>
        </div>
        <Link to="/graph" className="section-link-nebula">
          Full graph
        </Link>
      </div>

      {graph.isLoading ? (
        <div className="page-loading-skeleton page-loading-skeleton-compact" data-testid="galaxy-loading">
          <div className="skeleton-toolbar" />
          <div className="skeleton-card" style={{ height: 120 }} />
        </div>
      ) : null}

      {graph.error ? (
        <EmptyState icon={<Network size={22} />} title="Could not load topology" description="Try refreshing the page." tone="critical" />
      ) : null}

      {!graph.isLoading && !graph.error && nodes === 0 ? (
        <EmptyState
          icon={<Network size={22} />}
          title="No published topology yet"
          description="Only published services appear here. Publish services on Cluster to expand the graph."
          action={
            publishedCount > 0 ? (
              <Button variant="secondary" to="/cluster">
                Publish on Cluster
              </Button>
            ) : (
              <Button variant="secondary" to="/cluster">
                Browse cluster
              </Button>
            )
          }
        />
      ) : null}

      {!graph.isLoading && nodes === 0 && fallbackApps.length ? (
        <ConstellationFallback apps={fallbackApps} onNodeClick={onNodeClick} />
      ) : null}

      {graph.data && nodes > 0 ? (
        edges === 0 && nodes <= 4 ? (
          <>
            <p className="body-text" style={{ paddingBottom: '1rem' }}>
              Publish more services to expand connections in the topology graph.
            </p>
            <AppGraphView graph={graph.data} onNodeClick={onNodeClick} compact galaxy />
          </>
        ) : (
          <AppGraphView graph={graph.data} onNodeClick={onNodeClick} compact galaxy />
        )
      ) : null}
    </GlassPanel>
  )
}
