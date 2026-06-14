// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, LayoutGrid, Radar } from 'lucide-react'
import GlassPanel from '../nebula/GlassPanel'
import ServiceCard from '../nebula/ServiceCard'
import EmptyState from '../nebula/EmptyState'
import Button from '../nebula/Button'
import { HERMES_SPACES, groupAppsBySpace } from '../../utils/spaces'
import type { HermesApp } from '../../types'

interface MissionControlSpacesProps {
  apps: HermesApp[]
}

type FilterMode = 'all' | 'attention'

function statusRank(status: string): number {
  if (status === 'broken') return 0
  if (status === 'degraded') return 1
  return 2
}

function sortApps(apps: HermesApp[]): HermesApp[] {
  return [...apps].sort(
    (a, b) => statusRank(a.status) - statusRank(b.status) || a.displayName.localeCompare(b.displayName),
  )
}

function SpaceGroup({
  spaceId,
  label,
  apps,
  defaultOpen,
}: {
  spaceId: string
  label: string
  apps: HermesApp[]
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const unhealthy = apps.filter((a) => a.status !== 'healthy').length

  if (!apps.length) return null

  return (
    <div className="mission-control-group-flat">
      <button type="button" className="mission-control-group-head" onClick={() => setOpen((v) => !v)}>
        <h3>{label}</h3>
        <span className="mission-control-group-count">
          {apps.length} service{apps.length === 1 ? '' : 's'}
          {unhealthy > 0 ? ` · ${unhealthy} need attention` : ''}
        </span>
        <Link to={`/spaces/${spaceId}`} className="section-link-nebula" onClick={(e) => e.stopPropagation()}>
          View all
        </Link>
        <ChevronDown size={16} className={open ? 'rotated' : ''} aria-hidden />
      </button>
      {open ? (
        <div className="mission-control-group-body">
          {sortApps(apps).map((app) => (
            <ServiceCard key={app.id} app={app} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

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

  const spacesWithApps = HERMES_SPACES.filter((s) => (filteredGrouped.get(s.id)?.length ?? 0) > 0)
  const attentionTotal = apps.filter((a) => a.status !== 'healthy').length

  if (!apps.length) {
    return (
      <GlassPanel className="glass-panel-section" data-testid="mission-control-strip">
        <EmptyState
          icon={<Radar size={22} />}
          title="No services discovered yet"
          description="Hermes will index cluster services as the controller syncs. Check Cluster for the full inventory."
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
        />
      ) : (
        spacesWithApps.map((space) => {
          const spaceApps = filteredGrouped.get(space.id) ?? []
          const hasUnhealthy = spaceApps.some((a) => a.status !== 'healthy')
          return (
            <SpaceGroup
              key={space.id}
              spaceId={space.id}
              label={space.label}
              apps={spaceApps}
              defaultOpen={hasUnhealthy}
            />
          )
        })
      )}
    </GlassPanel>
  )
}
