// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import CommandPalette from './CommandPalette'
import HermesPageFooter from './HermesPageFooter'
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp'
import ServiceInspectorDrawer from './command/ServiceInspectorDrawer'
import ZeusDock from './shell/ZeusDock'
import ZeusLeftRail from './shell/ZeusLeftRail'
import ZeusTopBar from './shell/ZeusTopBar'
import { useInspector } from '../utils/inspectorContext'

interface LayoutProps {
  children: React.ReactNode
  paletteOpen: boolean
  onPaletteOpen: () => void
  onPaletteClose: () => void
}

const titles: Record<string, string> = {
  '/': 'Overview',
  '/apps': 'Catalog',
  '/spaces': 'Spaces',
  '/cluster': 'Cluster',
  '/graph': 'Graph',
  '/teams': 'Teams',
  '/discovery': 'Discovery',
  '/health': 'Health',
  '/activity': 'Activity',
  '/help': 'Settings',
  '/federated': 'Federated',
}

export default function Layout({ children, paletteOpen, onPaletteOpen, onPaletteClose }: LayoutProps) {
  const location = useLocation()
  const pageTitle = titles[location.pathname] ?? 'Hermes'
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const { appId, closeInspector } = useInspector()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null
        if (target?.closest('input, textarea, select')) return
        e.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="hermes-shell command-surface-shell" data-shell-density="calm">
      <div className="hermes-page-mesh" aria-hidden />
      <div className="command-surface-body">
        <ZeusLeftRail />
        <div className="command-surface-main">
          <ZeusTopBar pageTitle={pageTitle} onPaletteOpen={onPaletteOpen} onOpenShortcuts={() => setShortcutsOpen(true)} />
          <main className="hermes-main hermes-scroll-body">{children}</main>
          <HermesPageFooter onOpenShortcuts={() => setShortcutsOpen(true)} />
        </div>
      </div>
      <ZeusDock onPaletteOpen={onPaletteOpen} />
      {paletteOpen ? <CommandPalette onClose={onPaletteClose} /> : null}
      {shortcutsOpen ? <KeyboardShortcutsHelp onClose={() => setShortcutsOpen(false)} /> : null}
      <ServiceInspectorDrawer appId={appId} onClose={closeInspector} />
    </div>
  )
}
