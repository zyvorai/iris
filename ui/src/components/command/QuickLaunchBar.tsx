// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { Link } from 'react-router-dom'
import { openApp } from '../../services/irisApi'
import type { IrisApp } from '../../types'

interface QuickLaunchBarProps {
  apps: IrisApp[]
}

export default function QuickLaunchBar({ apps }: QuickLaunchBarProps) {
  if (!apps.length) return null

  return (
    <section className="hs-launch" data-testid="quick-launch-bar">
      <div className="hs-launch-head">
        <h2>Quick Launch</h2>
        <Link to="/apps" className="hs-btn-secondary">
          View all
        </Link>
      </div>
      <ul className="hs-launch-list">
        {apps.map((app) => (
          <li key={app.id} className="hs-launch-row">
            <div>
              <p className="hs-launch-name">{app.displayName}</p>
              <p className="hs-launch-meta">{app.namespace}</p>
            </div>
            <span className="hs-launch-status" data-ok={app.status === 'healthy'}>
              {app.status === 'healthy' ? 'Healthy' : app.status}
            </span>
            <button type="button" className="hs-launch-open" onClick={() => void openApp(app)}>
              Open
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
