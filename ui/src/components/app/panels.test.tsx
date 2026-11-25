// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AppLinksPanel from './AppLinksPanel'
import UptimePanel from './UptimePanel'
import { mockFetch, renderWithProviders } from '../../test/harness'

describe('AppLinksPanel', () => {
  it('shows safe links, lifecycle and tags and drops unsafe URLs', () => {
    renderWithProviders(
      <AppLinksPanel
        meta={{
          lifecycle: 'deprecated',
          tags: ['go'],
          links: [
            { title: 'Runbook', url: 'https://wiki.example/run', type: 'runbook' },
            { title: 'Evil', url: 'javascript:alert(1)' },
          ],
        }}
      />,
    )
    const link = screen.getByRole('link', { name: /Runbook/ })
    expect(link.getAttribute('href')).toBe('https://wiki.example/run')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.queryByText('Evil')).toBeNull()
    expect(screen.getByText('deprecated')).toBeTruthy()
    expect(screen.getByText('#go')).toBeTruthy()
  })

  it('renders nothing without catalog metadata', () => {
    renderWithProviders(<AppLinksPanel meta={{ owner: 'x' }} />)
    expect(screen.queryByTestId('app-links-panel')).toBeNull()
  })
})

describe('UptimePanel', () => {
  const history = (days: number, extra: object) => ({
    id: 'demo/a', label: 'a', namespace: 'demo', currentStatus: 'healthy', days, transitions: 0,
    observedSeconds: 0, downSeconds: 0, events: [], ...extra,
  })

  it('shows uptime, events and reloads for another window', async () => {
    const calls = mockFetch({
      'GET /api/v1/history?app=demo%2Fa&days=7': history(7, {
        uptimePercent: 75, observedSeconds: 345600, downSeconds: 86400, transitions: 2,
        events: [{ appId: 'demo/a', status: 'broken', message: 'no endpoints', at: '2026-11-22T00:00:00Z' }],
      }),
      'GET /api/v1/history?app=demo%2Fa&days=30': history(30, {}),
    })
    renderWithProviders(<UptimePanel appId="demo/a" />)
    expect(await screen.findByText('75.00%')).toBeTruthy()
    expect(screen.getByText(/no endpoints/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('History window'), { target: { value: '30' } })
    expect(await screen.findByText('no data')).toBeTruthy()
    expect(screen.getByText('No status changes in this window.')).toBeTruthy()
    expect(calls).toHaveLength(2)
  })

  it('reports a failed request', async () => {
    mockFetch({})
    renderWithProviders(<UptimePanel appId="demo/a" />)
    expect((await screen.findByRole('alert')).textContent).toContain('Could not load')
  })
})
