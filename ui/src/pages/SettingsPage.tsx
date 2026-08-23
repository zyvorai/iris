// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useState } from 'react'
import { Moon, Settings as SettingsIcon, Sun } from 'lucide-react'
import GlassPanel from '../components/nebula/GlassPanel'
import GlyphTile from '../components/nebula/GlyphTile'
import { loadTheme, saveTheme, type HermesTheme } from '../utils/hermesShellPreferences'

/** The mockup's 8th destination. Only ships controls backed by real, wired
 * behavior — theme is the one shell preference that actually drives visible
 * app state today; hermesShellPreferences.ts also stores dock/rail
 * preferences, but no component reads them, so no toggle for them here. */
export default function SettingsPage() {
  const [theme, setTheme] = useState<HermesTheme>(() => loadTheme())

  const setThemeAndSave = (next: HermesTheme) => {
    saveTheme(next)
    setTheme(next)
  }

  return (
    <div className="page-grid">
      <GlassPanel className="glass-panel-section">
        <div className="section-head-nebula">
          <GlyphTile tone="brand" icon={<SettingsIcon size={14} />} size="sm" />
          <div>
            <p className="section-label">Settings</p>
            <h2 className="section-title">Appearance</h2>
            <p className="body-text">Choose how the launchpad looks on this device.</p>
          </div>
        </div>

        <div className="view-toggle" role="tablist" aria-label="Theme" style={{ marginTop: '1rem' }}>
          <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => setThemeAndSave('dark')}>
            <Moon size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Dark
          </button>
          <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => setThemeAndSave('light')}>
            <Sun size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Light
          </button>
        </div>
      </GlassPanel>
    </div>
  )
}
