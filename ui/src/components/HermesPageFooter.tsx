// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Link } from 'react-router-dom'
import { BookOpen, Keyboard, LifeBuoy } from 'lucide-react'
import ZyvorFooter from './ZyvorBrand'

interface HermesPageFooterProps {
  onOpenShortcuts?: () => void
}

export default function HermesPageFooter({ onOpenShortcuts }: HermesPageFooterProps) {
  return (
    <div className="hermes-page-footer">
      <nav className="hermes-help-strip" aria-label="Help and resources">
        <Link to="/help" className="hermes-help-link">
          <LifeBuoy size={13} />
          Help
        </Link>
        <button type="button" className="hermes-help-link" onClick={onOpenShortcuts}>
          <Keyboard size={13} />
          Shortcuts
        </button>
        <a href="https://github.com/ssahani/hermes" target="_blank" rel="noopener noreferrer" className="hermes-help-link">
          <BookOpen size={13} />
          Docs
        </a>
        <a href="/api/v1/catalog" className="hermes-help-link">
          API
        </a>
      </nav>
      <ZyvorFooter />
      <p className="hermes-product-line">Hermes · Zeus Application Operating Layer</p>
    </div>
  )
}
