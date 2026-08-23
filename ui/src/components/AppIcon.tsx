// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import type { CSSProperties } from 'react'
import { accentColorFor } from '../utils/iconColor'

interface AppIconProps {
  icon: string
  name: string
  size?: 'sm' | 'md'
}

const labels: Record<string, string> = {
  grafana: 'Gr',
  prometheus: 'Pr',
  zeus: 'Z',
  argocd: 'Ar',
  jenkins: 'Jk',
  gitlab: 'Gl',
  backstage: 'Bs',
  loki: 'Lk',
  keycloak: 'Kc',
  vault: 'Vt',
  rancher: 'Rn',
  minio: 'Mn',
  opensearch: 'Os',
  kibana: 'Kb',
  dashboard: 'Kd',
  jupyter: 'Jp',
  openwebui: 'Ow',
  vscode: 'Vs',
  harbor: 'Hb',
  longhorn: 'Lh',
  traefik: 'Tr',
  ui: 'Ui',
  api: 'Ap',
}

export default function AppIcon({ icon, name, size = 'md' }: AppIconProps) {
  const key = icon && icon !== 'app' ? icon : 'app'
  const label = labels[key] ?? name.slice(0, 2).toUpperCase()
  const { gradient, glow } = accentColorFor(name, key)
  const style = { '--icon-bg': gradient, '--icon-glow': glow } as CSSProperties

  return (
    <div className={`app-icon app-icon-${size}`} style={style} aria-hidden>
      {label}
    </div>
  )
}
