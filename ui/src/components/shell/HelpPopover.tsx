// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Copy, HelpCircle, Keyboard, Search, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

interface HelpPopoverProps {
  onOpenShortcuts: () => void
}

const resources = [
  { label: 'Help center', href: '/help', icon: BookOpen, internal: true },
  { label: 'Catalog API', href: '/api/v1/catalog', icon: BookOpen, internal: false },
  { label: 'GitHub docs', href: 'https://github.com/zyvorai/iris', icon: BookOpen, internal: false },
]

export default function HelpPopover({ onOpenShortcuts }: HelpPopoverProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return resources
    return resources.filter((r) => r.label.toLowerCase().includes(q))
  }, [filter])

  const copyDiagnostics = async () => {
    const payload = {
      health: `${window.location.origin}/healthz`,
      cluster: `${window.location.origin}/api/v1/cluster/summary`,
    }
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
  }

  return (
    <div className="zeus-help-popover-wrap" ref={rootRef}>
      <button type="button" className="iris-help-menu-btn" onClick={() => setOpen((v) => !v)}>
        <HelpCircle size={16} />
        Help
      </button>
      {open ? (
        <div className="zeus-help-popover zeus-glass" role="dialog" aria-label="Help">
          <div className="zeus-help-search">
            <Search size={14} />
            <input
              type="search"
              placeholder="Search help…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="zeus-help-section">
            <h3>Quick actions</h3>
            <button type="button" className="zeus-help-action" onClick={() => { setOpen(false); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true })) }}>
              <Sparkles size={14} /> Open Spotlight
            </button>
            <button type="button" className="zeus-help-action" onClick={() => { setOpen(false); onOpenShortcuts() }}>
              <Keyboard size={14} /> Keyboard shortcuts
            </button>
            <p className="zeus-help-hint">Try <kbd>⌘K</kbd> then <code>attention</code> or <code>diagnose grafana</code></p>
          </div>
          <div className="zeus-help-section">
            <h3>Resources</h3>
            {filtered.map((item) =>
              item.internal ? (
                <Link key={item.label} to={item.href} className="zeus-help-link" onClick={() => setOpen(false)}>
                  <item.icon size={14} /> {item.label}
                </Link>
              ) : (
                <a key={item.label} href={item.href} className="zeus-help-link" target="_blank" rel="noreferrer">
                  <item.icon size={14} /> {item.label}
                </a>
              ),
            )}
          </div>
          <div className="zeus-help-section">
            <h3>Support</h3>
            <button type="button" className="zeus-help-action" onClick={() => void copyDiagnostics()}>
              <Copy size={14} /> Copy diagnostics URLs
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
