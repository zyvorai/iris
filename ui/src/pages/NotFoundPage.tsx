// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { MapPinOff } from 'lucide-react'
import GlassPanel from '../components/nebula/GlassPanel'
import PageFrame from '../components/nebula/PageFrame'
import EmptyState from '../components/nebula/EmptyState'
import Button from '../components/nebula/Button'

export default function NotFoundPage() {
  return (
    <PageFrame loading={false} error={false} hasData onRetry={() => {}}>
      <div className="hs-page">
        <section className="hs-hero">
          <div className="hs-wrap">
            <p className="hs-eyebrow">404</p>
            <h1 className="h-hero" style={{ maxWidth: '12ch' }}>Page not found</h1>
            <p className="hs-lede">
              That URL doesn&apos;t match anything in Hermes — it may have moved, or the link was mistyped.
            </p>
          </div>
        </section>
      <div className="page-grid">
        <GlassPanel className="glass-panel-section">
          <EmptyState
            icon={<MapPinOff size={22} />}
            title="Nothing here"
            description="Try Overview or browse the catalog for published apps."
            action={
              <>
                <Button variant="primary" to="/">
                  Back to Overview
                </Button>
                <Button variant="secondary" to="/apps">
                  Browse Catalog
                </Button>
              </>
            }
          />
        </GlassPanel>
      </div>
      </div>
    </PageFrame>
  )
}
