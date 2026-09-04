// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react'

interface FlippableItem {
  id: string
  status: string
}

/** Tracks status transitions across polls/refetches and returns the set of ids
 * whose status just changed, for one animation cycle (~700ms) — drives the
 * departures-board row-flip animation off real data instead of a fake timer. */
export function useStatusFlip(items: FlippableItem[]): Set<string> {
  const prevRef = useRef<Map<string, string>>(new Map())
  const [flipped, setFlipped] = useState<Set<string>>(new Set())
  const key = items.map((i) => `${i.id}:${i.status}`).join('|')

  useEffect(() => {
    const prev = prevRef.current
    const changed = new Set<string>()
    for (const item of items) {
      const before = prev.get(item.id)
      if (before !== undefined && before !== item.status) changed.add(item.id)
      prev.set(item.id, item.status)
    }
    if (changed.size > 0) {
      setFlipped(changed)
      const timer = setTimeout(() => setFlipped(new Set()), 700)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return flipped
}
