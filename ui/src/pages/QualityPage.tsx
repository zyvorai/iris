// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import { useMutation } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import Button from '../components/nebula/Button'
import CampaignsSection from '../components/quality/CampaignsSection'
import ExemptionsSection from '../components/quality/ExemptionsSection'
import MetricsSection from '../components/quality/MetricsSection'
import ScorecardSection from '../components/quality/ScorecardSection'
import StaleSection from '../components/quality/StaleSection'
import UptimeSection from '../components/quality/UptimeSection'
import { useToast } from '../components/Toast'
import { irisApi } from '../services/irisApi'
import { saveBlob } from '../utils/download'

export default function QualityPage() {
  const toast = useToast()
  const exportCatalog = useMutation({
    mutationFn: async (format: 'json' | 'csv') =>
      saveBlob(await irisApi.exportCatalog(format), `iris-catalog.${format}`),
    onError: (e: Error) => toast(`Export failed: ${e.message}`, 'error'),
  })

  return (
    <div className="hs-page">
      <section className="hs-hero">
        <div className="hs-wrap">
          <p className="hs-eyebrow">Catalog quality</p>
          <h1 className="h-hero" style={{ maxWidth: '16ch' }}>Standards &amp; uptime</h1>
          <p className="hs-lede">Maturity levels, campaigns, exemptions, uptime and stale entries.</p>
          <div className="hs-btnrow">
            <Button onClick={() => exportCatalog.mutate('csv')} disabled={exportCatalog.isPending}>
              <Download size={14} /> Export CSV
            </Button>
            <Button onClick={() => exportCatalog.mutate('json')} disabled={exportCatalog.isPending}>
              <Download size={14} /> Export JSON
            </Button>
          </div>
        </div>
      </section>
      <div className="page-grid">
        <ScorecardSection />
        <CampaignsSection />
        <ExemptionsSection />
        <UptimeSection />
        <StaleSection />
        <MetricsSection />
      </div>
    </div>
  )
}
