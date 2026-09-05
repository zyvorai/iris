// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { KeyRound, Moon, Settings as SettingsIcon, Sparkles, Sun, Users } from 'lucide-react'
import GlassPanel from '../components/nebula/GlassPanel'
import GlyphTile from '../components/nebula/GlyphTile'
import { ZyraAiBadge } from '../components/nebula/ZyraAiPanel'
import { useAiStatus } from '../hooks/useZyraAiInsight'
import { loadTheme, saveTheme, type IrisTheme } from '../utils/irisShellPreferences'

export default function SettingsPage() {
  const [theme, setTheme] = useState<IrisTheme>(() => loadTheme())
  const aiStatus = useAiStatus()

  const setThemeAndSave = (next: IrisTheme) => {
    saveTheme(next)
    setTheme(next)
  }

  return (
    <div className="hs-page">
      <section className="hs-hero">
        <div className="hs-wrap">
          <p className="hs-eyebrow">Preferences</p>
          <h1 className="h-hero" style={{ maxWidth: '14ch' }}>Settings</h1>
          <p className="hs-lede">Appearance on this device, plus how operators configure auth, AI, and federation.</p>
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
                Apple blue buttons and black text in light; the same blue accents in dark.
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

        <GlassPanel className="glass-panel-section">
          <div className="section-head-nebula">
            <GlyphTile tone="brand" icon={<KeyRound size={14} />} size="sm" />
            <div>
              <p className="hs-eyebrow">Security</p>
              <h2 className="h-tile">Authentication</h2>
              <p className="hs-lede" style={{ fontSize: 15, marginTop: 8 }}>
                Auth is configured on the server (Helm / env), not in the browser. Default is open local mode.
              </p>
            </div>
          </div>
          <ul className="body-text" style={{ marginTop: '1rem', paddingLeft: '1.1rem', lineHeight: 1.55 }}>
            <li>
              <code>server.auth.mode=none</code> — open access (demo / air-gapped labs)
            </li>
            <li>
              <code>server.auth.mode=api_key</code> — set <code>server.auth.apiKey</code>
            </li>
            <li>
              <code>server.auth.mode=oidc</code> — set <code>server.auth.oidc.issuer</code>, <code>clientId</code>, and secret
            </li>
            <li>
              Optional: <code>server.k8sRbac=true</code> for SubjectAccessReview gates on publish
            </li>
          </ul>
        </GlassPanel>

        <GlassPanel className="glass-panel-section">
          <div className="section-head-nebula">
            <GlyphTile tone="brand" icon={<Sparkles size={14} />} size="sm" />
            <div>
              <p className="hs-eyebrow">Zyra AI</p>
              <h2 className="h-tile">Language model</h2>
              <p className="hs-lede" style={{ fontSize: 15, marginTop: 8 }}>
                Insights use a rules engine unless an OpenAI-compatible LLM is configured.
              </p>
            </div>
            {aiStatus.data ? <ZyraAiBadge source={aiStatus.data.llmConfigured ? 'llm' : 'rules'} /> : null}
          </div>
          <p className="body-text" style={{ marginTop: '1rem' }}>
            {aiStatus.data?.llmConfigured
              ? aiStatus.data.llmReachable === false
                ? `LLM configured but unreachable${aiStatus.data.probeMessage ? `: ${aiStatus.data.probeMessage}` : ''}. Falling back to rules.`
                : `Live LLM enabled (${aiStatus.data.model ?? 'configured model'}).`
              : 'Rules engine active. Set server.llm.apiUrl + apiKey (or existingSecret) via Helm to enable live Zyra AI.'}
          </p>
        </GlassPanel>

        <GlassPanel className="glass-panel-section">
          <div className="section-head-nebula">
            <GlyphTile tone="brand" icon={<Users size={14} />} size="sm" />
            <div>
              <p className="hs-eyebrow">Multi-cluster</p>
              <h2 className="h-tile">Federation</h2>
              <p className="hs-lede" style={{ fontSize: 15, marginTop: 8 }}>
                Peer catalogs are merged when <code>cluster.federated</code> is set on the Helm release.
              </p>
            </div>
          </div>
          <p className="body-text" style={{ marginTop: '1rem' }}>
            Each peer needs <code>id</code>, <code>name</code>, <code>url</code>, and optionally <code>writeEnabled</code> + <code>apiKey</code>.
            Open the Federated page to browse remote catalogs after peers are configured.
          </p>
        </GlassPanel>
      </div>
    </div>
  )
}
