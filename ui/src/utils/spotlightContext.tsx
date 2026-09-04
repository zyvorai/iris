// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface SpotlightContextValue {
  open: boolean
  seed: string
  openSpotlight: (query?: string) => void
  closeSpotlight: () => void
}

const SpotlightContext = createContext<SpotlightContextValue | null>(null)

export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [seed, setSeed] = useState('')

  const openSpotlight = useCallback((query = '') => {
    setSeed(query)
    setOpen(true)
  }, [])

  const closeSpotlight = useCallback(() => {
    setOpen(false)
    setSeed('')
  }, [])

  const value = useMemo(
    () => ({ open, seed, openSpotlight, closeSpotlight }),
    [open, seed, openSpotlight, closeSpotlight],
  )

  return <SpotlightContext.Provider value={value}>{children}</SpotlightContext.Provider>
}

export function useSpotlight() {
  const ctx = useContext(SpotlightContext)
  if (!ctx) throw new Error('useSpotlight must be used within SpotlightProvider')
  return ctx
}
