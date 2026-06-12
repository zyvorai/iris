// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useState } from 'react'
import {
  Activity,
  Compass,
  GitBranch,
  Globe,
  Grid3X3,
  HeartPulse,
  HelpCircle,
  Home,
  Layers,
  Server,
  Settings,
  Shield,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { loadRailExpanded, saveRailExpanded, SHELL_PREFS_EVENT } from '../../utils/hermesShellPreferences'

const ZEUS_CONSOLE_URL = import.meta.env.VITE_ZEUS_CONSOLE_URL as string | undefined

const navItems = [
  { to: '/', label: 'Overview', icon: Home, shortcut: '⌘1' },
  { to: '/apps', label: 'Catalog', icon: Grid3X3, shortcut: '⌘2' },
  { to: '/spaces', label: 'Spaces', icon: Layers },
  { to: '/cluster', label: 'Routes', icon: Server },
  { to: '/cluster', label: 'Namespaces', icon: Compass, hash: '#namespaces' },
  { to: '/spaces/monitoring', label: 'Monitoring', icon: Activity },
  { to: '/spaces/security', label: 'Security', icon: Shield },
  { to: '/health', label: 'Health', icon: HeartPulse },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/graph', label: 'Graph', icon: GitBranch },
  { to: '/federated', label: 'Federated', icon: Globe },
  { to: '/help', label: 'Settings', icon: Settings },
]

export default function ZeusLeftRail() {
  const [expanded, setExpanded] = useState(loadRailExpanded)

  useEffect(() => {
    const onPrefs = () => setExpanded(loadRailExpanded())
    window.addEventListener(SHELL_PREFS_EVENT, onPrefs)
    return () => window.removeEventListener(SHELL_PREFS_EVENT, onPrefs)
  }, [])

  const onExpand = (value: boolean) => {
    setExpanded(value)
    saveRailExpanded(value)
  }

  return (
    <aside
      className={`zeus-left-rail${expanded ? ' expanded' : ''}`}
      data-testid="zeus-left-rail"
      onMouseEnter={() => onExpand(true)}
      onMouseLeave={() => onExpand(loadRailExpanded())}
      onFocus={() => onExpand(true)}
    >
      <nav className="zeus-rail-nav" aria-label="Primary navigation">
        {navItems.map((item) => (
          <NavLink
            key={`${item.to}-${item.label}`}
            to={item.hash ? `${item.to}${item.hash}` : item.to}
            end={item.to === '/'}
            className={({ isActive }) => `zeus-rail-item${isActive ? ' active' : ''}`}
            title={`${item.label}${item.shortcut ? ` · ${item.shortcut}` : ''}`}
          >
            <item.icon size={18} aria-hidden />
            <span className="zeus-rail-label">{item.label}</span>
            {item.shortcut ? <kbd className="zeus-rail-kbd">{item.shortcut}</kbd> : null}
          </NavLink>
        ))}
        {ZEUS_CONSOLE_URL ? (
          <>
            <a className="zeus-rail-item" href={`${ZEUS_CONSOLE_URL}/consoles`} target="_blank" rel="noreferrer">
              <Server size={18} aria-hidden />
              <span className="zeus-rail-label">VM Consoles</span>
            </a>
            <a className="zeus-rail-item" href={`${ZEUS_CONSOLE_URL}/marketplace`} target="_blank" rel="noreferrer">
              <HelpCircle size={18} aria-hidden />
              <span className="zeus-rail-label">Marketplace</span>
            </a>
          </>
        ) : null}
      </nav>
    </aside>
  )
}
