// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect } from 'react'
import { Keyboard, X } from 'lucide-react'

const shortcuts = [
  { keys: '⌘K', label: 'Open Spotlight search' },
  { keys: '?', label: 'Show keyboard shortcuts' },
  { keys: '⌘1–9', label: 'Jump to main pages (Overview, Catalog, Spaces…)' },
  { keys: 'Esc', label: 'Close Spotlight or this panel' },
  { keys: '↑ ↓', label: 'Navigate Spotlight results' },
  { keys: 'Enter', label: 'Open selected app or route' },
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
      className="shortcuts-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="shortcuts-panel glass-section">
        <div className="shortcuts-head">
          <div>
            <h2 id="shortcuts-title">
              <Keyboard size={16} /> Keyboard shortcuts
            </h2>
            <p className="hero-sub">Hermes Dock navigation</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <ul className="shortcuts-list">
          {shortcuts.map((item) => (
            <li key={item.keys}>
              <kbd>{item.keys}</kbd>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
