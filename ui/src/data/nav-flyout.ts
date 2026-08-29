// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

export type FlyLink = {
  label: string
  to: string
  sub?: string
}

export type FlyGroup = {
  heading: string
  lead?: boolean
  links: FlyLink[]
}

export type FlyPanel = {
  key: string
  groups: FlyGroup[]
}

export const NAV_FLYOUT_TRIGGER_LABELS: Record<string, string> = {
  more: 'More',
}

/** Apple-thin nav: few direct links; everything else under one flyout. */
export const NAV_FLYOUT_DIRECT_LINKS: FlyLink[] = [
  { label: 'Catalog', to: '/apps' },
  { label: 'Health', to: '/health' },
]

export const NAV_FLYOUT_PANELS: FlyPanel[] = [
  {
    key: 'more',
    groups: [
      {
        heading: 'Launch',
        lead: true,
        links: [
          { label: 'Overview', to: '/', sub: 'Fleet at a glance' },
          { label: 'Spaces', to: '/spaces', sub: 'Browse by category' },
          { label: 'Mission Control', to: '/mission-control', sub: 'Live status' },
        ],
      },
      {
        heading: 'Cluster',
        links: [
          { label: 'Cluster', to: '/cluster', sub: 'Namespaces & publish' },
          { label: 'Discovery', to: '/discovery', sub: 'Unpublished services' },
          { label: 'Topology', to: '/graph', sub: 'Service graph' },
          { label: 'Federated', to: '/federated', sub: 'Multi-cluster' },
        ],
      },
      {
        heading: 'Org',
        links: [
          { label: 'Teams', to: '/teams' },
          { label: 'Activity', to: '/activity' },
          { label: 'Settings', to: '/settings' },
          { label: 'Help', to: '/help' },
        ],
      },
    ],
  },
]
