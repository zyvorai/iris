// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { Link } from 'react-router-dom'

interface IrisPageFooterProps {
  onOpenShortcuts?: () => void
}

export default function IrisPageFooter({ onOpenShortcuts }: IrisPageFooterProps) {
  return (
    <footer className="iris-page-footer">
      <nav className="iris-help-strip" aria-label="Help and resources">
        <Link to="/help" className="iris-help-link">
          Help
        </Link>
        <button type="button" className="iris-help-link" onClick={onOpenShortcuts}>
          Shortcuts
        </button>
        <a href="https://github.com/zyvorai/iris" target="_blank" rel="noopener noreferrer" className="iris-help-link">
          Docs
        </a>
      </nav>
      <p className="iris-product-line">Zyvor</p>
    </footer>
  )
}
