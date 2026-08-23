// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { statusLabel } from '../../services/hermesApi'
import type { HermesApp } from '../../types'

interface PipsProps {
  apps: HermesApp[]
}

/** Compact fleet-glance strip — one square per service, colored by status. */
export default function Pips({ apps }: PipsProps) {
  return (
    <div className="pips" aria-hidden>
      {apps.map((app) => (
        <span key={app.id} data-s={app.status} title={`${app.displayName} — ${statusLabel(app.status)}`} />
      ))}
    </div>
  )
}
