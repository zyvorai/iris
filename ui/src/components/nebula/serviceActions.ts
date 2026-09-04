// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import type { ActionMenuItem } from './ActionMenu'
import {
  appDetailPath,
  appLaunchPath,
  appPublicUrl,
  copyAppUrl,
} from '../../services/irisApi'
import type { IrisApp } from '../../types'

export function canOpenApp(app: IrisApp): boolean {
  return app.readyEndpoints > 0 && app.status !== 'broken'
}

export function isUnhealthy(app: IrisApp): boolean {
  return app.status === 'broken' || app.status === 'degraded'
}

export function buildServiceMenuItems(
  app: IrisApp,
  opts: {
    onDiagnose?: () => void
    onInspector?: () => void
    onPublish?: () => void
    onHide?: () => void
    onPin?: () => void
    favorite?: boolean
  } = {},
): ActionMenuItem[] {
  const canOpen = canOpenApp(app)
  const items: ActionMenuItem[] = [
    { label: 'View route', href: appDetailPath(app) },
    { label: 'Inspect route', href: appDetailPath(app, true) },
    { label: 'Copy URL', onClick: () => void copyAppUrl(app), disabled: !canOpen },
    { label: 'Copy path', onClick: () => void navigator.clipboard.writeText(appLaunchPath(app)) },
    { label: 'Copy public URL', onClick: () => void navigator.clipboard.writeText(appPublicUrl(app)) },
  ]
  if (opts.onDiagnose) items.push({ label: 'Diagnose', onClick: opts.onDiagnose })
  if (opts.onInspector) items.push({ label: 'Ask Zyra AI', onClick: opts.onInspector })
  if (opts.onPublish) items.push({ label: 'Publish', onClick: opts.onPublish })
  if (opts.onPin) items.push({ label: opts.favorite ? 'Unpin' : 'Pin', onClick: opts.onPin })
  if (opts.onHide) items.push({ label: 'Hide from discovery', onClick: opts.onHide })
  return items
}
