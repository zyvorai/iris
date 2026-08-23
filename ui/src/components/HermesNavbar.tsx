// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  BookOpen,
  ChevronDown,
  Compass,
  Copy,
  GitBranch,
  Globe,
  Grid3X3,
  HeartPulse,
  HelpCircle,
  Home,
  Keyboard,
  Layers,
  Menu,
  Moon,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Sun,
  Users,
  X,
} from 'lucide-react'
import { NavLink, Link } from 'react-router-dom'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import GlyphTile, { type GlyphTileTone } from './nebula/GlyphTile'
import PulseGlyph from './icons/PulseGlyph'
import { hermesApi } from '../services/hermesApi'
import { refreshHermesData } from '../utils/refreshCatalog'
import { useAiStatus } from '../hooks/useZyraAiInsight'
import { ZyraAiBadge } from './nebula/ZyraAiPanel'
import { loadTheme, saveTheme, type HermesTheme } from '../utils/hermesShellPreferences'

interface HermesNavbarProps {
  onPaletteOpen: () => void
  onOpenShortcuts: () => void
}

const primaryNav = [
  { to: '/', label: 'Overview', icon: Home, end: true, tone: 'brand' as const },
  { to: '/apps', label: 'Catalog', icon: Grid3X3, tone: 'pink' as const },
  { to: '/cluster', label: 'Cluster', icon: Server, tone: 'info' as const },
  { to: '/health', label: 'Health', icon: HeartPulse, tone: 'ok' as const },
  { to: '/spaces', label: 'Spaces', icon: Layers, tone: 'cyan' as const },
]

const moreNav = [
  { to: '/graph', label: 'Graph', icon: GitBranch, tone: 'ai' as const },
  { to: '/discovery', label: 'Discovery', icon: Compass, tone: 'warn' as const },
  { to: '/federated', label: 'Federated', icon: Globe, tone: 'cyan' as const },
  { to: '/teams', label: 'Teams', icon: Users, tone: 'pink' as const },
  { to: '/activity', label: 'Activity', icon: Activity, tone: 'ok' as const },
]

function HelpMenu({ onOpenShortcuts }: { onOpenShortcuts: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const copyDiag = async () => {
    try {
      const payload = { health: `${window.location.origin}/healthz`, cluster: `${window.location.origin}/api/v1/cluster/summary` }
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      setOpen(false)
    } catch {
      // clipboard write failed (non-HTTPS or permission denied) — leave dropdown open
    }
  }

  return (
    <div className="hermes-nb-help-wrap" ref={ref}>
      <button type="button" className="hermes-nb-pill" onClick={() => setOpen((v) => !v)} aria-expanded={open} title="Help">
        <HelpCircle size={16} />
        <span className="hermes-nb-pill-label">Help</span>
        <ChevronDown size={12} className={open ? 'hermes-nb-chevron-open' : ''} />
      </button>
      {open && (
        <div className="hermes-nb-dropdown" role="menu" aria-label="Help menu">
          <button type="button" className="hermes-nb-dropdown-item" role="menuitem"
            onClick={() => { setOpen(false); onOpenShortcuts() }}>
            <Keyboard size={14} /> Keyboard shortcuts
            <kbd className="hermes-nb-kbd">?</kbd>
          </button>
          <button type="button" className="hermes-nb-dropdown-item" role="menuitem" onClick={() => void copyDiag()}>
            <Copy size={14} /> Copy diagnostics
          </button>
          <a href="https://github.com/ssahani/hermes" target="_blank" rel="noreferrer"
            className="hermes-nb-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
            <BookOpen size={14} /> Documentation
          </a>
        </div>
      )}
    </div>
  )
}

function MoreMenu({ toneFor }: { toneFor: (path: string) => GlyphTileTone }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="hermes-nb-help-wrap" ref={ref}>
      <button type="button" className="hermes-nb-pill" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        More
        <ChevronDown size={12} className={open ? 'hermes-nb-chevron-open' : ''} />
      </button>
      {open && (
        <div className="hermes-nb-dropdown" role="menu">
          {moreNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `hermes-nb-dropdown-item${isActive ? ' active' : ''}`}
              data-tone={toneFor(item.to)}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <GlyphTile tone={toneFor(item.to)} icon={<item.icon size={12} />} size="sm" /> {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HermesNavbar({ onPaletteOpen, onOpenShortcuts }: HermesNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [theme, setTheme] = useState<HermesTheme>(() => loadTheme())
  const qc = useQueryClient()
  const cluster = useQuery({ queryKey: ['cluster-summary'], queryFn: hermesApi.clusterSummary, refetchInterval: 15000 })
  const auth = useQuery({ queryKey: ['auth-me'], queryFn: hermesApi.authMe, retry: false })

  const healthy = cluster.data?.healthy ?? 0
  const broken = cluster.data?.broken ?? 0
  const degraded = cluster.data?.degraded ?? 0
  const total = cluster.data?.total ?? 0
  const healthPct = cluster.isLoading ? null : total > 0 ? Math.round((healthy / total) * 100) : 100
  const aiStatus = useAiStatus()
  const statusTone = cluster.isLoading ? 'ok'
    : broken > 0 ? 'bad'
    : (degraded > 0 || (healthPct ?? 0) < 80) ? 'warn'
    : 'ok'
  const healthTileTone: GlyphTileTone = statusTone === 'bad' ? 'critical' : statusTone === 'warn' ? 'warn' : 'ok'
  const toneFor = (path: string): GlyphTileTone =>
    path === '/health' ? healthTileTone : ([...primaryNav, ...moreNav].find((n) => n.to === path)?.tone ?? 'brand')

  const handleRefresh = () => {
    setSpinning(true)
    void refreshHermesData(qc)
    setTimeout(() => setSpinning(false), 600)
  }

  const toggleTheme = () => {
    const next: HermesTheme = theme === 'dark' ? 'light' : 'dark'
    saveTheme(next)
    setTheme(next)
  }

  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [mobileOpen])

  return (
    <nav className="hermes-navbar" data-testid="hermes-navbar">
      <div className="hermes-nb-content">
        {/* Row 1: Brand + utilities */}
        <div className="hermes-nb-row1">
          <div className="hermes-nb-brand-area">
            <Link to="/" className="hermes-nb-brand" onClick={() => setMobileOpen(false)}>
              <GlyphTile tone="brand" icon={<PulseGlyph />} size="md" />
              <div className="hermes-nb-brand-text">
                <span className="hermes-nb-brand-name">Hermes</span>
                <span className="hermes-nb-brand-sub">Service Launchpad</span>
              </div>
            </Link>
          </div>

          <div className="hermes-nb-utilities">
            <WorkspaceSwitcher />
            <Link
              to="/health"
              className="zeus-health-chip zeus-health-chip-compact"
              data-tone={statusTone}
              title={
                aiStatus.data?.llmConfigured
                  ? aiStatus.data.llmReachable === false
                    ? `Zyra AI unreachable${aiStatus.data.probeMessage ? `: ${aiStatus.data.probeMessage}` : ''}`
                    : `Zyra AI (${aiStatus.data.model}) · ${healthy} of ${total} healthy`
                  : `Rules engine · ${healthy} of ${total} healthy`
              }
              data-testid="navbar-health-chip"
            >
              <span className="zeus-live-dot" data-tone={statusTone} aria-hidden />
              <span className="zeus-health-label">{healthPct != null ? `${healthPct}%` : '—'} healthy</span>
            </Link>
            {aiStatus.data ? (
              <ZyraAiBadge
                source={aiStatus.data.llmConfigured ? 'llm' : 'rules'}
                warn={aiStatus.data.llmConfigured && aiStatus.data.llmReachable === false}
              />
            ) : null}
            <button type="button" className="hermes-nb-pill hermes-nb-search-pill" onClick={onPaletteOpen}>
              <Search size={15} />
              <span className="hermes-nb-pill-label">Spotlight</span>
              <kbd className="hermes-nb-kbd">⌘K</kbd>
            </button>
            <button
              type="button"
              className="hermes-nb-icon-pill hermes-nb-icon-pill-refresh"
              onClick={handleRefresh}
              title="Refresh data"
            >
              <RefreshCw size={16} className={spinning ? 'hermes-nb-spin' : ''} />
            </button>
            <button
              type="button"
              className={`hermes-nb-icon-pill hermes-nb-icon-pill-theme${theme === 'dark' ? ' is-sun' : ' is-moon'}`}
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <HelpMenu onOpenShortcuts={onOpenShortcuts} />
            {auth.data?.mode === 'oidc' && (
              auth.data.authenticated ? (
                <button
                  type="button"
                  className="hermes-nb-pill"
                  onClick={() => void fetch('/auth/logout', { method: 'POST' }).then(res => res.ok && window.location.reload()).catch(() => {})}
                  title={auth.data.userId}
                >
                  <Sparkles size={14} />
                  <span className="hermes-nb-pill-label hermes-nb-user-label">{auth.data.userId}</span>
                </button>
              ) : (
                <a href="/auth/login" className="hermes-nb-pill hermes-nb-pill-primary">Sign in</a>
              )
            )}
            <button
              type="button"
              className="hermes-nb-icon-pill hermes-nb-mobile-toggle"
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Row 2: Nav pills (desktop) */}
        <div className="hermes-nb-row2">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `hermes-nb-nav-pill${isActive ? ' active' : ''}`}
              data-tone={toneFor(item.to)}
            >
              <GlyphTile tone={toneFor(item.to)} icon={<item.icon size={12} />} size="sm" />
              {item.label}
            </NavLink>
          ))}
          <MoreMenu toneFor={toneFor} />
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <button
            type="button"
            className="hermes-nb-backdrop"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="hermes-nb-drawer" aria-label="Navigation">
            <div className="hermes-nb-drawer-head">
              <span>Menu</span>
              <button type="button" className="hermes-nb-icon-pill" onClick={() => setMobileOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="hermes-nb-drawer-body">
              <button type="button" className="hermes-nb-drawer-cmd" onClick={() => { onPaletteOpen(); setMobileOpen(false) }}>
                <Search size={16} /> Spotlight <kbd className="hermes-nb-kbd">⌘K</kbd>
              </button>
              <div className="hermes-nb-drawer-group">
                <div className="hermes-nb-drawer-group-label">Navigation</div>
                {[...primaryNav, ...moreNav].map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => `hermes-nb-drawer-item${isActive ? ' active' : ''}`}
                    data-tone={toneFor(item.to)}
                    onClick={() => setMobileOpen(false)}
                  >
                    <GlyphTile tone={toneFor(item.to)} icon={<item.icon size={14} />} size="sm" /> {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </aside>
        </>
      )}
    </nav>
  )
}
