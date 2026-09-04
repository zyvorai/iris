// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

const KEY = 'hermes-spotlight-recent'
const MAX = 8

export function loadSpotlightRecents(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : []
  } catch {
    return []
  }
}

export function pushSpotlightRecent(id: string) {
  const prev = loadSpotlightRecents().filter((x) => x !== id)
  prev.unshift(id)
  localStorage.setItem(KEY, JSON.stringify(prev.slice(0, MAX)))
}
