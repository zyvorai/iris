// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Compass, GitBranch, Globe, Grid3X3, HeartPulse, HelpCircle, History, Home, Layers, Server, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import AppIcon from './AppIcon'
import { hermesApi, openApp, statusLabel, statusTone } from '../services/hermesApi'
import { refreshHermesData } from '../utils/refreshCatalog'
import { loadSpotlightRecents, pushSpotlightRecent } from '../utils/recentStore'
import { useInspector } from '../utils/inspectorContext'
import { useWorkspace } from '../utils/workspaceContext'
import type { HermesApp } from '../types'

interface CommandPaletteProps {
  onClose: () => void
  initialQuery?: string
}

const navItems = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Apps catalog', path: '/apps', icon: Grid3X3 },
  { label: 'Spaces', path: '/spaces', icon: Layers },
  { label: 'Cluster services', path: '/cluster', icon: Server },
  { label: 'Federated', path: '/federated', icon: Globe },
  { label: 'Graph', path: '/graph', icon: GitBranch },
  { label: 'Teams', path: '/teams', icon: Users },
  { label: 'Discovery', path: '/discovery', icon: Compass },
  { label: 'Health', path: '/health', icon: HeartPulse },
  { label: 'Activity', path: '/activity', icon: History },
  { label: 'Help', path: '/help', icon: HelpCircle },
]

function depMatch(query: string): string | null {
  const m = query.match(/^(?:depends:?|depends on)\s+(.+)$/i)
  return m?.[1]?.trim() || null
}

function ownerMatch(query: string): string | null {
  const m = query.match(/^owner:(.+)$/i)
  return m?.[1]?.trim() || null
}

function envMatch(query: string): string | null {
  const q = query.trim().toLowerCase()
  if (['production', 'prod'].includes(q)) return 'production'
  if (['staging', 'stage'].includes(q)) return 'staging'
  if (['development', 'dev'].includes(q)) return 'development'
  if (['testing', 'test', 'qa'].includes(q)) return 'testing'
  const m = query.match(/^env:(.+)$/i)
  return m?.[1]?.trim().toLowerCase() || null
}

function parseSpotlightCommand(raw: string): { type: string; arg?: string } | null {
  const q = raw.trim().toLowerCase()
  if (!q) return null
  if (['attention', 'show unhealthy', 'unhealthy', 'show attention', 'filter degraded', 'degraded', 'show degraded'].includes(q)) return { type: 'attention' }
  if (['show routes', 'routes'].includes(q)) return { type: 'routes' }
  if (['refresh', 'sync', 'resync'].includes(q)) return { type: 'refresh' }
  if (['export', 'export catalog'].includes(q)) return { type: 'export' }
  if (['explain', 'explain fleet', 'ai summary', 'fleet summary', 'why unhealthy', 'fleet insight'].includes(q)) {
    return { type: 'explain' }
  }
  if (['suggest publish', 'publish suggest', 'what to publish', 'discovery insight'].includes(q)) {
    return { type: 'suggest_publish' }
  }
  if (['graph insight', 'topology insight', 'dependency insight'].includes(q)) {
    return { type: 'graph_insight' }
  }
  if (['ai status', 'zeus status', 'llm status', 'ai mode'].includes(q)) {
    return { type: 'ai_status' }
  }
  if (['federated insight', 'federation insight'].includes(q)) {
    return { type: 'federated_insight' }
  }
  if (['activity insight', 'audit insight'].includes(q)) {
    return { type: 'activity_insight' }
  }
  const open = raw.trim().match(/^open\s+(.+)$/i)
  if (open?.[1]) return { type: 'open', arg: open[1].trim() }
  const why = raw.trim().match(/^why\s+(?:is\s+)?(.+?)(?:\s+down|\s+unhealthy|\s+broken)?$/i)
  if (why?.[1]) return { type: 'why', arg: why[1].trim() }
  const diagnose = raw.trim().match(/^diagnose\s+(.+)$/i)
  if (diagnose?.[1]) return { type: 'diagnose', arg: diagnose[1].trim() }
  const nsInsight = raw.trim().match(/^(?:namespace insight|ns insight)\s+(.+)$/i)
  if (nsInsight?.[1]) return { type: 'ns_insight', arg: nsInsight[1].trim() }
  const ownerInsight = raw.trim().match(/^(?:owner insight|team insight)\s+(.+)$/i)
  if (ownerInsight?.[1]) return { type: 'owner_insight', arg: ownerInsight[1].trim() }
  const publish = raw.trim().match(/^publish\s+(.+)$/i)
  if (publish?.[1]) return { type: 'publish', arg: publish[1].trim() }
  const pin = raw.trim().match(/^pin\s+(.+)$/i)
  if (pin?.[1]) return { type: 'pin', arg: pin[1].trim() }
  const ns = raw.trim().match(/^(?:namespace:|ns:)\s*(.+)$/i)
  if (ns?.[1]) return { type: 'namespace', arg: ns[1].trim() }
  return null
}

function findAppByName(catalog: HermesApp[], name: string): HermesApp | undefined {
  const needle = name.toLowerCase()
  return catalog.find(
    (a) =>
      a.displayName.toLowerCase().includes(needle) ||
      a.slug.toLowerCase().includes(needle) ||
      (a.canonicalSlug ?? '').toLowerCase().includes(needle),
  )
}

function appDependsOn(app: HermesApp, dep: string): boolean {
  const needle = dep.toLowerCase()
  return (app.meta?.dependsOn ?? []).some(
    (d) =>
      d.toLowerCase() === needle ||
      app.slug.toLowerCase() === needle ||
      (app.canonicalSlug ?? '').toLowerCase() === needle,
  )
}

export default function CommandPalette({ onClose, initialQuery = '' }: CommandPaletteProps) {
  const [q, setQ] = useState(initialQuery)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { setWorkspaceId, matchesWorkspace } = useWorkspace()
  const { openDiagnose, openInspector } = useInspector()

  const recommended = useQuery({ queryKey: ['recommended'], queryFn: hermesApi.listRecommended })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog })

  const catalogUnhealthy = useMemo(
    () => (catalog.data ?? []).filter((a) => a.status !== 'healthy' && matchesWorkspace(a)),
    [catalog.data, matchesWorkspace],
  )

  const command = parseSpotlightCommand(q.trim())
  const isCommandQuery = !!command
  const diagnoseTarget = useMemo(() => {
    if ((command?.type === 'diagnose' || command?.type === 'why') && command.arg) {
      return findAppByName(catalog.data ?? [], command.arg)
    }
    return undefined
  }, [command, catalog.data])

  const diagnoseInsight = useQuery({
    queryKey: ['app-insight', diagnoseTarget?.id],
    queryFn: () => hermesApi.getAppInsight(diagnoseTarget!.id),
    enabled: !!diagnoseTarget,
    staleTime: 30_000,
  })

  const fleetInsight = useQuery({
    queryKey: ['fleet-insight'],
    queryFn: hermesApi.getFleetInsight,
    enabled: command?.type === 'explain',
    staleTime: 45_000,
  })

  const discoveryInsight = useQuery({
    queryKey: ['discovery-insight'],
    queryFn: hermesApi.getDiscoveryInsight,
    enabled: command?.type === 'suggest_publish',
    staleTime: 45_000,
  })

  const namespaceInsight = useQuery({
    queryKey: ['namespace-insight', command?.arg],
    queryFn: () => hermesApi.getNamespaceInsight(command!.arg!),
    enabled: command?.type === 'ns_insight' && !!command.arg,
    staleTime: 45_000,
  })

  const graphInsight = useQuery({
    queryKey: ['graph-insight'],
    queryFn: hermesApi.getGraphInsight,
    enabled: command?.type === 'graph_insight',
    staleTime: 45_000,
  })

  const ownerInsightQuery = useQuery({
    queryKey: ['owner-insight', command?.arg],
    queryFn: () => hermesApi.getOwnerInsight(command!.arg!),
    enabled: command?.type === 'owner_insight' && !!command.arg,
    staleTime: 45_000,
  })

  const aiStatus = useQuery({
    queryKey: ['ai-status'],
    queryFn: hermesApi.getAiStatus,
    enabled: command?.type === 'ai_status',
    staleTime: 60_000,
  })

  const federatedInsight = useQuery({
    queryKey: ['federated-insight'],
    queryFn: hermesApi.getFederatedInsight,
    enabled: command?.type === 'federated_insight',
    staleTime: 45_000,
  })

  const activityInsight = useQuery({
    queryKey: ['activity-insight'],
    queryFn: hermesApi.getActivityInsight,
    enabled: command?.type === 'activity_insight',
    staleTime: 45_000,
  })

  const query = q.trim().toLowerCase()
  const depQuery = depMatch(q.trim())
  const ownerQuery = ownerMatch(q.trim())
  const envQuery = envMatch(q.trim())
  const isLlmQuery = q.trim().toLowerCase().startsWith('ai:') || q.trim().toLowerCase().startsWith('llm:')
  const llmQuery = isLlmQuery ? q.trim().replace(/^(ai:|llm:)/i, '').trim() : ''
  const isTeamQuery = ['team', 'team picks', 'picks', 'recommended'].includes(query)
  const isIntentQuery =
    q.trim().length > 2 &&
    !depQuery &&
    !ownerQuery &&
    !envQuery &&
    !isTeamQuery &&
    !isLlmQuery &&
    query !== 'broken' &&
    (query.includes('depend') ||
      query.includes('unhealthy') ||
      query.startsWith('which ') ||
      query.startsWith('owned ') ||
      query.includes('production') ||
      query.includes('staging'))

  const { data: hits = [], isFetching: searchFetching } = useQuery({
    queryKey: ['search', q],
    queryFn: () => hermesApi.search(q),
    enabled:
      q.trim().length > 0 &&
      !isCommandQuery &&
      !depQuery &&
      !ownerQuery &&
      !envQuery &&
      !isTeamQuery &&
      !isIntentQuery &&
      !isLlmQuery &&
      query !== 'broken',
  })

  const isSearchPending =
    q.trim().length > 0 &&
    searchFetching &&
    !isCommandQuery &&
    !depQuery &&
    !ownerQuery &&
    !envQuery &&
    !isTeamQuery &&
    !isIntentQuery &&
    !isLlmQuery &&
    query !== 'broken'

  const llm = useQuery({
    queryKey: ['search-llm', llmQuery],
    queryFn: () => hermesApi.searchLlm(llmQuery),
    enabled: isLlmQuery && llmQuery.length > 0,
  })

  const intent = useQuery({
    queryKey: ['search-llm-intent', q],
    queryFn: () => hermesApi.searchLlm(q),
    enabled: isIntentQuery,
  })

  const recents = useQuery({ queryKey: ['recents'], queryFn: hermesApi.listRecents })

  const isQueryPending = isSearchPending || (isLlmQuery && llm.isFetching) || (isIntentQuery && intent.isFetching)

  const recentApps = useMemo(() => {
    const ids = loadSpotlightRecents()
    const fromApi = recents.data ?? []
    const byId = new Map(fromApi.map((a) => [a.id, a]))
    for (const app of catalog.data ?? []) {
      if (!byId.has(app.id)) byId.set(app.id, app)
    }
    return ids.map((id) => byId.get(id)).filter(Boolean)
  }, [recents.data, catalog.data])

  const defaultApps = useMemo(
    () => (catalog.data ?? []).filter(matchesWorkspace).slice(0, 6),
    [catalog.data, matchesWorkspace],
  )

  type Row =
    | { kind: 'nav'; label: string; path: string; icon: typeof Home; meta?: string }
    | { kind: 'app'; app: NonNullable<(typeof recentApps)[number]>; action: 'open' | 'inspect' }
    | { kind: 'action'; label: string; meta: string; run: () => void }

  const rows: Row[] = useMemo(() => {
    if (command?.type === 'attention') {
      const navRow = {
        kind: 'nav' as const,
        label: 'Open Mission Control',
        path: '/#mission-control',
        icon: Layers,
        meta: `${catalogUnhealthy.length} services need attention`,
      }
      return [
        navRow,
        ...catalogUnhealthy.slice(0, 8).flatMap((app) => [
          { kind: 'app' as const, app, action: 'inspect' as const },
          { kind: 'app' as const, app, action: 'open' as const },
        ]),
      ]
    }

    if (command?.type === 'routes') {
      return [
        { kind: 'nav', label: 'Cluster routes', path: '/cluster', icon: Server, meta: 'Ingress and mesh routes' },
        { kind: 'nav', label: 'Service graph', path: '/graph', icon: GitBranch, meta: 'Topology view' },
      ]
    }

    if (command?.type === 'open' && command.arg) {
      const app = findAppByName(catalog.data ?? [], command.arg)
      if (app) return [{ kind: 'app' as const, app, action: 'open' as const }]
    }

    if ((command?.type === 'diagnose' || command?.type === 'why') && command.arg) {
      const app = findAppByName(catalog.data ?? [], command.arg)
      if (app) {
        const rows: Row[] = []
        if (diagnoseInsight.data) {
          rows.push({
            kind: 'action',
            label: diagnoseInsight.data.summary,
            meta: `${diagnoseInsight.data.source === 'llm' ? 'Zeus AI' : 'Rules'} · ${diagnoseInsight.data.explanation.slice(0, 96)}${diagnoseInsight.data.explanation.length > 96 ? '…' : ''}`,
            run: () => openInspector(app.id, 'ai'),
          })
        }
        rows.push({ kind: 'app', app, action: 'inspect' })
        return rows
      }
    }

    if (command?.type === 'suggest_publish') {
      if (discoveryInsight.data) {
        const rows: Row[] = [
          {
            kind: 'action',
            label: discoveryInsight.data.summary,
            meta: discoveryInsight.data.explanation,
            run: () => navigate('/discovery'),
          },
        ]
        for (const id of discoveryInsight.data.suggestPublishIds ?? []) {
          const app = (catalog.data ?? []).find((a) => a.id === id)
          if (app) {
            rows.push({
              kind: 'action',
              label: `Publish ${app.displayName}`,
              meta: `${app.namespace} · Zeus AI suggested`,
              run: () => void hermesApi.publish(app.id).then(() => refreshHermesData(qc)),
            })
          }
        }
        return rows.slice(0, 8)
      }
      return [
        {
          kind: 'nav',
          label: 'Discovery queue',
          path: '/discovery',
          icon: Compass,
          meta: discoveryInsight.isLoading ? 'Loading Zeus AI publish suggestions…' : 'Review unpublished services',
        },
      ]
    }

    if (command?.type === 'ns_insight' && command.arg) {
      if (namespaceInsight.data) {
        const rows: Row[] = [
          {
            kind: 'action',
            label: namespaceInsight.data.summary,
            meta: namespaceInsight.data.explanation,
            run: () => navigate(`/cluster?ns=${encodeURIComponent(command.arg!)}`),
          },
        ]
        for (const id of namespaceInsight.data.focusAppIds ?? []) {
          const app = (catalog.data ?? []).find((a) => a.id === id)
          if (app) rows.push({ kind: 'app', app, action: 'inspect' })
        }
        return rows.slice(0, 8)
      }
      return [
        {
          kind: 'nav',
          label: `Cluster · ${command.arg}`,
          path: `/cluster?ns=${encodeURIComponent(command.arg)}`,
          icon: Server,
          meta: namespaceInsight.isLoading ? 'Loading Zeus AI namespace insight…' : 'View namespace services',
        },
      ]
    }

    if (command?.type === 'graph_insight') {
      if (graphInsight.data) {
        const rows: Row[] = [
          {
            kind: 'action',
            label: graphInsight.data.summary,
            meta: graphInsight.data.explanation,
            run: () => navigate('/graph'),
          },
        ]
        for (const id of graphInsight.data.focusAppIds ?? []) {
          const app = (catalog.data ?? []).find((a) => a.id === id)
          if (app) rows.push({ kind: 'app', app, action: 'inspect' })
        }
        return rows.slice(0, 8)
      }
      return [
        {
          kind: 'nav',
          label: 'Application graph',
          path: '/graph',
          icon: GitBranch,
          meta: graphInsight.isLoading ? 'Loading Zeus AI topology insight…' : 'View dependency graph',
        },
      ]
    }

    if (command?.type === 'owner_insight' && command.arg) {
      if (ownerInsightQuery.data) {
        const rows: Row[] = [
          {
            kind: 'action',
            label: ownerInsightQuery.data.summary,
            meta: ownerInsightQuery.data.explanation,
            run: () => navigate('/teams'),
          },
        ]
        for (const id of ownerInsightQuery.data.focusAppIds ?? []) {
          const app = (catalog.data ?? []).find((a) => a.id === id)
          if (app) rows.push({ kind: 'app', app, action: 'inspect' })
        }
        return rows.slice(0, 8)
      }
      return [
        {
          kind: 'nav',
          label: 'Teams',
          path: '/teams',
          icon: Users,
          meta: ownerInsightQuery.isLoading ? 'Loading Zeus AI team insight…' : 'View team ownership',
        },
      ]
    }

    if (command?.type === 'ai_status') {
      if (aiStatus.data) {
        const mode = aiStatus.data.llmConfigured ? 'Live LLM' : 'Rules engine'
        const model = aiStatus.data.model ? ` · ${aiStatus.data.model}` : ''
        return [
          {
            kind: 'action',
            label: `${mode}${model}`,
            meta: aiStatus.data.llmConfigured
              ? aiStatus.data.llmReachable === false
                ? aiStatus.data.probeMessage || 'LLM configured but unreachable — falling back to rules'
                : 'Zeus AI is generating insight responses from your configured model'
              : 'Set HERMES_LLM_API_URL on the server for live LLM responses',
            run: () => navigate('/help'),
          },
          {
            kind: 'nav',
            label: 'Fleet health dashboard',
            path: '/health',
            icon: HeartPulse,
            meta: 'Review Zeus AI fleet summary',
          },
        ]
      }
      return [
        {
          kind: 'nav',
          label: 'Help · Zeus AI',
          path: '/help',
          icon: HelpCircle,
          meta: aiStatus.isLoading ? 'Loading AI status…' : 'View configuration guide',
        },
      ]
    }

    if (command?.type === 'federated_insight') {
      if (federatedInsight.data) {
        return [
          {
            kind: 'action',
            label: federatedInsight.data.summary,
            meta: federatedInsight.data.explanation,
            run: () => navigate('/federated'),
          },
          {
            kind: 'nav',
            label: 'Federated catalog',
            path: '/federated',
            icon: Globe,
            meta: 'Merged remote cluster apps',
          },
        ]
      }
      return [
        {
          kind: 'nav',
          label: 'Federated catalog',
          path: '/federated',
          icon: Globe,
          meta: federatedInsight.isLoading ? 'Loading Zeus AI federation insight…' : 'View peer clusters',
        },
      ]
    }

    if (command?.type === 'activity_insight') {
      if (activityInsight.data) {
        return [
          {
            kind: 'action',
            label: activityInsight.data.summary,
            meta: activityInsight.data.explanation,
            run: () => navigate('/activity'),
          },
          {
            kind: 'nav',
            label: 'Activity log',
            path: '/activity',
            icon: History,
            meta: 'Full audit timeline',
          },
        ]
      }
      return [
        {
          kind: 'nav',
          label: 'Activity log',
          path: '/activity',
          icon: History,
          meta: activityInsight.isLoading ? 'Loading Zeus AI activity insight…' : 'View audit events',
        },
      ]
    }

    if (command?.type === 'explain') {
      if (fleetInsight.data) {
        const rows: Row[] = [
          {
            kind: 'action',
            label: fleetInsight.data.summary,
            meta: fleetInsight.data.explanation,
            run: () => navigate('/health'),
          },
        ]
        for (const id of fleetInsight.data.focusAppIds ?? []) {
          const app = (catalog.data ?? []).find((a) => a.id === id)
          if (app) rows.push({ kind: 'app', app, action: 'inspect' })
        }
        return rows.slice(0, 8)
      }
      return [
        {
          kind: 'nav',
          label: 'Fleet health dashboard',
          path: '/health',
          icon: HeartPulse,
          meta: fleetInsight.isLoading ? 'Loading Zeus AI fleet insight…' : 'View cluster health',
        },
      ]
    }

    if (command?.type === 'publish' && command.arg) {
      const app = findAppByName(catalog.data ?? [], command.arg)
      if (app) {
        return [
          {
            kind: 'action' as const,
            label: `Publish ${app.displayName}`,
            meta: `${app.namespace} · add to launchpad`,
            run: () => void hermesApi.publish(app.id).then(() => refreshHermesData(qc)),
          },
        ]
      }
    }

    if (command?.type === 'pin' && command.arg) {
      const app = findAppByName(catalog.data ?? [], command.arg)
      if (app) {
        return [
          {
            kind: 'action' as const,
            label: `Pin ${app.displayName}`,
            meta: 'Add to favorites',
            run: () => void hermesApi.addFavorite(app.id).then(() => qc.invalidateQueries({ queryKey: ['favorites'] })),
          },
        ]
      }
    }

    if (command?.type === 'namespace' && command.arg) {
      return [
        {
          kind: 'nav' as const,
          label: `Cluster · ${command.arg}`,
          path: `/cluster?ns=${encodeURIComponent(command.arg)}`,
          icon: Server,
          meta: 'Filter by namespace',
        },
      ]
    }

    if (command?.type === 'refresh') {
      return [
        {
          kind: 'action' as const,
          label: 'Refresh catalog',
          meta: 'Re-fetch discovery and health',
          run: () => void refreshHermesData(qc),
        },
      ]
    }

    if (command?.type === 'export') {
      return [
        {
          kind: 'action' as const,
          label: 'Export catalog JSON',
          meta: 'Download full service catalog',
          run: () => {
            void hermesApi.exportCatalog().then((blob) => {
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `hermes-catalog-${new Date().toISOString().slice(0, 10)}.json`
              a.click()
              URL.revokeObjectURL(url)
            })
          },
        },
      ]
    }

    if (query === 'broken' || query === 'broken services') {
      const count = catalogUnhealthy.length
      return [
        {
          kind: 'nav',
          label: 'Apps need attention',
          path: '/health',
          icon: HeartPulse,
          meta: count > 0 ? `${count} discovered services need attention` : 'View health dashboard',
        },
      ]
    }

    if (isLlmQuery && llm.data) {
      return [
        {
          kind: 'action' as const,
          label: llm.data.answer,
          meta: `${llm.data.intent} · ${llm.data.apps.length} apps`,
          run: () => {},
        },
        ...llm.data.apps.slice(0, 8).flatMap((app) => [
          { kind: 'app' as const, app, action: 'open' as const },
        ]),
      ]
    }

    if (isTeamQuery) {
      return (recommended.data ?? [])
        .filter(matchesWorkspace)
        .slice(0, 8)
        .flatMap((app) => [
          { kind: 'app' as const, app, action: 'open' as const },
          { kind: 'app' as const, app, action: 'inspect' as const },
        ])
    }

    if (envQuery) {
      const apps = (catalog.data ?? []).filter((a) => a.meta?.environment === envQuery)
      return [
        {
          kind: 'action',
          label: `Switch to ${envQuery} workspace`,
          meta: `${apps.length} apps in this environment`,
          run: () => setWorkspaceId(envQuery),
        },
        ...apps.slice(0, 6).flatMap((app) => [
          { kind: 'app' as const, app, action: 'open' as const },
        ]),
      ]
    }

    if (depQuery) {
      const apps = (catalog.data ?? []).filter((a) => appDependsOn(a, depQuery))
      return apps.slice(0, 8).flatMap((app) => [
        { kind: 'app' as const, app, action: 'open' as const },
        { kind: 'app' as const, app, action: 'inspect' as const },
      ])
    }

    if (ownerQuery) {
      const apps = (catalog.data ?? []).filter((a) => (a.meta?.owner ?? '').toLowerCase() === ownerQuery.toLowerCase())
      return apps.slice(0, 8).flatMap((app) => [{ kind: 'app' as const, app, action: 'open' as const }])
    }

    if (intent.data?.apps.length) {
      return [
        {
          kind: 'action' as const,
          label: intent.data.answer,
          meta: `${intent.data.apps.length} apps · ${intent.data.intent}`,
          run: () => {},
        },
        ...intent.data.apps
          .filter(matchesWorkspace)
          .slice(0, 8)
          .flatMap((app) => [
            { kind: 'app' as const, app, action: 'open' as const },
            { kind: 'app' as const, app, action: 'inspect' as const },
          ]),
      ]
    }

    if (q.trim()) {
      return hits
        .filter((h) => matchesWorkspace(h.app))
        .flatMap((h) => [
          { kind: 'app' as const, app: h.app, action: 'open' as const },
          { kind: 'app' as const, app: h.app, action: 'inspect' as const },
        ])
    }

    const list: Row[] = []
    const topUnhealthy = catalogUnhealthy[0]
    if (topUnhealthy) {
      list.push({
        kind: 'action',
        label: `Diagnose ${topUnhealthy.displayName}`,
        meta: 'Suggested · discovered service needs attention',
        run: () => openDiagnose(topUnhealthy.id),
      })
    }
    list.push(...navItems.slice(0, 4).map((n) => ({ kind: 'nav' as const, ...n })))
    const apps = recentApps.length ? recentApps : defaultApps
    for (const app of apps.slice(0, 6)) {
      if (app) list.push({ kind: 'app', app, action: 'open' })
    }
    return list
  }, [
    q,
    query,
    command,
    hits,
    recentApps,
    defaultApps,
    catalogUnhealthy,
    recommended.data,
    catalog.data,
    depQuery,
    ownerQuery,
    envQuery,
    isTeamQuery,
    isLlmQuery,
    llm.data,
    intent.data,
    matchesWorkspace,
    setWorkspaceId,
    diagnoseInsight.data,
    fleetInsight.data,
    fleetInsight.isLoading,
    discoveryInsight.data,
    discoveryInsight.isLoading,
    namespaceInsight.data,
    namespaceInsight.isLoading,
    graphInsight.data,
    graphInsight.isLoading,
    ownerInsightQuery.data,
    ownerInsightQuery.isLoading,
    aiStatus.data,
    aiStatus.isLoading,
    federatedInsight.data,
    federatedInsight.isLoading,
    activityInsight.data,
    activityInsight.isLoading,
    openDiagnose,
    openInspector,
    navigate,
    qc,
  ])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (initialQuery) setQ(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    setSelected(0)
  }, [q, rows.length])

  const activate = (row: Row) => {
    if (row.kind === 'nav') {
      navigate(row.path)
      onClose()
      return
    }
    if (row.kind === 'action') {
      row.run()
      onClose()
      return
    }
    if (row.action === 'inspect') {
      openDiagnose(row.app.id)
      onClose()
      return
    }
    pushSpotlightRecent(row.app.id)
    openApp(row.app)
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => Math.min(s + 1, Math.max(rows.length - 1, 0)))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => Math.max(s - 1, 0))
      }
      if (e.key === 'Enter' && rows[selected]) {
        activate(rows[selected])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows, selected, onClose, navigate])

  const sectionLabel = (() => {
    if (!q.trim()) return 'Suggested'
    if (command?.type === 'attention') return 'Commands · Attention'
    if (command?.type === 'routes') return 'Commands · Navigation'
    if (command?.type === 'open' || command?.type === 'diagnose' || command?.type === 'why') return 'Commands · Services'
    if (command?.type === 'explain') return 'Zeus AI · Fleet'
    if (command?.type === 'suggest_publish') return 'Zeus AI · Discovery'
    if (command?.type === 'ns_insight') return 'Zeus AI · Namespace'
    if (command?.type === 'graph_insight') return 'Zeus AI · Topology'
    if (command?.type === 'owner_insight') return 'Zeus AI · Team'
    if (command?.type === 'ai_status') return 'Zeus AI · Status'
    if (command?.type === 'federated_insight') return 'Zeus AI · Federation'
    if (command?.type === 'activity_insight') return 'Zeus AI · Activity'
    if (query === 'broken') return 'Health'
    if (isTeamQuery) return 'Team picks'
    if (envQuery) return 'Workspace'
    if (depQuery) return `Depends on ${depQuery}`
    if (ownerQuery) return `Owner ${ownerQuery}`
    if (rows.length === 0) return ''
    return 'Services · Open or inspect'
  })()

  return (
    <div className="palette-backdrop" onClick={onClose} role="presentation">
      <div className="palette command-palette-glass palette-wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Spotlight">
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="open grafana · publish prometheus · pin grafana · ns:hermes-system · refresh · export"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="palette-results">
          {sectionLabel ? <div className="palette-section-label">{sectionLabel}</div> : null}
          {isQueryPending ? (
            <div className="palette-item palette-item-pending" aria-live="polite">
              <div className="palette-pending-spinner" aria-hidden />
              <div>
                <strong>Searching catalog…</strong>
                <div className="app-meta">Matching services and routes</div>
              </div>
            </div>
          ) : null}
          {q.trim() && !isQueryPending && rows.length === 0 ? (
            <div className="empty palette-empty">No matches in cluster catalog</div>
          ) : null}
          {rows.map((row, i) =>
            row.kind === 'nav' ? (
              <button
                key={`${row.path}-${row.label}`}
                type="button"
                className={`palette-item ${i === selected ? 'selected' : ''}`}
                onClick={() => activate(row)}
              >
                <row.icon size={16} />
                <div>
                  <strong>{row.label}</strong>
                  <div className="app-meta">{row.meta ?? 'Navigate'}</div>
                </div>
              </button>
            ) : row.kind === 'action' ? (
              <button
                key={row.label}
                type="button"
                className={`palette-item ${i === selected ? 'selected' : ''}`}
                onClick={() => activate(row)}
              >
                <Layers size={16} />
                <div>
                  <strong>{row.label}</strong>
                  <div className="app-meta">{row.meta}</div>
                </div>
              </button>
            ) : (
              <button
                key={`${row.app.id}-${row.action}`}
                type="button"
                className={`palette-item ${i === selected ? 'selected' : ''} ${statusTone(row.app.status)}`}
                onClick={() => activate(row)}
              >
                <AppIcon icon={row.app.icon} name={row.app.displayName} size="sm" />
                <div>
                  <strong>{row.app.displayName}</strong>
                  <div className="app-meta">
                    {row.app.namespace} · {statusLabel(row.app.status)}
                    {!row.app.visibility.published ? ' · unpublished' : ''} ·{' '}
                    {row.action === 'inspect' ? 'Inspect route' : 'Open app'}
                  </div>
                </div>
              </button>
            ),
          )}
        </div>
        <div className="palette-footer">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>Enter</kbd> open
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
          <Link to="/help" className="palette-footer-link" onClick={onClose}>
            Help
          </Link>
        </div>
      </div>
    </div>
  )
}
