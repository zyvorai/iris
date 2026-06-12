// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import type { ClusterSummary, HealthSummary, HermesApp, SearchHit } from '../types'

const base = '/api/v1'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const hermesApi = {
  listApps: () => req<HermesApp[]>('/apps'),
  listCatalog: () => req<HermesApp[]>('/catalog'),
  clusterSummary: () => req<ClusterSummary>('/cluster/summary'),
  getApp: (id: string) => req<HermesApp>(`/apps/${encodeURIComponent(id)}`),
  listDiscovery: () => req<HermesApp[]>('/discovery'),
  publish: (id: string) => req<void>(`/discovery/publish/${encodeURIComponent(id)}`, { method: 'POST' }),
  hide: (id: string) => req<void>(`/discovery/hide/${encodeURIComponent(id)}`, { method: 'POST' }),
  search: (q: string) => req<SearchHit[]>(`/search?q=${encodeURIComponent(q)}&limit=20`),
  listFavorites: () => req<HermesApp[]>('/favorites'),
  addFavorite: (id: string) => req<void>(`/favorites/${encodeURIComponent(id)}`, { method: 'PUT' }),
  removeFavorite: (id: string) => req<void>(`/favorites/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  listRecents: () => req<HermesApp[]>('/recents'),
  recordRecent: (id: string) => req<void>(`/recents/${encodeURIComponent(id)}`, { method: 'POST' }),
  healthSummary: () => req<HealthSummary>('/health/apps'),
}

export function openApp(app: HermesApp) {
  void hermesApi.recordRecent(app.id)
  window.open(app.routePath, '_blank', 'noopener,noreferrer')
}

export function statusTone(status: string): string {
  switch (status) {
    case 'healthy':
      return 'status-healthy'
    case 'degraded':
      return 'status-warn'
    case 'broken':
      return 'status-critical'
    default:
      return 'status-unknown'
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'healthy':
      return 'Healthy'
    case 'degraded':
      return 'Degraded'
    case 'broken':
      return 'Broken'
    default:
      return 'Unknown'
  }
}

export function sourceLabel(source: string): string {
  switch (source) {
    case 'annotation':
      return 'Annotated'
    case 'signature':
      return 'Known app'
    case 'service':
      return 'Cluster service'
    default:
      return source
  }
}
