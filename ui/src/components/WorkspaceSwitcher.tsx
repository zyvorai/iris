// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useQuery } from '@tanstack/react-query'
import { Layers, Lock } from 'lucide-react'
import { hermesApi, environmentLabel } from '../services/hermesApi'
import { useWorkspace } from '../utils/workspaceContext'

export default function WorkspaceSwitcher() {
  const { workspaceId, setWorkspaceId } = useWorkspace()
  const workspaces = useQuery({ queryKey: ['workspaces'], queryFn: hermesApi.listWorkspaces })
  const clusters = useQuery({ queryKey: ['clusters'], queryFn: hermesApi.listClusters })
  const auth = useQuery({ queryKey: ['auth-me'], queryFn: hermesApi.authMe })
  const allowed = auth.data?.allowedWorkspaces ?? []

  if (!workspaces.data?.length && !clusters.data?.length) return null

  const isRestricted = (env: string) =>
    allowed.length > 0 && !allowed.some((a) => a.toLowerCase() === env.toLowerCase())

  return (
    <div className="workspace-switcher zeus-cluster-switcher" data-testid="workspace-switcher">
      <Layers size={14} aria-hidden />
      <span className="zeus-switcher-label">Cluster</span>
      <button
        type="button"
        className={`workspace-chip ${workspaceId === '' ? 'active' : ''}`}
        onClick={() => setWorkspaceId('')}
      >
        All
      </button>
      {workspaces.data?.map((ws) => (
        <button
          key={ws.id}
          type="button"
          className={`workspace-chip ${workspaceId === ws.id ? 'active' : ''} ${isRestricted(ws.id) ? 'workspace-locked' : ''}`}
          onClick={() => setWorkspaceId(ws.id)}
          title={`${ws.appCount} apps · ${ws.healthy} healthy${isRestricted(ws.id) ? ' · restricted' : ''}`}
          disabled={isRestricted(ws.id)}
        >
          {environmentLabel(ws.label)}
          {isRestricted(ws.id) ? <Lock size={10} aria-hidden /> : null}
          <span className="workspace-count">{ws.appCount}</span>
        </button>
      ))}
      {clusters.data?.filter((c) => !c.isLocal).length ? (
        <div className="zeus-federated-clusters">
          {clusters.data
            ?.filter((c) => !c.isLocal)
            .map((cluster) => (
              <span key={cluster.id} className="workspace-chip federated" title={`${cluster.appCount} apps · ${cluster.healthy} healthy`}>
                {cluster.status === 'online' ? <span className="zeus-live-dot" aria-hidden /> : null}
                {cluster.name}
                <span className="workspace-count">{cluster.appCount}</span>
              </span>
            ))}
        </div>
      ) : null}
    </div>
  )
}
