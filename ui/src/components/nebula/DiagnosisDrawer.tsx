// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Copy, Sparkles, Stethoscope, X } from 'lucide-react'
import RouteLens from '../RouteLens'
import StatusBadge from './StatusBadge'
import Button from './Button'
import { hermesApi, statusLabel } from '../../services/hermesApi'
import { useZyraAiInsight } from '../../hooks/useZyraAiInsight'
import { useInspector } from '../../utils/inspectorContext'
import type { SuggestedAction } from '../../types'

interface DiagnosisDrawerProps {
  appId: string | null
  onClose: () => void
}

const KNOWN_ISSUES_KEY = 'hermes-known-issues'

function getKnownIssues(): Set<string> {
  try {
    const raw = localStorage.getItem(KNOWN_ISSUES_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function markKnownIssue(appId: string) {
  const set = getKnownIssues()
  set.add(appId)
  localStorage.setItem(KNOWN_ISSUES_KEY, JSON.stringify([...set]))
}

function extractCommands(actions: SuggestedAction[]): string[] {
  return actions
    .filter((a) => a.href.startsWith('#copy:'))
    .map((a) => a.href.slice('#copy:'.length))
}

function DiagnosisSkeleton() {
  return (
    <div className="diagnosis-drawer-skeleton page-loading-skeleton-compact" data-testid="diagnosis-loading">
      <div className="skeleton-toolbar" />
      <div className="skeleton-card" style={{ height: 72 }} />
      <div className="skeleton-card" style={{ height: 96 }} />
    </div>
  )
}

export default function DiagnosisDrawer({ appId, onClose }: DiagnosisDrawerProps) {
  const { openInspector } = useInspector()
  const app = useQuery({
    queryKey: ['app', appId],
    queryFn: () => hermesApi.getApp(appId!),
    enabled: !!appId,
  })
  const diagnosis = useQuery({
    queryKey: ['diagnosis', appId],
    queryFn: () => hermesApi.getDiagnosis(appId!),
    enabled: !!appId,
  })
  const audit = useQuery({
    queryKey: ['audit-recent', appId],
    queryFn: () => hermesApi.listAudit(20),
    enabled: !!appId,
  })
  const insight = useZyraAiInsight(appId, !!appId)

  const commands = useMemo(
    () => extractCommands(diagnosis.data?.suggestedActions ?? []),
    [diagnosis.data?.suggestedActions],
  )

  const timeline = useMemo(() => {
    if (!app.data) return []
    const events = (audit.data ?? []).filter((e) => e.appId === appId).slice(0, 5)
    const items: { label: string; time: string }[] = [
      { label: 'Last probe', time: app.data.updatedAt ? new Date(app.data.updatedAt).toLocaleString() : '—' },
    ]
    for (const evt of events) {
      items.push({ label: evt.action, time: new Date(evt.createdAt).toLocaleString() })
    }
    return items
  }, [app.data, audit.data, appId])

  if (!appId) return null

  const loading = (app.isLoading && !app.data) || (diagnosis.isLoading && !diagnosis.data)
  const error = app.isError || diagnosis.isError

  const copyCommands = () => {
    if (commands.length) void navigator.clipboard.writeText(commands.join('\n'))
  }

  const retry = () => {
    void app.refetch()
    void diagnosis.refetch()
  }

  return (
    <div className="diagnosis-drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="diagnosis-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Service diagnosis"
        data-testid="diagnose-panel"
      >
        <header className="diagnosis-drawer-header">
          <div>
            <h2>Diagnosing {app.data?.displayName ?? 'service'}</h2>
            {app.data ? <StatusBadge status={app.data.status} /> : null}
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            <X size={18} />
          </Button>
        </header>

        <div className="diagnosis-drawer-body">
          {loading ? <DiagnosisSkeleton /> : null}

          {error && !loading ? (
            <div className="diagnosis-drawer-error" data-testid="diagnosis-error">
              <AlertTriangle size={22} aria-hidden />
              <p className="body-text">Could not load diagnosis for this service.</p>
              <Button variant="primary" onClick={retry}>
                Retry
              </Button>
            </div>
          ) : null}

          {!loading && !error && app.data ? (
            <div className="diagnosis-drawer-facts">
              <div className="diagnosis-drawer-fact">
                <span>Status</span>
                <strong>{statusLabel(app.data.status)}</strong>
              </div>
              <div className="diagnosis-drawer-fact">
                <span>Namespace</span>
                <strong>{app.data.namespace}</strong>
              </div>
              <div className="diagnosis-drawer-fact">
                <span>Endpoint</span>
                <code>{app.data.publicUrl || app.data.routePath}</code>
              </div>
            </div>
          ) : null}

          {!loading && !error && (diagnosis.data?.cause || diagnosis.data?.problem || insight.explanation) ? (
            <div className="diagnosis-drawer-section diagnosis-drawer-ai">
              <h3>
                <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Zyra AI insight
              </h3>
              {insight.summary ? <p className="zyra-ai-summary body-text">{insight.summary}</p> : null}
              <p className="body-text">{insight.explanation}</p>
              {insight.remediation.length ? (
                <ul className="zyra-ai-remediation">
                  {insight.remediation.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {!loading && !error && diagnosis.data?.suggestedActions?.length ? (
            <div className="diagnosis-drawer-section">
              <h3>Suggested fixes</h3>
              <ol>
                {diagnosis.data.suggestedActions.map((action, i) => (
                  <li key={action.href}>{action.label || `Step ${i + 1}`}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {!loading && !error && commands.length ? (
            <div className="diagnosis-drawer-section">
              <h3>Commands</h3>
              <pre className="diagnosis-drawer-commands">{commands.join('\n')}</pre>
            </div>
          ) : null}

          {!loading && !error && diagnosis.data ? <RouteLens diagnosis={diagnosis.data} /> : null}

          {!loading && !error && timeline.length ? (
            <div className="diagnosis-drawer-section">
              <h3>Service timeline</h3>
              <ul className="diagnosis-drawer-timeline">
                {timeline.map((item) => (
                  <li key={`${item.label}-${item.time}`}>
                    <span>{item.label}</span>
                    <time>{item.time}</time>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!loading && !error ? (
            <div className="diagnosis-drawer-actions">
              {commands.length ? (
                <Button variant="secondary" onClick={copyCommands}>
                  <Copy size={14} /> Copy commands
                </Button>
              ) : null}
              <Button variant="primary" onClick={() => { openInspector(appId, 'overview'); onClose() }}>
                <Stethoscope size={14} /> Run check
              </Button>
              <Button variant="ai" onClick={() => { openInspector(appId, 'ai'); onClose() }}>
                <Sparkles size={14} /> Ask Zyra AI
              </Button>
              <Button variant="ghost" onClick={() => markKnownIssue(appId)}>
                Mark as known issue
              </Button>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
