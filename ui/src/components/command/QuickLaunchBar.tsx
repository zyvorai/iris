// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Link } from 'react-router-dom'
import { Rocket } from 'lucide-react'
import GlassPanel from '../nebula/GlassPanel'
import QuickLaunchTile from '../nebula/QuickLaunchTile'
import EmptyState from '../nebula/EmptyState'
import Button from '../nebula/Button'
import type { HermesApp } from '../../types'

interface QuickLaunchBarProps {
  apps: HermesApp[]
}

export default function QuickLaunchBar({ apps }: QuickLaunchBarProps) {
  return (
    <GlassPanel className="glass-panel-section quick-launch-bar" data-testid="quick-launch-bar">
      <div className="section-head-nebula">
        <div>
          <p className="section-label">Quick Launch</p>
          <p className="body-text">Published services with ready endpoints — one click to open</p>
        </div>
        <Link to="/apps" className="section-link-nebula">
          All published
        </Link>
      </div>
      {apps.length ? (
        <div className="quick-launch-grid">
          {apps.map((app) => (
            <QuickLaunchTile key={app.id} app={app} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Rocket size={22} />}
          title="No published services ready"
          description="Publish healthy services from Cluster to pin them here for one-click launch."
          action={
            <Button variant="primary" to="/cluster">
              Publish on Cluster
            </Button>
          }
        />
      )}
    </GlassPanel>
  )
}
