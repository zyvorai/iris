// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Grid3X3 } from 'lucide-react'
import AppCard from '../components/AppCard'
import GlassPanel from '../components/nebula/GlassPanel'
import PageFrame from '../components/nebula/PageFrame'
import PageToolbar from '../components/nebula/PageToolbar'
import EmptyState from '../components/nebula/EmptyState'
import Button from '../components/nebula/Button'
import { hermesApi } from '../services/hermesApi'
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
  const [categoryFilter, setCategoryFilter] = useState('')
  const [mode, setMode] = useState<CatalogMode>('published')
  const [sort, setSort] = useState<SortKey>('name')
  const [statusFilter, setStatusFilter] = useState('')
  const { matchesWorkspace } = useWorkspace()
  const published = useQuery({ queryKey: ['apps'], queryFn: hermesApi.listApps })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog })
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: hermesApi.listFavorites })
  const favIds = new Set(favorites.data?.map((a) => a.id) ?? [])

  const source = mode === 'published' ? published.data : catalog.data
  const loading = mode === 'published' ? published.isLoading && !published.data : catalog.isLoading && !catalog.data
  const error = mode === 'published' ? published.isError : catalog.isError
  const hasData = Boolean(source)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const cat = categoryFilter.trim().toLowerCase()
    const list = (source ?? []).filter((a) => {
      if (!matchesWorkspace(a)) return false
      if (statusFilter && a.status !== statusFilter) return false
      if (cat && a.category.toLowerCase() !== cat) return false
      if (!q) return true
      return (
        a.displayName.toLowerCase().includes(q) ||
        a.namespace.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.meta?.environment ?? '').toLowerCase().includes(q)
      )
    })
    return sortApps(list, sort)
  }, [source, filter, categoryFilter, matchesWorkspace, sort, statusFilter])

  const categories = useMemo(() => {
    const set = new Set((source ?? []).map((a) => a.category))
    return [...set].sort()
  }, [source])

  const onRetry = () => {
    void published.refetch()
    void catalog.refetch()
  }

  const clearFilters = () => {
    setFilter('')
    setCategoryFilter('')
    setStatusFilter('')
  }

  const catalogCount = source?.length ?? 0
  const hasActiveFilters = Boolean(filter.trim() || categoryFilter || statusFilter)
  const isTrulyEmpty = hasData && catalogCount === 0
  const isFilterEmpty = hasData && catalogCount > 0 && !filtered.length
  const [showAllCategories, setShowAllCategories] = useState(false)
  const visibleCategories = showAllCategories ? categories : categories.slice(0, 8)
  const hiddenCategoryCount = Math.max(0, categories.length - visibleCategories.length)

  return (
    <PageFrame
      loading={loading}
      error={error}
      hasData={hasData}
      onRetry={onRetry}
      errorTitle="Could not load catalog"
      isEmpty={isTrulyEmpty || isFilterEmpty}
      empty={
        <GlassPanel className="glass-panel-section">
          {isTrulyEmpty ? (
            <EmptyState
              icon={<Grid3X3 size={22} />}
              title={mode === 'published' ? 'No published apps yet' : 'No services discovered yet'}
              description={
                mode === 'published'
                  ? 'Publish services from the cluster catalog or discovery queue to populate the launchpad.'
                  : 'Hermes will populate this view once the controller finishes scanning your cluster.'
              }
              action={
                <>
                  <Button variant="primary" to="/cluster">
                    Browse cluster
                  </Button>
                  <Button variant="secondary" to="/discovery">
                    Open discovery
                  </Button>
                </>
              }
            />
          ) : (
            <EmptyState
              icon={<Grid3X3 size={22} />}
              title="No apps match your filters"
              description="Try clearing filters or browse the full cluster inventory."
              action={
                <>
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                  <Button variant="primary" to="/cluster">
                    Browse cluster
                  </Button>
                </>
              }
            />
          )}
        </GlassPanel>
      }
    >
      <div className="page-grid">
        <GlassPanel className="glass-panel-section">
          <div className="section-head-nebula">
            <div>
              <p className="section-label">Catalog</p>
              <p className="body-text">
                Published launchpad apps and the full discovered cluster inventory.
              </p>
            </div>
          </div>

          <PageToolbar className="page-toolbar-stacked" data-testid="catalog-toolbar">
            <div className="view-toggle" role="tablist">
              <button type="button" className={mode === 'published' ? 'active' : ''} onClick={() => setMode('published')}>
                Published ({published.data?.length ?? 0})
              </button>
              <button type="button" className={mode === 'all' ? 'active' : ''} onClick={() => setMode('all')}>
                All ({catalog.data?.length ?? 0})
              </button>
            </div>
            <input
              className="page-toolbar-search"
              placeholder="Search apps…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Search apps"
            />
            <select className="page-toolbar-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort apps">
              <option value="name">Sort: name</option>
              <option value="status">Sort: status</option>
              <option value="namespace">Sort: namespace</option>
              <option value="updated">Recently updated</option>
            </select>
            <select className="page-toolbar-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="broken">Broken</option>
            </select>
          </PageToolbar>

          {categories.length ? (
            <div className="toolbar-scroll-shell" style={{ marginTop: '0.75rem' }}>
              <div className="mission-control-filters">
                <button type="button" className={`filter-chip ${!categoryFilter ? 'active' : ''}`} onClick={() => setCategoryFilter('')}>
                  All categories
                </button>
                {visibleCategories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`filter-chip ${categoryFilter === c ? 'active' : ''}`}
                    onClick={() => setCategoryFilter(categoryFilter === c ? '' : c)}
                  >
                    {c}
                  </button>
                ))}
                {hiddenCategoryCount ? (
                  <button type="button" className="filter-chip" onClick={() => setShowAllCategories(true)}>
                    More categories (+{hiddenCategoryCount})
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <p className="body-text" style={{ marginTop: '1rem' }}>
            {mode === 'published' ? 'Launchpad catalog' : 'Full cluster catalog'} · {filtered.length} apps
            {hasActiveFilters && catalogCount > 0 ? ` · ${catalogCount} total` : ''}
          </p>

          <div className="app-grid" style={{ marginTop: '1rem' }}>
            {filtered.map((app) => (
              <AppCard key={app.id} app={app} favorite={favIds.has(app.id)} />
            ))}
          </div>
        </GlassPanel>
      </div>
    </PageFrame>
  )
}
