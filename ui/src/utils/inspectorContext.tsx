// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface InspectorContextValue {
  appId: string | null
  diagnoseAppId: string | null
  openInspector: (appId: string) => void
  closeInspector: () => void
  openDiagnose: (appId: string) => void
  closeDiagnose: () => void
}

const InspectorContext = createContext<InspectorContextValue | null>(null)

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [appId, setAppId] = useState<string | null>(null)
  const [diagnoseAppId, setDiagnoseAppId] = useState<string | null>(null)

  const openInspector = useCallback((id: string) => {
    setDiagnoseAppId(null)
    setAppId(id)
  }, [])

  const closeInspector = useCallback(() => setAppId(null), [])

  const openDiagnose = useCallback((id: string) => {
    setAppId(null)
    setDiagnoseAppId(id)
  }, [])

  const closeDiagnose = useCallback(() => setDiagnoseAppId(null), [])

  const value = useMemo(
    () => ({ appId, diagnoseAppId, openInspector, closeInspector, openDiagnose, closeDiagnose }),
    [appId, diagnoseAppId, openInspector, closeInspector, openDiagnose, closeDiagnose],
  )
  return <InspectorContext.Provider value={value}>{children}</InspectorContext.Provider>
}

export function useInspector() {
  const ctx = useContext(InspectorContext)
  if (!ctx) throw new Error('useInspector must be used within InspectorProvider')
  return ctx
}
