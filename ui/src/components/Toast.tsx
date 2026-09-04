// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

interface ToastItem {
  id: number
  message: string
  tone: 'ok' | 'error'
}

type ToastFn = (message: string, tone?: 'ok' | 'error') => void

const ToastContext = createContext<ToastFn | null>(null)

/** Lightweight toast system — Hermes had none. Wired at mutation call sites
 * (publish, hide, share create/revoke, federation publish) that previously
 * gave no user-facing success/failure feedback beyond the button's own
 * pending state. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const toast = useCallback<ToastFn>((message, tone = 'ok') => {
    const id = ++idRef.current
    setItems((prev) => [...prev, { id, message, tone }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-host" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.tone === 'ok' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
