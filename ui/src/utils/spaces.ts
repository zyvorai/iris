// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import type { IrisApp } from '../types'
import { groupBy } from './groupBy'

export type SpaceId =
  | 'monitoring'
  | 'security'
  | 'infrastructure'
  | 'zeus-os'
  | 'consolehub'
  | 'databases'
  | 'other'

export interface IrisSpace {
  id: SpaceId
  label: string
  description: string
  matchCategories: string[]
  matchNamespaces?: string[]
  matchNamePatterns?: RegExp[]
}

export const IRIS_SPACES: IrisSpace[] = [
  {
    id: 'monitoring',
    label: 'Monitoring',
    description: 'Dashboards, metrics, and observability',
    matchCategories: ['monitoring', 'observability'],
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Identity, firewall, and security tooling',
    matchCategories: ['security', 'identity'],
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    description: 'Storage, CI/CD, GitOps, and virtualization',
    matchCategories: ['storage', 'ci/cd', 'gitops', 'developer tools', 'virtualization', 'vm', 'console', 'infrastructure'],
  },
  {
    id: 'zeus-os',
    label: 'Zeus OS',
    description: 'Core Zeus platform services',
    matchCategories: ['zeus', 'platform'],
    matchNamespaces: ['zeus-os-system', 'zeus-system', 'zeus-os'],
    matchNamePatterns: [/^zeus-/i],
  },
  {
    id: 'consolehub',
    label: 'ConsoleHub',
    description: 'ConsoleHub remote access stack',
    matchCategories: ['consolehub'],
    matchNamespaces: ['zeus-os-system', 'consolehub'],
    matchNamePatterns: [/consolehub/i, /guacamole/i],
  },
  {
    id: 'databases',
    label: 'Databases',
    description: 'Database and data store services',
    matchCategories: ['database', 'databases', 'data store', 'postgres', 'mysql', 'redis', 'mongo'],
    matchNamePatterns: [/postgres/i, /mysql/i, /redis/i, /mongo/i, /mariadb/i],
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Everything else in the catalog',
    matchCategories: [],
  },
]

function matchesPatterns(app: IrisApp, patterns?: RegExp[]): boolean {
  if (!patterns?.length) return false
  const hay = `${app.displayName} ${app.slug} ${app.backend.name}`.toLowerCase()
  return patterns.some((p) => p.test(hay))
}

function matchesNamespace(app: IrisApp, namespaces?: string[]): boolean {
  if (!namespaces?.length) return false
  const ns = app.namespace.toLowerCase()
  return namespaces.some((n) => ns === n.toLowerCase() || ns.includes(n.toLowerCase()))
}

export function spaceForApp(app: IrisApp): SpaceId {
  if (matchesPatterns(app, [/consolehub/i]) || (matchesNamespace(app, ['zeus-os-system']) && /guacamole|consolehub/i.test(app.displayName + app.slug))) {
    return 'consolehub'
  }
  if (matchesNamespace(app, ['zeus-os-system', 'zeus-system', 'zeus-os']) || matchesPatterns(app, [/^zeus-/i])) {
    return 'zeus-os'
  }
  if (matchesPatterns(app, [/postgres/i, /mysql/i, /redis/i, /mongo/i, /mariadb/i])) {
    return 'databases'
  }

  const cat = (app.category || 'Custom').trim().toLowerCase()
  for (const space of IRIS_SPACES) {
    if (space.id === 'other') continue
    if (space.matchCategories.some((c) => cat.includes(c) || c.includes(cat))) {
      return space.id
    }
  }
  return 'other'
}

/** @deprecated use spaceForApp */
export function spaceForCategory(category: string): SpaceId {
  const cat = category.trim().toLowerCase()
  for (const space of IRIS_SPACES) {
    if (space.id === 'other') continue
    if (space.matchCategories.some((c) => cat.includes(c) || c.includes(cat))) {
      return space.id
    }
  }
  return 'other'
}

export function groupAppsBySpace(apps: IrisApp[]): Map<SpaceId, IrisApp[]> {
  const map = groupBy(apps, spaceForApp)
  for (const space of IRIS_SPACES) {
    if (!map.has(space.id)) map.set(space.id, [])
  }
  return map
}

export function spaceById(id: string): IrisSpace | undefined {
  return IRIS_SPACES.find((s) => s.id === id)
}

export function spaceCounts(apps: IrisApp[]): Record<SpaceId, number> {
  const grouped = groupAppsBySpace(apps)
  const counts = {} as Record<SpaceId, number>
  for (const space of IRIS_SPACES) {
    counts[space.id] = grouped.get(space.id)?.length ?? 0
  }
  return counts
}
