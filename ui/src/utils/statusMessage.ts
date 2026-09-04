// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

export interface FormattedStatusMessage {
  summary: string
  endpoint?: string
  detail?: string
}

function friendlyReason(reason: string): string {
  const r = reason.toLowerCase()
  if (r.includes('context deadline exceeded') || r.includes('timeout')) return 'Health check timed out'
  if (r.includes('connection refused')) return 'Connection refused'
  if (r === 'eof' || r.includes(': eof')) return 'Connection closed unexpectedly'
  if (r.includes('malformed http response') || r.includes('malformed http status')) return 'Probe port is not speaking HTTP'
  if (r.includes('transport connection broken')) return 'Protocol mismatch on probe port'
  if (r.includes('no such host')) return 'Service DNS name not found'
  if (r.includes('connection reset')) return 'Connection reset by peer'
  if (r.includes('tls') || r.includes('certificate')) return 'TLS handshake failed'
  if (r.includes('service has no ready endpoints')) return 'No ready endpoints'
  if (r.includes('dial tcp')) return 'Service unreachable'
  return reason.length > 72 ? `${reason.slice(0, 69)}…` : reason
}

function formatEndpoint(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.replace(/\.svc\.cluster\.local$/i, '')
    const port = url.port || (url.protocol === 'https:' ? '443' : '80')
    return `${host}:${port}`
  } catch {
    return rawUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '')
  }
}

function stripProbeWrapper(text: string): FormattedStatusMessage | null {
  const probe = text.match(/^Get "(https?:\/\/[^"]+)":\s*([\s\S]+)$/)
  if (!probe) return null
  const endpoint = formatEndpoint(probe[1])
  const reason = probe[2].trim()
  return {
    summary: friendlyReason(reason),
    endpoint,
    detail: text,
  }
}

export function formatStatusMessage(raw?: string): FormattedStatusMessage | null {
  if (!raw?.trim()) return null
  const text = raw.trim()

  const fromProbe = stripProbeWrapper(text)
  if (fromProbe) return fromProbe

  if (/^service has no ready endpoints/i.test(text)) {
    return { summary: 'No ready endpoints', detail: text }
  }

  if (text.length > 100) {
    return {
      summary: friendlyReason(text.split(/[:.]/)[0] ?? text) || 'Health check failed',
      detail: text,
    }
  }

  return { summary: friendlyReason(text), detail: text !== friendlyReason(text) ? text : undefined }
}
