// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

export interface AppSeries {
  namespace: string
  app: string
  status?: string
  conformanceScore?: number
}

const SERIES = /^(iris_app_status|iris_app_conformance_score)\{(.*)\}\s+(-?[\d.]+)$/
const LABEL = /(\w+)="((?:\\.|[^"\\])*)"/g

function unescapeLabel(v: string): string {
  return v.replace(/\\(.)/g, (_, c: string) => (c === 'n' ? '\n' : c))
}

/** Per-app series from the Prometheus text served on /metrics. */
export function parseAppMetrics(text: string): AppSeries[] {
  const rows = new Map<string, AppSeries>()
  for (const line of text.split('\n')) {
    const m = SERIES.exec(line.trim())
    if (!m) continue
    const labels: Record<string, string> = {}
    for (const [, key, value] of m[2].matchAll(LABEL)) labels[key] = unescapeLabel(value)
    const { app, namespace } = labels
    if (!app || !namespace) continue
    const id = `${namespace}/${app}`
    const row = rows.get(id) ?? { namespace, app }
    if (m[1] === 'iris_app_status') row.status = labels.status
    else row.conformanceScore = Number(m[3])
    rows.set(id, row)
  }
  return [...rows.values()].sort((a, b) =>
    `${a.namespace}/${a.app}`.localeCompare(`${b.namespace}/${b.app}`),
  )
}
