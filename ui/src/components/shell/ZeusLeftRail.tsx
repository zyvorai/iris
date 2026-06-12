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
  Users,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { loadRailExpanded, saveRailExpanded, SHELL_PREFS_EVENT } from '../../utils/hermesShellPreferences'

const ZEUS_CONSOLE_URL = import.meta.env.VITE_ZEUS_CONSOLE_URL as string | undefined

const navItems = [
  { to: '/', label: 'Overview', icon: Home, end: true },
  { to: '/apps', label: 'Catalog', icon: Grid3X3 },
  { to: '/spaces', label: 'Spaces', icon: Layers },
  { to: '/cluster', label: 'Cluster', icon: Server },
  { to: '/discovery', label: 'Discovery', icon: Compass },
  { to: '/health', label: 'Health', icon: HeartPulse },
  { to: '/graph', label: 'Graph', icon: GitBranch },
  { to: '/federated', label: 'Federated', icon: Globe },
  { to: '/teams', label: 'Teams', icon: Users },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/help', label: 'Help', icon: HelpCircle },
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
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `zeus-rail-item${isActive ? ' active' : ''}`}
            title={item.label}
          >
            <item.icon size={18} aria-hidden />
            <span className="zeus-rail-label">{item.label}</span>
          </NavLink>
        ))}
        {ZEUS_CONSOLE_URL ? (
          <>
            <div className="zeus-rail-divider" aria-hidden />
            <a className="zeus-rail-item" href={`${ZEUS_CONSOLE_URL}/consoles`} target="_blank" rel="noreferrer">
              <Server size={18} aria-hidden />
              <span className="zeus-rail-label">Zeus Consoles</span>
            </a>
          </>
        ) : null}
      </nav>
    </aside>
  )
}
