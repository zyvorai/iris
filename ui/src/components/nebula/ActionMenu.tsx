// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'

export interface ActionMenuItem {
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  label?: string
  className?: string
}

export default function ActionMenu({ items, label = 'More actions', className = '' }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const visible = items.filter((item) => !item.disabled)
  if (!visible.length) return null

  return (
    <div className={`action-menu ${className}`.trim()} ref={ref}>
      <button
        type="button"
        className="nebula-btn nebula-btn-ghost nebula-btn-compact action-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={16} strokeWidth={1.5} />
      </button>
      {open ? (
        <div className="action-menu-dropdown" role="menu">
          {visible.map((item) =>
            item.href ? (
              <a
                key={item.label}
                href={item.href}
                className="action-menu-item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ) : (
              <button
                key={item.label}
                type="button"
                className="action-menu-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  item.onClick?.()
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  )
}
