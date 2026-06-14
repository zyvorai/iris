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
  meshPolicies?: MeshPolicy[]
}

export interface MeshPolicy {
  kind: string
  name?: string
  namespace?: string
  hosts?: string[]
  destination?: string
  weight?: number
  detail?: string
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

export interface AppInsight {
  appId: string
  summary: string
  explanation: string
  source: string
  remediation?: string[]
  suggestedActions?: SuggestedAction[]
}

export interface FleetInsight {
  summary: string
  explanation: string
  source: string
  highlights?: string[]
  focusAppIds?: string[]
}

export interface DiscoveryInsight {
  summary: string
  explanation: string
  source: string
  highlights?: string[]
  suggestPublishIds?: string[]
}

export interface NamespaceInsight {
  namespace: string
  summary: string
  explanation: string
  source: string
  highlights?: string[]
  focusAppIds?: string[]
}

export interface OwnerInsight {
  owner: string
  summary: string
  explanation: string
  source: string
  highlights?: string[]
  focusAppIds?: string[]
}

export interface GraphInsight {
  summary: string
  explanation: string
  source: string
  highlights?: string[]
  focusAppIds?: string[]
}

export interface FederatedInsight {
  summary: string
  explanation: string
  source: string
  highlights?: string[]
  focusAppIds?: string[]
}

export interface ActivityInsight {
  summary: string
  explanation: string
  source: string
  highlights?: string[]
}

export interface AiStatus {
  llmConfigured: boolean
  defaultSource: string
  model?: string
  llmReachable?: boolean
  probeMessage?: string
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
  writeEnabled?: boolean
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
  meshRoutes?: string[]
}

export interface FederationActionResult {
  clusterId: string
  clusterName: string
  ok: boolean
  detail?: string
}

export interface FederatedAuditEvent extends AuditEvent {
  clusterId: string
  clusterName: string
}

export interface FederationRbacStatus {
  clusterId: string
  clusterName: string
  ok: boolean
  userId: string
  allowedActions?: string[]
  detail?: string
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
