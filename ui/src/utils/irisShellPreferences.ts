// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

export type DockPosition = 'bottom' | 'left' | 'right'
export type DockSize = 'compact' | 'regular' | 'large'
export type IrisTheme = 'dark' | 'light'

export const SHELL_PREFS_EVENT = 'iris-shell-prefs-changed'

const DOCK_POSITION_KEY = 'iris-dock-position'
const DOCK_SIZE_KEY = 'iris-dock-size'
const DOCK_AUTO_HIDE_KEY = 'iris-dock-auto-hide'
const DOCK_MAGNIFY_KEY = 'iris-dock-magnify'
const RAIL_EXPANDED_KEY = 'iris-rail-expanded'
const THEME_KEY = 'iris-theme'

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === '1') return true
    if (raw === '0') return false
  } catch {
    /* ignore */
  }
  return fallback
}

function writeBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function loadDockPosition(): DockPosition {
  try {
    const raw = localStorage.getItem(DOCK_POSITION_KEY)
    if (raw === 'left' || raw === 'right' || raw === 'bottom') return raw
  } catch {
    /* ignore */
  }
  return 'bottom'
}

export function saveDockPosition(position: DockPosition) {
  try {
    localStorage.setItem(DOCK_POSITION_KEY, position)
  } catch {
    /* ignore */
  }
  document.documentElement.dataset.irisDockPosition = position
  window.dispatchEvent(new CustomEvent(SHELL_PREFS_EVENT, { detail: { dockPosition: position } }))
}

export function loadDockSize(): DockSize {
  try {
    const raw = localStorage.getItem(DOCK_SIZE_KEY)
    if (raw === 'compact' || raw === 'regular' || raw === 'large') return raw
  } catch {
    /* ignore */
  }
  return 'regular'
}

export function saveDockSize(size: DockSize) {
  try {
    localStorage.setItem(DOCK_SIZE_KEY, size)
  } catch {
    /* ignore */
  }
  document.documentElement.dataset.irisDockSize = size
  window.dispatchEvent(new CustomEvent(SHELL_PREFS_EVENT, { detail: { dockSize: size } }))
}

export function loadDockAutoHide(): boolean {
  return readBool(DOCK_AUTO_HIDE_KEY, false)
}

export function saveDockAutoHide(enabled: boolean) {
  writeBool(DOCK_AUTO_HIDE_KEY, enabled)
  document.documentElement.dataset.irisDockAutoHide = enabled ? '1' : '0'
  window.dispatchEvent(new CustomEvent(SHELL_PREFS_EVENT, { detail: { dockAutoHide: enabled } }))
}

export function loadDockMagnify(): boolean {
  return readBool(DOCK_MAGNIFY_KEY, true)
}

export function saveDockMagnify(enabled: boolean) {
  writeBool(DOCK_MAGNIFY_KEY, enabled)
  window.dispatchEvent(new CustomEvent(SHELL_PREFS_EVENT, { detail: { dockMagnify: enabled } }))
}

export function loadRailExpanded(): boolean {
  return readBool(RAIL_EXPANDED_KEY, true)
}

export function saveRailExpanded(expanded: boolean) {
  writeBool(RAIL_EXPANDED_KEY, expanded)
  window.dispatchEvent(new CustomEvent(SHELL_PREFS_EVENT, { detail: { railExpanded: expanded } }))
}

export function loadTheme(): IrisTheme {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    /* ignore */
  }
  return 'light'
}

/** DOM attribute — apple.com / zyvor-web style: light default, dark opt-in. */
function themeAttr(theme: IrisTheme): 'light' | 'dark' {
  return theme === 'dark' ? 'dark' : 'light'
}

export function saveTheme(theme: IrisTheme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* ignore */
  }
  document.documentElement.dataset.theme = themeAttr(theme)
  window.dispatchEvent(new CustomEvent(SHELL_PREFS_EVENT, { detail: { theme } }))
}

export function applyShellPreferencesOnBoot() {
  document.documentElement.dataset.irisDockPosition = loadDockPosition()
  document.documentElement.dataset.irisDockSize = loadDockSize()
  document.documentElement.dataset.irisDockAutoHide = loadDockAutoHide() ? '1' : '0'
  document.documentElement.dataset.theme = themeAttr(loadTheme())
}
