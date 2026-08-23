// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

// Flat "chit" icon palette — deterministic per-service wayfinding colour
// (81 services need to stay visually distinguishable). Each pair is
// [flat fill, glow accent]; the tile itself renders as a solid swatch.
const ICON_PALETTE: readonly [string, string][] = [
  ['#f0583a', '#f89e8a'], // coral
  ['#ff8f3f', '#ffc48a'], // orange
  ['#eab308', '#fde68a'], // gold
  ['#65a30d', '#bef264'], // lime
  ['#10b981', '#6ee7b7'], // green
  ['#0d9488', '#5eead4'], // teal
  ['#0891b2', '#67e8f9'], // cyan
  ['#0284c7', '#7dd3fc'], // sky
  ['#2563eb', '#93c5fd'], // blue
  ['#4f46e5', '#a5b4fc'], // indigo
  ['#7c3aed', '#c4b5fd'], // violet
  ['#9333ea', '#d8b4fe'], // purple
  ['#c026d3', '#f0abfc'], // fuchsia
  ['#db2777', '#f9a8d4'], // pink
  ['#e11d48', '#fda4af'], // rose
]

function hashString(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

function gradientFor([accent]: readonly [string, string]) {
  return {
    gradient: accent,
    glow: `rgba(${hexToRgb(accent)}, 0.35)`,
    accent,
  }
}

export interface IconColor {
  gradient: string
  glow: string
  accent: string
}

export function iconColorFor(seed: string): IconColor {
  const pair = ICON_PALETTE[hashString(seed || 'app') % ICON_PALETTE.length]
  return gradientFor(pair)
}

// Icon keys with a curated brand-matched gradient (kept in the same
// accent/accentLight, same-hue-family shape as the hashed palette above).
const CURATED_ICON_PALETTE: Record<string, [string, string]> = {
  grafana: ['#ea580c', '#fdba74'],
  prometheus: ['#dc2626', '#fca5a5'],
  zeus: ['#2563eb', '#93c5fd'],
  argocd: ['#dc2626', '#fca5a5'],
  jenkins: ['#ca8a04', '#fde047'],
  gitlab: ['#ea580c', '#fdba74'],
  loki: ['#2563eb', '#93c5fd'],
  keycloak: ['#475569', '#cbd5e1'],
  vault: ['#0d9488', '#5eead4'],
  harbor: ['#0284c7', '#7dd3fc'],
  minio: ['#dc2626', '#fca5a5'],
}

export function curatedIconColor(iconKey: string): IconColor | undefined {
  const pair = CURATED_ICON_PALETTE[iconKey]
  return pair ? gradientFor(pair) : undefined
}

/** The gradient an app's icon actually renders — curated brand gradient when
 * one exists, otherwise the same deterministic hash used by AppIcon. */
export function accentColorFor(name: string, iconKey?: string): IconColor {
  return (iconKey ? curatedIconColor(iconKey) : undefined) ?? iconColorFor(name || iconKey || 'app')
}
