// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AppsPage from './AppsPage'
import { InspectorProvider } from '../utils/inspectorContext'
import { SpotlightProvider } from '../utils/spotlightContext'
import { WorkspaceProvider } from '../utils/workspaceContext'
import { makeApp, mockFetch, renderWithProviders } from '../test/harness'

describe('AppsPage catalog filters', () => {
  it('filters by tag and lifecycle', async () => {
    const apps = [
      makeApp('alpha', { meta: { tags: ['go'], lifecycle: 'production' } }),
      makeApp('bravo', { meta: { tags: ['rust'], lifecycle: 'deprecated' } }),
    ]
    mockFetch({ 'GET /api/v1/apps': apps, 'GET /api/v1/catalog': apps, 'GET /api/v1/favorites': [] })
    renderWithProviders(
      <WorkspaceProvider>
        <InspectorProvider>
          <SpotlightProvider>
            <AppsPage />
          </SpotlightProvider>
        </InspectorProvider>
      </WorkspaceProvider>,
    )
    expect(await screen.findByText(/Launchpad catalog · 2 apps/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Filter by tag'), { target: { value: 'rust' } })
    expect(screen.getByText(/Launchpad catalog · 1 apps/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Filter by lifecycle'), { target: { value: 'production' } })
    expect(screen.getByText('No apps match your filters')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText(/Launchpad catalog · 2 apps/)).toBeTruthy()
  })
})
