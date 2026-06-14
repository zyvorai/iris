// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useState } from 'react'
import { formatStatusMessage } from '../../utils/statusMessage'

interface ServiceStatusMessageProps {
  message?: string
  status: string
  compact?: boolean
  fallback?: string
}

export default function ServiceStatusMessage({
  message,
  status,
  compact = false,
  fallback,
}: ServiceStatusMessageProps) {
  const [expanded, setExpanded] = useState(false)
  const formatted = formatStatusMessage(message)
  const critical = status === 'broken'

  if (!formatted && !fallback) return null

  const summary = formatted?.summary ?? fallback ?? ''
  const hasDetail = Boolean(formatted?.detail && formatted.detail !== summary)
  const showDetailToggle = hasDetail && !compact

  return (
    <div className={`service-status-message${critical ? ' service-status-message-critical' : ''}`}>
      <p className="service-status-summary">
        {summary}
        {formatted?.endpoint ? (
          <span className="service-status-endpoint" title="In-cluster probe target">
            {formatted.endpoint}
          </span>
        ) : null}
      </p>
      {showDetailToggle && expanded ? (
        <pre className="service-status-detail">{formatted?.detail}</pre>
      ) : null}
      {showDetailToggle ? (
        <button type="button" className="service-error-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Hide technical details' : 'Technical details'}
        </button>
      ) : null}
    </div>
  )
}
