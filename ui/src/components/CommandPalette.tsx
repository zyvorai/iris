// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Compass, Grid3X3, HeartPulse, History, Home, Layers, Server } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AppIcon from './AppIcon'
import { appDetailPath, hermesApi, openApp, statusLabel, statusTone } from '../services/hermesApi'
import { loadSpotlightRecents, pushSpotlightRecent } from '../utils/recentStore'

interface CommandPaletteProps {
  onClose: () => void
}

const navItems = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Apps catalog', path: '/apps', icon: Grid3X3 },
  { label: 'Spaces', path: '/spaces', icon: Layers },
  { label: 'Cluster services', path: '/cluster', icon: Server },
  { label: 'Discovery', path: '/discovery', icon: Compass },
  { label: 'Health', path: '/health', icon: HeartPulse },
  { label: 'Activity', path: '/activity', icon: History },
]

export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const health = useQuery({ queryKey: ['health'], queryFn: hermesApi.healthSummary })

  const { data: hits = [] } = useQuery({
    queryKey: ['search', q],
    queryFn: () => hermesApi.search(q),
    enabled: q.trim().length > 0 && q.trim().toLowerCase() !== 'broken',
  })

  const recents = useQuery({ queryKey: ['recents'], queryFn: hermesApi.listRecents })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog })

  const recentApps = useMemo(() => {
    const ids = loadSpotlightRecents()
    const fromApi = recents.data ?? []
    const byId = new Map(fromApi.map((a) => [a.id, a]))
    for (const app of catalog.data ?? []) {
      if (!byId.has(app.id)) byId.set(app.id, app)
    }
    return ids.map((id) => byId.get(id)).filter(Boolean)
  }, [recents.data, catalog.data])

  const defaultApps = useMemo(() => (catalog.data ?? []).slice(0, 6), [catalog.data])

  type Row =
    | { kind: 'nav'; label: string; path: string; icon: typeof Home; meta?: string }
    | { kind: 'app'; app: NonNullable<(typeof recentApps)[number]>; action: 'open' | 'inspect' }

  const rows: Row[] = useMemo(() => {
    const query = q.trim().toLowerCase()
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
    if (q.trim()) {
      const list: Row[] = []
      for (const h of hits) {
        list.push({ kind: 'app', app: h.app, action: 'open' })
        list.push({ kind: 'app', app: h.app, action: 'inspect' })
      }
      return list
    }
    const list: Row[] = navItems.map((n) => ({ kind: 'nav', ...n }))
    const apps = recentApps.length ? recentApps : defaultApps
    for (const app of apps.slice(0, 6)) {
      if (app) list.push({ kind: 'app', app, action: 'open' })
    }
    return list
  }, [q, hits, recentApps, defaultApps, health.data])

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

  return (
    <div className="palette-backdrop" onClick={onClose} role="presentation">
      <div className="palette command-palette-glass" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Spotlight">
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Search apps, namespaces, or type broken…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="palette-results">
          {q.trim() === '' ? (
            <div className="palette-section-label">Navigate &amp; recent</div>
          ) : q.trim().toLowerCase() === 'broken' ? (
            <div className="palette-section-label">Health</div>
          ) : hits.length === 0 ? (
            <div className="empty palette-empty">No matches in cluster catalog</div>
          ) : (
            <div className="palette-section-label">Services · Open or inspect</div>
          )}
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
