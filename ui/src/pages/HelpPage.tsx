// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Link } from 'react-router-dom'
import { BookOpen, Compass, Globe, Rocket, Search } from 'lucide-react'
import { ZyvorInline } from '../components/ZyvorBrand'

export default function HelpPage() {
  return (
    <section className="glass-section help-page">
      <div className="section-head">
        <h2>Help</h2>
        <span className="chip chip-muted">Hermes Dock</span>
      </div>
      <p className="hero-sub">
        Hermes is the application layer of Zeus — discover, launch, and govern catalog apps across your cluster
        and federated peers.
      </p>

      <div className="help-grid">
        <article className="help-card">
          <h3>
            <Search size={16} /> Spotlight
          </h3>
          <p>
            Press <kbd>⌘K</kbd> anywhere to search apps, routes, and navigation. Prefixes:{' '}
            <code>owner:</code>, <code>env:</code>, <code>depends:</code>, <code>ai:</code>.
          </p>
        </article>
        <article className="help-card">
          <h3>
            <Rocket size={16} /> Launch apps
          </h3>
          <p>
            Published apps open through the gateway at <code>/launchpad/…</code>. Share links and canonical slugs
            are supported.
          </p>
        </article>
        <article className="help-card">
          <h3>
            <Compass size={16} /> Discovery
          </h3>
          <p>
            Annotate services with <code>hermes.zyvor.dev/*</code> labels or let Hermes infer routes from
            ingress, Gateway API, and service mesh policies.
          </p>
        </article>
        <article className="help-card">
          <h3>
            <Globe size={16} /> Federation
          </h3>
          <p>
            Configure <code>HERMES_FEDERATED_CLUSTERS</code> to merge remote catalogs, check RBAC, and publish
            across clusters when write federation is enabled.
          </p>
        </article>
      </div>

      <div className="help-links">
        <Link to="/discovery" className="btn">
          Open discovery
        </Link>
        <Link to="/activity" className="btn">
          View activity
        </Link>
        <a href="/api/v1/catalog" className="btn">
          Catalog API
        </a>
        <a href="https://github.com/ssahani/hermes" target="_blank" rel="noopener noreferrer" className="btn">
          <BookOpen size={14} /> Repository
        </a>
      </div>

      <p className="help-brand">
        <ZyvorInline /> · Hermes is part of the Zeus platform by ZyvorAI Labs
      </p>
    </section>
  )
}
