// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import type { AppLink } from '../types'

/** Only absolute http(s) URLs are ever rendered as links. */
export function isSafeLink(url: string): boolean {
  if (/\s/.test(url) || !/^https?:\/\//i.test(url)) return false
  try {
    return new URL(url).host !== ''
  } catch {
    return false
  }
}

export function safeLinks(links: AppLink[] | undefined): AppLink[] {
  return (links ?? []).filter((l) => isSafeLink(l.url))
}
