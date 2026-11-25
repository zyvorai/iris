// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import { describe, expect, it } from 'vitest'
import { parseAppMetrics } from './appMetrics'
import { matchesCatalogQuery } from './catalogFilter'
import { formatDuration, formatUptime } from './format'
import { isSafeLink, safeLinks } from './links'
import { makeApp } from '../test/harness'

describe('parseAppMetrics', () => {
  it('merges status and score series and unescapes labels', () => {
    const text = [
      '# TYPE iris_app_status gauge',
      'iris_apps_total 2',
      'iris_app_status{app="a",namespace="we\\"ird",status="broken"} 1',
      'iris_app_conformance_score{app="a",namespace="we\\"ird"} 70',
      'iris_app_status{app="b",namespace="demo",status="healthy"} 1',
    ].join('\n')
    expect(parseAppMetrics(text)).toEqual([
      { namespace: 'demo', app: 'b', status: 'healthy' },
      { namespace: 'we"ird', app: 'a', status: 'broken', conformanceScore: 70 },
    ])
  })

  it('ignores unrelated or malformed input', () => {
    expect(parseAppMetrics('<html></html>\niris_app_status{} 1')).toEqual([])
  })
})

describe('links', () => {
  it('accepts only absolute http(s) URLs', () => {
    expect(isSafeLink('https://wiki.example/run')).toBe(true)
    for (const bad of ['javascript:alert(1)', '//x.example', '/rel', 'https://', 'https://a b', 'data:text/html,x']) {
      expect(isSafeLink(bad), bad).toBe(false)
    }
    expect(safeLinks([{ title: 'x', url: 'javascript:1' }])).toEqual([])
  })
})

describe('matchesCatalogQuery', () => {
  const app = makeApp('grafana', { meta: { tags: ['observability'], lifecycle: 'deprecated', owner: 'platform' } })
  it('searches tags, lifecycle and owner', () => {
    for (const text of ['observ', 'DEPRECATED', 'platform', 'graf', '']) {
      expect(matchesCatalogQuery(app, { text }), text).toBe(true)
    }
    expect(matchesCatalogQuery(app, { text: 'nothing' })).toBe(false)
  })
  it('applies exact tag and lifecycle filters', () => {
    expect(matchesCatalogQuery(app, { tag: 'observability', lifecycle: 'deprecated' })).toBe(true)
    expect(matchesCatalogQuery(app, { tag: 'observ' })).toBe(false)
    expect(matchesCatalogQuery(app, { lifecycle: 'production' })).toBe(false)
    expect(matchesCatalogQuery(makeApp('bare'), { tag: 'observability' })).toBe(false)
  })
})

describe('format', () => {
  it('formats durations and uptime', () => {
    expect([5, 120, 3660, 90000].map(formatDuration)).toEqual(['5s', '2m', '1h 1m', '1d 1h'])
    expect(formatUptime(undefined)).toBe('no data')
    expect(formatUptime(99.5)).toBe('99.50%')
  })
})
