// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Compass, Grid3X3, HeartPulse, History, Home, Layers, Search, Server } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import CommandPalette from './CommandPalette'
import AppIcon from './AppIcon'
import { hermesApi, openApp } from '../services/hermesApi'

interface LayoutProps {
  children: React.ReactNode
  paletteOpen: boolean
  onPaletteOpen: () => void
  onPaletteClose: () => void
}

const titles: Record<string, string> = {
  '/': 'Home',
  '/apps': 'Apps',
  '/spaces': 'Spaces',
  '/cluster': 'Cluster',
  '/discovery': 'Discovery',
  '/health': 'Health',
  '/activity': 'Activity',
}

export default function Layout({ children, paletteOpen, onPaletteOpen, onPaletteClose }: LayoutProps) {
  const location = useLocation()
  const pageTitle = titles[location.pathname] ?? 'Hermes Dock'
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: hermesApi.listFavorites })
  const auth = useQuery({ queryKey: ['auth-me'], queryFn: hermesApi.authMe, retry: false })

  return (
    <div className="hermes-shell" data-shell-density="calm">
      <header className="hermes-menubar">
        <div className="hermes-brand">
          <div className="hermes-brand-mark" aria-hidden />
          <div>
            <h1>Hermes</h1>
            <p>Application Operating Layer</p>
          </div>
        </div>
        <div className="menubar-title">{pageTitle}</div>
        <button type="button" className="hermes-search-btn" onClick={onPaletteOpen}>
          <Search size={16} />
          <span>Spotlight</span>
          <kbd>⌘K</kbd>
        </button>
        {auth.data?.mode === 'oidc' ? (
          auth.data.authenticated ? (
            <div className="auth-chip" title={auth.data.userId}>
              {auth.data.userId}
              <button type="button" className="btn btn-ghost" onClick={() => { void fetch('/auth/logout', { method: 'POST' }).then(() => window.location.reload()) }}>
                Sign out
              </button>
            </div>
          ) : (
            <a href="/auth/login" className="btn btn-primary auth-login">
              Sign in
            </a>
          )
        ) : null}
      </header>
      <main className="hermes-main hermes-scroll-body">{children}</main>
      <footer className="hermes-dock mac-dock" aria-label="App dock">
        <NavLink to="/" className={({ isActive }) => `dock-item${isActive ? ' active' : ''}`} title="Home">
          <Home size={20} />
        </NavLink>
        <NavLink to="/apps" className={({ isActive }) => `dock-item${isActive ? ' active' : ''}`} title="Apps">
          <Grid3X3 size={20} />
        </NavLink>
        <NavLink to="/spaces" className={({ isActive }) => `dock-item${isActive ? ' active' : ''}`} title="Spaces">
          <Layers size={20} />
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
        <NavLink to="/activity" className={({ isActive }) => `dock-item${isActive ? ' active' : ''}`} title="Activity">
          <History size={20} />
        </NavLink>
        {favorites.data?.length ? (
          <div className="dock-divider" aria-hidden />
        ) : null}
        {favorites.data?.slice(0, 6).map((app) => (
          <button
            key={app.id}
            type="button"
            className="dock-item dock-fav"
            title={app.displayName}
            onClick={() => openApp(app)}
          >
            <AppIcon icon={app.icon} name={app.displayName} size="sm" />
          </button>
        ))}
        <button type="button" className="dock-item dock-spotlight" title="Spotlight" onClick={onPaletteOpen}>
          <Search size={20} />
        </button>
      </footer>
      {paletteOpen ? <CommandPalette onClose={onPaletteClose} /> : null}
    </div>
  )
}
