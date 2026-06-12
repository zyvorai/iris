// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import type {
  AppDiagnosis,
  AppGraph,
  AuditEvent,
  CatalogStats,
  ClusterSummary,
  CreateShareRequest,
  ClusterInfo,
  HealthSummary,
  HermesApp,
  SearchHit,
  FederatedApp,
  FederationActionResult,
  FederationRbacStatus,
  SearchIntent,
  ShareLink,
  TeamOwner,
  Workspace,
} from '../types'

const base = '/api/v1'

function appPath(id: string, suffix = '') {
  const encoded = id.split('/').map(encodeURIComponent).join('/')
  return `/apps/${encoded}${suffix}`
}

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

function federationPath(clusterId: string, suffix: string) {
  return `/federation/${suffix}/${encodeURIComponent(clusterId)}`
}

function federationAppPath(clusterId: string, id: string, action: string) {
  const encodedId = id.split('/').map(encodeURIComponent).join('/')
  return `/federation/${action}/${encodeURIComponent(clusterId)}/${encodedId}`
}

export const hermesApi = {
  listApps: () => req<HermesApp[]>('/apps'),
  listCatalog: () => req<HermesApp[]>('/catalog'),
  listFederatedCatalog: () => req<FederatedApp[]>('/catalog/federated'),
  exportCatalog: () => fetch('/api/v1/catalog/export').then((r) => r.blob()),
  catalogStats: () => req<CatalogStats>('/stats'),
  clusterSummary: () => req<ClusterSummary>('/cluster/summary'),
  listClusters: () => req<ClusterInfo[]>('/clusters'),
  federationPublish: (clusterId: string, id: string) =>
    req<FederationActionResult>(federationAppPath(clusterId, id, 'publish'), { method: 'POST' }),
  federationPublishNamespace: (clusterId: string, namespace: string) =>
    req<FederationActionResult>(
      `${federationPath(clusterId, 'publish-namespace')}/${encodeURIComponent(namespace)}`,
      { method: 'POST' },
    ),
  federationSetRecommended: (clusterId: string, id: string, recommended: boolean) =>
    req<FederationActionResult>(federationAppPath(clusterId, id, 'recommended'), {
      method: 'PUT',
      body: JSON.stringify({ recommended }),
    }),
  federationRbacCheck: (clusterId: string) =>
    req<FederationRbacStatus>(`/federation/rbac/${encodeURIComponent(clusterId)}`),
  getGraph: () => req<AppGraph>('/graph'),
  listWorkspaces: () => req<Workspace[]>('/workspaces'),
  listOwners: () => req<TeamOwner[]>('/owners'),
  getApp: (id: string) => req<HermesApp>(appPath(id)),
  getDiagnosis: (id: string) => req<AppDiagnosis>(`${appPath(id)}/diagnosis`),
  listDiscovery: () => req<HermesApp[]>('/discovery'),
  publish: (id: string) => req<void>(`/discovery/publish/${encodeURIComponent(id)}`, { method: 'POST' }),
  publishNamespace: (namespace: string) =>
    req<{ published: number; namespace: string }>(
      `/discovery/publish-namespace/${encodeURIComponent(namespace)}`,
      { method: 'POST' },
    ),
  hide: (id: string) => req<void>(`/discovery/hide/${encodeURIComponent(id)}`, { method: 'POST' }),
  search: (q: string) => req<SearchHit[]>(`/search?q=${encodeURIComponent(q)}&limit=20`),
  searchIntent: (q: string) => req<SearchIntent>(`/search/intent?q=${encodeURIComponent(q)}`),
  searchLlm: (q: string) => req<SearchIntent>(`/search/llm?q=${encodeURIComponent(q)}`),
  listFavorites: () => req<HermesApp[]>('/favorites'),
  addFavorite: (id: string) => req<void>(`/favorites/${encodeURIComponent(id)}`, { method: 'PUT' }),
  removeFavorite: (id: string) => req<void>(`/favorites/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  listRecents: () => req<HermesApp[]>('/recents'),
  recordRecent: (id: string) => req<void>(`/recents/${encodeURIComponent(id)}`, { method: 'POST' }),
  healthSummary: () => req<HealthSummary>('/health/apps'),
  listRecommended: () => req<HermesApp[]>('/recommended'),
  setRecommended: (id: string, recommended: boolean) =>
    req<HermesApp>(`/recommended/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ recommended }),
    }),
  listShares: () => req<ShareLink[]>('/shares'),
  listAllShares: () => req<ShareLink[]>('/shares/all'),
  createShare: (body: CreateShareRequest) =>
    req<ShareLink>('/shares', { method: 'POST', body: JSON.stringify(body) }),
  revokeShare: (token: string) => req<void>(`/shares/${encodeURIComponent(token)}`, { method: 'DELETE' }),
  listAudit: (limit = 50) => req<AuditEvent[]>(`/audit?limit=${limit}`),
  authMe: async () => {
    const res = await fetch('/auth/me')
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json() as Promise<{
      authenticated: boolean
      userId: string
      mode: string
      groups?: string[]
      allowedWorkspaces?: string[]
    }>
  },
}

export function appDetailPath(app: HermesApp, diagnose = false): string {
  const base = `/apps/${encodeURIComponent(app.id)}`
  return diagnose ? `${base}?diagnose=1` : base
}

export function copyAppUrl(app: HermesApp) {
  return navigator.clipboard.writeText(appPublicUrl(app))
}

export function sharePublicUrl(sharePath: string): string {
  return window.location.origin + sharePath
}

export function copyShareUrl(sharePath: string) {
  return navigator.clipboard.writeText(sharePublicUrl(sharePath))
}

export function appLaunchPath(app: HermesApp): string {
  if (app.canonicalSlug) return `/apps/${app.canonicalSlug}`
  return app.routePath
}

export function appPublicUrl(app: HermesApp): string {
  if (app.publicUrl) return app.publicUrl
  return window.location.origin + appLaunchPath(app)
}

export function openApp(app: HermesApp) {
  void hermesApi.recordRecent(app.id)
  window.open(appLaunchPath(app), '_blank', 'noopener,noreferrer')
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
      return 'Offline'
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
    case 'ingress':
      return 'Ingress'
    case 'gateway':
      return 'Gateway API'
    case 'mesh':
      return 'Service mesh'
    case 'service':
      return 'Cluster service'
    default:
      return source
  }
}

export function environmentLabel(env?: string): string {
  if (!env) return 'Unknown'
  return env.charAt(0).toUpperCase() + env.slice(1)
}

export function actionLabel(action: string): string {
  switch (action) {
    case 'launch':
      return 'Launched'
    case 'publish':
      return 'Published'
    case 'publish_namespace':
      return 'Bulk publish'
    case 'hide':
      return 'Hidden'
    case 'search':
      return 'Search'
    case 'favorite':
      return 'Pinned'
    case 'unfavorite':
      return 'Unpinned'
    case 'recent':
      return 'Opened'
    case 'recommend':
      return 'Team pick'
    case 'unrecommend':
      return 'Removed pick'
    case 'share_create':
      return 'Share link'
    case 'share_revoke':
      return 'Revoked share'
    case 'share_access':
      return 'Share opened'
    default:
      return action
  }
}
