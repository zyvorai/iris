// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import RouteLens from './RouteLens'
import { hermesApi } from '../services/hermesApi'
import type { HermesApp } from '../types'

interface DiagnosePanelProps {
  app: HermesApp
  open: boolean
  onClose: () => void
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
                <ul>
                  {diagnosis.data.suggestedActions.map((action) => (
                    <li key={action.href}>{action.label}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  )
}
