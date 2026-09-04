// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

export const ZYVOR_URL = 'https://zyvor.dev'
export const ZYVOR_COPY = '© 2026'

export default function ZyvorFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`zyvor-footer ${className}`.trim()} role="contentinfo">
      <a href={ZYVOR_URL} target="_blank" rel="noopener noreferrer" className="zyvor-link">
        zyvor.dev
      </a>
      <span className="zyvor-sep" aria-hidden>
        {' · '}
      </span>
      <span className="zyvor-copy">{ZYVOR_COPY}</span>
    </footer>
  )
}

export function ZyvorInline({ className = '' }: { className?: string }) {
  return (
    <span className={`zyvor-inline ${className}`.trim()}>
      <a href={ZYVOR_URL} target="_blank" rel="noopener noreferrer" className="zyvor-link">
        zyvor.dev
      </a>
      <span className="zyvor-sep" aria-hidden>
        {' · '}
      </span>
      <span className="zyvor-copy">{ZYVOR_COPY}</span>
    </span>
  )
}
