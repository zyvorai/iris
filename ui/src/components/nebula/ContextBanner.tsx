// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Filter, X } from 'lucide-react'
import Button from './Button'

interface ContextBannerProps {
  label: string
  detail?: string
  onClear: () => void
}

export default function ContextBanner({ label, detail, onClear }: ContextBannerProps) {
  return (
    <div className="context-banner" data-testid="context-banner" role="status">
      <Filter size={14} aria-hidden />
      <span className="context-banner-text">
        {label}
        {detail ? <span className="context-banner-detail"> · {detail}</span> : null}
      </span>
      <Button variant="ghost" className="nebula-btn-compact context-banner-clear" onClick={onClear}>
        <X size={12} /> Clear filter
      </Button>
    </div>
  )
}
