// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Globe, ShieldCheck, Upload } from 'lucide-react'
import AppCard from '../components/AppCard'
import GlassPanel from '../components/nebula/GlassPanel'
import PageFrame from '../components/nebula/PageFrame'
import EmptyState from '../components/nebula/EmptyState'
import Button from '../components/nebula/Button'
import { hermesApi } from '../services/hermesApi'
import type { FederatedApp } from '../types'

export default function FederatedPage() {
  const queryClient = useQueryClient()
  const federated = useQuery({
    queryKey: ['catalog-federated'],
    queryFn: hermesApi.listFederatedCatalog,
    refetchInterval: 20000,
  })
  const clusters = useQuery({
    queryKey: ['clusters'],
    queryFn: hermesApi.listClusters,
    refetchInterval: 30000,
  })

  const writeClusters = new Set(
    (clusters.data ?? []).filter((c) => c.writeEnabled && !c.isLocal).map((c) => c.id),
  )

  const publishRemote = useMutation({
    mutationFn: ({ clusterId, id }: { clusterId: string; id: string }) =>
      hermesApi.federationPublish(clusterId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['catalog-federated'] })
    },
  })

  const rbacCheck = useMutation({
    mutationFn: (clusterId: string) => hermesApi.federationRbacCheck(clusterId),
  })

  const byCluster = new Map<string, FederatedApp[]>()
  for (const entry of federated.data ?? []) {
    const list = byCluster.get(entry.clusterId) ?? []
    list.push(entry)
    byCluster.set(entry.clusterId, list)
  }

  const loading = federated.isLoading && !federated.data

  return (
    <PageFrame
      loading={loading}
      error={federated.isError}
      hasData={Boolean(federated.data)}
      onRetry={() => void federated.refetch()}
      errorTitle="Could not load federated catalog"
    >
      <div className="page-grid">
        <GlassPanel className="glass-panel-section">
          <div className="section-head-nebula">
            <div>
              <p className="section-label">Federation</p>
              <h2 className="section-title">Federated catalog</h2>
              <p className="body-text">Merged apps from remote clusters — publish when write federation is enabled.</p>
            </div>
            <span className="nebula-status-badge status-unknown">{federated.data?.length ?? 0} apps</span>
            <Link to="/cluster" className="section-link-nebula">Clusters</Link>
          </div>

          {!byCluster.size ? (
            <EmptyState icon={<Globe size={22} />} title="No federated apps" description="Configure HERMES_FEDERATED_CLUSTERS to merge remote catalogs." />
          ) : (
            [...byCluster.entries()].map(([clusterId, entries]) => {
              const canWrite = writeClusters.has(clusterId)
              return (
                <div key={clusterId} className="mission-control-group-flat">
                  <div className="section-head-nebula">
                    <p className="section-label">{entries[0]?.clusterName ?? clusterId}</p>
                    {canWrite ? (
                      <span className="nebula-status-badge status-healthy">Write enabled</span>
                    ) : (
                      <span className="nebula-status-badge status-unknown">Read-only</span>
                    )}
                    {canWrite ? (
                      <Button variant="ghost" className="nebula-btn-compact" disabled={rbacCheck.isPending} onClick={() => rbacCheck.mutate(clusterId)}>
                        <ShieldCheck size={14} /> Check RBAC
                      </Button>
                    ) : null}
                  </div>
                  {rbacCheck.data && rbacCheck.variables === clusterId ? (
                    <p className={rbacCheck.data.ok ? 'federated-action-ok' : 'federated-action-error'}>
                      {rbacCheck.data.detail ?? (rbacCheck.data.ok ? 'Publish allowed' : 'Publish denied')}
                    </p>
                  ) : null}
                  <div className="app-grid" style={{ marginTop: '0.75rem' }}>
                    {entries.map((entry) => (
                      <div key={`${entry.clusterId}-${entry.id}`} className="federated-app-wrap">
                        <AppCard app={entry} />
                        {canWrite && !entry.id.includes('__offline__') ? (
                          <Button
                            variant="secondary"
                            className="nebula-btn-compact federated-publish-btn"
                            disabled={publishRemote.isPending}
                            onClick={() => publishRemote.mutate({ clusterId: entry.clusterId, id: entry.id })}
                          >
                            <Upload size={14} /> Publish on remote
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </GlassPanel>
      </div>
    </PageFrame>
  )
}
