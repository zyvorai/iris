// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'

export type GlyphTileTone = 'brand' | 'ai' | 'ok' | 'warn' | 'critical' | 'info' | 'cyan' | 'pink'
export type GlyphTileSize = 'sm' | 'md' | 'lg'

interface GlyphTileProps {
  icon: ReactNode
  tone?: GlyphTileTone
  size?: GlyphTileSize
  className?: string
}

const ICON_PX: Record<GlyphTileSize, number> = {
  sm: 16,
  md: 18,
  lg: 22,
}

type LucideLikeProps = {
  size?: number
  width?: number
  height?: number
  strokeWidth?: number
  'aria-hidden'?: boolean
}

/** Soft tinted icon well — Apple Settings style, not a glossy badge. */
export default function GlyphTile({ icon, tone = 'brand', size = 'md', className = '' }: GlyphTileProps) {
  const px = ICON_PX[size]
  const normalized = Children.map(icon, (child) => {
    if (!isValidElement(child)) return child
    return cloneElement(child as ReactElement<LucideLikeProps>, {
      size: px,
      width: px,
      height: px,
      strokeWidth: 1.5,
      'aria-hidden': true,
    })
  })

  return (
    <span
      className={`glyph-tile glyph-tile-quiet glyph-tile-${size} glyph-tile-${tone} ${className}`.trim()}
      aria-hidden
    >
      {normalized}
    </span>
  )
}
