// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from '@tanstack/react-query'
import MissionControlSpaces from '../components/command/MissionControlSpaces'
import PageFrame from '../components/nebula/PageFrame'
import ContextBanner from '../components/nebula/ContextBanner'
import { hermesApi } from '../services/hermesApi'
import { useWorkspace } from '../utils/workspaceContext'

/** Standalone departures-board destination — the cross-namespace live status
 * feed extracted from HomePage's embedded Mission Control section, per the
 * mockup's 8-destination IA. */
export default function MissionControlPage() {
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog, refetchInterval: 15000 })
  const { matchesWorkspace, workspaceId, setWorkspaceId } = useWorkspace()
  const apps = (catalog.data ?? []).filter(matchesWorkspace)

  const loading = catalog.isLoading && !catalog.data
  const hasData = Boolean(catalog.data)

  return (
    <PageFrame
      loading={loading}
      error={catalog.isError}
      hasData={hasData}
      onRetry={() => void catalog.refetch()}
      errorTitle="Could not load mission control"
      contextBanner={
        workspaceId ? (
          <ContextBanner
            label={`Showing ${workspaceId} workspace only`}
            detail="Clear the filter to see all cluster services"
            onClear={() => setWorkspaceId('')}
          />
        ) : undefined
      }
    >
      <div className="hs-page">
        <section className="hs-hero">
          <div className="hs-wrap">
            <p className="hs-eyebrow">Live status</p>
            <h1 className="h-hero" style={{ maxWidth: '16ch' }}>Mission Control</h1>
            <p className="hs-lede">
              Discovered services by space — expandable cards with diagnosis and actions.
            </p>
          </div>
        </section>
      <div className="page-grid">
        <MissionControlSpaces apps={apps} />
      </div>
      </div>
    </PageFrame>
  )
}
