// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Layers, Lock } from 'lucide-react'
import { hermesApi, environmentLabel } from '../services/hermesApi'
import { useWorkspace } from '../utils/workspaceContext'
import { environmentTone as workspaceTone } from '../utils/environmentTone'

export default function WorkspaceSwitcher() {
  const { workspaceId, setWorkspaceId } = useWorkspace()
  const workspaces = useQuery({ queryKey: ['workspaces'], queryFn: hermesApi.listWorkspaces })
  const clusters = useQuery({ queryKey: ['clusters'], queryFn: hermesApi.listClusters })
  const auth = useQuery({ queryKey: ['auth-me'], queryFn: hermesApi.authMe })
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const allowed = auth.data?.allowedWorkspaces ?? []

  useEffect(() => {
    if (!dropdownOpen) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [dropdownOpen])

  if (!workspaces.data?.length && !clusters.data?.length) {
    return (
      <div className="workspace-switcher workspace-switcher-compact zeus-cluster-switcher" ref={ref} data-testid="workspace-switcher">
        <Layers size={14} aria-hidden />
        <button type="button" className="workspace-chip active" onClick={() => setDropdownOpen((v) => !v)}>
          All
          <ChevronDown size={12} className={dropdownOpen ? 'hermes-nb-chevron-open' : ''} />
        </button>
        {dropdownOpen ? (
          <div className="workspace-dropdown-menu">
            <button type="button" className="workspace-dropdown-item active" onClick={() => { setWorkspaceId(''); setDropdownOpen(false) }}>
              All environments
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  const isRestricted = (env: string) =>
    allowed.length > 0 && !allowed.some((a) => a.toLowerCase() === env.toLowerCase())

  const activeLabel = workspaceId
    ? environmentLabel(workspaces.data?.find((w) => w.id === workspaceId)?.label ?? workspaceId)
    : 'All'

  const chipList = (
    <>
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
          data-tone={workspaceTone(ws.label)}
          onClick={() => setWorkspaceId(ws.id)}
          title={`${ws.appCount} apps · ${ws.healthy} healthy${isRestricted(ws.id) ? ' · restricted' : ''}`}
          disabled={isRestricted(ws.id)}
        >
          <span className="workspace-tone-dot" data-tone={workspaceTone(ws.label)} aria-hidden />
          {environmentLabel(ws.label)}
          {isRestricted(ws.id) ? <Lock size={10} aria-hidden /> : null}
          <span className="workspace-count">{ws.appCount}</span>
        </button>
      ))}
    </>
  )

  return (
    <>
      <div className="workspace-switcher workspace-switcher-full zeus-cluster-switcher" data-testid="workspace-switcher">
        <Layers size={14} aria-hidden />
        <span className="sr-only">Environment filter</span>
        <div className="workspace-chip-list">{chipList}</div>
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

      <div className="workspace-switcher workspace-switcher-compact zeus-cluster-switcher" ref={ref}>
        <Layers size={14} aria-hidden />
        <button type="button" className="workspace-chip active" onClick={() => setDropdownOpen((v) => !v)}>
          {activeLabel}
          <ChevronDown size={12} className={dropdownOpen ? 'hermes-nb-chevron-open' : ''} />
        </button>
        {dropdownOpen ? (
          <div className="workspace-dropdown-menu">
            <button type="button" className={`workspace-dropdown-item ${workspaceId === '' ? 'active' : ''}`} onClick={() => { setWorkspaceId(''); setDropdownOpen(false) }}>
              All environments
            </button>
            {workspaces.data?.map((ws) => (
              <button
                key={ws.id}
                type="button"
                className={`workspace-dropdown-item ${workspaceId === ws.id ? 'active' : ''}`}
                data-tone={workspaceTone(ws.label)}
                disabled={isRestricted(ws.id)}
                onClick={() => { setWorkspaceId(ws.id); setDropdownOpen(false) }}
              >
                <span className="workspace-tone-dot" data-tone={workspaceTone(ws.label)} aria-hidden />
                {environmentLabel(ws.label)} ({ws.appCount})
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </>
  )
}
