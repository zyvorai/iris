// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { AlertTriangle, Layers, Rocket } from 'lucide-react'
import MetricCard from '../nebula/MetricCard'

interface HomeFleetSnapshotProps {
  serviceCount: number
  publishedCount: number
  namespaceCount: number
  issueCount: number
  brokenCount: number
}

export default function HomeFleetSnapshot({
  serviceCount,
  publishedCount,
  namespaceCount,
  issueCount,
  brokenCount,
}: HomeFleetSnapshotProps) {
  const unpublished = Math.max(0, serviceCount - publishedCount)

  return (
    <div className="metric-strip" data-testid="home-metrics-strip">
      <MetricCard
        icon={Layers}
        label="Discovered"
        value={String(serviceCount)}
        sub={`${namespaceCount} namespaces`}
        to="/cluster"
      />
      <MetricCard
        icon={Rocket}
        label="Published"
        value={String(publishedCount)}
        sub={unpublished > 0 ? `${unpublished} awaiting publish` : 'Launchpad ready'}
        to="/cluster"
        warn={unpublished > serviceCount * 0.5 && serviceCount > 0}
      />
      <MetricCard
        icon={AlertTriangle}
        label="Needs Attention"
        value={String(issueCount)}
        sub={brokenCount > 0 ? `${brokenCount} broken` : issueCount > 0 ? 'Degraded services' : 'All clear'}
        to="/health"
        warn={issueCount > 0}
      />
    </div>
  )
}
