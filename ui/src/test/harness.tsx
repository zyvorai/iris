// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import { ToastProvider } from '../components/Toast'
import type { IrisApp } from '../types'

export interface Call {
  method: string
  url: string
  body?: unknown
}

type Reply = { status?: number; body: unknown }

/** Replace fetch with a table keyed by "METHOD url"; records every call. */
export function mockFetch(routes: Record<string, Reply | unknown>) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const key = `${method} ${url}`
    if (!(key in routes)) return new Response('not mocked', { status: 404 })
    const entry = routes[key] as Reply
    const reply = entry && typeof entry === 'object' && 'body' in entry ? entry : { body: entry }
    const status = reply.status ?? 200
    if (status === 204) return new Response(null, { status })
    const body = typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body)
    return new Response(body, { status })
  })
  return calls
}

export function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ToastProvider>{ui}</ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

export function makeApp(slug: string, extra: Partial<IrisApp> = {}): IrisApp {
  return {
    id: `demo/${slug}`,
    slug,
    displayName: slug,
    namespace: 'demo',
    category: 'Tools',
    icon: 'app',
    backend: { kind: 'Service', name: slug, port: 80, scheme: 'http', path: '/' },
    routePath: `/a/demo/${slug}`,
    publicUrl: '',
    status: 'healthy',
    source: 'annotation',
    authMode: 'none',
    score: 0,
    visibility: { published: true, hidden: false, favorite: false },
    readyEndpoints: 1,
    updatedAt: '2026-11-25T00:00:00Z',
    ...extra,
  }
}
