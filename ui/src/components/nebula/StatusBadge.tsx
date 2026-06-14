// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { statusLabel, statusTone } from '../../services/hermesApi'

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
