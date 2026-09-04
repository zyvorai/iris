// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { IRIS_SPACES, spaceCounts } from '../utils/spaces'
import { accentColorFor } from '../utils/iconColor'
import type { IrisApp } from '../types'

interface SpaceGridProps {
  apps: IrisApp[]
}

export default function SpaceGrid({ apps }: SpaceGridProps) {
  const counts = spaceCounts(apps)

  return (
    <div className="space-grid" data-testid="space-grid">
      {IRIS_SPACES.filter((space) => counts[space.id] > 0).map((space) => {
        const style = { '--icon-accent': accentColorFor(space.label, space.id).accent } as CSSProperties
        return (
          <Link key={space.id} to={`/spaces/${space.id}`} className="space-tile zeus-card">
            <div className="space-tile-icon" style={style} aria-hidden>
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
        )
      })}
    </div>
  )
}
