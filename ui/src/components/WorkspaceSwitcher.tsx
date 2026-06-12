// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useQuery } from '@tanstack/react-query'
import { Layers } from 'lucide-react'
import { hermesApi, environmentLabel } from '../services/hermesApi'
import { useWorkspace } from '../utils/workspaceContext'

export default function WorkspaceSwitcher() {
  const { workspaceId, setWorkspaceId } = useWorkspace()
  const workspaces = useQuery({ queryKey: ['workspaces'], queryFn: hermesApi.listWorkspaces })

  if (!workspaces.data?.length) return null

  return (
    <div className="workspace-switcher" data-testid="workspace-switcher">
      <Layers size={14} aria-hidden />
      <button
        type="button"
        className={`workspace-chip ${workspaceId === '' ? 'active' : ''}`}
        onClick={() => setWorkspaceId('')}
      >
        All
      </button>
      {workspaces.data.map((ws) => (
        <button
          key={ws.id}
          type="button"
          className={`workspace-chip ${workspaceId === ws.id ? 'active' : ''}`}
          onClick={() => setWorkspaceId(ws.id)}
          title={`${ws.appCount} apps · ${ws.healthy} healthy`}
        >
          {environmentLabel(ws.label)}
          <span className="workspace-count">{ws.appCount}</span>
        </button>
      ))}
    </div>
  )
}
