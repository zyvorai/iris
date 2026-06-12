// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AppCard from '../components/AppCard'
import { hermesApi } from '../services/hermesApi'

export default function DiscoveryPage() {
  const qc = useQueryClient()
  const discovery = useQuery({ queryKey: ['discovery'], queryFn: hermesApi.listDiscovery, refetchInterval: 15000 })
  const cluster = useQuery({ queryKey: ['cluster-summary'], queryFn: hermesApi.clusterSummary })

  const publish = useMutation({
    mutationFn: hermesApi.publish,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['discovery'] })
      void qc.invalidateQueries({ queryKey: ['apps'] })
      void qc.invalidateQueries({ queryKey: ['catalog'] })
      void qc.invalidateQueries({ queryKey: ['cluster-summary'] })
    },
  })

  const hide = useMutation({
    mutationFn: hermesApi.hide,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['discovery'] })
      void qc.invalidateQueries({ queryKey: ['catalog'] })
      void qc.invalidateQueries({ queryKey: ['cluster-summary'] })
    },
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
              <div key={app.id} className="discovery-card-wrap">
                <AppCard app={app} onPublish={() => publish.mutate(app.id)} />
                <button type="button" className="btn discovery-hide" onClick={() => hide.mutate(app.id)}>
                  Hide from discovery
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
