// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { ExternalLink } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import AppIcon from '../AppIcon'
import GlassPanel from './GlassPanel'
import StatusBadge from './StatusBadge'
import Button from './Button'
import ActionMenu from './ActionMenu'
import { appDetailPath, copyAppUrl, openApp } from '../../services/hermesApi'
import { useInspector } from '../../utils/inspectorContext'
import type { HermesApp } from '../../types'

interface QuickLaunchTileProps {
  app: HermesApp
}

export default function QuickLaunchTile({ app }: QuickLaunchTileProps) {
  const { openDiagnose } = useInspector()
  const glowClass =
    app.status === 'healthy' ? 'glow-healthy' : app.status === 'degraded' ? 'glow-degraded' : 'glow-broken'

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') void openApp(app)
  }

  return (
    <GlassPanel
      className={`quick-launch-tile-nebula ${glowClass}`}
      tabIndex={0}
      role="group"
      aria-label={`${app.displayName} quick launch`}
      onKeyDown={onKeyDown}
    >
      <div className="quick-launch-tile-icon">
        <AppIcon icon={app.icon} name={app.displayName} size="md" />
      </div>
      <span className="quick-launch-tile-name">{app.displayName}</span>
      <span className="quick-launch-tile-ns">{app.namespace}</span>
      <StatusBadge status={app.status} />
      <div className="quick-launch-tile-actions">
        <Button variant="primary" className="nebula-btn-compact" onClick={() => void openApp(app)}>
          Open <ExternalLink size={11} />
        </Button>
        <ActionMenu
          items={[
            { label: 'Copy URL', onClick: () => void copyAppUrl(app) },
            { label: 'View route', href: appDetailPath(app) },
            { label: 'Diagnose', onClick: () => openDiagnose(app.id) },
          ]}
          label={`More actions for ${app.displayName}`}
        />
      </div>
    </GlassPanel>
  )
}
