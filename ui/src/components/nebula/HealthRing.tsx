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
      return 'EXCELLENT'
    case 'stable':
      return 'STABLE'
    case 'warning':
      return 'WARNING'
    case 'critical':
      return 'CRITICAL'
  }
}

const R = 84
const C = 2 * Math.PI * R

interface HealthRingProps {
  healthy: number
  total: number
  attentionCount?: number
}

export default function HealthRing({ healthy, total, attentionCount = 0 }: HealthRingProps) {
  const pct = total > 0 ? Math.round((healthy / total) * 100) : 100
  const tier = healthTier(pct)
  const offset = C - (pct / 100) * C
  const needsAttention = attentionCount > 0 ? attentionCount : total - healthy
  const animatedPct = Math.round(useCountUp(pct, 900))

  return (
    <div className="health-ring-wrap">
      <div
        className={`health-ring tone-${tier}`}
        data-testid="cluster-health-orb"
        aria-label={`Cluster health ${pct} percent, ${healthTierLabel(tier)}`}
      >
        <svg className="health-ring-ring" viewBox="0 0 190 190" aria-hidden>
          <circle className="health-ring-track" cx="95" cy="95" r={R} />
          <circle
            className="health-ring-progress"
            cx="95"
            cy="95"
            r={R}
            strokeDasharray={C}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="health-ring-core">
          <span className="health-ring-label">{healthTierLabel(tier)}</span>
          <strong className="health-ring-pct">{animatedPct}%</strong>
          <span className="health-ring-subtitle">cluster health</span>
        </div>
      </div>
      <p className="health-ring-stats">
        {healthy}/{total} healthy
        {needsAttention > 0 ? (
          <>
            <br />
            {needsAttention} require attention
          </>
        ) : null}
      </p>
    </div>
  )
}
