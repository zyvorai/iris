// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { Moon, Settings as SettingsIcon, Sun } from 'lucide-react'
import GlassPanel from '../components/nebula/GlassPanel'
import GlyphTile from '../components/nebula/GlyphTile'
import { loadTheme, saveTheme, type HermesTheme } from '../utils/hermesShellPreferences'

export default function SettingsPage() {
  const [theme, setTheme] = useState<HermesTheme>(() => loadTheme())

  const setThemeAndSave = (next: HermesTheme) => {
    saveTheme(next)
    setTheme(next)
  }

  return (
    <div className="hs-page">
      <section className="hs-hero">
        <div className="hs-wrap">
          <p className="hs-eyebrow">Preferences</p>
          <h1 className="h-hero" style={{ maxWidth: '14ch' }}>Settings</h1>
          <p className="hs-lede">Choose how the launchpad looks on this device.</p>
        </div>
      </section>
      <div className="page-grid">
        <GlassPanel className="glass-panel-section">
          <div className="section-head-nebula">
            <GlyphTile tone="brand" icon={<SettingsIcon size={14} />} size="sm" />
            <div>
              <p className="hs-eyebrow">Appearance</p>
              <h2 className="h-tile">Theme</h2>
              <p className="hs-lede" style={{ fontSize: 15, marginTop: 8 }}>
                Light matches apple.com; dark is available when you need it.
              </p>
            </div>
          </div>

          <div className="view-toggle" role="tablist" aria-label="Theme" style={{ marginTop: '1rem' }}>
            <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => setThemeAndSave('light')}>
              <Sun size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Light
            </button>
            <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => setThemeAndSave('dark')}>
              <Moon size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Dark
            </button>
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}
