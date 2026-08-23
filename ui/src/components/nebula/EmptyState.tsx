// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import type { ReactNode } from 'react'
import GlyphTile, { type GlyphTileTone } from './GlyphTile'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  tone?: GlyphTileTone
  'data-testid'?: string
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'brand',
  'data-testid': testId,
}: EmptyStateProps) {
  return (
    <div className="glass-empty-state" data-testid={testId ?? 'empty-state'}>
      <GlyphTile tone={tone} icon={icon} size="lg" className="glass-empty-state-icon" />
      <h3 className="glass-empty-state-title">{title}</h3>
      {description ? <p className="glass-empty-state-desc">{description}</p> : null}
      {action ? <div className="glass-empty-state-action">{action}</div> : null}
    </div>
  )
}
