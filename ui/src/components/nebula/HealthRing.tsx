// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useCountUp } from '../../hooks/useCountUp'

export type HealthTier = 'excellent' | 'stable' | 'warning' | 'critical'

export function healthTier(pct: number): HealthTier {
  if (pct >= 90) return 'excellent'
  if (pct >= 75) return 'stable'
  if (pct >= 60) return 'warning'
  return 'critical'
}

export function healthTierLabel(tier: HealthTier): string {
  switch (tier) {
    case 'excellent':
      return 'Excellent'
    case 'stable':
      return 'Stable'
    case 'warning':
      return 'Needs attention'
    case 'critical':
      return 'Critical'
  }
}

interface HealthRingProps {
  healthy: number
  total: number
  attentionCount?: number
}

/** Compact proof — typography only. */
export default function HealthRing({ healthy, total, attentionCount = 0 }: HealthRingProps) {
  const pct = total > 0 ? Math.round((healthy / total) * 100) : 100
  const tier = healthTier(pct)
  const needsAttention = attentionCount > 0 ? attentionCount : total - healthy
  const animatedPct = Math.round(useCountUp(pct, 900))

  return (
    <div
      className={`hs-proof tone-${tier}`}
      data-testid="cluster-health-orb"
      aria-label={`Cluster health ${pct} percent, ${healthTierLabel(tier)}`}
    >
      <strong className="hs-proof-value">{animatedPct}%</strong>
      <span className="hs-proof-label">{healthTierLabel(tier)}</span>
      <span className="hs-proof-sub">
        {healthy}/{total} healthy
        {needsAttention > 0 ? ` · ${needsAttention} need attention` : ''}
      </span>
    </div>
  )
}
