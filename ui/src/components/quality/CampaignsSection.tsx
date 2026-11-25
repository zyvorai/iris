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

const EMPTY = { name: '', dueDate: '', namespace: '', owner: '', rules: [] as string[] }

export default function CampaignsSection() {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const campaigns = useQuery({ queryKey: ['campaigns'], queryFn: irisApi.listCampaigns })
  const refresh = () => void qc.invalidateQueries({ queryKey: ['campaigns'] })

  const create = useMutation({
    mutationFn: () => irisApi.createCampaign(form),
    onSuccess: () => {
      setForm(EMPTY)
      toast('Campaign created')
      refresh()
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })
  const remove = useMutation({
    mutationFn: irisApi.deleteCampaign,
    onSuccess: refresh,
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const toggleRule = (rule: string) =>
    setForm((f) => ({
      ...f,
      rules: f.rules.includes(rule) ? f.rules.filter((r) => r !== rule) : [...f.rules, rule],
    }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate()
  }

  return (
    <GlassPanel className="glass-panel-section" data-testid="campaigns-section">
      <h2 className="section-title">Campaigns</h2>
      <p className="body-text">Rules with a due date, tracked across published apps.</p>
      <SectionState query={campaigns} name="campaigns" />
      {campaigns.data?.length === 0 ? <p className="body-text">No campaigns yet.</p> : null}
      {campaigns.data?.map((c) => (
        <article key={c.id} className="quality-card">
          <div className="quality-head">
            <h3 className="section-title">{c.name}</h3>
            <span className={`chip ${c.status === 'overdue' ? 'chip-warn' : c.status === 'complete' ? 'chip-ok' : 'chip-muted'}`}>
              {c.status}
            </span>
            <Button variant="ghost" onClick={() => remove.mutate(c.id)} aria-label={`Delete campaign ${c.name}`}>
              Delete
            </Button>
          </div>
          <progress max={100} value={c.percent} aria-label={`${c.name} progress`} />
          <p className="body-text">
            {c.passing} of {c.total} passing ({c.percent}%) · due {c.dueDate}
            {c.status === 'complete' ? '' : c.daysLeft < 0 ? ` · ${-c.daysLeft} day(s) late` : ` · ${c.daysLeft} day(s) left`}
            {' · '}{c.rules.join(', ')}
          </p>
          {c.failingApps.length ? (
            <details>
              <summary className="body-text">{c.failing} failing app(s)</summary>
              <ul>
                {c.failingApps.map((a) => (
                  <li key={a.id} className="body-text">
                    <strong>{a.label}</strong> ({a.owner || 'no owner'}): {a.rules.join(', ')}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </article>
      ))}
      <form className="quality-form" onSubmit={submit} aria-label="New campaign">
        <input className="page-toolbar-search" required maxLength={120} placeholder="Campaign name" aria-label="Campaign name"
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="page-toolbar-search" required type="date" aria-label="Due date"
          value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        <input className="page-toolbar-search" placeholder="Namespace (optional)" aria-label="Campaign namespace"
          value={form.namespace} onChange={(e) => setForm({ ...form, namespace: e.target.value })} />
        <input className="page-toolbar-search" placeholder="Owner (optional)" aria-label="Campaign owner"
          value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
        <fieldset className="quality-rules">
          <legend className="body-text">Rules</legend>
          {CONFORMANCE_RULES.map((rule) => (
            <label key={rule} className="body-text">
              <input type="checkbox" checked={form.rules.includes(rule)} onChange={() => toggleRule(rule)} /> {rule}
            </label>
          ))}
        </fieldset>
        <Button variant="primary" type="submit" disabled={!form.rules.length || create.isPending}>
          Create campaign
        </Button>
      </form>
    </GlassPanel>
  )
}
