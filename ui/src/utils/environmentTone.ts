// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import type { GlyphTileTone } from '../components/nebula/GlyphTile'

/** Best-effort color coding for an environment/workspace label, so
 * prod/staging/dev read as visually distinct instead of one flat color. */
export function environmentTone(label: string): GlyphTileTone {
  const l = label.toLowerCase()
  if (l.includes('prod')) return 'critical'
  if (l.includes('stag') || l.includes('preprod')) return 'warn'
  if (l.includes('test') || l.includes('qa')) return 'cyan'
  if (l.includes('dev') || l.includes('local')) return 'info'
  return 'brand'
}
