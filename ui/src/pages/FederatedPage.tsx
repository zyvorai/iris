// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Globe } from 'lucide-react'
import AppCard from '../components/AppCard'
import { hermesApi } from '../services/hermesApi'
import type { FederatedApp } from '../types'

export default function FederatedPage() {
  const federated = useQuery({
    queryKey: ['catalog-federated'],
    queryFn: hermesApi.listFederatedCatalog,
    refetchInterval: 20000,
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
        [...byCluster.entries()].map(([clusterId, entries]) => (
          <div key={clusterId} className="federated-cluster-block">
            <h3>{entries[0]?.clusterName ?? clusterId}</h3>
            <div className="app-grid">
              {entries.map((entry) => (
                <AppCard key={`${entry.clusterId}-${entry.id}`} app={entry} />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  )
}
