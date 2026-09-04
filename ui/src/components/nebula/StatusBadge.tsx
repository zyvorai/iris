// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { statusLabel, statusTone } from '../../services/irisApi'

interface StatusBadgeProps {
  status: string
  className?: string
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const tone = statusTone(status)
  return (
    <span className={`nebula-status-badge status-${tone} ${className}`.trim()}>
      {statusLabel(status)}
    </span>
  )
}
