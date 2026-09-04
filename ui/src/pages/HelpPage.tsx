// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { BookOpen, Compass, Globe, Rocket, Search, Sparkles } from 'lucide-react'
import GlassPanel from '../components/nebula/GlassPanel'
import GlyphTile from '../components/nebula/GlyphTile'
import PageFrame from '../components/nebula/PageFrame'
import Button from '../components/nebula/Button'
import { ZyraAiBadge } from '../components/nebula/ZyraAiPanel'
import { ZyvorInline } from '../components/ZyvorBrand'
import { useAiStatus } from '../hooks/useZyraAiInsight'

export default function HelpPage() {
  const aiStatus = useAiStatus()

  return (
    <PageFrame loading={false} error={false} hasData onRetry={() => {}}>
      <div className="hs-page">
        <section className="hs-hero">
          <div className="hs-wrap">
            <p className="hs-eyebrow">Help</p>
            <h1 className="h-hero" style={{ maxWidth: '14ch' }}>Hermes guide</h1>
            <p className="hs-lede">
              Discover, launch, and govern catalog apps across your cluster and federated peers.
            </p>
          </div>
        </section>
      <div className="page-grid">
        <GlassPanel className="glass-panel-section">
          <div className="section-head-nebula">
            <GlyphTile tone="brand" icon={<BookOpen size={14} />} size="sm" />
            <div>
              <p className="hs-eyebrow">Reference</p>
              <h2 className="h-tile">How to use Hermes</h2>
            </div>
            {aiStatus.data ? <ZyraAiBadge source={aiStatus.data.llmConfigured ? 'llm' : 'rules'} /> : null}
          </div>

          <div className="help-grid" style={{ marginTop: '1.25rem' }}>
            <article className="hub-link-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span className="hub-icon-tile hub-icon-tile-1"><Search size={18} /></span>
              <h3>Spotlight</h3>
              <p>
                Press <kbd>⌘K</kbd> to search apps, routes, and navigation. Prefixes: <code>owner:</code>, <code>env:</code>, <code>depends:</code>, <code>ai:</code>
              </p>
              <p className="body-text" style={{ marginTop: '0.5rem' }}>
                Zyra AI commands: <code>explain</code>, <code>diagnose grafana</code>, <code>why grafana</code>, <code>suggest publish</code>, <code>graph insight</code>, <code>ns insight hermes-demo</code>, <code>owner insight platform</code>, <code>federated insight</code>, <code>activity insight</code>, <code>ai status</code>
              </p>
              <p className="body-text" style={{ marginTop: '0.5rem' }}>
                Actions: <code>open</code>, <code>publish</code>, <code>pin</code>, <code>refresh</code>, <code>export</code>, <code>attention</code>
              </p>
            </article>
            <article className="hub-link-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span className="hub-icon-tile hub-icon-tile-2"><Sparkles size={18} /></span>
              <h3>Zyra AI insights</h3>
              <p>
                {aiStatus.data?.llmConfigured
                  ? aiStatus.data.llmReachable === false
                    ? `LLM configured but unreachable${aiStatus.data.probeMessage ? `: ${aiStatus.data.probeMessage}` : ''}. Insights use rules fallback.`
                    : `Live LLM enabled (${aiStatus.data.model ?? 'configured model'}).`
                  : 'Rules engine active — set HERMES_LLM_API_URL for live LLM responses.'}
              </p>
              <p className="body-text" style={{ marginTop: '0.5rem' }}>
                Insight APIs cover fleet, app, discovery, namespace, graph topology, and team owner rollups. Surfaces include Home, Health, Activity, Discovery, Cluster, Graph, Teams, Spaces, Federated, Diagnose drawer, and inspector AI tab.
              </p>
            </article>
            <article className="hub-link-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span className="hub-icon-tile hub-icon-tile-3"><Rocket size={18} /></span>
              <h3>Launch apps</h3>
              <p>Published apps open through the gateway at /launchpad/…</p>
            </article>
            <article className="hub-link-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span className="hub-icon-tile hub-icon-tile-4"><Compass size={18} /></span>
              <h3>Discovery</h3>
              <p>Annotate services with hermes.zyvor.dev/* labels or let Hermes infer routes.</p>
            </article>
            <article className="hub-link-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span className="hub-icon-tile hub-icon-tile-5"><Globe size={18} /></span>
              <h3>Federation</h3>
              <p>Configure HERMES_FEDERATED_CLUSTERS to merge remote catalogs.</p>
            </article>
          </div>

          <div className="action-row" style={{ marginTop: '1.25rem' }}>
            <Button variant="secondary" to="/discovery">Open discovery</Button>
            <Button variant="secondary" to="/activity">View activity</Button>
            <Button variant="ghost" href="/api/v1/insights/status">AI status API</Button>
            <Button variant="ghost" href="/api/v1/catalog">Catalog API</Button>
            <Button variant="ghost" href="https://github.com/zyvorai/hermes" target="_blank" rel="noopener noreferrer">
              <BookOpen size={14} /> Repository
            </Button>
          </div>

          <p className="body-text help-brand" style={{ marginTop: '1.5rem' }}>
            <ZyvorInline /> · Hermes is part of the Zeus platform by ZyvorAI Labs
          </p>
        </GlassPanel>
      </div>
      </div>
    </PageFrame>
  )
}
