// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect } from 'react'
import { Keyboard, X } from 'lucide-react'
import Button from './nebula/Button'

const shortcuts = [
  { keys: '⌘K', label: 'Open Spotlight search' },
  { keys: '?', label: 'Show keyboard shortcuts' },
  { keys: '⌘1–9', label: 'Jump to main pages (Overview, Catalog, Spaces…)' },
  { keys: 'Esc', label: 'Close Spotlight or this panel' },
  { keys: '↑ ↓', label: 'Navigate Spotlight results' },
  { keys: 'Enter', label: 'Open selected app or route' },
]

const spotlightAi = [
  'explain — fleet health summary',
  'diagnose grafana / why grafana — app insight preview',
  'suggest publish — ranked discovery queue',
  'graph insight — topology / unresolved deps',
  'ns insight <namespace> — namespace rollup',
  'owner insight <team> — team ownership health',
  'ai: <question> — natural-language catalog search',
]

interface KeyboardShortcutsHelpProps {
  onClose: () => void
}

export default function KeyboardShortcutsHelp({ onClose }: KeyboardShortcutsHelpProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="diagnosis-drawer-backdrop shortcuts-backdrop-nebula"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <aside className="shortcuts-panel-nebula" onClick={(e) => e.stopPropagation()}>
        <header className="diagnosis-drawer-header">
          <div>
            <h2 id="shortcuts-title">
              <Keyboard size={16} /> Keyboard shortcuts
            </h2>
            <p className="body-text">Hermes navigation</p>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </header>
        <ul className="shortcuts-list-nebula">
          {shortcuts.map((item) => (
            <li key={item.keys}>
              <kbd>{item.keys}</kbd>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
        <div className="shortcuts-ai-section">
          <p className="section-label" style={{ marginTop: '1rem' }}>Spotlight · Zeus AI</p>
          <ul className="shortcuts-list-nebula shortcuts-list-compact">
            {spotlightAi.map((item) => (
              <li key={item}>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
