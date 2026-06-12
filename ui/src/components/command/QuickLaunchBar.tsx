// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import AppIcon from '../AppIcon'
import { openApp } from '../../services/hermesApi'
import type { HermesApp } from '../../types'

interface QuickLaunchBarProps {
  apps: HermesApp[]
}

export default function QuickLaunchBar({ apps }: QuickLaunchBarProps) {
  if (!apps.length) return null

  return (
    <section className="glass-section quick-launch-bar" data-testid="quick-launch-bar">
      <div className="section-head">
        <div>
          <h2>Quick Launch</h2>
          <p className="hero-sub">Published services with ready endpoints — one click to open</p>
        </div>
        <Link to="/apps" className="section-link">
          All published
        </Link>
      </div>
      <div className="quick-launch-grid">
        {apps.map((app) => (
          <button
            key={app.id}
            type="button"
            className="quick-launch-tile zeus-glass"
            title={app.displayName}
            onClick={() => void openApp(app)}
          >
            <AppIcon icon={app.icon} name={app.displayName} size="md" />
            <span>{app.displayName}</span>
            <ExternalLink size={12} aria-hidden />
          </button>
        ))}
      </div>
    </section>
  )
}
