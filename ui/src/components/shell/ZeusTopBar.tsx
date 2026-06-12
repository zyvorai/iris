// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import WorkspaceSwitcher from '../WorkspaceSwitcher'
import QuickActionsMenu from './QuickActionsMenu'
import HelpPopover from './HelpPopover'
import { hermesApi } from '../../services/hermesApi'
import { useWorkspace } from '../../utils/workspaceContext'

interface ZeusTopBarProps {
  pageTitle: string
  onPaletteOpen: () => void
  onOpenShortcuts: () => void
}

export default function ZeusTopBar({ pageTitle, onPaletteOpen, onOpenShortcuts }: ZeusTopBarProps) {
  const { workspaceId } = useWorkspace()
  const cluster = useQuery({ queryKey: ['cluster-summary'], queryFn: hermesApi.clusterSummary, refetchInterval: 15000 })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog, refetchInterval: 15000 })
  const auth = useQuery({ queryKey: ['auth-me'], queryFn: hermesApi.authMe, retry: false })

  const total = cluster.data?.total ?? catalog.data?.length ?? 0
  const published = cluster.data?.published ?? 0
  const healthy = cluster.data?.healthy ?? 0
  const degraded = cluster.data?.degraded ?? 0
  const broken = cluster.data?.broken ?? 0
  const healthPct = total > 0 ? Math.round((healthy / total) * 100) : 100
  const issueCount = broken + degraded
  const statusTone = broken > 0 ? 'bad' : degraded > 0 || healthPct < 80 ? 'warn' : 'ok'
  const lastSync = useMemo(() => {
    const times = (catalog.data ?? [])
      .map((a) => Date.parse(a.updatedAt))
      .filter((t) => Number.isFinite(t))
    if (!times.length) return null
    return new Date(Math.max(...times))
  }, [catalog.data])
  const workspaceLabel = workspaceId || 'All clusters'

  return (
    <header className="zeus-topbar-shell" data-testid="zeus-topbar">
      <div className="zeus-topbar">
        <div className="zeus-topbar-left">
          <div className="hermes-brand-mark zeus-pulse-dot" aria-hidden />
          <div>
            <h1 className="zeus-topbar-title">Hermes</h1>
            <p className="zeus-topbar-sub">Application Operating Layer</p>
          </div>
        </div>
        <div className="zeus-topbar-center">
          <WorkspaceSwitcher />
          <span className="zeus-health-chip" data-tone={healthPct >= 95 ? 'ok' : healthPct >= 80 ? 'warn' : 'bad'}>
            {healthPct}% healthy
          </span>
        </div>
        <div className="zeus-topbar-right">
          <span className="zeus-status-chip">{total} discovered</span>
          <span className="zeus-status-chip">{published} published</span>
          {issueCount > 0 ? (
            <a href="#attention-queue" className="zeus-status-chip warn">
              {issueCount} issues
            </a>
          ) : null}
          <button type="button" className="hermes-search-btn zeus-spotlight-btn" onClick={onPaletteOpen}>
            <Search size={16} />
            <span>Spotlight</span>
            <kbd>⌘K</kbd>
          </button>
          <QuickActionsMenu />
          <HelpPopover onOpenShortcuts={onOpenShortcuts} />
          {auth.data?.mode === 'oidc' ? (
            auth.data.authenticated ? (
              <div className="auth-chip" title={auth.data.userId}>
                {auth.data.userId}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    void fetch('/auth/logout', { method: 'POST' }).then(() => window.location.reload())
                  }}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <a href="/auth/login" className="btn btn-primary auth-login">
                Sign in
              </a>
            )
          ) : null}
        </div>
      </div>
      <div className="zeus-status-strip">
        <span className="zeus-live-dot" data-tone={statusTone} aria-hidden />
        Discovery
        {lastSync ? ` · controller sync ${lastSync.toLocaleTimeString()}` : ' · awaiting sync'}
        {' · '}
        {cluster.data?.namespaces ?? '—'} namespaces
        {' · '}
        <Link to="/cluster">Publish apps on Cluster</Link>
      </div>
      <nav className="zeus-breadcrumb" aria-label="Breadcrumb">
        Hermes <ChevronRight size={12} /> {workspaceLabel} <ChevronRight size={12} /> {pageTitle}
      </nav>
    </header>
  )
}
