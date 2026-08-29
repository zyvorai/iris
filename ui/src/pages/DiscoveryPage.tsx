// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Compass, Rocket } from 'lucide-react'
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
import { hermesApi } from '../services/hermesApi'
import { useDiscoveryInsight } from '../hooks/useZyraAiInsight'
import { refreshHermesData } from '../utils/refreshCatalog'
import { useStatusFlip } from '../hooks/useStatusFlip'
import { useToast } from '../components/Toast'

export default function DiscoveryPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const discovery = useQuery({ queryKey: ['discovery'], queryFn: hermesApi.listDiscovery, refetchInterval: 15000 })
  const cluster = useQuery({ queryKey: ['cluster-summary'], queryFn: hermesApi.clusterSummary })

  const publish = useMutation({
    mutationFn: hermesApi.publish,
    onSuccess: () => {
      void refreshHermesData(qc)
      toast('Service published')
    },
    onError: () => toast('Could not publish service', 'error'),
  })

  const loading = discovery.isLoading && !discovery.data
  const discoveryInsight = useDiscoveryInsight(Boolean(discovery.data?.length))

  const publishAll = useMutation({
    mutationFn: async () => {
      const apps = discovery.data ?? []
      for (const app of apps.slice(0, 25)) {
        await hermesApi.publish(app.id)
      }
      return apps.length
    },
    onSuccess: (count) => {
      void refreshHermesData(qc)
      toast(`Published ${count} service${count === 1 ? '' : 's'}`)
    },
    onError: () => toast('Could not publish services', 'error'),
  })

  const publishZyraPicks = useMutation({
    mutationFn: async () => {
      const ids = discoveryInsight.data?.suggestPublishIds ?? []
      for (const id of ids.slice(0, 10)) {
        await hermesApi.publish(id)
      }
      return ids.length
    },
    onSuccess: (count) => {
      void refreshHermesData(qc)
      toast(`Published ${count} Zyra-picked service${count === 1 ? '' : 's'}`)
    },
    onError: () => toast('Could not publish Zyra picks', 'error'),
  })

  const hide = useMutation({
    mutationFn: hermesApi.hide,
    onSuccess: () => {
      void refreshHermesData(qc)
      toast('Hidden from discovery')
    },
    onError: () => toast('Could not hide service', 'error'),
  })

  const flipped = useStatusFlip(discovery.data ?? [])

  return (
    <PageFrame
      loading={loading}
      error={discovery.isError}
      hasData={Boolean(discovery.data)}
      onRetry={() => void discovery.refetch()}
      errorTitle="Could not load discovery queue"
    >
      <div className="hs-page">
        <section className="hs-hero">
          <div className="hs-wrap">
            <p className="hs-eyebrow">Discovery</p>
            <h1 className="h-hero" style={{ maxWidth: '14ch' }}>Discovery queue</h1>
            <p className="hs-lede">
              {cluster.data?.discovery ?? '—'} unpublished services across {cluster.data?.namespaces ?? '—'} namespaces.
            </p>
          </div>
        </section>
      <div className="page-grid">
        {discovery.data?.length ? (
          <GlassPanel className="glass-panel-section">
            <div className="section-head-nebula">
              <GlyphTile tone="brand" icon={<Compass size={14} />} size="sm" />
              <div>
                <p className="hs-eyebrow">Actions</p>
                <h2 className="h-tile">Publish controls</h2>
              </div>
              <AskZyraButton compact command="suggest publish" />
              {discoveryInsight.data?.suggestPublishIds?.length ? (
                <Button
                  variant="ai"
                  className="nebula-btn-compact"
                  disabled={publishZyraPicks.isPending}
                  onClick={() => void publishZyraPicks.mutate()}
                  data-testid="publish-zyra-picks"
                >
                  Publish Zyra picks ({Math.min(discoveryInsight.data.suggestPublishIds.length, 10)})
                </Button>
              ) : null}
              <Button variant="primary" className="nebula-btn-compact" disabled={publishAll.isPending} onClick={() => void publishAll.mutate()}>
                <Rocket size={14} /> Publish first {Math.min(discovery.data.length, 25)}
              </Button>
            </div>
          </GlassPanel>
        ) : null}

        {discovery.data?.length ? (
          <ZyraAiPanel
            title="Publish suggestions"
            summary={discoveryInsight.data?.summary}
            explanation={discoveryInsight.data?.explanation ?? 'Zyra AI is ranking unpublished services…'}
            source={discoveryInsight.data?.source}
            remediation={discoveryInsight.data?.highlights}
            loading={discoveryInsight.isLoading}
            compact
            onRefresh={() => void discoveryInsight.refetch()}
            refreshing={discoveryInsight.isFetching && !discoveryInsight.isLoading}
            action={
              <ZyraAiFocusChips
                appIds={discoveryInsight.data?.suggestPublishIds ?? []}
                catalog={discovery.data}
                onSelect={(id) => publish.mutate(id)}
                label="Publish"
              />
            }
          />
        ) : null}

        <GlassPanel className="glass-panel-section">
          <p className="section-label">Unpublished services</p>
          {!discovery.data?.length ? (
            <EmptyState
              icon={<Compass size={22} />}
              title="Queue is empty"
              description="All discovered services are published. Check Cluster for the full inventory."
              tone="ok"
            />
          ) : (
            <Board style={{ marginTop: '1rem' }}>
              {discovery.data.map((app) => (
                <DeparturesRow
                  key={app.id}
                  app={app}
                  flipped={flipped.has(app.id)}
                  onPublish={() => publish.mutate(app.id)}
                  onHide={() => hide.mutate(app.id)}
                />
              ))}
            </Board>
          )}
        </GlassPanel>
      </div>
      </div>
    </PageFrame>
  )
}
