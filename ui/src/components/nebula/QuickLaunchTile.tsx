// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { ExternalLink } from 'lucide-react'
import type { CSSProperties, KeyboardEvent } from 'react'
import AppIcon from '../AppIcon'
import GlassPanel from './GlassPanel'
import StatusBadge from './StatusBadge'
import Button from './Button'
import ActionMenu from './ActionMenu'
import { appDetailPath, copyAppUrl, openApp } from '../../services/irisApi'
import { useInspector } from '../../utils/inspectorContext'
import { accentColorFor } from '../../utils/iconColor'
import type { IrisApp } from '../../types'

interface QuickLaunchTileProps {
  app: IrisApp
}

export default function QuickLaunchTile({ app }: QuickLaunchTileProps) {
  const { openDiagnose } = useInspector()
  const glowClass =
    app.status === 'healthy' ? 'glow-healthy' : app.status === 'degraded' ? 'glow-degraded' : 'glow-broken'

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') void openApp(app)
  }

  const accentStyle = { '--card-accent': accentColorFor(app.displayName, app.icon).gradient } as CSSProperties

  return (
    <GlassPanel
      className={`quick-launch-tile-nebula card-accent ${glowClass}`}
      style={accentStyle}
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
          Open <ExternalLink size={14} strokeWidth={1.5} />
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
