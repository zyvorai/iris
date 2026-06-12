// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid } from 'lucide-react'
import AppIcon from './AppIcon'
import { appDetailPath, openApp } from '../services/hermesApi'
import { HERMES_SPACES, groupAppsBySpace } from '../utils/spaces'
import type { HermesApp } from '../types'

const APPS_PER_SPACE = 5

interface MissionControlStripProps {
  apps: HermesApp[]
}

export default function MissionControlStrip({ apps }: MissionControlStripProps) {
  const grouped = useMemo(() => groupAppsBySpace(apps), [apps])
  const spacesWithApps = HERMES_SPACES.filter((s) => (grouped.get(s.id)?.length ?? 0) > 0)

  if (spacesWithApps.length === 0) return null

  return (
    <section className="glass-section mission-control-strip" data-testid="mission-control-strip">
      <div className="section-head">
        <div>
          <h2>
            <LayoutGrid size={16} /> Mission Control
          </h2>
          <p className="hero-sub">Quick launch by infrastructure space</p>
        </div>
        <Link to="/spaces" className="section-link">
          All spaces
        </Link>
      </div>
      <div className="mission-control-grid">
        {spacesWithApps.map((space) => {
          const spaceApps = (grouped.get(space.id) ?? []).slice(0, APPS_PER_SPACE)
          return (
            <div key={space.id} className="mission-control-space">
              <div className="mission-control-space-head">
                <h3>{space.label}</h3>
                <Link to={`/spaces/${space.id}`}>View all</Link>
              </div>
              <div className="mission-control-apps">
                {spaceApps.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    className="mission-control-app"
                    title={app.displayName}
                    onClick={() => openApp(app)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      window.location.href = appDetailPath(app)
                    }}
                  >
                    <AppIcon icon={app.icon} name={app.displayName} size="sm" />
                    <span>{app.displayName}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
