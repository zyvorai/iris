// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface InspectorContextValue {
  appId: string | null
  openInspector: (appId: string) => void
  closeInspector: () => void
}

const InspectorContext = createContext<InspectorContextValue | null>(null)

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [appId, setAppId] = useState<string | null>(null)
  const openInspector = useCallback((id: string) => setAppId(id), [])
  const closeInspector = useCallback(() => setAppId(null), [])
  const value = useMemo(
    () => ({ appId, openInspector, closeInspector }),
    [appId, openInspector, closeInspector],
  )
  return <InspectorContext.Provider value={value}>{children}</InspectorContext.Provider>
}

export function useInspector() {
  const ctx = useContext(InspectorContext)
  if (!ctx) throw new Error('useInspector must be used within InspectorProvider')
  return ctx
}
