// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

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
