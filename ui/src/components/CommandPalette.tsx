// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Compass, GitBranch, Grid3X3, HeartPulse, History, Home, Layers, Server, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AppIcon from './AppIcon'
import { appDetailPath, hermesApi, openApp, statusLabel, statusTone } from '../services/hermesApi'
import { loadSpotlightRecents, pushSpotlightRecent } from '../utils/recentStore'
import { useWorkspace } from '../utils/workspaceContext'
import type { HermesApp } from '../types'

interface CommandPaletteProps {
  onClose: () => void
}

const navItems = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Apps catalog', path: '/apps', icon: Grid3X3 },
  { label: 'Spaces', path: '/spaces', icon: Layers },
  { label: 'Cluster services', path: '/cluster', icon: Server },
  { label: 'Graph', path: '/graph', icon: GitBranch },
  { label: 'Teams', path: '/teams', icon: Users },
  { label: 'Discovery', path: '/discovery', icon: Compass },
  { label: 'Health', path: '/health', icon: HeartPulse },
  { label: 'Activity', path: '/activity', icon: History },
]

function depMatch(query: string): string | null {
  const m = query.match(/^(?:depends:?|depends on)\s+(.+)$/i)
  return m?.[1]?.trim() || null
}

function ownerMatch(query: string): string | null {
  const m = query.match(/^owner:(.+)$/i)
  return m?.[1]?.trim() || null
}

function envMatch(query: string): string | null {
  const q = query.trim().toLowerCase()
  if (['production', 'prod'].includes(q)) return 'production'
  if (['staging', 'stage'].includes(q)) return 'staging'
  if (['development', 'dev'].includes(q)) return 'development'
  if (['testing', 'test', 'qa'].includes(q)) return 'testing'
  const m = query.match(/^env:(.+)$/i)
  return m?.[1]?.trim().toLowerCase() || null
}

function appDependsOn(app: HermesApp, dep: string): boolean {
  const needle = dep.toLowerCase()
  return (app.meta?.dependsOn ?? []).some(
    (d) =>
      d.toLowerCase() === needle ||
      app.slug.toLowerCase() === needle ||
      (app.canonicalSlug ?? '').toLowerCase() === needle,
  )
}

export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { setWorkspaceId, matchesWorkspace } = useWorkspace()

  const health = useQuery({ queryKey: ['health'], queryFn: hermesApi.healthSummary })
  const recommended = useQuery({ queryKey: ['recommended'], queryFn: hermesApi.listRecommended })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog })

  const query = q.trim().toLowerCase()
  const depQuery = depMatch(q.trim())
  const ownerQuery = ownerMatch(q.trim())
  const envQuery = envMatch(q.trim())
  const isTeamQuery = ['team', 'team picks', 'picks', 'recommended'].includes(query)
  const isIntentQuery =
    q.trim().length > 2 &&
    !depQuery &&
    !ownerQuery &&
    !envQuery &&
    !isTeamQuery &&
    query !== 'broken' &&
    (query.includes('depend') ||
      query.includes('unhealthy') ||
      query.startsWith('which ') ||
      query.startsWith('owned ') ||
      query.includes('production') ||
      query.includes('staging'))

  const { data: hits = [] } = useQuery({
    queryKey: ['search', q],
    queryFn: () => hermesApi.search(q),
    enabled:
      q.trim().length > 0 &&
      !depQuery &&
      !ownerQuery &&
      !envQuery &&
      !isTeamQuery &&
      !isIntentQuery &&
      query !== 'broken',
  })

  const intent = useQuery({
    queryKey: ['search-intent', q],
    queryFn: () => hermesApi.searchIntent(q),
    enabled: isIntentQuery,
  })

  const recents = useQuery({ queryKey: ['recents'], queryFn: hermesApi.listRecents })

  const recentApps = useMemo(() => {
    const ids = loadSpotlightRecents()
    const fromApi = recents.data ?? []
    const byId = new Map(fromApi.map((a) => [a.id, a]))
    for (const app of catalog.data ?? []) {
      if (!byId.has(app.id)) byId.set(app.id, app)
    }
    return ids.map((id) => byId.get(id)).filter(Boolean)
  }, [recents.data, catalog.data])

  const defaultApps = useMemo(
    () => (catalog.data ?? []).filter(matchesWorkspace).slice(0, 6),
    [catalog.data, matchesWorkspace],
  )

  type Row =
    | { kind: 'nav'; label: string; path: string; icon: typeof Home; meta?: string }
    | { kind: 'app'; app: NonNullable<(typeof recentApps)[number]>; action: 'open' | 'inspect' }
    | { kind: 'action'; label: string; meta: string; run: () => void }

  const rows: Row[] = useMemo(() => {
    if (query === 'broken' || query === 'broken services') {
      const count = (health.data?.broken ?? 0) + (health.data?.degraded ?? 0)
      return [
        {
          kind: 'nav',
          label: 'Apps need attention',
          path: '/health',
          icon: HeartPulse,
          meta: count > 0 ? `${count} unhealthy apps` : 'View health dashboard',
        },
      ]
    }

    if (isTeamQuery) {
      return (recommended.data ?? [])
        .filter(matchesWorkspace)
        .slice(0, 8)
        .flatMap((app) => [
          { kind: 'app' as const, app, action: 'open' as const },
          { kind: 'app' as const, app, action: 'inspect' as const },
        ])
    }

    if (envQuery) {
      const apps = (catalog.data ?? []).filter((a) => a.meta?.environment === envQuery)
      return [
        {
          kind: 'action',
          label: `Switch to ${envQuery} workspace`,
          meta: `${apps.length} apps in this environment`,
          run: () => setWorkspaceId(envQuery),
        },
        ...apps.slice(0, 6).flatMap((app) => [
          { kind: 'app' as const, app, action: 'open' as const },
        ]),
      ]
    }

    if (depQuery) {
      const apps = (catalog.data ?? []).filter((a) => appDependsOn(a, depQuery))
      return apps.slice(0, 8).flatMap((app) => [
        { kind: 'app' as const, app, action: 'open' as const },
        { kind: 'app' as const, app, action: 'inspect' as const },
      ])
    }

    if (ownerQuery) {
      const apps = (catalog.data ?? []).filter((a) => (a.meta?.owner ?? '').toLowerCase() === ownerQuery.toLowerCase())
      return apps.slice(0, 8).flatMap((app) => [{ kind: 'app' as const, app, action: 'open' as const }])
    }

    if (intent.data?.apps.length) {
      return [
        {
          kind: 'action' as const,
          label: intent.data.answer,
          meta: `${intent.data.apps.length} apps · ${intent.data.intent}`,
          run: () => {},
        },
        ...intent.data.apps
          .filter(matchesWorkspace)
          .slice(0, 8)
          .flatMap((app) => [
            { kind: 'app' as const, app, action: 'open' as const },
            { kind: 'app' as const, app, action: 'inspect' as const },
          ]),
      ]
    }

    if (q.trim()) {
      return hits
        .filter((h) => matchesWorkspace(h.app))
        .flatMap((h) => [
          { kind: 'app' as const, app: h.app, action: 'open' as const },
          { kind: 'app' as const, app: h.app, action: 'inspect' as const },
        ])
    }

    const list: Row[] = navItems.map((n) => ({ kind: 'nav', ...n }))
    const apps = recentApps.length ? recentApps : defaultApps
    for (const app of apps.slice(0, 6)) {
      if (app) list.push({ kind: 'app', app, action: 'open' })
    }
    return list
  }, [
    q,
    query,
    hits,
    recentApps,
    defaultApps,
    health.data,
    recommended.data,
    catalog.data,
    depQuery,
    ownerQuery,
    envQuery,
    isTeamQuery,
    intent.data,
    matchesWorkspace,
    setWorkspaceId,
  ])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelected(0)
  }, [q, rows.length])

  const activate = (row: Row) => {
    if (row.kind === 'nav') {
      navigate(row.path)
      onClose()
      return
    }
    if (row.kind === 'action') {
      row.run()
      onClose()
      return
    }
    if (row.action === 'inspect') {
      navigate(appDetailPath(row.app, true))
      onClose()
      return
    }
    pushSpotlightRecent(row.app.id)
    openApp(row.app)
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => Math.min(s + 1, Math.max(rows.length - 1, 0)))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => Math.max(s - 1, 0))
      }
      if (e.key === 'Enter' && rows[selected]) {
        activate(rows[selected])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows, selected, onClose, navigate])

  const sectionLabel = (() => {
    if (!q.trim()) return 'Navigate & recent'
    if (query === 'broken') return 'Health'
    if (isTeamQuery) return 'Team picks'
    if (envQuery) return 'Workspace'
    if (depQuery) return `Depends on ${depQuery}`
    if (ownerQuery) return `Owner ${ownerQuery}`
    if (rows.length === 0) return ''
    return 'Services · Open or inspect'
  })()

  return (
    <div className="palette-backdrop" onClick={onClose} role="presentation">
      <div className="palette command-palette-glass" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Spotlight">
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Search apps, team picks, owner:team, depends:prometheus, production…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="palette-results">
          {sectionLabel ? <div className="palette-section-label">{sectionLabel}</div> : null}
          {q.trim() && rows.length === 0 ? (
            <div className="empty palette-empty">No matches in cluster catalog</div>
          ) : null}
          {rows.map((row, i) =>
            row.kind === 'nav' ? (
              <button
                key={`${row.path}-${row.label}`}
                type="button"
                className={`palette-item ${i === selected ? 'selected' : ''}`}
                onClick={() => activate(row)}
              >
                <row.icon size={16} />
                <div>
                  <strong>{row.label}</strong>
                  <div className="app-meta">{row.meta ?? 'Navigate'}</div>
                </div>
              </button>
            ) : row.kind === 'action' ? (
              <button
                key={row.label}
                type="button"
                className={`palette-item ${i === selected ? 'selected' : ''}`}
                onClick={() => activate(row)}
              >
                <Layers size={16} />
                <div>
                  <strong>{row.label}</strong>
                  <div className="app-meta">{row.meta}</div>
                </div>
              </button>
            ) : (
              <button
                key={`${row.app.id}-${row.action}`}
                type="button"
                className={`palette-item ${i === selected ? 'selected' : ''} ${statusTone(row.app.status)}`}
                onClick={() => activate(row)}
              >
                <AppIcon icon={row.app.icon} name={row.app.displayName} size="sm" />
                <div>
                  <strong>{row.app.displayName}</strong>
                  <div className="app-meta">
                    {row.app.namespace} · {statusLabel(row.app.status)} ·{' '}
                    {row.action === 'inspect' ? 'Inspect route' : 'Open app'}
                  </div>
                </div>
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
