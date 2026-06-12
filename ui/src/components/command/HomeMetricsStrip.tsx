// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Link } from 'react-router-dom'
import { AlertTriangle, Globe, Layers, Rocket } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface MetricTileProps {
  icon: LucideIcon
  label: string
  value: string
  sub?: string
  to: string
  warn?: boolean
}

function MetricTile({ icon: Icon, label, value, sub, to, warn }: MetricTileProps) {
  return (
    <Link
      to={to}
      className={`home-metric-tile zeus-glass${warn ? ' home-metric-tile-warn' : ''}`}
    >
      <div className="home-metric-head">
        <Icon size={14} aria-hidden />
        <span>{label}</span>
      </div>
      <p className="home-metric-value">{value}</p>
      {sub ? <p className="home-metric-sub">{sub}</p> : null}
    </Link>
  )
}

interface HomeMetricsStripProps {
  serviceCount: number
  publishedCount: number
  namespaceCount: number
  issueCount: number
  brokenCount: number
}

export default function HomeMetricsStrip({
  serviceCount,
  publishedCount,
  namespaceCount,
  issueCount,
  brokenCount,
}: HomeMetricsStripProps) {
  const unpublished = Math.max(0, serviceCount - publishedCount)

  return (
    <div className="home-metrics-strip" data-testid="home-metrics-strip">
      <MetricTile
        icon={Layers}
        label="Discovered"
        value={String(serviceCount)}
        sub={`${namespaceCount} namespaces`}
        to="/cluster"
      />
      <MetricTile
        icon={Rocket}
        label="Published"
        value={String(publishedCount)}
        sub={unpublished > 0 ? `${unpublished} awaiting publish` : 'Launchpad ready'}
        to="/cluster"
        warn={unpublished > serviceCount * 0.5 && serviceCount > 0}
      />
      <MetricTile
        icon={AlertTriangle}
        label="Needs attention"
        value={String(issueCount)}
        sub={brokenCount > 0 ? `${brokenCount} broken` : issueCount > 0 ? 'Degraded services' : 'All clear'}
        to="/health"
        warn={issueCount > 0}
      />
      <MetricTile
        icon={Globe}
        label="Topology"
        value={String(publishedCount)}
        sub="Published graph nodes"
        to="/graph"
      />
    </div>
  )
}
