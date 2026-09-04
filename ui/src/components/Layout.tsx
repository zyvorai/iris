// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import CommandPalette from './CommandPalette'
import IrisNavbar from './IrisNavbar'
import IrisPageFooter from './IrisPageFooter'
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
      <IrisNavbar onPaletteOpen={() => openSpotlight()} onOpenShortcuts={() => setShortcutsOpen(true)} />
      <div className="main-scroll-area">
        {children}
        <IrisPageFooter onOpenShortcuts={() => setShortcutsOpen(true)} />
      </div>
      {open ? <CommandPalette onClose={closeSpotlight} initialQuery={seed} /> : null}
      {shortcutsOpen ? <KeyboardShortcutsHelp onClose={() => setShortcutsOpen(false)} /> : null}
      <DiagnosisDrawer appId={diagnoseAppId} onClose={closeDiagnose} />
      <ServiceInspectorDrawer appId={appId} initialTab={inspectorTab} onClose={closeInspector} />
    </div>
  )
}
