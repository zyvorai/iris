// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Link } from 'react-router-dom'
import { HERMES_SPACES, spaceCounts } from '../utils/spaces'
import type { HermesApp } from '../types'

const SPACE_GRADIENTS: Record<string, string> = {
  monitoring: 'space-monitoring',
  security: 'space-security',
  infrastructure: 'space-infrastructure',
  'zeus-os': 'space-zeus-os',
  consolehub: 'space-consolehub',
  databases: 'space-databases',
  other: 'space-other',
}

interface SpaceGridProps {
  apps: HermesApp[]
}

export default function SpaceGrid({ apps }: SpaceGridProps) {
  const counts = spaceCounts(apps)

  return (
    <div className="space-grid" data-testid="space-grid">
      {HERMES_SPACES.filter((space) => counts[space.id] > 0).map((space) => (
        <Link key={space.id} to={`/spaces/${space.id}`} className={`space-tile zeus-card ${SPACE_GRADIENTS[space.id]}`}>
          <div className="space-tile-icon" aria-hidden>
            {space.label.charAt(0)}
          </div>
          <div>
            <h3>{space.label}</h3>
            <p>{space.description}</p>
            <span className="space-count">
              {counts[space.id]} app{counts[space.id] === 1 ? '' : 's'}
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
