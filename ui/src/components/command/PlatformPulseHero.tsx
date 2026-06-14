// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { ChevronRight, GitBranch } from 'lucide-react'
import GlassPanel from '../nebula/GlassPanel'
import HealthRing, { healthTier } from '../nebula/HealthRing'
import Button from '../nebula/Button'

interface PlatformPulseHeroProps {
  greeting: string
  userId?: string
  serviceCount: number
  namespaceCount: number
  publishedCount: number
  healthy: number
  degraded: number
  broken: number
  aiHint?: string
  onResolveIssues?: () => void
}

export default function PlatformPulseHero({
  greeting,
  userId,
  serviceCount,
  namespaceCount,
  publishedCount,
  healthy,
  degraded,
  broken,
  aiHint,
  onResolveIssues,
}: PlatformPulseHeroProps) {
  const who = userId ? userId.split('@')[0] : 'operator'
  const attentionCount = broken + degraded
  const healthPct = serviceCount > 0 ? Math.round((healthy / serviceCount) * 100) : 100
  const tier = healthTier(healthPct)
  const auraClass = `aura-${tier}`

  const headline =
    broken > 0 || healthPct < 60
      ? 'Your platform needs attention.'
      : degraded > 0
        ? 'Your platform is degraded.'
        : healthPct >= 90
          ? 'Your platform is excellent.'
          : 'Your platform is stable.'

  return (
    <GlassPanel className={`hero-command-panel ${auraClass}`} data-testid="platform-pulse-hero">
      <div className="hero-aura" aria-hidden />
      <div className="hero-layout">
        <div className="hero-command-copy">
          <p className="page-kicker">
            {greeting}, {who}
          </p>
          <h1 className="page-title">{headline}</h1>
          <p className="hero-command-stats body-text">
            {serviceCount} discovered · {publishedCount} published · {namespaceCount} namespaces ·{' '}
            {attentionCount > 0 ? `${attentionCount} degraded` : `${healthy} healthy`}
          </p>
          {aiHint ? <p className="hero-command-ai-hint">{aiHint}</p> : null}
          <div className="hero-command-ctas">
            <Button variant="primary" href="#mission-control">
              Open Mission Control <ChevronRight size={14} />
            </Button>
            <Button variant="secondary" to="/cluster">
              Publish &amp; Cluster
            </Button>
            <Button variant="secondary" to="/graph">
              <GitBranch size={14} /> Topology
            </Button>
            {attentionCount > 0 ? (
              <Button variant="danger" onClick={onResolveIssues}>
                Review {attentionCount} Issues
              </Button>
            ) : null}
          </div>
        </div>
        <HealthRing healthy={healthy} total={serviceCount} attentionCount={attentionCount} />
      </div>
    </GlassPanel>
  )
}
