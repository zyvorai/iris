// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

interface ClusterHealthOrbProps {
  healthy: number
  total: number
}

export default function ClusterHealthOrb({ healthy, total }: ClusterHealthOrbProps) {
  const pct = total > 0 ? Math.round((healthy / Math.max(total, 1)) * 100) : 100
  const tone = pct >= 95 ? 'ok' : pct >= 80 ? 'warn' : 'bad'

  return (
    <div className={`cluster-health-orb tone-${tone}`} data-testid="cluster-health-orb" aria-label={`Cluster health ${pct} percent`}>
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
