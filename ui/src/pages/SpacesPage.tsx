// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Layers } from 'lucide-react'
import QuickLaunchTile from '../components/nebula/QuickLaunchTile'
import DeparturesRow from '../components/nebula/DeparturesBoard'
import Board from '../components/nebula/Board'
import GlassPanel from '../components/nebula/GlassPanel'
import GlyphTile from '../components/nebula/GlyphTile'
import PageFrame from '../components/nebula/PageFrame'
import EmptyState from '../components/nebula/EmptyState'
import ZyraAiPanel from '../components/nebula/ZyraAiPanel'
import { hermesApi } from '../services/hermesApi'
import { useFleetInsight } from '../hooks/useZyraAiInsight'
import { groupAppsBySpace, HERMES_SPACES, spaceById, spaceCounts } from '../utils/spaces'
import { useStatusFlip } from '../hooks/useStatusFlip'

export default function SpacesPage() {
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog })
  const published = (catalog.data ?? []).filter((a) => a.visibility.published)

  const loading = catalog.isLoading && !catalog.data
  const error = catalog.isError
  const issueCount = (catalog.data ?? []).filter((a) => a.status !== 'healthy').length
  const fleetInsight = useFleetInsight(Boolean(catalog.data?.length) && issueCount > 0)

  return (
    <PageFrame
      loading={loading}
      error={error}
      hasData={Boolean(catalog.data)}
      onRetry={() => void catalog.refetch()}
      errorTitle="Could not load spaces"
    >
      <div className="hs-page">
        <section className="hs-hero">
          <div className="hs-wrap">
            <p className="hs-eyebrow">Spaces</p>
            <h1 className="h-hero" style={{ maxWidth: '16ch' }}>Browse by category</h1>
            <p className="hs-lede">
              Mission Control shows all discovered services; spaces show published apps only.
            </p>
          </div>
        </section>
      <div className="page-grid">
        {issueCount > 0 && (fleetInsight.data || fleetInsight.isLoading) ? (
          <ZyraAiPanel
            title="Fleet insight"
            summary={fleetInsight.data?.summary}
            explanation={fleetInsight.data?.explanation ?? 'Zyra AI is summarizing space health…'}
            source={fleetInsight.data?.source}
            remediation={fleetInsight.data?.highlights}
            loading={fleetInsight.isLoading}
            compact
          />
        ) : null}

        <GlassPanel className="glass-panel-section">
          <div className="section-head-nebula">
            <GlyphTile tone="brand" icon={<Layers size={14} />} size="sm" />
            <div>
              <p className="hs-eyebrow">Categories</p>
              <h2 className="h-tile">Published spaces</h2>
            </div>
          </div>
          <div className="space-list" style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
            {HERMES_SPACES.filter((space) => spaceCounts(published)[space.id] > 0).map((space) => (
              <Link key={space.id} to={`/spaces/${space.id}`} className="hub-link-card">
                <div>
                  <h3>{space.label}</h3>
                  <p>{space.description}</p>
                </div>
                <span className="nebula-status-badge status-healthy">
                  {spaceCounts(published)[space.id]} app{spaceCounts(published)[space.id] === 1 ? '' : 's'}
                </span>
              </Link>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="glass-panel-section">
          <p className="section-label">Quick preview</p>
          {published.length ? (
            <div className="quick-launch-grid">
              {published.slice(0, 6).map((app) => (
                <QuickLaunchTile key={app.id} app={app} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Layers size={22} />}
              title="No published apps yet"
              description="Publish services from Cluster to populate spaces."
            />
          )}
        </GlassPanel>
      </div>
      </div>
    </PageFrame>
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

  const loading = catalog.isLoading && !catalog.data
  const flipped = useStatusFlip(apps)

  return (
    <PageFrame
      loading={loading}
      error={catalog.isError}
      hasData={Boolean(catalog.data)}
      onRetry={() => void catalog.refetch()}
    >
      <div className="hs-page">
        <section className="hs-hero">
          <div className="hs-wrap">
            <p className="hs-eyebrow">
              <Link to="/spaces" className="section-link-nebula">← All spaces</Link>
            </p>
            <h1 className="h-hero" style={{ maxWidth: '16ch' }}>{space?.label ?? 'Space'}</h1>
            <p className="hs-lede">{space?.description ?? 'Published apps in this space'}</p>
          </div>
        </section>
      <div className="page-grid">
        <GlassPanel className="glass-panel-section" data-testid={`space-${spaceId}`}>
          <p className="section-label">{apps.length} published app{apps.length === 1 ? '' : 's'}</p>
          {apps.length ? (
            <Board style={{ marginTop: '1rem' }}>
              {apps.map((app) => (
                <DeparturesRow key={app.id} app={app} favorite={favIds.has(app.id)} flipped={flipped.has(app.id)} />
              ))}
            </Board>
          ) : (
            <EmptyState icon={<Layers size={22} />} title="No apps in this space" description="Publish apps that match this category to see them here." />
          )}
        </GlassPanel>
      </div>
      </div>
    </PageFrame>
  )
}
