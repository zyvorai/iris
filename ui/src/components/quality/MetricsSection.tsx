// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import { useQuery } from '@tanstack/react-query'
import GlassPanel from '../nebula/GlassPanel'
import { irisApi } from '../../services/irisApi'
import { parseAppMetrics } from '../../utils/appMetrics'
import SectionState from './SectionState'

/** Per-app Prometheus series, limited to the apps in the caller's catalog. */
export default function MetricsSection() {
  const metrics = useQuery({ queryKey: ['app-metrics'], queryFn: irisApi.getMetricsText })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: irisApi.listCatalog })
  const visible = new Set((catalog.data ?? []).map((a) => `${a.namespace}/${a.slug}`))
  const rows = parseAppMetrics(metrics.data ?? '').filter((r) => visible.has(`${r.namespace}/${r.app}`))

  return (
    <GlassPanel className="glass-panel-section" data-testid="metrics-section">
      <h2 className="section-title">Per-app metrics</h2>
      <p className="body-text">
        <code>iris_app_status</code> and <code>iris_app_conformance_score</code> from{' '}
        <a href="/metrics" target="_blank" rel="noreferrer">/metrics</a>.
      </p>
      <SectionState query={metrics} name="metrics" />
      {metrics.data !== undefined && !rows.length ? <p className="body-text">No per-app series.</p> : null}
      {rows.length ? (
        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr><th>Namespace</th><th>App</th><th>Status</th><th>Conformance</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.namespace}/${r.app}`}>
                  <td>{r.namespace}</td>
                  <td>{r.app}</td>
                  <td>{r.status ?? '—'}</td>
                  <td>{r.conformanceScore ?? 'unpublished'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </GlassPanel>
  )
}
