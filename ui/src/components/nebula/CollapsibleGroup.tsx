// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import GlassPanel from './GlassPanel'
import { BoardHead } from './Board'
import type { IrisApp } from '../../types'

function statusRank(status: string): number {
  if (status === 'broken') return 0
  if (status === 'degraded') return 1
  return 2
}

function sortApps(apps: IrisApp[]): IrisApp[] {
  return [...apps].sort(
    (a, b) => statusRank(a.status) - statusRank(b.status) || a.displayName.localeCompare(b.displayName),
  )
}

interface CollapsibleGroupProps {
  label: string
  apps: IrisApp[]
  renderApp: (app: IrisApp) => ReactNode
  headerExtra?: ReactNode
  /** Renders the group as its own bordered GlassPanel instead of a plain flat section. */
  wrap?: boolean
  className?: string
}

export default function CollapsibleGroup({
  label,
  apps,
  renderApp,
  headerExtra,
  wrap = false,
  className = '',
}: CollapsibleGroupProps) {
  const hasUnhealthy = apps.some((a) => a.status === 'broken' || a.status === 'degraded')
  const [open, setOpen] = useState(hasUnhealthy)

  if (!apps.length) return null

  const issueCount = apps.filter((a) => a.status !== 'healthy').length
  const sorted = sortApps(apps)

  const content = (
    <>
      <button
        type="button"
        className={`mission-control-group-head${wrap ? ' namespace-group-head' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <h3>{label}</h3>
        <span className="mission-control-group-count">
          {apps.length} service{apps.length === 1 ? '' : 's'}
          {issueCount > 0 ? ` · ${issueCount} need attention` : ''}
        </span>
        {headerExtra}
        <ChevronDown size={16} className={open ? 'rotated' : ''} aria-hidden />
      </button>
      {open ? (
        <div className="board">
          <BoardHead />
          {sorted.map(renderApp)}
        </div>
      ) : null}
    </>
  )

  if (wrap) {
    return <GlassPanel className={`glass-panel-section namespace-section ${className}`.trim()}>{content}</GlassPanel>
  }
  return <div className={`mission-control-group-flat ${className}`.trim()}>{content}</div>
}
