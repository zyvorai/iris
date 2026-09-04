// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import GlassPanel from './GlassPanel'
import GlyphTile from './GlyphTile'
import Button from './Button'

interface ZyraAiPanelProps {
  title?: string
  summary?: string
  explanation: string
  source?: string
  remediation?: string[]
  loading?: boolean
  compact?: boolean
  action?: ReactNode
  onRefresh?: () => void
  refreshing?: boolean
}

export default function ZyraAiPanel({
  title = 'Zyra AI',
  summary,
  explanation,
  source,
  remediation,
  loading,
  compact,
  action,
  onRefresh,
  refreshing,
}: ZyraAiPanelProps) {
  if (loading) {
    return (
      <GlassPanel className={`glass-panel-section zyra-ai-panel${compact ? ' zyra-ai-panel-compact' : ''}`} data-testid="zyra-ai-panel">
        <div className="section-head-nebula">
          <GlyphTile tone="brand" icon={<Sparkles size={14} />} size="sm" />
          <div>
            <p className="section-label">{title}</p>
          </div>
        </div>
        <div className="page-loading-skeleton page-loading-skeleton-compact">
          <div className="skeleton-card" style={{ height: compact ? 48 : 72 }} />
        </div>
      </GlassPanel>
    )
  }

  return (
    <GlassPanel className={`glass-panel-section zyra-ai-panel${compact ? ' zyra-ai-panel-compact' : ''}`} data-testid="zyra-ai-panel">
      <div className="section-head-nebula">
        <GlyphTile tone="brand" icon={<Sparkles size={14} />} size="sm" />
        <div>
          <p className="section-label">{title}</p>
          {summary ? <h3 className="section-title zyra-ai-summary">{summary}</h3> : null}
        </div>
        {source ? (
          <span className={`nebula-status-badge ${source === 'llm' ? 'status-healthy' : 'status-unknown'}`}>
            {source === 'llm' ? 'AI' : 'Rules'}
          </span>
        ) : null}
        {onRefresh ? (
          <Button
            variant="ghost"
            className="nebula-btn-compact zyra-ai-refresh"
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh insight"
            aria-label="Refresh insight"
          >
            <RefreshCw size={14} className={refreshing ? 'hermes-nb-spin' : ''} />
          </Button>
        ) : null}
      </div>
      <p className="body-text zyra-ai-explanation">{explanation}</p>
      {remediation?.length ? (
        <ul className="zyra-ai-remediation">
          {remediation.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      ) : null}
      {action ? <div className="zyra-ai-actions">{action}</div> : null}
    </GlassPanel>
  )
}

export function ZyraAiBadge({ source, warn }: { source?: string; warn?: boolean }) {
  if (!source) return null
  const tone = warn ? 'status-degraded' : source === 'llm' ? 'status-healthy' : 'status-unknown'
  const label = warn ? 'AI offline' : source === 'llm' ? 'Zyra AI' : 'Heuristic'
  return (
    <span className={`nebula-status-badge zyra-ai-badge ${tone}`}>
      <Sparkles size={10} /> {label}
    </span>
  )
}
