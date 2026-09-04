// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { IrisApp } from '../types'

const STORAGE_KEY = 'iris-workspace'

interface WorkspaceContextValue {
  workspaceId: string
  setWorkspaceId: (id: string) => void
  matchesWorkspace: (app: IrisApp) => boolean
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
    (app: IrisApp) => {
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

export function filterByWorkspace(apps: IrisApp[], workspaceId: string): IrisApp[] {
  if (!workspaceId) return apps
  return apps.filter((a) => a.meta?.environment === workspaceId)
}
