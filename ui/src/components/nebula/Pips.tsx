// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { statusLabel } from '../../services/irisApi'
import type { IrisApp } from '../../types'

interface PipsProps {
  apps: IrisApp[]
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
