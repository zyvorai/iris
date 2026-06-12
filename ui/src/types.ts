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
