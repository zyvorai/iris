// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import QualityPage from './QualityPage'
import { makeApp, mockFetch, renderWithProviders } from '../test/harness'

const scorecard = {
  summary: { gold: 1, silver: 0, bronze: 0, none: 1 },
  apps: [
    { id: 'demo/bad', label: 'bad-app', namespace: 'demo', level: 'none', score: 40, nextSteps: ['no ready endpoints'] },
    { id: 'demo/good', label: 'good-app', namespace: 'demo', owner: 'team', level: 'gold', score: 100, nextSteps: [] },
  ],
}

const base = {
  'GET /api/v1/scorecard': scorecard,
  'GET /api/v1/campaigns': [
    {
      id: 'c1', name: 'Own it', description: '', rules: ['owner-missing'], namespace: '', owner: '',
      dueDate: '2026-01-01', status: 'overdue', daysLeft: -5, total: 2, passing: 1, failing: 1, percent: 50,
      owners: [], failingApps: [{ id: 'demo/bad', label: 'bad-app', rules: ['owner-missing'] }],
    },
  ],
  'GET /api/v1/exemptions': [
    {
      id: 'e1', appId: 'demo/bad', rule: 'owner-missing', reason: 'migrating', createdBy: 'boss',
      createdAt: '2026-11-01T00:00:00Z', expiresAt: '2026-12-01T00:00:00Z', status: 'active',
    },
  ],
  'GET /api/v1/catalog': [makeApp('bad'), makeApp('good')],
  'GET /api/v1/uptime?days=7': {
    days: 7,
    apps: [{ id: 'demo/bad', label: 'bad-app', namespace: 'demo', uptimePercent: 12.5, observedSeconds: 800, downSeconds: 700, transitions: 3, currentStatus: 'broken' }],
  },
  'GET /api/v1/stale?days=30': { days: 30, unknown: 0, apps: [] },
  'GET /api/v1/stale?days=90': {
    days: 90, unknown: 2,
    apps: [{ id: 'demo/bad', label: 'old-app', namespace: 'demo', updatedAt: '2025-01-01T00:00:00Z', ageDays: 600 }],
  },
  'GET /metrics': [
    'iris_app_status{app="bad",namespace="demo",status="broken"} 1',
    'iris_app_conformance_score{app="bad",namespace="demo"} 40',
    'iris_app_status{app="secret",namespace="other",status="healthy"} 1',
  ].join('\n'),
}

const section = (id: string) => within(screen.getByTestId(`${id}-section`))

describe('QualityPage', () => {
  it('shows the scorecard and filters by level', async () => {
    mockFetch(base)
    renderWithProviders(<QualityPage />)
    expect(await section('scorecard').findByText('good-app')).toBeTruthy()
    fireEvent.click(section('scorecard').getByRole('button', { name: 'none (1)' }))
    expect(section('scorecard').queryByText('good-app')).toBeNull()
    expect(section('scorecard').getByText('no ready endpoints')).toBeTruthy()
  })

  it('lists stale apps for the chosen window', async () => {
    mockFetch(base)
    renderWithProviders(<QualityPage />)
    expect(await section('stale').findByText(/refreshed within 30 day/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Stale window'), { target: { value: '90' } })
    expect(await section('stale').findByText('old-app')).toBeTruthy()
    expect(section('stale').getByText(/2 app\(s\) have no readable update time/)).toBeTruthy()
  })

  it('shows per-app metrics only for apps in the catalog', async () => {
    mockFetch(base)
    renderWithProviders(<QualityPage />)
    expect(await section('metrics').findByRole('cell', { name: '40' })).toBeTruthy()
    expect(section('metrics').queryByText('secret')).toBeNull()
  })

  it('shows uptime and campaign progress', async () => {
    mockFetch(base)
    renderWithProviders(<QualityPage />)
    expect(await section('uptime').findByText('12.50%')).toBeTruthy()
    expect(await section('campaigns').findByText(/1 of 2 passing \(50%\)/)).toBeTruthy()
    expect(section('campaigns').getByText(/5 day\(s\) late/)).toBeTruthy()
  })

  it('downloads the CSV export', async () => {
    const calls = mockFetch({ ...base, 'GET /api/v1/catalog/export?format=csv': 'id,name\r\n' })
    const create = vi.fn(() => 'blob:x')
    URL.createObjectURL = create
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderWithProviders(<QualityPage />)
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/ }))
    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(create).toHaveBeenCalledOnce()
    expect(calls.some((c) => c.url === '/api/v1/catalog/export?format=csv')).toBe(true)
  })

  it('reports a failed export instead of saving the error page', async () => {
    mockFetch({ ...base, 'GET /api/v1/catalog/export': { status: 500, body: 'boom' } })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderWithProviders(<QualityPage />)
    fireEvent.click(screen.getByRole('button', { name: /Export JSON/ }))
    expect(await screen.findByText(/Export failed: 500/)).toBeTruthy()
    expect(click).not.toHaveBeenCalled()
  })

  it('grants and revokes exemptions', async () => {
    const calls = mockFetch({
      ...base,
      'POST /api/v1/exemptions': { status: 201, body: {} },
      'DELETE /api/v1/exemptions/e1': { status: 204, body: null },
    })
    renderWithProviders(<QualityPage />)
    await section('exemptions').findByText('migrating')
    await section('exemptions').findByRole('option', { name: 'demo/good' })
    fireEvent.change(screen.getByLabelText('Exempt app'), { target: { value: 'demo/good' } })
    fireEvent.change(screen.getByLabelText('Exempt rule'), { target: { value: 'tags-missing' } })
    fireEvent.change(screen.getByLabelText('Exemption reason'), { target: { value: 'later' } })
    fireEvent.change(screen.getByLabelText('Exemption days'), { target: { value: '14' } })
    fireEvent.submit(screen.getByRole('form', { name: 'New exemption' }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
        appId: 'demo/good', rule: 'tags-missing', reason: 'later', days: 14,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Revoke owner-missing for demo/bad' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true))
  })

  it('creates a campaign and shows the server explanation on rejection', async () => {
    const calls = mockFetch({
      ...base,
      'POST /api/v1/campaigns': { status: 409, body: 'campaign limit reached' },
    })
    renderWithProviders(<QualityPage />)
    const create = screen.getByRole('button', { name: 'Create campaign' }) as HTMLButtonElement
    expect(create.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Campaign name'), { target: { value: 'Runbooks' } })
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-12-31' } })
    fireEvent.click(section('campaigns').getByRole('checkbox', { name: 'runbook-missing' }))
    expect(create.disabled).toBe(false)
    fireEvent.submit(screen.getByRole('form', { name: 'New campaign' }))
    expect(await screen.findByText('campaign limit reached')).toBeTruthy()
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({
      name: 'Runbooks', dueDate: '2026-12-31', rules: ['runbook-missing'],
    })
  })

  it('keeps other sections usable when one request fails', async () => {
    mockFetch({ ...base, 'GET /api/v1/scorecard': { status: 500, body: 'x' } })
    renderWithProviders(<QualityPage />)
    expect((await section('scorecard').findByRole('alert')).textContent).toContain('500')
    expect(await section('uptime').findByText('12.50%')).toBeTruthy()
  })
})
