// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import AppCard from '../components/AppCard'
import type { HermesApp } from '../types'
import { hermesApi } from '../services/hermesApi'

export default function TeamsPage() {
  const owners = useQuery({ queryKey: ['owners'], queryFn: hermesApi.listOwners })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog })

  const appsByOwner = useMemo(() => {
    const map = new Map<string, HermesApp[]>()
    for (const app of catalog.data ?? []) {
      const owner = app.meta?.owner?.trim()
      if (!owner) continue
      const list = map.get(owner) ?? []
      list.push(app)
      map.set(owner, list)
    }
    return map
  }, [catalog.data])

  return (
    <>
      <section className="glass-hero compact-hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <Users size={16} /> Team ownership
          </div>
          <h2 className="hero-title">Who runs what</h2>
          <p className="hero-sub">
            Owners come from service annotations and discovery metadata — a lightweight org map over your catalog.
          </p>
        </div>
      </section>

      {owners.isLoading ? (
        <div className="empty glass-section">Loading teams…</div>
      ) : !owners.data?.length ? (
        <div className="empty glass-section">
          No owner metadata yet. Add <code>hermes.zyvor.dev/owner</code> annotations to services.
        </div>
      ) : (
        owners.data.map((owner) => {
          const apps = appsByOwner.get(owner.id) ?? []
          return (
            <section key={owner.id} className="glass-section team-section">
              <div className="section-head">
                <div>
                  <h2>{owner.label}</h2>
                  <p className="hero-sub">
                    {owner.appCount} apps
                    {owner.recommended ? ` · ${owner.recommended} team picks` : ''}
                    {owner.unhealthy ? ` · ${owner.unhealthy} need attention` : ''}
                  </p>
                </div>
              </div>
              {apps.length ? (
                <div className="app-grid">
                  {apps.map((app) => (
                    <AppCard key={app.id} app={app} />
                  ))}
                </div>
              ) : (
                <div className="empty">No apps linked to this owner in the current catalog.</div>
              )}
            </section>
          )
        })
      )}

      <div className="app-actions" style={{ marginTop: '0.5rem' }}>
        <Link to="/graph" className="btn">
          View dependency graph
        </Link>
      </div>
    </>
  )
}
