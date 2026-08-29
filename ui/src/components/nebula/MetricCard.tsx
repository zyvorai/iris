// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { useCountUp } from '../../hooks/useCountUp'

export type MetricCardTone = 'blue' | 'green' | 'purple' | 'cyan' | 'pink' | 'orange'

interface MetricCardProps {
  icon?: LucideIcon
  label: string
  value: string
  sub?: string
  to?: string
  warn?: boolean
  tone?: MetricCardTone
}

/** Apple-style proof cell — typography only, optional icon ignored for quiet chrome. */
export default function MetricCard({ label, value, sub, to, warn }: MetricCardProps) {
  const numeric = Number(value)
  const isNumeric = value.trim() !== '' && Number.isFinite(numeric)
  const animated = useCountUp(isNumeric ? numeric : 0)
  const display = isNumeric ? String(Math.round(animated)) : value
  const body = (
    <div className={`hs-stat${warn ? ' hs-stat-warn' : ''}`}>
      <p className="hs-stat-value">{display}</p>
      <p className="hs-stat-label">{label}</p>
      {sub ? <p className="hs-stat-sub">{sub}</p> : null}
    </div>
  )

  if (to) {
    return (
      <Link to={to} className="hs-stat-link">
        {body}
      </Link>
    )
  }

  return <div className="hs-stat-link">{body}</div>
}
