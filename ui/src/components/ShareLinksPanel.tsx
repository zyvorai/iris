// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Link2, Trash2 } from 'lucide-react'
import GlassPanel from './nebula/GlassPanel'
import Button from './nebula/Button'
import EmptyState from './nebula/EmptyState'
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
    mutationFn: (ttlMinutes: number) => hermesApi.createShare({ appId: app.id, ttlMinutes }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['shares'] }),
  })

  const revokeMutation = useMutation({
    mutationFn: (token: string) => hermesApi.revokeShare(token),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['shares'] }),
  })

  return (
    <GlassPanel className="glass-panel-section share-panel-nebula">
      <div className="share-panel-head-nebula">
        <div>
          <p className="section-label">
            <Link2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Share links
          </p>
          <p className="body-text">Time-limited URLs for teammates without launchpad access.</p>
        </div>
        <div className="share-create-row-nebula">
          {TTL_OPTIONS.map((opt) => (
            <Button
              key={opt.minutes}
              variant="secondary"
              className="nebula-btn-compact"
              disabled={createMutation.isPending}
              onClick={() => void createMutation.mutate(opt.minutes)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {shares.isLoading ? (
        <div className="page-loading-skeleton page-loading-skeleton-compact">
          <div className="skeleton-card" style={{ height: 48 }} />
        </div>
      ) : null}

      {createMutation.error ? (
        <p className="service-status-summary" style={{ color: 'var(--accent-red)' }}>
          Could not create share link. App must be published.
        </p>
      ) : null}

      {!shares.isLoading && appShares.length ? (
        <ul className="share-list-nebula">
          {appShares.map((share) => (
            <li key={share.token} className="share-item-nebula">
              <div className="share-item-copy">
                <code className="route-display-path">{sharePublicUrl(share.sharePath)}</code>
                <span className="share-expiry">Expires {formatExpiry(share.expiresAt)}</span>
              </div>
              <div className="action-row-primary">
                <Button variant="ghost" className="nebula-btn-compact" onClick={() => void copyShareUrl(share.sharePath)}>
                  <Copy size={12} /> Copy
                </Button>
                <Button
                  variant="danger"
                  className="nebula-btn-compact"
                  disabled={revokeMutation.isPending}
                  onClick={() => void revokeMutation.mutate(share.token)}
                >
                  <Trash2 size={12} /> Revoke
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : !shares.isLoading ? (
        <EmptyState icon={<Link2 size={22} />} title="No active share links" description="Create a time-limited link above." />
      ) : null}
    </GlassPanel>
  )
}
