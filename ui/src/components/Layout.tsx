// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useState } from 'react'
import CommandPalette from './CommandPalette'
import HermesNavbar from './HermesNavbar'
import HermesPageFooter from './HermesPageFooter'
import HermesStatusStrip from './HermesStatusStrip'
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp'
import DiagnosisDrawer from './nebula/DiagnosisDrawer'
import ServiceInspectorDrawer from './command/ServiceInspectorDrawer'
import { useInspector } from '../utils/inspectorContext'
import { useSpotlight } from '../utils/spotlightContext'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const { appId, diagnoseAppId, inspectorTab, closeInspector, closeDiagnose } = useInspector()
  const { open, seed, openSpotlight, closeSpotlight } = useSpotlight()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        openSpotlight()
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null
        if (target?.closest('input, textarea, select')) return
        e.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openSpotlight])

  return (
    <div className="app-shell">
      <div className="hermes-page-mesh" aria-hidden />
      <div className="top-command-bar">
        <HermesNavbar onPaletteOpen={() => openSpotlight()} onOpenShortcuts={() => setShortcutsOpen(true)} />
      </div>
      <div className="main-scroll-area">
        {children}
        <HermesPageFooter onOpenShortcuts={() => setShortcutsOpen(true)} />
      </div>
      <HermesStatusStrip />
      {open ? <CommandPalette onClose={closeSpotlight} initialQuery={seed} /> : null}
      {shortcutsOpen ? <KeyboardShortcutsHelp onClose={() => setShortcutsOpen(false)} /> : null}
      <DiagnosisDrawer appId={diagnoseAppId} onClose={closeDiagnose} />
      <ServiceInspectorDrawer appId={appId} initialTab={inspectorTab} onClose={closeInspector} />
    </div>
  )
}
