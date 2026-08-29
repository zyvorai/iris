// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Link } from 'react-router-dom'
import { healthTier } from '../nebula/HealthRing'

interface PlatformPulseHeroProps {
  greeting: string
  userId?: string
  serviceCount: number
  namespaceCount?: number
  publishedCount: number
  healthy: number
  degraded: number
  broken: number
  aiHint?: string
  onResolveIssues?: () => void
  onAskZyra?: () => void
}

export default function PlatformPulseHero({
  greeting,
  userId,
  serviceCount,
  publishedCount,
  healthy,
  degraded,
  broken,
  onResolveIssues,
}: PlatformPulseHeroProps) {
  const who = userId ? userId.split('@')[0] : 'operator'
  const attentionCount = broken + degraded
  const healthPct = serviceCount > 0 ? Math.round((healthy / serviceCount) * 100) : 100
  const tier = healthTier(healthPct)

  const headline =
    broken > 0 || healthPct < 60
      ? 'Your platform needs attention.'
      : degraded > 0
        ? 'Your platform is degraded.'
        : healthPct >= 90
          ? 'Your platform is excellent.'
          : 'Your platform is stable.'

  const lede =
    attentionCount > 0
      ? `${attentionCount} of ${serviceCount} services need a closer look.`
      : `${publishedCount} apps ready to launch across your cluster.`

  return (
    <section className="hs-hero hs-hero-center" data-testid="platform-pulse-hero" data-tier={tier}>
      <div className="hs-wrap">
        <p className="hs-eyebrow">
          {greeting}, {who}
        </p>
        <h1 className="h-hero">{headline}</h1>
        <p className="hs-lede hs-lede-center">{lede}</p>
        <div className="hs-btnrow hs-btnrow-center">
          {attentionCount > 0 ? (
            <button type="button" className="hs-btn-primary" onClick={onResolveIssues}>
              Review issues
            </button>
          ) : (
            <Link className="hs-btn-primary" to="/apps">
              Browse catalog
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
