// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { HermesApp } from '../types'

const STORAGE_KEY = 'hermes-workspace'

interface WorkspaceContextValue {
  workspaceId: string
  setWorkspaceId: (id: string) => void
  matchesWorkspace: (app: HermesApp) => boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function readStoredWorkspace(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setWorkspaceIdState] = useState(readStoredWorkspace)

  const setWorkspaceId = useCallback((id: string) => {
    setWorkspaceIdState(id)
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const matchesWorkspace = useCallback(
    (app: HermesApp) => {
      if (!workspaceId) return true
      return app.meta?.environment === workspaceId
    },
    [workspaceId],
  )

  const value = useMemo(
    () => ({ workspaceId, setWorkspaceId, matchesWorkspace }),
    [workspaceId, setWorkspaceId, matchesWorkspace],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}

export function filterByWorkspace(apps: HermesApp[], workspaceId: string): HermesApp[] {
  if (!workspaceId) return apps
  return apps.filter((a) => a.meta?.environment === workspaceId)
}
