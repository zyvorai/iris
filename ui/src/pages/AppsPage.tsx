// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import AppCard from '../components/AppCard'
import { environmentLabel, hermesApi } from '../services/hermesApi'
import { useWorkspace } from '../utils/workspaceContext'
import type { HermesApp } from '../types'

type CatalogMode = 'published' | 'all'
type SortKey = 'name' | 'status' | 'namespace' | 'updated'

function sortApps(apps: HermesApp[], sort: SortKey): HermesApp[] {
  const rank = (s: string) => (s === 'broken' ? 0 : s === 'degraded' ? 1 : 2)
  return [...apps].sort((a, b) => {
    if (sort === 'status') return rank(a.status) - rank(b.status) || a.displayName.localeCompare(b.displayName)
    if (sort === 'namespace') return a.namespace.localeCompare(b.namespace) || a.displayName.localeCompare(b.displayName)
    if (sort === 'updated') return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    return a.displayName.localeCompare(b.displayName)
  })
}

export default function AppsPage() {
  const [filter, setFilter] = useState('')
  const [mode, setMode] = useState<CatalogMode>('published')
  const [sort, setSort] = useState<SortKey>('name')
  const [statusFilter, setStatusFilter] = useState('')
  const { workspaceId, matchesWorkspace } = useWorkspace()
  const published = useQuery({ queryKey: ['apps'], queryFn: hermesApi.listApps })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog })
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: hermesApi.listFavorites })
  const favIds = new Set(favorites.data?.map((a) => a.id) ?? [])

  const source = mode === 'published' ? published.data : catalog.data

  const environments = useMemo(() => {
    const set = new Set<string>()
    for (const a of source ?? []) {
      if (a.meta?.environment) set.add(a.meta.environment)
    }
    return [...set].sort()
  }, [source])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = (source ?? []).filter((a) => {
      if (!matchesWorkspace(a)) return false
      if (statusFilter && a.status !== statusFilter) return false
      if (!q) return true
      return (
        a.displayName.toLowerCase().includes(q) ||
        a.namespace.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.meta?.environment ?? '').toLowerCase().includes(q)
      )
    })
    return sortApps(list, sort)
  }, [source, filter, matchesWorkspace, sort, statusFilter])

  const categories = useMemo(() => {
    const set = new Set((source ?? []).map((a) => a.category))
    return [...set].sort()
  }, [source])

  return (
    <>
      <section className="glass-section catalog-toolbar">
        <div className="catalog-toolbar-row">
          <div className="view-toggle" role="tablist">
            <button type="button" className={mode === 'published' ? 'active' : ''} onClick={() => setMode('published')}>
              Published ({published.data?.length ?? 0})
            </button>
            <button type="button" className={mode === 'all' ? 'active' : ''} onClick={() => setMode('all')}>
              All discovered ({catalog.data?.length ?? 0})
            </button>
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort apps">
            <option value="name">Sort: name</option>
            <option value="status">Sort: status</option>
            <option value="namespace">Sort: namespace</option>
            <option value="updated">Sort: recently updated</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="healthy">Healthy</option>
            <option value="degraded">Degraded</option>
            <option value="broken">Broken</option>
          </select>
        </div>
      </section>
      <div className="filter-bar">
        <input placeholder="Filter apps…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {categories.slice(0, 8).map((c) => (
          <button key={c} type="button" className="btn" onClick={() => setFilter(c)}>
            {c}
          </button>
        ))}
        {environments.map((env) => (
          <span key={env} className={`chip ${workspaceId === env ? 'chip-accent' : 'chip-muted'}`}>
            {environmentLabel(env)}
          </span>
        ))}
      </div>
      <section className="glass-section">
        <h2>
          {mode === 'published' ? 'Launchpad catalog' : 'Full cluster catalog'} · {filtered.length} apps
        </h2>
        {!filtered.length ? <div className="empty">No apps match your filters.</div> : null}
        <div className="app-grid">
          {filtered.map((app) => (
            <AppCard key={app.id} app={app} favorite={favIds.has(app.id)} />
          ))}
        </div>
      </section>
    </>
  )
}
