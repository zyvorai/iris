// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, Radar } from 'lucide-react'
import GlassPanel from '../nebula/GlassPanel'
import DeparturesRow from '../nebula/DeparturesBoard'
import CollapsibleGroup from '../nebula/CollapsibleGroup'
import { useStatusFlip } from '../../hooks/useStatusFlip'
import EmptyState from '../nebula/EmptyState'
import Button from '../nebula/Button'
import { IRIS_SPACES, groupAppsBySpace } from '../../utils/spaces'
import type { IrisApp } from '../../types'

interface MissionControlSpacesProps {
  apps: IrisApp[]
}

type FilterMode = 'all' | 'attention'

export default function MissionControlSpaces({ apps }: MissionControlSpacesProps) {
  const [filter, setFilter] = useState<FilterMode>('all')
  const grouped = useMemo(() => groupAppsBySpace(apps), [apps])

  const filteredGrouped = useMemo(() => {
    if (filter === 'all') return grouped
    const next = new Map(grouped)
    for (const [id, list] of next) {
      next.set(
        id,
        list.filter((a) => a.status === 'degraded' || a.status === 'broken'),
      )
    }
    return next
  }, [grouped, filter])

  const spacesWithApps = IRIS_SPACES.filter((s) => (filteredGrouped.get(s.id)?.length ?? 0) > 0)
  const attentionTotal = apps.filter((a) => a.status !== 'healthy').length
  const flipped = useStatusFlip(apps)

  if (!apps.length) {
    return (
      <GlassPanel className="glass-panel-section" data-testid="mission-control-strip">
        <EmptyState
          icon={<Radar size={22} />}
          title="No services discovered yet"
          description="Iris will index cluster services as the controller syncs. Check Cluster for the full inventory."
          action={
            <Button variant="primary" to="/cluster">
              Open Cluster
            </Button>
          }
        />
      </GlassPanel>
    )
  }

  return (
    <GlassPanel className="glass-panel-section mission-control-board" id="mission-control" data-testid="mission-control-strip">
      <div className="section-head-nebula">
        <div>
          <p className="section-label">
            <LayoutGrid size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Mission Control
          </p>
          <p className="body-text">Discovered services by space — expandable cards with diagnosis and actions</p>
        </div>
        <Link to="/spaces" className="section-link-nebula">
          All spaces
        </Link>
      </div>

      <div className="mission-control-filters" role="tablist" aria-label="Filter mission control">
        <button type="button" role="tab" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          All services ({apps.length})
        </button>
        <button
          type="button"
          role="tab"
          className={filter === 'attention' ? 'active' : ''}
          onClick={() => setFilter('attention')}
        >
          Needs attention ({attentionTotal})
        </button>
      </div>

      {!spacesWithApps.length ? (
        <EmptyState
          icon={<Radar size={22} />}
          title="All clear"
          description="No services match this filter. Every discovered service in this view is healthy."
          tone="ok"
        />
      ) : (
        spacesWithApps.map((space) => (
          <CollapsibleGroup
            key={space.id}
            label={space.label}
            apps={filteredGrouped.get(space.id) ?? []}
            renderApp={(app) => <DeparturesRow key={app.id} app={app} flipped={flipped.has(app.id)} />}
            headerExtra={
              <Link to={`/spaces/${space.id}`} className="section-link-nebula" onClick={(e) => e.stopPropagation()}>
                View all
              </Link>
            }
          />
        ))
      )}
    </GlassPanel>
  )
}
