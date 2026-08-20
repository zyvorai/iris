// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GitBranch, Users } from 'lucide-react'
import AppCard from '../components/AppCard'
import GlassPanel from '../components/nebula/GlassPanel'
import PageFrame from '../components/nebula/PageFrame'
import EmptyState from '../components/nebula/EmptyState'
import Button from '../components/nebula/Button'
import AskZyraButton from '../components/nebula/AskZyraButton'
import ZyraAiPanel from '../components/nebula/ZyraAiPanel'
import ZyraAiFocusChips from '../components/nebula/ZyraAiFocusChips'
import type { HermesApp } from '../types'
import { hermesApi } from '../services/hermesApi'
import { useOwnerInsight } from '../hooks/useZyraAiInsight'
import { useInspector } from '../utils/inspectorContext'

export default function TeamsPage() {
  const { openDiagnose } = useInspector()
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

  const focusOwner = useMemo(() => {
    if (!owners.data?.length) return null
    const troubled = [...owners.data]
      .filter((o) => o.unhealthy > 0)
      .sort((a, b) => b.unhealthy - a.unhealthy || b.appCount - a.appCount)
    if (troubled[0]) return troubled[0].id
    return owners.data[0]?.id ?? null
  }, [owners.data])

  const ownerInsight = useOwnerInsight(focusOwner, Boolean(focusOwner && catalog.data))

  const loading = (owners.isLoading && !owners.data) || (catalog.isLoading && !catalog.data)
  const error = owners.isError || catalog.isError

  const onRetry = () => {
    void owners.refetch()
    void catalog.refetch()
  }

  const focusLabel = owners.data?.find((o) => o.id === focusOwner)?.label ?? focusOwner

  return (
    <PageFrame
      loading={loading}
      error={error}
      hasData={Boolean(owners.data && catalog.data)}
      onRetry={onRetry}
      errorTitle="Could not load teams"
    >
      <div className="page-grid">
        {focusOwner && (ownerInsight.data || ownerInsight.isLoading) ? (
          <ZyraAiPanel
            title={focusLabel ? `Team · ${focusLabel}` : 'Team insight'}
            summary={ownerInsight.data?.summary}
            explanation={ownerInsight.data?.explanation ?? 'Zyra AI is analyzing team ownership health…'}
            source={ownerInsight.data?.source}
            remediation={ownerInsight.data?.highlights}
            loading={ownerInsight.isLoading}
            compact
            onRefresh={() => void ownerInsight.refetch()}
            refreshing={ownerInsight.isFetching && !ownerInsight.isLoading}
            action={
              <ZyraAiFocusChips
                appIds={ownerInsight.data?.focusAppIds ?? []}
                catalog={catalog.data ?? []}
                onSelect={openDiagnose}
              />
            }
          />
        ) : null}

        <GlassPanel className="glass-panel-section">
          <div className="section-head-nebula">
            <div>
              <p className="section-label">
                <Users size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Team ownership
              </p>
              <p className="body-text">
                Owners from service annotations — a lightweight org map over your catalog.
              </p>
            </div>
            {focusOwner ? (
              <AskZyraButton compact command={`owner insight ${focusOwner}`} />
            ) : null}
          </div>
        </GlassPanel>

        {!owners.data?.length ? (
          <GlassPanel className="glass-panel-section">
            <EmptyState
              icon={<Users size={22} />}
              title="No owner metadata yet"
              description="Add hermes.zyvor.dev/owner annotations to services."
            />
          </GlassPanel>
        ) : (
          owners.data.map((owner) => {
            const apps = appsByOwner.get(owner.id) ?? []
            return (
              <GlassPanel key={owner.id} className="glass-panel-section">
                <div className="section-head-nebula">
                  <div>
                    <h2 className="section-title">{owner.label}</h2>
                    <p className="body-text">
                      {owner.appCount} apps
                      {owner.recommended ? ` · ${owner.recommended} team picks` : ''}
                      {owner.unhealthy ? ` · ${owner.unhealthy} need attention` : ''}
                    </p>
                  </div>
                </div>
                {apps.length ? (
                  <div className="app-grid" style={{ marginTop: '1rem' }}>
                    {apps.map((app) => (
                      <AppCard key={app.id} app={app} />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={<Users size={22} />} title="No linked apps" description="No apps linked to this owner in the current catalog." />
                )}
              </GlassPanel>
            )
          })
        )}

        <Button variant="secondary" to="/graph">
          <GitBranch size={14} /> View dependency graph
        </Button>
      </div>
    </PageFrame>
  )
}
