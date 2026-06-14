// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import type { HermesApp } from '../../types'

interface ZeusAiFocusChipsProps {
  appIds: string[]
  catalog: HermesApp[]
  onSelect: (id: string) => void
  label?: string
  className?: string
}

export default function ZeusAiFocusChips({
  appIds,
  catalog,
  onSelect,
  label = 'Diagnose',
  className = '',
}: ZeusAiFocusChipsProps) {
  const apps = appIds
    .map((id) => catalog.find((app) => app.id === id))
    .filter((app): app is HermesApp => !!app)

  if (!apps.length) return null

  return (
    <div className={`graph-ai-focus-chips${className ? ` ${className}` : ''}`} data-testid="zeus-ai-focus-chips">
      {apps.map((app) => (
        <button key={app.id} type="button" className="filter-chip" onClick={() => onSelect(app.id)}>
          {label} {app.displayName}
        </button>
      ))}
    </div>
  )
}
