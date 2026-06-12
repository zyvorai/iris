// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import ServiceTile from './ServiceTile'
import { hermesApi } from '../../services/hermesApi'
import { HERMES_SPACES, groupAppsBySpace } from '../../utils/spaces'
import type { HermesApp } from '../../types'

const APPS_PER_SPACE = 8

interface MissionControlSpacesProps {
  apps: HermesApp[]
  onInspect?: (app: HermesApp) => void
}

export default function MissionControlSpaces({ apps, onInspect }: MissionControlSpacesProps) {
  const grouped = useMemo(() => groupAppsBySpace(apps), [apps])
  const spacesWithApps = HERMES_SPACES.filter((s) => (grouped.get(s.id)?.length ?? 0) > 0)
  const recents = useQuery({ queryKey: ['audit-recent'], queryFn: () => hermesApi.listAudit(5) })

  if (spacesWithApps.length === 0) return null

  return (
    <section className="glass-section mission-control-spaces" id="mission-control" data-testid="mission-control-strip">
      <div className="section-head">
        <div>
          <h2>
            <LayoutGrid size={16} /> Mission Control
          </h2>
          <p className="hero-sub">Dense launch surfaces by infrastructure space</p>
        </div>
        <Link to="/spaces" className="section-link">
          All spaces
        </Link>
      </div>
      <div className="mission-control-layout">
        <div className="mission-control-grid">
          {spacesWithApps.map((space) => {
            const spaceApps = (grouped.get(space.id) ?? []).slice(0, APPS_PER_SPACE)
            return (
              <div key={space.id} className="mission-control-space zeus-glass">
                <div className="mission-control-space-head">
                  <h3>{space.label}</h3>
                  <Link to={`/spaces/${space.id}`}>View all</Link>
                </div>
                <div className="mission-control-apps dense">
                  {spaceApps.map((app) => (
                    <ServiceTile key={app.id} app={app} variant="detail" onInspect={onInspect} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <aside className="mission-recent-activity zeus-glass">
          <h3>Recent Activity</h3>
          {recents.isLoading ? <p className="empty">Loading…</p> : null}
          {!recents.isLoading && !recents.data?.length ? <p className="empty">No recent events.</p> : null}
          <ul className="mission-recent-list">
            {recents.data?.map((evt) => (
              <li key={evt.id}>
                <strong>{evt.action}</strong>
                <span>{evt.detail || evt.appId || 'cluster'}</span>
                <time>{new Date(evt.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  )
}
