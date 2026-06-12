// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import AppCard from '../components/AppCard'
import { hermesApi } from '../services/hermesApi'

export default function AppsPage() {
  const [filter, setFilter] = useState('')
  const apps = useQuery({ queryKey: ['apps'], queryFn: hermesApi.listApps })
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: hermesApi.listFavorites })
  const favIds = new Set(favorites.data?.map((a) => a.id) ?? [])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return apps.data ?? []
    return (apps.data ?? []).filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        a.namespace.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
    )
  }, [apps.data, filter])

  const categories = useMemo(() => {
    const set = new Set((apps.data ?? []).map((a) => a.category))
    return [...set].sort()
  }, [apps.data])

  return (
    <>
      <div className="filter-bar">
        <input
          placeholder="Filter apps..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {categories.map((c) => (
          <button key={c} type="button" className="btn" onClick={() => setFilter(c)}>
            {c}
          </button>
        ))}
      </div>
      <section className="glass-section">
        <h2>Catalog · {filtered.length} apps</h2>
        <div className="app-grid">
          {filtered.map((app) => (
            <AppCard key={app.id} app={app} favorite={favIds.has(app.id)} />
          ))}
        </div>
      </section>
    </>
  )
}
