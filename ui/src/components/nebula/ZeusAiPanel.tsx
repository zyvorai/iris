// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import type { ReactNode } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import GlassPanel from './GlassPanel'
import Button from './Button'

interface ZeusAiPanelProps {
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

export default function ZeusAiPanel({
  title = 'Zeus AI',
  summary,
  explanation,
  source,
  remediation,
  loading,
  compact,
  action,
  onRefresh,
  refreshing,
}: ZeusAiPanelProps) {
  if (loading) {
    return (
      <GlassPanel className={`glass-panel-section zeus-ai-panel${compact ? ' zeus-ai-panel-compact' : ''}`} data-testid="zeus-ai-panel">
        <div className="page-loading-skeleton page-loading-skeleton-compact">
          <div className="skeleton-card" style={{ height: compact ? 48 : 72 }} />
        </div>
      </GlassPanel>
    )
  }

  return (
    <GlassPanel className={`glass-panel-section zeus-ai-panel${compact ? ' zeus-ai-panel-compact' : ''}`} data-testid="zeus-ai-panel">
      <div className="section-head-nebula">
        <div>
          <p className="section-label">
            <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {title}
          </p>
          {summary ? <h3 className="section-title zeus-ai-summary">{summary}</h3> : null}
        </div>
        {source ? (
          <span className={`nebula-status-badge ${source === 'llm' ? 'status-healthy' : 'status-unknown'}`}>
            {source === 'llm' ? 'AI' : 'Rules'}
          </span>
        ) : null}
        {onRefresh ? (
          <Button
            variant="ghost"
            className="nebula-btn-compact zeus-ai-refresh"
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh insight"
            aria-label="Refresh insight"
          >
            <RefreshCw size={14} className={refreshing ? 'hermes-nb-spin' : ''} />
          </Button>
        ) : null}
      </div>
      <p className="body-text zeus-ai-explanation">{explanation}</p>
      {remediation?.length ? (
        <ul className="zeus-ai-remediation">
          {remediation.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      ) : null}
      {action ? <div className="zeus-ai-actions">{action}</div> : null}
    </GlassPanel>
  )
}

export function ZeusAiBadge({ source, warn }: { source?: string; warn?: boolean }) {
  if (!source) return null
  const tone = warn ? 'status-degraded' : source === 'llm' ? 'status-healthy' : 'status-unknown'
  const label = warn ? 'AI offline' : source === 'llm' ? 'Zeus AI' : 'Heuristic'
  return (
    <span className={`nebula-status-badge zeus-ai-badge ${tone}`}>
      <Sparkles size={10} /> {label}
    </span>
  )
}
