// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const routes: Record<string, string> = {
  '1': '/',
  '2': '/apps',
  '3': '/spaces',
  '4': '/cluster',
  '5': '/discovery',
  '6': '/health',
  '7': '/graph',
  '8': '/activity',
  '9': '/help',
}

export function useGlobalNavShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      const path = routes[e.key]
      if (!path) return
      e.preventDefault()
      navigate(path)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
}
