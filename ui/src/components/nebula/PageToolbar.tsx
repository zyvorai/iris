// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react'

interface PageToolbarProps {
  children: ReactNode
  className?: string
  'data-testid'?: string
}

export default function PageToolbar({ children, className = '', 'data-testid': testId }: PageToolbarProps) {
  return (
    <div className={`glass-toolbar page-toolbar ${className}`.trim()} data-testid={testId ?? 'page-toolbar'}>
      {children}
    </div>
  )
}
