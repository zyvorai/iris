// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import ClusterHealthOrb from './ClusterHealthOrb'

interface PlatformPulseHeroProps {
  greeting: string
  userId?: string
  serviceCount: number
  namespaceCount: number
  attentionCount: number
  healthy: number
  onResolveIssues?: () => void
}

export default function PlatformPulseHero({
  greeting,
  userId,
  serviceCount,
  namespaceCount,
  attentionCount,
  healthy,
  onResolveIssues,
}: PlatformPulseHeroProps) {
  const who = userId ? userId.split('@')[0] : 'operator'

  return (
    <section className="platform-pulse-hero zeus-glass" data-testid="platform-pulse-hero">
      <div className="platform-pulse-copy">
        <p className="hero-kicker">{greeting}</p>
        <h2 className="hero-title">
          {who}. Your platform is <em>alive</em>.
        </h2>
        <p className="hero-sub">
          {serviceCount} services across {namespaceCount} namespaces
          {attentionCount > 0 ? ` · ${attentionCount} need attention` : ' · all systems nominal'}.
        </p>
        <div className="platform-pulse-ctas">
          <a href="#mission-control" className="btn btn-primary">
            Open Mission Control <ChevronRight size={14} />
          </a>
          <Link to="/apps" className="btn">
            Browse Catalog
          </Link>
          {attentionCount > 0 ? (
            <button type="button" className="btn btn-warn" onClick={onResolveIssues}>
              Resolve {attentionCount} Issues
            </button>
          ) : null}
        </div>
      </div>
      <ClusterHealthOrb healthy={healthy} total={serviceCount} />
    </section>
  )
}
