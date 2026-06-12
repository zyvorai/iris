// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import AppCard from '../components/AppCard'
import { environmentLabel, hermesApi } from '../services/hermesApi'

export default function AppsPage() {
  const [filter, setFilter] = useState('')
  const [environment, setEnvironment] = useState('')
  const apps = useQuery({ queryKey: ['apps'], queryFn: hermesApi.listApps })
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: hermesApi.listFavorites })
  const favIds = new Set(favorites.data?.map((a) => a.id) ?? [])

  const environments = useMemo(() => {
    const set = new Set<string>()
    for (const a of apps.data ?? []) {
      if (a.meta?.environment) set.add(a.meta.environment)
    }
    return [...set].sort()
  }, [apps.data])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (apps.data ?? []).filter((a) => {
      if (environment && a.meta?.environment !== environment) return false
      if (!q) return true
      return (
        a.displayName.toLowerCase().includes(q) ||
        a.namespace.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.meta?.environment ?? '').toLowerCase().includes(q)
      )
    })
  }, [apps.data, filter, environment])

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
        {environments.map((env) => (
          <button
            key={env}
            type="button"
            className={`btn ${environment === env ? 'btn-accent' : ''}`}
            onClick={() => setEnvironment((cur) => (cur === env ? '' : env))}
          >
            {environmentLabel(env)}
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
