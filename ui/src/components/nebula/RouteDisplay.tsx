// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Copy, ExternalLink } from 'lucide-react'
import Button from './Button'

interface RouteDisplayProps {
  label: string
  path: string
  href?: string
  hint?: string
}

export default function RouteDisplay({ label, path, href, hint }: RouteDisplayProps) {
  const copy = () => void navigator.clipboard.writeText(href ?? path)

  return (
    <div className="route-display-row">
      <span className="route-display-label">{label}</span>
      <div className="route-display-value">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="route-display-link">
            <span className="route-display-path">{path}</span>
            <ExternalLink size={12} aria-hidden />
          </a>
        ) : (
          <code className="route-display-path">{path}</code>
        )}
        <Button variant="ghost" className="nebula-btn-compact route-display-copy" onClick={copy} title={`Copy ${label.toLowerCase()}`}>
          <Copy size={12} />
        </Button>
      </div>
      {hint ? <span className="route-display-hint">{hint}</span> : null}
    </div>
  )
}
