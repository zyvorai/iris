// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import GlassPanel from './GlassPanel'
import { useCountUp } from '../../hooks/useCountUp'

export type MetricCardTone = 'blue' | 'green' | 'purple' | 'cyan' | 'pink' | 'orange'

interface MetricCardProps {
  icon: LucideIcon
  label: string
  value: string
  sub?: string
  to?: string
  warn?: boolean
  tone?: MetricCardTone
}

export default function MetricCard({ icon: Icon, label, value, sub, to, warn, tone }: MetricCardProps) {
  const toneClass = warn ? 'metric-card-warn' : tone ? `metric-card-tone-${tone}` : ''
  const numeric = Number(value)
  const isNumeric = value.trim() !== '' && Number.isFinite(numeric)
  const animated = useCountUp(isNumeric ? numeric : 0)
  const display = isNumeric ? String(Math.round(animated)) : value
  const panel = (
    <GlassPanel className={`metric-card${toneClass ? ` ${toneClass}` : ''}`}>
      <div className="metric-card-head">
        <span className="metric-card-icon" aria-hidden>
          <Icon size={13} />
        </span>
        <span>{label}</span>
      </div>
      <p className="metric-card-value">{display}</p>
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
