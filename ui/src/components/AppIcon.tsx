// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import type { CSSProperties } from 'react'
import { CURATED_ICON_FG, iconColorFor } from '../utils/iconColor'

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
  const curated = key in CURATED_ICON_FG
  const style: CSSProperties | undefined = curated
    ? undefined
    : (() => {
        const { bg, fg } = iconColorFor(name || key)
        return { '--icon-bg': bg, '--icon-fg': fg } as CSSProperties
      })()

  return (
    <div className={`app-icon icon-${key} app-icon-${size}`} style={style} aria-hidden>
      {label}
    </div>
  )
}
