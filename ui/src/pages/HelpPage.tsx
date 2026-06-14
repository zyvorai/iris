// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { BookOpen, Compass, Globe, Rocket, Search, Sparkles } from 'lucide-react'
import GlassPanel from '../components/nebula/GlassPanel'
import PageFrame from '../components/nebula/PageFrame'
import Button from '../components/nebula/Button'
import { ZyvorInline } from '../components/ZyvorBrand'

export default function HelpPage() {
  return (
    <PageFrame loading={false} error={false} hasData onRetry={() => {}}>
      <div className="page-grid">
        <GlassPanel className="glass-panel-section">
          <div className="section-head-nebula">
            <div>
              <p className="section-label">Help</p>
              <h2 className="section-title">Hermes guide</h2>
              <p className="body-text">
                Discover, launch, and govern catalog apps across your cluster and federated peers.
              </p>
            </div>
          </div>

          <div className="help-grid" style={{ marginTop: '1.25rem' }}>
            <article className="hub-link-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <Search size={18} />
              <h3>Spotlight</h3>
              <p>
                Press <kbd>⌘K</kbd> to search apps, routes, and navigation. Prefixes: owner:, env:, depends:, ai:
              </p>
              <p className="body-text" style={{ marginTop: '0.5rem' }}>
                Commands: <code>diagnose grafana</code> (AI insight preview), <code>explain</code> (fleet summary),
                <code>open</code>, <code>publish</code>, <code>pin</code>, <code>refresh</code>, <code>export</code>.
              </p>
              <p className="body-text" style={{ marginTop: '0.5rem' }}>
                Natural-language queries use Zeus AI when HERMES_LLM_API_URL is configured; otherwise Hermes falls back to rule-based intent search.
              </p>
            </article>
            <article className="hub-link-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <Sparkles size={18} />
              <h3>Zeus AI insights</h3>
              <p>
                Per-app insight and fleet summaries power Ask Zeus AI, Diagnose drawer, Home, Health, Activity, and Graph focus chips.
              </p>
            </article>
            <article className="hub-link-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <Rocket size={18} />
              <h3>Launch apps</h3>
              <p>Published apps open through the gateway at /launchpad/…</p>
            </article>
            <article className="hub-link-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <Compass size={18} />
              <h3>Discovery</h3>
              <p>Annotate services with hermes.zyvor.dev/* labels or let Hermes infer routes.</p>
            </article>
            <article className="hub-link-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <Globe size={18} />
              <h3>Federation</h3>
              <p>Configure HERMES_FEDERATED_CLUSTERS to merge remote catalogs.</p>
            </article>
          </div>

          <div className="action-row" style={{ marginTop: '1.25rem' }}>
            <Button variant="secondary" to="/discovery">Open discovery</Button>
            <Button variant="secondary" to="/activity">View activity</Button>
            <Button variant="ghost" href="/api/v1/catalog">Catalog API</Button>
            <Button variant="ghost" href="https://github.com/ssahani/hermes" target="_blank" rel="noopener noreferrer">
              <BookOpen size={14} /> Repository
            </Button>
          </div>

          <p className="body-text help-brand" style={{ marginTop: '1.5rem' }}>
            <ZyvorInline /> · Hermes is part of the Zeus platform by ZyvorAI Labs
          </p>
        </GlassPanel>
      </div>
    </PageFrame>
  )
}
