// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

interface ClusterHealthOrbProps {
  healthy: number
  total: number
  degraded?: number
  broken?: number
}

const R = 54
const C = 2 * Math.PI * R

export default function ClusterHealthOrb({ healthy, total, degraded = 0, broken = 0 }: ClusterHealthOrbProps) {
  const pct = total > 0 ? Math.round((healthy / Math.max(total, 1)) * 100) : 100
  const tone = broken > 0 ? 'bad' : degraded > 0 || pct < 80 ? 'warn' : 'ok'
  const offset = C - (pct / 100) * C

  return (
    <div className={`cluster-health-orb tone-${tone}`} data-testid="cluster-health-orb" aria-label={`Cluster health ${pct} percent`}>
      <svg className="cluster-health-orb-ring" viewBox="0 0 120 120" aria-hidden>
        <circle className="cluster-health-orb-track" cx="60" cy="60" r={R} />
        <circle
          className="cluster-health-orb-progress"
          cx="60"
          cy="60"
          r={R}
          strokeDasharray={C}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="cluster-health-orb-core">
        <strong>{pct}%</strong>
        <span>CLUSTER HEALTH</span>
        <small className="cluster-health-orb-sub">
          {healthy}/{total} healthy
        </small>
      </div>
    </div>
  )
}
