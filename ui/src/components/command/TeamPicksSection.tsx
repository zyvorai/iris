// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import AppCard from '../AppCard'
import type { HermesApp } from '../../types'

interface TeamPicksSectionProps {
  apps: HermesApp[]
  favoriteIds: Set<string>
}

export default function TeamPicksSection({ apps, favoriteIds }: TeamPicksSectionProps) {
  if (!apps.length) return null

  return (
    <section className="glass-section team-picks-section" data-testid="team-picks-section">
      <div className="section-head">
        <div>
          <h2>
            <Sparkles size={16} /> Team Picks
          </h2>
          <p className="hero-sub">Recommended services for your organization</p>
        </div>
        <Link to="/teams" className="section-link">
          Manage teams
        </Link>
      </div>
      <div className="app-grid">
        {apps.map((app) => (
          <AppCard key={app.id} app={app} favorite={favoriteIds.has(app.id)} />
        ))}
      </div>
    </section>
  )
}
