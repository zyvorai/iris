// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Rocket } from 'lucide-react'
import AppCard from '../components/AppCard'
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

  return (
    <>
      <section className="glass-hero compact-hero">
        <div className="hero-copy">
          <h2 className="hero-title">Discovery queue</h2>
          <p className="hero-sub">
            {cluster.data?.discovery ?? '—'} unpublished services across {cluster.data?.namespaces ?? '—'} namespaces.
            Publish to add them to your dock — or browse everything on Cluster.
          </p>
          {discovery.data?.length ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={publishAll.isPending}
              onClick={() => void publishAll.mutate()}
            >
              <Rocket size={14} /> Publish first {Math.min(discovery.data.length, 25)} services
            </button>
          ) : null}
        </div>
      </section>
      <section className="glass-section">
        <h2>Unpublished services</h2>
        {discovery.isLoading ? (
          <div className="empty">Scanning cluster…</div>
        ) : !discovery.data?.length ? (
          <div className="empty">
            No unpublished services in queue. Hermes indexes all cluster services — check the Cluster page for the full
            catalog.
          </div>
        ) : (
          <div className="app-grid">
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
      </section>
    </>
  )
}
