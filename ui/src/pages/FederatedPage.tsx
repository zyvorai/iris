// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Globe, ShieldCheck } from 'lucide-react'
import DeparturesRow from '../components/nebula/DeparturesBoard'
import Board from '../components/nebula/Board'
import GlassPanel from '../components/nebula/GlassPanel'
import GlyphTile from '../components/nebula/GlyphTile'
import PageFrame from '../components/nebula/PageFrame'
import EmptyState from '../components/nebula/EmptyState'
import AskZyraButton from '../components/nebula/AskZyraButton'
import Button from '../components/nebula/Button'
import ZyraAiPanel from '../components/nebula/ZyraAiPanel'
import ZyraAiFocusChips from '../components/nebula/ZyraAiFocusChips'
import { irisApi } from '../services/irisApi'
import { useFederatedInsight } from '../hooks/useZyraAiInsight'
import { useInspector } from '../utils/inspectorContext'
import { useToast } from '../components/Toast'
import type { FederatedApp } from '../types'

export default function FederatedPage() {
  const queryClient = useQueryClient()
  const { openDiagnose } = useInspector()
  const toast = useToast()
  const federated = useQuery({
    queryKey: ['catalog-federated'],
    queryFn: irisApi.listFederatedCatalog,
    refetchInterval: 20000,
  })
  const clusters = useQuery({
    queryKey: ['clusters'],
    queryFn: irisApi.listClusters,
    refetchInterval: 30000,
  })
  const federatedInsight = useFederatedInsight(Boolean(federated.data?.length))

  const writeClusters = new Set(
    (clusters.data ?? []).filter((c) => c.writeEnabled && !c.isLocal).map((c) => c.id),
  )

  const publishRemote = useMutation({
    mutationFn: ({ clusterId, id }: { clusterId: string; id: string }) =>
      irisApi.federationPublish(clusterId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['catalog-federated'] })
      toast('Published on remote cluster')
    },
    onError: () => toast('Could not publish on remote cluster', 'error'),
  })

  const rbacCheck = useMutation({
    mutationFn: (clusterId: string) => irisApi.federationRbacCheck(clusterId),
  })

  const byCluster = new Map<string, FederatedApp[]>()
  for (const entry of federated.data ?? []) {
    const list = byCluster.get(entry.clusterId) ?? []
    list.push(entry)
    byCluster.set(entry.clusterId, list)
  }

  const loading =
    (federated.isLoading && !federated.data) || (clusters.isLoading && !clusters.data)
  const error = federated.isError || clusters.isError

  const onRetry = () => {
    void federated.refetch()
    void clusters.refetch()
  }

  return (
    <PageFrame
      loading={loading}
      error={error}
      hasData={Boolean(federated.data && clusters.data)}
      onRetry={onRetry}
      errorTitle="Could not load federated catalog"
      isEmpty={Boolean(federated.data && !byCluster.size)}
      empty={
        <GlassPanel className="glass-panel-section">
          <EmptyState
            icon={<Globe size={22} />}
            title="No federated apps"
            description="Configure IRIS_FEDERATED_CLUSTERS to merge remote catalogs."
          />
        </GlassPanel>
      }
    >
      <div className="hs-page">
        <section className="hs-hero">
          <div className="hs-wrap">
            <p className="hs-eyebrow">Federation</p>
            <h1 className="h-hero" style={{ maxWidth: '16ch' }}>Federated catalog</h1>
            <p className="hs-lede">Merged apps from remote clusters — publish when write federation is enabled.</p>
          </div>
        </section>
      <div className="page-grid">
        {federated.data?.length ? (
          <ZyraAiPanel
            title="Federated insight"
            summary={federatedInsight.data?.summary}
            explanation={federatedInsight.data?.explanation ?? 'Zyra AI is analyzing federated catalogs…'}
            source={federatedInsight.data?.source}
            remediation={federatedInsight.data?.highlights}
            loading={federatedInsight.isLoading}
            compact
            onRefresh={() => void federatedInsight.refetch()}
            refreshing={federatedInsight.isFetching && !federatedInsight.isLoading}
            action={
              <ZyraAiFocusChips
                appIds={federatedInsight.data?.focusAppIds ?? []}
                catalog={federated.data}
                onSelect={openDiagnose}
              />
            }
          />
        ) : null}

        <GlassPanel className="glass-panel-section">
          <div className="section-head-nebula">
            <GlyphTile tone="brand" icon={<Globe size={14} />} size="sm" />
            <div>
              <p className="hs-eyebrow">Remote clusters</p>
              <h2 className="h-tile">Merged inventory</h2>
            </div>
            <span className="nebula-status-badge status-unknown">{federated.data?.length ?? 0} apps</span>
            <AskZyraButton compact command="federated insight" />
            <Link to="/cluster" className="section-link-nebula">Clusters</Link>
          </div>

          {!byCluster.size ? null : (
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
                  <Board style={{ marginTop: '0.75rem' }}>
                    {entries.map((entry) => (
                      <DeparturesRow
                        key={`${entry.clusterId}-${entry.id}`}
                        app={entry}
                        onPublish={
                          canWrite && !entry.id.includes('__offline__')
                            ? () => publishRemote.mutate({ clusterId: entry.clusterId, id: entry.id })
                            : null
                        }
                      />
                    ))}
                  </Board>
                </div>
              )
            })
          )}
        </GlassPanel>
      </div>
      </div>
    </PageFrame>
  )
}
