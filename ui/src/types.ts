// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

export interface Backend {
  kind: string
  name: string
  port: number
  scheme: string
  path: string
}

export interface Visibility {
  published: boolean
  hidden: boolean
  favorite: boolean
}

export interface AppMeta {
  environment?: string
  owner?: string
  dependsOn?: string[]
  recommended?: boolean
  ingressHosts?: string[]
  meshRoutes?: string[]
}

export interface ShareLink {
  token: string
  appId: string
  sharePath: string
  expiresAt: string
  createdAt: string
  label?: string
  createdBy?: string
}

export interface FederatedApp extends HermesApp {
  clusterId: string
  clusterName: string
}

export interface SearchIntent {
  intent: string
  answer: string
  apps: HermesApp[]
}

export interface ClusterInfo {
  id: string
  name: string
  appCount: number
  published: number
  healthy: number
  isLocal: boolean
  url?: string
  status?: string
}

export interface CreateShareRequest {
  appId: string
  ttlMinutes?: number
  label?: string
}

export interface AppGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GraphNode {
  id: string
  label: string
  category: string
  status: string
  namespace: string
  owner?: string
  icon?: string
}

export interface GraphEdge {
  from: string
  to: string
  label?: string
  resolved: boolean
}

export interface Workspace {
  id: string
  label: string
  appCount: number
  published: number
  healthy: number
  degraded: number
  broken: number
}

export interface TeamOwner {
  id: string
  label: string
  appCount: number
  recommended: number
  unhealthy: number
}

export interface HermesApp {
  id: string
  slug: string
  canonicalSlug?: string
  displayName: string
  description?: string
  namespace: string
  category: string
  icon: string
  backend: Backend
  routePath: string
  publicUrl: string
  status: string
  statusMessage?: string
  source: string
  authMode: string
  score: number
  visibility: Visibility
  readyEndpoints: number
  updatedAt: string
  meta?: AppMeta
}

export interface CatalogStats {
  total: number
  published: number
  environments: { label: string; count: number }[]
  categories: { label: string; count: number }[]
  sources: { label: string; count: number }[]
  recommended: number
}

export interface SearchHit {
  app: HermesApp
  score: number
}

export interface HealthSummary {
  total: number
  healthy: number
  degraded: number
  broken: number
  apps: HermesApp[]
}

export interface ClusterSummary {
  total: number
  published: number
  discovery: number
  namespaces: number
  healthy: number
  degraded: number
  broken: number
}

export interface AuditEvent {
  id: number
  userId: string
  action: string
  appId: string
  detail: string
  createdAt: string
}

export interface DiagnosisChainNode {
  id: string
  label: string
  status?: string
}

export interface SuggestedAction {
  label: string
  href: string
}

export interface AppDiagnosis {
  appId: string
  routePath: string
  publicUrl: string
  backend: Backend
  problem?: string
  cause?: string
  chain: DiagnosisChainNode[]
  suggestedActions: SuggestedAction[]
}
