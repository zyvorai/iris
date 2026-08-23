// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

// Vivid, distinct hues for app icons without a curated brand color — an
// "app tray" palette so a catalog of many services reads as colorful
// rather than one repeated accent tone.
const ICON_PALETTE: readonly [number, number, number][] = [
  [240, 88, 58], // coral
  [245, 158, 11], // amber
  [234, 179, 8], // gold
  [132, 204, 22], // lime
  [16, 185, 129], // green
  [20, 184, 166], // teal
  [6, 182, 212], // cyan
  [14, 165, 233], // sky
  [59, 130, 246], // blue
  [99, 102, 241], // indigo
  [139, 92, 246], // violet
  [168, 85, 247], // purple
  [217, 70, 239], // fuchsia
  [236, 72, 153], // pink
  [244, 63, 94], // rose
]

function hashString(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export interface IconColor {
  bg: string
  fg: string
}

export function iconColorFor(seed: string): IconColor {
  const [r, g, b] = ICON_PALETTE[hashString(seed || 'app') % ICON_PALETTE.length]
  return {
    bg: `rgba(${r}, ${g}, ${b}, 0.22)`,
    fg: `rgb(${r}, ${g}, ${b})`,
  }
}

// Icon keys with a curated brand color (see .icon-<key> in nebula-components.css /
// index.css, including their light-theme overrides). Kept in sync with those CSS
// rules so anything reading a "card accent" color matches the icon glyph exactly.
export const CURATED_ICON_FG: Record<string, string> = {
  grafana: '#fb923c',
  prometheus: '#f87171',
  zeus: '#93c5fd',
  argocd: '#fca5a5',
  jenkins: '#facc15',
  gitlab: '#fb923c',
  loki: '#93c5fd',
  keycloak: '#cbd5e1',
  vault: '#5eead4',
  harbor: '#7dd3fc',
  minio: '#f87171',
}

/** The accent color an app's icon actually renders in — curated brand color when
 * one exists, otherwise the same deterministic hash used by AppIcon. Use this for
 * any other UI element (e.g. a card's top accent bar) that should match the icon. */
export function accentColorFor(name: string, iconKey?: string): string {
  const curated = iconKey ? CURATED_ICON_FG[iconKey] : undefined
  return curated ?? iconColorFor(name || iconKey || 'app').fg
}
