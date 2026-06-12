// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useQuery } from '@tanstack/react-query'
import { Copy, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import RouteLens from './RouteLens'
import { copyAppUrl, hermesApi } from '../services/hermesApi'
import type { HermesApp, SuggestedAction } from '../types'

interface DiagnosePanelProps {
  app: HermesApp
  open: boolean
  onClose: () => void
}

function ActionLink({ action }: { action: SuggestedAction }) {
  if (action.href.startsWith('#copy:')) {
    const cmd = action.href.slice('#copy:'.length)
    return (
      <button type="button" className="btn" onClick={() => void navigator.clipboard.writeText(cmd)}>
        <Copy size={12} /> {action.label}
      </button>
    )
  }
  if (action.href.startsWith('/') && !action.href.startsWith('//')) {
    return <Link to={action.href}>{action.label}</Link>
  }
  return (
    <a href={action.href} target="_blank" rel="noreferrer">
      {action.label}
    </a>
  )
}

export default function DiagnosePanel({ app, open, onClose }: DiagnosePanelProps) {
  const diagnosis = useQuery({
    queryKey: ['diagnosis', app.id],
    queryFn: () => hermesApi.getDiagnosis(app.id),
    enabled: open,
  })

  if (!open) return null

  return (
    <div className="diagnose-backdrop" onClick={onClose} role="presentation">
      <aside
        className="diagnose-panel glass-section"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Diagnose ${app.displayName}`}
        data-testid="diagnose-panel"
      >
        <header className="diagnose-header">
          <div>
            <h2>{app.displayName}</h2>
            <p className="app-meta">Route diagnosis</p>
          </div>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        {diagnosis.isLoading ? <div className="empty">Loading diagnosis…</div> : null}
        {diagnosis.error ? <div className="empty">Could not load diagnosis.</div> : null}

        {diagnosis.data ? (
          <div className="diagnose-body">
            {(diagnosis.data.problem || diagnosis.data.cause) && (
              <div className="diagnose-alert">
                {diagnosis.data.problem ? <strong>{diagnosis.data.problem}</strong> : null}
                {diagnosis.data.cause ? <p>{diagnosis.data.cause}</p> : null}
              </div>
            )}
            <RouteLens diagnosis={diagnosis.data} />
            {diagnosis.data.suggestedActions?.length ? (
              <div className="diagnose-actions">
                <h3>Suggested actions</h3>
                <ul className="diagnose-action-list">
                  {diagnosis.data.suggestedActions.map((action) => (
                    <li key={action.href}>
                      <ActionLink action={action} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="app-actions diagnose-copy-row">
              <button type="button" className="btn" onClick={() => void copyAppUrl(app)}>
                <Copy size={12} /> Copy public URL
              </button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
