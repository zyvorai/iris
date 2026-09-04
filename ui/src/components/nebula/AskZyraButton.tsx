// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { Sparkles } from 'lucide-react'
import Button from './Button'
import { useSpotlight } from '../../utils/spotlightContext'

interface AskZyraButtonProps {
  command: string
  compact?: boolean
  className?: string
}

export default function AskZyraButton({ command, compact, className = '' }: AskZyraButtonProps) {
  const { openSpotlight } = useSpotlight()

  return (
    <Button
      variant="ai"
      data-testid="ask-zyra-btn"
      className={`${compact ? 'nebula-btn-compact' : ''} ${className}`.trim()}
      onClick={() => openSpotlight(command)}
    >
      <Sparkles size={15} strokeWidth={1.5} /> Ask Zyra
    </Button>
  )
}
