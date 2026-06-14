// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Compass, Rocket } from 'lucide-react'
import AppCard from '../components/AppCard'
import GlassPanel from '../components/nebula/GlassPanel'
import PageFrame from '../components/nebula/PageFrame'
import EmptyState from '../components/nebula/EmptyState'
import Button from '../components/nebula/Button'
import { hermesApi } from '../services/hermesApi'
import { refreshHermesData } from '../utils/refreshCatalog'

export default function DiscoveryPage() {
  const qc = useQueryClient()
  const discovery = useQuery({ queryKey: ['discovery'], queryFn: hermesApi.listDiscovery, refetchInterval: 15000 })
  const cluster = useQuery({ queryKey: ['cluster-summary'], queryFn: hermesApi.clusterSummary })

  const publish = useMutation({
    mutationFn: hermesApi.publish,
    onSuccess: () => void refreshHermesData(qc),
  })

  const publishAll = useMutation({
    mutationFn: async () => {
      const apps = discovery.data ?? []
      for (const app of apps.slice(0, 25)) {
        await hermesApi.publish(app.id)
      }
      return apps.length
    },
    onSuccess: () => void refreshHermesData(qc),
  })

  const hide = useMutation({
    mutationFn: hermesApi.hide,
    onSuccess: () => void refreshHermesData(qc),
  })

  const loading = discovery.isLoading && !discovery.data

  return (
    <PageFrame
      loading={loading}
      error={discovery.isError}
      hasData={Boolean(discovery.data)}
      onRetry={() => void discovery.refetch()}
      errorTitle="Could not load discovery queue"
    >
      <div className="page-grid">
        <GlassPanel className="glass-panel-section">
          <div className="section-head-nebula">
            <div>
              <p className="section-label">Discovery</p>
              <h2 className="section-title">Discovery queue</h2>
              <p className="body-text">
                {cluster.data?.discovery ?? '—'} unpublished services across {cluster.data?.namespaces ?? '—'} namespaces.
              </p>
            </div>
            {discovery.data?.length ? (
              <Button variant="primary" className="nebula-btn-compact" disabled={publishAll.isPending} onClick={() => void publishAll.mutate()}>
                <Rocket size={14} /> Publish first {Math.min(discovery.data.length, 25)}
              </Button>
            ) : null}
          </div>
        </GlassPanel>

        <GlassPanel className="glass-panel-section">
          <p className="section-label">Unpublished services</p>
          {!discovery.data?.length ? (
            <EmptyState
              icon={<Compass size={22} />}
              title="Queue is empty"
              description="All discovered services are published. Check Cluster for the full inventory."
            />
          ) : (
            <div className="app-grid" style={{ marginTop: '1rem' }}>
              {discovery.data.map((app) => (
                <AppCard
                  key={app.id}
                  app={app}
                  onPublish={() => publish.mutate(app.id)}
                  onHide={() => hide.mutate(app.id)}
                />
              ))}
            </div>
          )}
        </GlassPanel>
      </div>
    </PageFrame>
  )
}
