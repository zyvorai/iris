// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import GlassPanel from './GlassPanel'

interface MetricCardProps {
  icon: LucideIcon
  label: string
  value: string
  sub?: string
  to?: string
  warn?: boolean
}

export default function MetricCard({ icon: Icon, label, value, sub, to, warn }: MetricCardProps) {
  const panel = (
    <GlassPanel className={`metric-card${warn ? ' metric-card-warn' : ''}`}>
      <div className="metric-card-head">
        <Icon size={14} aria-hidden />
        <span>{label}</span>
      </div>
      <p className="metric-card-value">{value}</p>
      {sub ? <p className="metric-card-sub">{sub}</p> : null}
    </GlassPanel>
  )

  if (to) {
    return (
      <Link to={to} className="metric-card-link">
        {panel}
      </Link>
    )
  }

  return <div className="metric-card-link">{panel}</div>
}
