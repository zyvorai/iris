// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import type { ReactNode, CSSProperties, HTMLAttributes } from 'react'

type GlassTone = 'default' | 'healthy' | 'warning' | 'critical'

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  tone?: GlassTone
  className?: string
  style?: CSSProperties
  children: ReactNode
  id?: string
  'data-testid'?: string
}

export default function GlassPanel({
  tone = 'default',
  className = '',
  style,
  children,
  id,
  'data-testid': testId,
  ...rest
}: GlassPanelProps) {
  const toneClass =
    tone === 'healthy'
      ? 'glass-panel-tone-healthy'
      : tone === 'warning'
        ? 'glass-panel-tone-warning'
        : tone === 'critical'
          ? 'glass-panel-tone-critical'
          : ''

  return (
    <div
      id={id}
      data-testid={testId}
      className={`glass-panel ${toneClass} ${className}`.trim()}
      style={style}
      {...rest}
    >
      {children}
    </div>
  )
}
