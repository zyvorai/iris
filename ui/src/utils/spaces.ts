// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import type { HermesApp } from '../types'

export type SpaceId =
  | 'monitoring'
  | 'virtualization'
  | 'security'
  | 'storage'
  | 'developer'
  | 'ai'
  | 'other'

export interface HermesSpace {
  id: SpaceId
  label: string
  description: string
  matchCategories: string[]
}

export const HERMES_SPACES: HermesSpace[] = [
  {
    id: 'monitoring',
    label: 'Monitoring',
    description: 'Dashboards, metrics, and observability',
    matchCategories: ['monitoring', 'observability'],
  },
  {
    id: 'virtualization',
    label: 'Virtualization',
    description: 'VM consoles and virtualization tools',
    matchCategories: ['virtualization', 'vm', 'console'],
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Identity, firewall, and security tooling',
    matchCategories: ['security', 'identity'],
  },
  {
    id: 'storage',
    label: 'Storage',
    description: 'Volumes, object stores, and backups',
    matchCategories: ['storage'],
  },
  {
    id: 'developer',
    label: 'Developer',
    description: 'CI/CD, GitOps, and developer tools',
    matchCategories: ['ci/cd', 'gitops', 'developer tools'],
  },
  {
    id: 'ai',
    label: 'AI',
    description: 'AI workloads and assistants',
    matchCategories: ['ai'],
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Everything else in the catalog',
    matchCategories: [],
  },
]

export function spaceForCategory(category: string): SpaceId {
  const cat = category.trim().toLowerCase()
  for (const space of HERMES_SPACES) {
    if (space.id === 'other') continue
    if (space.matchCategories.some((c) => cat.includes(c) || c.includes(cat))) {
      return space.id
    }
  }
  return 'other'
}

export function groupAppsBySpace(apps: HermesApp[]): Map<SpaceId, HermesApp[]> {
  const map = new Map<SpaceId, HermesApp[]>()
  for (const space of HERMES_SPACES) {
    map.set(space.id, [])
  }
  for (const app of apps) {
    map.get(spaceForCategory(app.category || 'Custom'))?.push(app)
  }
  return map
}

export function spaceById(id: string): HermesSpace | undefined {
  return HERMES_SPACES.find((s) => s.id === id)
}

export function spaceCounts(apps: HermesApp[]): Record<SpaceId, number> {
  const grouped = groupAppsBySpace(apps)
  const counts = {} as Record<SpaceId, number>
  for (const space of HERMES_SPACES) {
    counts[space.id] = grouped.get(space.id)?.length ?? 0
  }
  return counts
}
