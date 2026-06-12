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

export interface HermesApp {
  id: string
  slug: string
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
