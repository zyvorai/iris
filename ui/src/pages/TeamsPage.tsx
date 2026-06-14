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
import ZeusAiPanel from '../components/nebula/ZeusAiPanel'
import ZeusAiFocusChips from '../components/nebula/ZeusAiFocusChips'
import type { HermesApp } from '../types'
import { hermesApi } from '../services/hermesApi'
import { useFleetInsight } from '../hooks/useZeusAiInsight'
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

  const loading = (owners.isLoading && !owners.data) || (catalog.isLoading && !catalog.data)
  const error = owners.isError || catalog.isError

  const onRetry = () => {
    void owners.refetch()
    void catalog.refetch()
  }

  const issueCount = (catalog.data ?? []).filter((a) => a.status !== 'healthy').length
  const fleetInsight = useFleetInsight(Boolean(catalog.data?.length) && issueCount > 0)

  return (
    <PageFrame
      loading={loading}
      error={error}
      hasData={Boolean(owners.data && catalog.data)}
      onRetry={onRetry}
      errorTitle="Could not load teams"
    >
      <div className="page-grid">
        {issueCount > 0 && (fleetInsight.data || fleetInsight.isLoading) ? (
          <ZeusAiPanel
            title="Fleet insight"
            summary={fleetInsight.data?.summary}
            explanation={fleetInsight.data?.explanation ?? 'Zeus AI is summarizing team-owned services…'}
            source={fleetInsight.data?.source}
            remediation={fleetInsight.data?.highlights}
            loading={fleetInsight.isLoading}
            compact
            action={
              <ZeusAiFocusChips
                appIds={fleetInsight.data?.focusAppIds ?? []}
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
