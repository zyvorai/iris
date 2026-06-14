// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  'data-testid'?: string
}

export default function EmptyState({ icon, title, description, action, 'data-testid': testId }: EmptyStateProps) {
  return (
    <div className="glass-empty-state" data-testid={testId ?? 'empty-state'}>
      <div className="glass-empty-state-icon">{icon}</div>
      <h3 className="glass-empty-state-title">{title}</h3>
      {description ? <p className="glass-empty-state-desc">{description}</p> : null}
      {action ? <div className="glass-empty-state-action">{action}</div> : null}
    </div>
  )
}
