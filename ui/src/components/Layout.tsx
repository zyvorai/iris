// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useState } from 'react'
import CommandPalette from './CommandPalette'
import HermesNavbar from './HermesNavbar'
import HermesPageFooter from './HermesPageFooter'
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp'
import ServiceInspectorDrawer from './command/ServiceInspectorDrawer'
import { useGlobalNavShortcuts } from '../hooks/useGlobalNavShortcuts'
import { useInspector } from '../utils/inspectorContext'

interface LayoutProps {
  children: React.ReactNode
  paletteOpen: boolean
  onPaletteOpen: () => void
  onPaletteClose: () => void
}

export default function Layout({ children, paletteOpen, onPaletteOpen, onPaletteClose }: LayoutProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const { appId, closeInspector } = useInspector()
  useGlobalNavShortcuts()

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
    <div className="hermes-shell">
      <div className="hermes-page-mesh" aria-hidden />
      <HermesNavbar onPaletteOpen={onPaletteOpen} onOpenShortcuts={() => setShortcutsOpen(true)} />
      <main className="hermes-main hermes-scroll-body">{children}</main>
      <HermesPageFooter onOpenShortcuts={() => setShortcutsOpen(true)} />
      {paletteOpen ? <CommandPalette onClose={onPaletteClose} /> : null}
      {shortcutsOpen ? <KeyboardShortcutsHelp onClose={() => setShortcutsOpen(false)} /> : null}
      <ServiceInspectorDrawer appId={appId} onClose={closeInspector} />
    </div>
  )
}
