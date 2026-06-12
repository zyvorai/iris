// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Compass, Grid3X3, HeartPulse, Home, Server } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { hermesApi, openApp, sourceLabel, statusLabel, statusTone } from '../services/hermesApi'
import { loadSpotlightRecents, pushSpotlightRecent } from '../utils/recentStore'

interface CommandPaletteProps {
  onClose: () => void
}

const navItems = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Apps catalog', path: '/apps', icon: Grid3X3 },
  { label: 'Cluster services', path: '/cluster', icon: Server },
  { label: 'Discovery', path: '/discovery', icon: Compass },
  { label: 'Health', path: '/health', icon: HeartPulse },
]

export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const { data: hits = [] } = useQuery({
    queryKey: ['search', q],
    queryFn: () => hermesApi.search(q),
    enabled: q.trim().length > 0,
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
    | { kind: 'nav'; label: string; path: string; icon: typeof Home }
    | { kind: 'app'; app: NonNullable<(typeof recentApps)[number]> }

  const rows: Row[] = useMemo(() => {
    if (q.trim()) {
      return hits.map((h) => ({ kind: 'app' as const, app: h.app }))
    }
    const list: Row[] = navItems.map((n) => ({ kind: 'nav', ...n }))
    const apps = recentApps.length ? recentApps : defaultApps
    for (const app of apps.slice(0, 6)) {
      if (app) list.push({ kind: 'app', app })
    }
    return list
  }, [q, hits, recentApps, defaultApps])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelected(0)
  }, [q, rows.length])

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
        const row = rows[selected]
        if (row.kind === 'nav') {
          navigate(row.path)
          onClose()
        } else {
          pushSpotlightRecent(row.app.id)
          openApp(row.app)
          onClose()
        }
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
          placeholder="Search cluster services, namespaces, pages…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="palette-results">
          {q.trim() === '' ? (
            <div className="palette-section-label">Navigate &amp; recent</div>
          ) : hits.length === 0 ? (
            <div className="empty palette-empty">No matches in cluster catalog</div>
          ) : (
            <div className="palette-section-label">Services · {hits.length}</div>
          )}
          {rows.map((row, i) =>
            row.kind === 'nav' ? (
              <button
                key={row.path}
                type="button"
                className={`palette-item ${i === selected ? 'selected' : ''}`}
                onClick={() => {
                  navigate(row.path)
                  onClose()
                }}
              >
                <row.icon size={16} />
                <div>
                  <strong>{row.label}</strong>
                  <div className="app-meta">Navigate</div>
                </div>
              </button>
            ) : (
              <button
                key={row.app.id}
                type="button"
                className={`palette-item ${i === selected ? 'selected' : ''} ${statusTone(row.app.status)}`}
                onClick={() => {
                  pushSpotlightRecent(row.app.id)
                  openApp(row.app)
                  onClose()
                }}
              >
                <div className={`app-icon icon-${row.app.icon}`}>{row.app.displayName.slice(0, 2).toUpperCase()}</div>
                <div>
                  <strong>{row.app.displayName}</strong>
                  <div className="app-meta">
                    {row.app.namespace} · {sourceLabel(row.app.source)} · {statusLabel(row.app.status)}
                    {!row.app.visibility.published ? ' · unpublished' : ''}
                  </div>
                </div>
                <span className="app-meta">{row.app.routePath}</span>
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
