// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { AlertTriangle } from 'lucide-react'
import GlassPanel from './GlassPanel'
import Button from './Button'

interface PageLoadErrorProps {
  title?: string
  description?: string
  onRetry: () => void
}

export default function PageLoadError({
  title = 'Data unavailable',
  description = 'Could not load this page. Check your connection and try again.',
  onRetry,
}: PageLoadErrorProps) {
  return (
    <GlassPanel className="glass-panel-section page-load-error" data-testid="page-load-error">
      <div className="page-load-error-inner">
        <span className="page-load-error-icon" aria-hidden>
          <AlertTriangle size={22} />
        </span>
        <h2 className="section-title">{title}</h2>
        <p className="body-text">{description}</p>
        <Button variant="primary" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </GlassPanel>
  )
}
