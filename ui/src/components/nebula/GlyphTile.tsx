// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import type { ReactNode } from 'react'

export type GlyphTileTone = 'brand' | 'ai' | 'ok' | 'warn' | 'critical' | 'info' | 'cyan' | 'pink'
export type GlyphTileSize = 'sm' | 'md' | 'lg'

interface GlyphTileProps {
  icon: ReactNode
  tone?: GlyphTileTone
  size?: GlyphTileSize
  className?: string
}

/** Flat matte icon badge — board fill, hairline edge, tone-colored icon. */
export default function GlyphTile({ icon, tone = 'brand', size = 'md', className = '' }: GlyphTileProps) {
  return (
    <span
      className={`glyph-tile glyph-tile-${tone} glyph-tile-${size} ${className}`.trim()}
      aria-hidden
    >
      {icon}
    </span>
  )
}
