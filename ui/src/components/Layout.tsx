// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Compass, Grid3X3, HeartPulse, Home, Search, Server } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import CommandPalette from './CommandPalette'

interface LayoutProps {
  children: React.ReactNode
  paletteOpen: boolean
  onPaletteOpen: () => void
  onPaletteClose: () => void
}

const titles: Record<string, string> = {
  '/': 'Home',
  '/apps': 'Apps',
  '/cluster': 'Cluster',
  '/discovery': 'Discovery',
  '/health': 'Health',
}

export default function Layout({ children, paletteOpen, onPaletteOpen, onPaletteClose }: LayoutProps) {
  const location = useLocation()
  const pageTitle = titles[location.pathname] ?? 'Hermes Dock'

  return (
    <div className="hermes-shell" data-shell-density="calm">
      <header className="hermes-menubar">
        <div className="hermes-brand">
          <div className="hermes-brand-mark" aria-hidden />
          <div>
            <h1>Hermes</h1>
            <p>Service Gateway</p>
          </div>
        </div>
        <div className="menubar-title">{pageTitle}</div>
        <button type="button" className="hermes-search-btn" onClick={onPaletteOpen}>
          <Search size={16} />
          <span>Spotlight</span>
          <kbd>⌘K</kbd>
        </button>
      </header>
      <main className="hermes-main hermes-scroll-body">{children}</main>
      <footer className="hermes-dock mac-dock" aria-label="App dock">
        <NavLink to="/" className={({ isActive }) => `dock-item${isActive ? ' active' : ''}`} title="Home">
          <Home size={20} />
        </NavLink>
        <NavLink to="/apps" className={({ isActive }) => `dock-item${isActive ? ' active' : ''}`} title="Apps">
          <Grid3X3 size={20} />
        </NavLink>
        <NavLink to="/cluster" className={({ isActive }) => `dock-item${isActive ? ' active' : ''}`} title="Cluster">
          <Server size={20} />
        </NavLink>
        <NavLink to="/discovery" className={({ isActive }) => `dock-item${isActive ? ' active' : ''}`} title="Discovery">
          <Compass size={20} />
        </NavLink>
        <NavLink to="/health" className={({ isActive }) => `dock-item${isActive ? ' active' : ''}`} title="Health">
          <HeartPulse size={20} />
        </NavLink>
        <button type="button" className="dock-item dock-spotlight" title="Spotlight" onClick={onPaletteOpen}>
          <Search size={20} />
        </button>
      </footer>
      {paletteOpen ? <CommandPalette onClose={onPaletteClose} /> : null}
    </div>
  )
}
