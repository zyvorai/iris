// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import GlassPanel from '../nebula/GlassPanel'
import Button from '../nebula/Button'
import { useToast } from '../Toast'
import { irisApi } from '../../services/irisApi'
import { CONFORMANCE_RULES } from '../../utils/format'
import SectionState from './SectionState'

const EMPTY = { appId: '', rule: CONFORMANCE_RULES[0], reason: '', days: 30 }

export default function ExemptionsSection() {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const exemptions = useQuery({ queryKey: ['exemptions'], queryFn: irisApi.listExemptions })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: irisApi.listCatalog })
  const refresh = () => {
    for (const key of ['exemptions', 'scorecard', 'campaigns', 'conformance', 'app-metrics']) {
      void qc.invalidateQueries({ queryKey: [key] })
    }
  }

  const create = useMutation({
    mutationFn: () => irisApi.createExemption(form),
    onSuccess: () => {
      setForm(EMPTY)
      toast('Exemption granted')
      refresh()
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })
  const revoke = useMutation({
    mutationFn: irisApi.deleteExemption,
    onSuccess: refresh,
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }

  return (
    <GlassPanel className="glass-panel-section" data-testid="exemptions-section">
      <h2 className="section-title">Rule exemptions</h2>
      <p className="body-text">Waive one rule for one app, with a reason and an expiry. Administrators only.</p>
      <SectionState query={exemptions} name="exemptions" />
      {exemptions.data?.length === 0 ? <p className="body-text">No exemptions.</p> : null}
      {exemptions.data?.length ? (
        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr><th>App</th><th>Rule</th><th>Reason</th><th>Granted by</th><th>Expires</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {exemptions.data.map((e) => (
                <tr key={e.id}>
                  <td>{e.appId}</td>
                  <td>{e.rule}</td>
                  <td>{e.reason}</td>
                  <td>{e.createdBy}</td>
                  <td>{e.expiresAt.slice(0, 10)}</td>
                  <td>{e.status}</td>
                  <td>
                    <Button variant="ghost" onClick={() => revoke.mutate(e.id)} aria-label={`Revoke ${e.rule} for ${e.appId}`}>
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <form className="quality-form" onSubmit={submit} aria-label="New exemption">
        <select className="page-toolbar-select" required aria-label="Exempt app" value={form.appId}
          onChange={(e) => setForm({ ...form, appId: e.target.value })}>
          <option value="">Choose an app…</option>
          {(catalog.data ?? []).filter((a) => a.visibility.published).map((a) => (
            <option key={a.id} value={a.id}>{a.id}</option>
          ))}
        </select>
        <select className="page-toolbar-select" aria-label="Exempt rule" value={form.rule}
          onChange={(e) => setForm({ ...form, rule: e.target.value })}>
          {CONFORMANCE_RULES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input className="page-toolbar-search" required maxLength={500} placeholder="Reason" aria-label="Exemption reason"
          value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <input className="page-toolbar-search" required type="number" min={1} max={365} aria-label="Exemption days"
          value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} />
        <Button variant="primary" type="submit" disabled={create.isPending}>
          Grant exemption
        </Button>
      </form>
    </GlassPanel>
  )
}
