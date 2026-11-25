// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import type { IrisApp } from '../types'

export interface CatalogQuery {
  text?: string
  tag?: string
  lifecycle?: string
}

/** Free text search plus exact tag and lifecycle filters. */
export function matchesCatalogQuery(app: IrisApp, { text, tag, lifecycle }: CatalogQuery): boolean {
  if (tag && !app.meta?.tags?.includes(tag)) return false
  if (lifecycle && app.meta?.lifecycle !== lifecycle) return false
  const q = (text ?? '').trim().toLowerCase()
  if (!q) return true
  return [
    app.displayName,
    app.namespace,
    app.category,
    app.meta?.environment ?? '',
    app.meta?.owner ?? '',
    app.meta?.lifecycle ?? '',
    ...(app.meta?.tags ?? []),
  ].some((v) => v.toLowerCase().includes(q))
}
