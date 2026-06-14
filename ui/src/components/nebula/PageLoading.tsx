// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

interface PageLoadingProps {
  rows?: number
}

export default function PageLoading({ rows = 4 }: PageLoadingProps) {
  return (
    <div className="page-loading-skeleton" data-testid="page-loading">
      <div className="skeleton-hero" />
      <div className="skeleton-metric-strip">
        <div className="skeleton-metric" />
        <div className="skeleton-metric" />
        <div className="skeleton-metric" />
      </div>
      <div className="skeleton-toolbar" />
      <div className="skeleton-grid">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton-card" />
        ))}
      </div>
    </div>
  )
}
