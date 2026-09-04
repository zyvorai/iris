// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { Link } from 'react-router-dom'

interface HermesPageFooterProps {
  onOpenShortcuts?: () => void
}

export default function HermesPageFooter({ onOpenShortcuts }: HermesPageFooterProps) {
  return (
    <footer className="hermes-page-footer">
      <nav className="hermes-help-strip" aria-label="Help and resources">
        <Link to="/help" className="hermes-help-link">
          Help
        </Link>
        <button type="button" className="hermes-help-link" onClick={onOpenShortcuts}>
          Shortcuts
        </button>
        <a href="https://github.com/zyvorai/hermes" target="_blank" rel="noopener noreferrer" className="hermes-help-link">
          Docs
        </a>
      </nav>
      <p className="hermes-product-line">Hermes · ZyvorAI Labs</p>
    </footer>
  )
}
