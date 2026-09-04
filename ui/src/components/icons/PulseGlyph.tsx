// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

interface PulseGlyphProps {
  size?: number
}

/** Iris's brand glyph — a heartbeat/pulse line, fitting a health &
 * monitoring dashboard. Thin-stroke, currentColor, sized to sit inside a
 * GlyphTile badge. */
export default function PulseGlyph({ size = 18 }: PulseGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M2.5 10h3.4l1.6-4.5 3 9L12.4 10H17.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
