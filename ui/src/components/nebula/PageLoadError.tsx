// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

interface PageLoadErrorProps {
  title?: string
  description?: string
  onRetry: () => void
}

export default function PageLoadError({
  title = 'Data unavailable',
  description = 'Could not load this page. Check your connection and try again.',
  onRetry,
}: PageLoadErrorProps) {
  return (
    <div className="hs-page hs-error-page" data-testid="page-load-error">
      <section className="hs-hero hs-hero-center">
        <div className="hs-wrap">
          <h1 className="h-sec">{title}</h1>
          <p className="hs-lede hs-lede-center">{description}</p>
          <div className="hs-btnrow hs-btnrow-center">
            <button type="button" className="hs-btn-primary" onClick={onRetry}>
              Try again
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
