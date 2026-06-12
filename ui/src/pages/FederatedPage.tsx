// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Globe, ShieldCheck, Upload } from 'lucide-react'
import AppCard from '../components/AppCard'
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

  return (
    <section className="glass-section">
      <div className="section-head">
        <h2>
          <Globe size={16} /> Federated catalog
        </h2>
        <span className="chip chip-muted">{federated.data?.length ?? 0} apps</span>
        <Link to="/cluster" className="section-link">
          Clusters
        </Link>
      </div>
      {federated.isLoading ? (
        <div className="empty">Loading federated catalog…</div>
      ) : (
        [...byCluster.entries()].map(([clusterId, entries]) => {
          const canWrite = writeClusters.has(clusterId)
          return (
            <div key={clusterId} className="federated-cluster-block">
              <div className="federated-cluster-head">
                <h3>{entries[0]?.clusterName ?? clusterId}</h3>
                {canWrite ? (
                  <span className="chip chip-ok">Write federation enabled</span>
                ) : (
                  <span className="chip chip-muted">Read-only</span>
                )}
                {canWrite ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={rbacCheck.isPending}
                    onClick={() => rbacCheck.mutate(clusterId)}
                  >
                    <ShieldCheck size={14} />
                    Check RBAC
                  </button>
                ) : null}
              </div>
              {rbacCheck.data && rbacCheck.variables === clusterId ? (
                <p className={rbacCheck.data.ok ? 'federated-action-ok' : 'federated-action-error'}>
                  {rbacCheck.data.detail ?? (rbacCheck.data.ok ? 'Publish allowed' : 'Publish denied')}
                  {rbacCheck.data.allowedActions?.length
                    ? ` · ${rbacCheck.data.allowedActions.join(', ')}`
                    : ''}
                </p>
              ) : null}
              <div className="app-grid">
                {entries.map((entry) => (
                  <div key={`${entry.clusterId}-${entry.id}`} className="federated-app-wrap">
                    <AppCard app={entry} />
                    {canWrite && !entry.id.includes('__offline__') ? (
                      <button
                        type="button"
                        className="btn btn-sm federated-publish-btn"
                        disabled={publishRemote.isPending}
                        onClick={() => publishRemote.mutate({ clusterId: entry.clusterId, id: entry.id })}
                      >
                        <Upload size={14} />
                        Publish on remote
                      </button>
                    ) : null}
                    {publishRemote.isError &&
                    publishRemote.variables?.id === entry.id &&
                    publishRemote.variables?.clusterId === entry.clusterId ? (
                      <p className="federated-action-error">Remote publish failed.</p>
                    ) : null}
                    {publishRemote.data &&
                    !publishRemote.data.ok &&
                    publishRemote.variables?.id === entry.id ? (
                      <p className="federated-action-error">{publishRemote.data.detail ?? 'Failed'}</p>
                    ) : null}
                    {publishRemote.data?.ok && publishRemote.variables?.id === entry.id ? (
                      <p className="federated-action-ok">{publishRemote.data.detail ?? 'Published'}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </section>
  )
}
