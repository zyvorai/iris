// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useState } from 'react'
import { Compass, GitBranch, Grid3X3, HeartPulse, History, Home, Layers, Search, Server, Settings, Users } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import AppIcon from '../AppIcon'
import {
  loadDockAutoHide,
  loadDockMagnify,
  loadDockPosition,
  loadDockSize,
  saveDockAutoHide,
  saveDockMagnify,
  saveDockPosition,
  saveDockSize,
  SHELL_PREFS_EVENT,
  type DockPosition,
  type DockSize,
} from '../../utils/hermesShellPreferences'
import { hermesApi, openApp } from '../../services/hermesApi'

interface ZeusDockProps {
  onPaletteOpen: () => void
}

const dockNav = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/apps', icon: Grid3X3, label: 'Apps' },
  { to: '/spaces', icon: Layers, label: 'Spaces' },
  { to: '/cluster', icon: Server, label: 'Cluster' },
  { to: '/graph', icon: GitBranch, label: 'Graph' },
  { to: '/teams', icon: Users, label: 'Teams' },
  { to: '/discovery', icon: Compass, label: 'Discovery' },
  { to: '/health', icon: HeartPulse, label: 'Health' },
  { to: '/activity', icon: History, label: 'Activity' },
]

export default function ZeusDock({ onPaletteOpen }: ZeusDockProps) {
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: hermesApi.listFavorites })
  const [position, setPosition] = useState<DockPosition>(loadDockPosition)
  const [size, setSize] = useState<DockSize>(loadDockSize)
  const [autoHide, setAutoHide] = useState(loadDockAutoHide)
  const [magnify, setMagnify] = useState(loadDockMagnify)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [revealed, setRevealed] = useState(!autoHide)

  useEffect(() => {
    const onPrefs = () => {
      setPosition(loadDockPosition())
      setSize(loadDockSize())
      setAutoHide(loadDockAutoHide())
      setMagnify(loadDockMagnify())
    }
    window.addEventListener(SHELL_PREFS_EVENT, onPrefs)
    return () => window.removeEventListener(SHELL_PREFS_EVENT, onPrefs)
  }, [])

  useEffect(() => {
    setRevealed(!autoHide)
  }, [autoHide])

  const dockClass = [
    'hermes-dock',
    'mac-dock',
    'zeus-dock',
    `zeus-dock-${position}`,
    `zeus-dock-${size}`,
    magnify ? 'zeus-dock-magnify' : '',
    autoHide && !revealed ? 'zeus-dock-hidden' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      {autoHide ? (
        <div
          className={`zeus-dock-reveal zeus-dock-reveal-${position}`}
          onMouseEnter={() => setRevealed(true)}
          aria-hidden
        />
      ) : null}
      <nav
        className={dockClass}
        aria-label="App dock"
        onMouseLeave={() => autoHide && setRevealed(false)}
        onContextMenu={(e) => {
          e.preventDefault()
          setSettingsOpen((v) => !v)
        }}
      >
        {dockNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `dock-item${isActive ? ' active' : ''}`}
            title={item.label}
          >
            <item.icon size={20} />
          </NavLink>
        ))}
        {favorites.data?.length ? <div className="dock-divider" aria-hidden /> : null}
        {favorites.data?.slice(0, 6).map((app) => (
          <button key={app.id} type="button" className="dock-item dock-fav" title={app.displayName} onClick={() => openApp(app)}>
            <AppIcon icon={app.icon} name={app.displayName} size="sm" />
          </button>
        ))}
        <button type="button" className="dock-item dock-spotlight" title="Spotlight" onClick={onPaletteOpen}>
          <Search size={20} />
        </button>
        <button type="button" className="dock-item dock-settings" title="Dock settings" onClick={() => setSettingsOpen((v) => !v)}>
          <Settings size={18} />
        </button>
        {settingsOpen ? (
          <div className="zeus-dock-settings zeus-glass" onClick={(e) => e.stopPropagation()}>
            <strong>Dock</strong>
            <label>
              Position
              <select
                value={position}
                onChange={(e) => {
                  const next = e.target.value as DockPosition
                  setPosition(next)
                  saveDockPosition(next)
                }}
              >
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </label>
            <label>
              Size
              <select
                value={size}
                onChange={(e) => {
                  const next = e.target.value as DockSize
                  setSize(next)
                  saveDockSize(next)
                }}
              >
                <option value="compact">Compact</option>
                <option value="regular">Regular</option>
                <option value="large">Large</option>
              </select>
            </label>
            <label className="zeus-dock-toggle">
              <input type="checkbox" checked={autoHide} onChange={(e) => { setAutoHide(e.target.checked); saveDockAutoHide(e.target.checked) }} />
              Auto-hide
            </label>
            <label className="zeus-dock-toggle">
              <input type="checkbox" checked={magnify} onChange={(e) => { setMagnify(e.target.checked); saveDockMagnify(e.target.checked) }} />
              Magnification
            </label>
          </div>
        ) : null}
      </nav>
    </>
  )
}
