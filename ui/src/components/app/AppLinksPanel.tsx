// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import { ExternalLink } from 'lucide-react'
import GlassPanel from '../nebula/GlassPanel'
import { safeLinks } from '../../utils/links'
import type { AppMeta } from '../../types'

/** Runbook, docs and other links plus lifecycle and tags from annotations. */
export default function AppLinksPanel({ meta }: { meta?: AppMeta }) {
  const links = safeLinks(meta?.links)
  const tags = meta?.tags ?? []
  if (!links.length && !tags.length && !meta?.lifecycle) return null
  return (
    <GlassPanel className="glass-panel-section" data-testid="app-links-panel">
      <p className="section-label">Catalog</p>
      {meta?.lifecycle || tags.length ? (
        <div className="app-meta-row">
          {meta?.lifecycle ? (
            <span className={`chip ${meta.lifecycle === 'deprecated' ? 'chip-warn' : 'chip-accent'}`}>
              {meta.lifecycle}
            </span>
          ) : null}
          {tags.map((tag) => (
            <span key={tag} className="chip chip-muted">#{tag}</span>
          ))}
        </div>
      ) : null}
      {links.length ? (
        <ul className="quality-links">
          {links.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={13} /> {link.title || link.url}
              </a>
              {link.type ? <span className="chip chip-muted">{link.type}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </GlassPanel>
  )
}
