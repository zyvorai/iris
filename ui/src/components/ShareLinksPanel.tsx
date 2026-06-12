// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Link2, Trash2 } from 'lucide-react'
import type { HermesApp } from '../types'
import { copyShareUrl, hermesApi, sharePublicUrl } from '../services/hermesApi'

const TTL_OPTIONS = [
  { label: '30 min', minutes: 30 },
  { label: '2 hours', minutes: 120 },
  { label: '24 hours', minutes: 1440 },
]

function formatExpiry(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function ShareLinksPanel({ app }: { app: HermesApp }) {
  const qc = useQueryClient()
  const shares = useQuery({ queryKey: ['shares'], queryFn: hermesApi.listShares })
  const appShares = (shares.data ?? []).filter((s) => s.appId === app.id)

  const createMutation = useMutation({
    mutationFn: (ttlMinutes: number) =>
      hermesApi.createShare({ appId: app.id, ttlMinutes }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['shares'] }),
  })

  const revokeMutation = useMutation({
    mutationFn: (token: string) => hermesApi.revokeShare(token),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['shares'] }),
  })

  return (
    <section className="glass-section share-panel">
      <div className="share-panel-head">
        <div>
          <h3>
            <Link2 size={14} /> Share links
          </h3>
          <p className="hero-sub">Time-limited URLs for teammates without dock access.</p>
        </div>
        <div className="share-create-row">
          {TTL_OPTIONS.map((opt) => (
            <button
              key={opt.minutes}
              type="button"
              className="btn"
              disabled={createMutation.isPending}
              onClick={() => void createMutation.mutate(opt.minutes)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {createMutation.error ? (
        <p className="app-problem">Could not create share link. App must be published.</p>
      ) : null}
      {appShares.length ? (
        <ul className="share-list">
          {appShares.map((share) => (
            <li key={share.token} className="share-item">
              <div>
                <code>{sharePublicUrl(share.sharePath)}</code>
                <span className="share-expiry">Expires {formatExpiry(share.expiresAt)}</span>
              </div>
              <div className="app-actions">
                <button type="button" className="btn" onClick={() => void copyShareUrl(share.sharePath)}>
                  <Copy size={12} /> Copy
                </button>
                <button
                  type="button"
                  className="btn btn-warn"
                  disabled={revokeMutation.isPending}
                  onClick={() => void revokeMutation.mutate(share.token)}
                >
                  <Trash2 size={12} /> Revoke
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">No active share links for this app.</div>
      )}
    </section>
  )
}
