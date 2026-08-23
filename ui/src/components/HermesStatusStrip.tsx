// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { hermesApi } from '../services/hermesApi'

function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  return `${m}m ago`
}

/** Pinned bottom status strip — the mockup's persistent live-status bar.
 * Reuses the cluster-summary query already polled every 15s elsewhere
 * (React Query dedupes the request, so this is free). */
export default function HermesStatusStrip() {
  const cluster = useQuery({ queryKey: ['cluster-summary'], queryFn: hermesApi.clusterSummary, refetchInterval: 15000 })
  const [, forceTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 15000)
    return () => clearInterval(t)
  }, [])

  const healthy = cluster.data?.healthy ?? 0
  const broken = cluster.data?.broken ?? 0
  const degraded = cluster.data?.degraded ?? 0
  const total = cluster.data?.total ?? 0
  const tone = broken > 0 ? 'bad' : degraded > 0 ? 'warn' : 'ok'

  return (
    <div className="hermes-status-strip" data-testid="hermes-status-strip">
      <span className="hermes-strip-dot" data-tone={tone} aria-hidden />
      <span className="hermes-strip-item">
        {healthy}/{total} healthy
      </span>
      {broken > 0 ? <span className="hermes-strip-item hermes-strip-bad">{broken} broken</span> : null}
      {degraded > 0 ? <span className="hermes-strip-item hermes-strip-warn">{degraded} degraded</span> : null}
      <span className="hermes-strip-spacer" />
      <span className="hermes-strip-item hermes-strip-muted">
        {cluster.dataUpdatedAt ? `Updated ${timeAgo(cluster.dataUpdatedAt)}` : 'Connecting…'}
      </span>
      <Link to="/health" className="hermes-strip-link">
        Health
      </Link>
    </div>
  )
}
