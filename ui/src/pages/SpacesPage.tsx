// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import AppCard from '../components/AppCard'
import { hermesApi } from '../services/hermesApi'
import { groupAppsBySpace, HERMES_SPACES, spaceById, spaceCounts } from '../utils/spaces'

export default function SpacesPage() {
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog })
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: hermesApi.listFavorites })
  const favIds = new Set(favorites.data?.map((a) => a.id) ?? [])
  const published = (catalog.data ?? []).filter((a) => a.visibility.published)

  return (
    <>
      <section className="glass-hero">
        <h2 className="hero-title">Spaces</h2>
        <p className="hero-sub">Browse apps by category — monitoring, security, developer tools, and more.</p>
      </section>
      <section className="glass-section">
        <div className="space-list">
          {HERMES_SPACES.filter((space) => spaceCounts(published)[space.id] > 0).map((space) => (
            <Link key={space.id} to={`/spaces/${space.id}`} className="space-row zeus-card">
              <div>
                <h3>{space.label}</h3>
                <p>{space.description}</p>
              </div>
              <span className="chip chip-accent">{spaceCounts(published)[space.id]} apps</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="glass-section">
        <h2>Quick preview</h2>
        <div className="app-grid">
          {published.slice(0, 6).map((app) => (
            <AppCard key={app.id} app={app} favorite={favIds.has(app.id)} />
          ))}
        </div>
      </section>
    </>
  )
}

export function SpaceDetailPage() {
  const { spaceId = '' } = useParams()
  const space = spaceById(spaceId)
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog })
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: hermesApi.listFavorites })
  const favIds = new Set(favorites.data?.map((a) => a.id) ?? [])

  const apps = space
    ? (groupAppsBySpace((catalog.data ?? []).filter((a) => a.visibility.published)).get(space.id) ?? [])
    : []

  return (
    <>
      <section className="glass-hero">
        <Link to="/spaces" className="section-link">
          ← All spaces
        </Link>
        <h2 className="hero-title">{space?.label ?? 'Space'}</h2>
        <p className="hero-sub">{space?.description ?? 'Apps in this space'}</p>
      </section>
      <section className="glass-section" data-testid={`space-${spaceId}`}>
        <h2>{apps.length} app{apps.length === 1 ? '' : 's'}</h2>
        <div className="app-grid">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} favorite={favIds.has(app.id)} />
          ))}
        </div>
      </section>
    </>
  )
}
