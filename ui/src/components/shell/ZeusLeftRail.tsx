// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Compass,
  GitBranch,
  Globe,
  Grid3X3,
  HeartPulse,
  HelpCircle,
  Home,
  Layers,
  Rocket,
  Search,
  Server,
  Users,
} from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AppIcon from '../AppIcon'
import { hermesApi, openApp } from '../../services/hermesApi'
import { useInspector } from '../../utils/inspectorContext'
import { HERMES_SPACES, groupAppsBySpace } from '../../utils/spaces'
import { loadRailExpanded, saveRailExpanded, SHELL_PREFS_EVENT } from '../../utils/hermesShellPreferences'
import { refreshHermesData } from '../../utils/refreshCatalog'

const ZEUS_CONSOLE_URL = import.meta.env.VITE_ZEUS_CONSOLE_URL as string | undefined

const primaryNav = [
  { to: '/', label: 'Overview', icon: Home, end: true },
  { to: '/apps', label: 'Catalog', icon: Grid3X3 },
  { to: '/spaces', label: 'Spaces', icon: Layers },
  { to: '/cluster', label: 'Cluster', icon: Server },
  { to: '/discovery', label: 'Discovery', icon: Compass },
  { to: '/health', label: 'Health', icon: HeartPulse },
  { to: '/graph', label: 'Graph', icon: GitBranch },
  { to: '/federated', label: 'Federated', icon: Globe },
  { to: '/teams', label: 'Teams', icon: Users },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/help', label: 'Help', icon: HelpCircle },
]

export default function ZeusLeftRail() {
  const [expanded, setExpanded] = useState(loadRailExpanded)
  const [filter, setFilter] = useState('')
  const { openInspector } = useInspector()
  const qc = useQueryClient()
  const cluster = useQuery({ queryKey: ['cluster-summary'], queryFn: hermesApi.clusterSummary, refetchInterval: 20000 })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: hermesApi.listCatalog, refetchInterval: 20000 })
  const favorites = useQuery({ queryKey: ['favorites'], queryFn: hermesApi.listFavorites })
  const recents = useQuery({ queryKey: ['recents'], queryFn: hermesApi.listRecents })

  const publishNs = useMutation({
    mutationFn: hermesApi.publishNamespace,
    onSuccess: () => void refreshHermesData(qc),
  })

  useEffect(() => {
    const onPrefs = () => setExpanded(loadRailExpanded())
    window.addEventListener(SHELL_PREFS_EVENT, onPrefs)
    return () => window.removeEventListener(SHELL_PREFS_EVENT, onPrefs)
  }, [])

  const toggleExpanded = () => {
    const next = !expanded
    setExpanded(next)
    saveRailExpanded(next)
  }

  const q = filter.trim().toLowerCase()
  const navFiltered = q ? primaryNav.filter((item) => item.label.toLowerCase().includes(q)) : primaryNav

  const issueCount = (cluster.data?.broken ?? 0) + (cluster.data?.degraded ?? 0)
  const spaces = useMemo(() => {
    const grouped = groupAppsBySpace(catalog.data ?? [])
    return HERMES_SPACES.map((space) => ({
      ...space,
      count: grouped.get(space.id)?.length ?? 0,
    })).filter((space) => space.count > 0 && (!q || space.label.toLowerCase().includes(q)))
  }, [catalog.data, q])

  const namespaces = useMemo(() => {
    const map = new Map<string, { total: number; unpublished: number }>()
    for (const app of catalog.data ?? []) {
      const cur = map.get(app.namespace) ?? { total: 0, unpublished: 0 }
      cur.total++
      if (!app.visibility.published) cur.unpublished++
      map.set(app.namespace, cur)
    }
    return [...map.entries()]
      .filter(([ns]) => !q || ns.toLowerCase().includes(q))
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
  }, [catalog.data, q])

  const attentionApps = useMemo(
    () =>
      [...(catalog.data ?? [])]
        .filter((a) => a.status !== 'healthy' && (!q || a.displayName.toLowerCase().includes(q)))
        .sort((a, b) => (a.status === 'broken' && b.status !== 'broken' ? -1 : 1) || a.displayName.localeCompare(b.displayName))
        .slice(0, 5),
    [catalog.data, q],
  )

  const favFiltered = (favorites.data ?? []).filter((a) => !q || a.displayName.toLowerCase().includes(q)).slice(0, 6)
  const recentFiltered = (recents.data ?? []).filter((a) => !q || a.displayName.toLowerCase().includes(q)).slice(0, 5)

  return (
    <aside className={`zeus-left-rail${expanded ? ' expanded' : ''}`} data-testid="zeus-left-rail">
      <header className="zeus-rail-header">
        <div className="zeus-rail-brand">
          <div className="hermes-brand-mark" aria-hidden />
          {expanded ? (
            <div>
              <strong>Hermes</strong>
              <span>Service Launchpad</span>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="zeus-rail-toggle"
          onClick={toggleExpanded}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {expanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </header>

      {expanded ? (
        <label className="zeus-rail-search">
          <Search size={14} aria-hidden />
          <input
            type="search"
            placeholder="Filter sidebar…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
      ) : null}

      {expanded ? (
        <div className="zeus-rail-summary zeus-glass">
          <div className="zeus-rail-summary-row">
            <span>
              <Server size={12} /> {cluster.data?.total ?? '—'} discovered
            </span>
            <span>
              <Rocket size={12} /> {cluster.data?.published ?? '—'} published
            </span>
          </div>
          <div className="zeus-rail-summary-row">
            <span className={issueCount > 0 ? 'warn' : 'ok'}>
              <AlertTriangle size={12} /> {issueCount} need attention
            </span>
            <span>{cluster.data?.namespaces ?? '—'} ns</span>
          </div>
        </div>
      ) : (
        <div className="zeus-rail-icon-stats" aria-label="Cluster summary">
          <span title="Discovered services">{cluster.data?.total ?? '—'}</span>
          {issueCount > 0 ? (
            <span className="warn" title="Needs attention">
              {issueCount}
            </span>
          ) : null}
        </div>
      )}

      <nav className="zeus-rail-nav" aria-label="Primary navigation">
        <p className="zeus-rail-section-label">{expanded ? 'Command' : 'Nav'}</p>
        {navFiltered.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `zeus-rail-item${isActive ? ' active' : ''}`}
            title={item.label}
          >
            <item.icon size={18} aria-hidden />
            <span className="zeus-rail-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {recentFiltered.length ? (
        <section className="zeus-rail-section">
          <p className="zeus-rail-section-label">{expanded ? 'Recent' : 'R'}</p>
          <div className="zeus-rail-section-body">
            {recentFiltered.map((app) => (
              <button
                key={app.id}
                type="button"
                className="zeus-rail-fav"
                title={app.displayName}
                onClick={() => void openApp(app)}
              >
                <AppIcon icon={app.icon} name={app.displayName} size="sm" />
                {expanded ? <span>{app.displayName}</span> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {spaces.length ? (
        <section className="zeus-rail-section">
          <p className="zeus-rail-section-label">{expanded ? 'Spaces' : 'SPC'}</p>
          <div className="zeus-rail-section-body">
            {(expanded ? spaces : spaces.slice(0, 5)).map((space) => (
              <NavLink
                key={space.id}
                to={`/spaces/${space.id}`}
                className={({ isActive }) => `zeus-rail-space${isActive ? ' active' : ''}`}
                title={`${space.label} · ${space.count} apps`}
              >
                <Layers size={14} aria-hidden />
                {expanded ? (
                  <>
                    <span>{space.label}</span>
                    <span className="zeus-rail-count">{space.count}</span>
                  </>
                ) : (
                  <span className="zeus-rail-count">{space.count}</span>
                )}
              </NavLink>
            ))}
          </div>
        </section>
      ) : null}

      {namespaces.length ? (
        <section className="zeus-rail-section">
          <p className="zeus-rail-section-label">{expanded ? 'Namespaces' : 'NS'}</p>
          <div className="zeus-rail-section-body">
            {namespaces.map(([ns, stats]) => (
              <div key={ns} className="zeus-rail-namespace">
                <Link to={`/cluster?ns=${encodeURIComponent(ns)}`} className="zeus-rail-space" title={`${ns} · ${stats.total} apps`}>
                  <Server size={14} aria-hidden />
                  {expanded ? (
                    <>
                      <span>{ns}</span>
                      <span className="zeus-rail-count">{stats.total}</span>
                    </>
                  ) : (
                    <span className="zeus-rail-count">{stats.total}</span>
                  )}
                </Link>
                {expanded && stats.unpublished > 0 ? (
                  <button
                    type="button"
                    className="zeus-rail-ns-publish"
                    disabled={publishNs.isPending}
                    title={`Publish ${stats.unpublished} apps in ${ns}`}
                    onClick={() => void publishNs.mutate(ns)}
                  >
                    +{stats.unpublished}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {favFiltered.length ? (
        <section className="zeus-rail-section">
          <p className="zeus-rail-section-label">{expanded ? 'Pinned' : 'Pin'}</p>
          <div className="zeus-rail-section-body">
            {favFiltered.map((app) => (
              <button
                key={app.id}
                type="button"
                className="zeus-rail-fav"
                title={app.displayName}
                onClick={() => openInspector(app.id)}
              >
                <AppIcon icon={app.icon} name={app.displayName} size="sm" />
                {expanded ? <span>{app.displayName}</span> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {attentionApps.length ? (
        <section className="zeus-rail-section zeus-rail-attention">
          <p className="zeus-rail-section-label">{expanded ? 'Attention' : '!'}</p>
          <div className="zeus-rail-section-body">
            {attentionApps.map((app) => (
              <button
                key={app.id}
                type="button"
                className={`zeus-rail-attention-item status-${app.status}`}
                title={`${app.displayName} · ${app.status}`}
                onClick={() => openInspector(app.id)}
              >
                <AppIcon icon={app.icon} name={app.displayName} size="sm" />
                {expanded ? (
                  <>
                    <span>{app.displayName}</span>
                    <span className="zeus-rail-count">{app.status === 'broken' ? '!' : '~'}</span>
                  </>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {ZEUS_CONSOLE_URL ? (
        <section className="zeus-rail-section zeus-rail-footer">
          <a className="zeus-rail-item" href={`${ZEUS_CONSOLE_URL}/consoles`} target="_blank" rel="noreferrer" title="Zeus Consoles">
            <Server size={18} aria-hidden />
            {expanded ? <span className="zeus-rail-label">Zeus Consoles</span> : null}
          </a>
        </section>
      ) : null}
    </aside>
  )
}
