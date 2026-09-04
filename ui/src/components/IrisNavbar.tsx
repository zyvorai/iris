// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Moon, Search, Sun } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import { irisApi } from '../services/irisApi'
import { loadTheme, saveTheme, type IrisTheme } from '../utils/irisShellPreferences'
import {
  NAV_FLYOUT_DIRECT_LINKS,
  NAV_FLYOUT_PANELS,
  NAV_FLYOUT_TRIGGER_LABELS,
} from '../data/nav-flyout'
import styles from './IrisNavbar.module.css'

interface IrisNavbarProps {
  onPaletteOpen: () => void
  onOpenShortcuts: () => void
}

const CLOSE_DELAY_MS = 220

function BurgerIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true">
      <path d="M2 5.5h13M2 11.5h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="9" height="14" viewBox="0 0 9 14" fill="none" aria-hidden="true">
      <path d="M1.5 1L7 7l-5.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function IrisNavbar({ onPaletteOpen, onOpenShortcuts: _onOpenShortcuts }: IrisNavbarProps) {
  const [theme, setTheme] = useState<IrisTheme>(() => loadTheme())
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetSection, setSheetSection] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const auth = useQuery({ queryKey: ['auth-me'], queryFn: irisApi.authMe, retry: false })

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => setOpenKey(null), CLOSE_DELAY_MS)
  }, [clearCloseTimer])

  const handleTriggerClick = (key: string) => {
    setOpenKey((current) => (current === key ? null : key))
  }

  const handleTriggerEnter = (key: string) => {
    clearCloseTimer()
    setOpenKey((current) => (current ? key : current))
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openKey) {
        const key = openKey
        setOpenKey(null)
        triggerRefs.current[key]?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [openKey])

  useEffect(() => {
    document.body.style.overflow = sheetOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [sheetOpen])

  const toggleTheme = () => {
    const next: IrisTheme = theme === 'dark' ? 'light' : 'dark'
    saveTheme(next)
    setTheme(next)
  }

  const closeSheet = () => {
    setSheetOpen(false)
    setSheetSection(null)
  }

  return (
    <>
      <nav
        className={styles.gnav}
        aria-label="Global"
        data-testid="iris-navbar"
        data-open={String(!!openKey)}
        onMouseLeave={scheduleClose}
      >
        <div className={styles.gnavInner}>
          <Link to="/" className={styles.mark} aria-label="Iris home" onClick={closeSheet}>
            <span className={styles.word}>Iris</span>
          </Link>

          <div className={styles.links}>
            {NAV_FLYOUT_DIRECT_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  isActive ? `${styles.link} ${styles.linkActive}` : styles.link
                }
              >
                {link.label}
              </NavLink>
            ))}
            {NAV_FLYOUT_PANELS.map((panel) => (
              <button
                key={panel.key}
                ref={(el) => {
                  triggerRefs.current[panel.key] = el
                }}
                type="button"
                className={styles.link}
                aria-expanded={openKey === panel.key}
                aria-controls="iris-fly"
                onClick={() => handleTriggerClick(panel.key)}
                onMouseEnter={() => handleTriggerEnter(panel.key)}
              >
                {NAV_FLYOUT_TRIGGER_LABELS[panel.key]}
              </button>
            ))}
          </div>

          <div className={styles.utils}>
            <div className={styles.workspaceSlot}>
              <WorkspaceSwitcher />
            </div>
            <button
              type="button"
              className={styles.icon}
              onClick={onPaletteOpen}
              aria-label="Search"
              title="Search (⌘K)"
              data-testid="navbar-health-chip"
            >
              <Search size={17} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              className={styles.icon}
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun size={17} strokeWidth={1.5} /> : <Moon size={17} strokeWidth={1.5} />}
            </button>
            {auth.data?.mode === 'oidc' &&
              (auth.data.authenticated ? (
                <button
                  type="button"
                  className={styles.cta}
                  onClick={() =>
                    void fetch('/auth/logout', { method: 'POST' })
                      .then((res) => res.ok && window.location.reload())
                      .catch(() => {})
                  }
                  title={auth.data.userId}
                >
                  Sign out
                </button>
              ) : (
                <a href="/auth/login" className={styles.cta}>
                  Sign in
                </a>
              ))}
            <button
              type="button"
              className={styles.burger}
              aria-expanded={sheetOpen}
              aria-controls="iris-sheet"
              aria-label="Menu"
              onClick={() => setSheetOpen((v) => !v)}
            >
              <BurgerIcon />
            </button>
          </div>
        </div>
      </nav>

      <div
        className={styles.fly}
        id="iris-fly"
        data-open={String(!!openKey)}
        onMouseEnter={clearCloseTimer}
        onMouseLeave={scheduleClose}
      >
        <div className={styles.flyInner}>
          {NAV_FLYOUT_PANELS.map((panel) => (
            <div
              key={panel.key}
              className={styles.flyPanel}
              data-panel={panel.key}
              data-active={String(openKey === panel.key)}
            >
              <div className={`${styles.flyCols} ${styles.flyCols3}`}>
                {panel.groups.map((group) => (
                  <div
                    key={group.heading}
                    className={group.lead ? `${styles.flyGroup} ${styles.flyLead}` : styles.flyGroup}
                  >
                    <h3>{group.heading}</h3>
                    <ul>
                      {group.links.map((link) => (
                        <li key={link.to}>
                          <Link to={link.to} onClick={() => setOpenKey(null)}>
                            {link.label}
                            {link.sub ? <small>{link.sub}</small> : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.flyScrim} data-open={String(!!openKey)} onClick={() => setOpenKey(null)} />

      <div className={styles.sheet} id="iris-sheet" data-open={String(sheetOpen)}>
        <div className={styles.sheetItem}>
          <Link className={styles.sheetTop} to="/" onClick={closeSheet}>
            Overview
          </Link>
        </div>
        {NAV_FLYOUT_DIRECT_LINKS.map((link) => (
          <div key={link.to} className={styles.sheetItem}>
            <Link className={styles.sheetTop} to={link.to} onClick={closeSheet}>
              {link.label}
            </Link>
          </div>
        ))}
        {NAV_FLYOUT_PANELS.map((panel) => (
          <div key={panel.key} className={styles.sheetItem}>
            <button
              type="button"
              className={styles.sheetTop}
              aria-expanded={sheetSection === panel.key}
              onClick={() => setSheetSection((c) => (c === panel.key ? null : panel.key))}
            >
              {NAV_FLYOUT_TRIGGER_LABELS[panel.key]}
              <ChevronIcon />
            </button>
            <div className={styles.sheetSub} data-open={String(sheetSection === panel.key)}>
              {panel.groups.flatMap((group) =>
                group.links.map((link) => (
                  <Link key={link.to} to={link.to} onClick={closeSheet}>
                    {link.label}
                  </Link>
                )),
              )}
            </div>
          </div>
        ))}
        <div className={styles.sheetCta}>
          <button
            type="button"
            className={styles.sheetCtaBtn}
            onClick={() => {
              closeSheet()
              onPaletteOpen()
            }}
          >
            Search
          </button>
        </div>
      </div>
    </>
  )
}
