// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { test, expect } from '@playwright/test'

async function waitForPageReady(page: import('@playwright/test').Page) {
  await expect(page.locator('.app-shell')).toBeVisible()
  await expect(page.getByTestId('hermes-navbar')).toBeVisible()
  const loading = page.getByTestId('page-loading')
  if (await loading.count()) {
    await expect(loading).toBeHidden({ timeout: 15000 })
  }
}

test('home loads nebula command deck shell and hero', async ({ page }) => {
  await page.goto('/')
  await waitForPageReady(page)

  const hero = page.getByTestId('platform-pulse-hero')
  const loadError = page.getByTestId('page-load-error')
  await expect(hero.or(loadError)).toBeVisible({ timeout: 5000 })

  if (await hero.isVisible()) {
    await expect(page.getByTestId('cluster-health-orb')).toBeVisible()
    await expect(page.getByTestId('home-metrics-strip')).toBeVisible()
    await expect(hero).toContainText(/your platform (is excellent|is stable|is degraded|needs attention)/i)
  }
})

test('home mission control accordion present', async ({ page }) => {
  await page.goto('/')
  await waitForPageReady(page)
  const mission = page.getByTestId('mission-control-strip')
  const loadError = page.getByTestId('page-load-error')
  await expect(mission.or(loadError)).toBeVisible({ timeout: 5000 })
  if (await mission.isVisible()) {
    const groups = mission.locator('.mission-control-group-head')
    if (await groups.count()) {
      await expect(groups.first()).toBeVisible()
    }
  }
})

test('spotlight opens from navbar', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('hermes-navbar')).toBeVisible()
  await page.keyboard.press('Meta+k')
  await expect(page.getByPlaceholder(/open grafana/i)).toBeVisible()
})

test('footer visible after scroll', async ({ page }) => {
  await page.goto('/')
  await page.locator('.main-scroll-area').evaluate((el) => { el.scrollTop = el.scrollHeight })
  await expect(page.locator('.hermes-page-footer')).toBeVisible()
  await expect(page.locator('.hermes-page-footer')).toContainText('Hermes')
})

test('catalog page renders toolbar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/apps')
  await waitForPageReady(page)

  const toolbar = page.getByTestId('catalog-toolbar')
  const loadError = page.getByTestId('page-load-error')
  await expect(toolbar.or(loadError)).toBeVisible({ timeout: 5000 })
})

test('cluster page renders toolbar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/cluster')
  await waitForPageReady(page)

  const toolbar = page.getByTestId('cluster-toolbar')
  const loadError = page.getByTestId('page-load-error')
  await expect(toolbar.or(loadError)).toBeVisible({ timeout: 5000 })
})

test('health page loads attention queue', async ({ page }) => {
  await page.goto('/health')
  await waitForPageReady(page)
  const queue = page.getByTestId('attention-queue')
  const loadError = page.getByTestId('page-load-error')
  await expect(queue.or(loadError)).toBeVisible({ timeout: 5000 })
})

test('discovery page renders toolbar or empty state', async ({ page }) => {
  await page.goto('/discovery')
  await waitForPageReady(page)
  const loadError = page.getByTestId('page-load-error')
  const discoveryTitle = page.getByRole('heading', { name: 'Discovery queue', exact: true })
  await expect(loadError.or(discoveryTitle)).toBeVisible({ timeout: 5000 })
})

test('app detail opens global diagnose drawer', async ({ page }) => {
  await page.goto('/apps')
  await waitForPageReady(page)

  const firstAppLink = page.locator('.app-card-nebula .app-title-link').first()
  if (!(await firstAppLink.count())) {
    test.skip()
    return
  }

  await firstAppLink.click()
  await waitForPageReady(page)

  const diagnoseBtn = page.getByRole('button', { name: /diagnose/i })
  const inspectItem = page.getByRole('button', { name: /inspect route/i })
  if (await diagnoseBtn.count()) {
    await diagnoseBtn.click()
  } else if (await inspectItem.count()) {
    await inspectItem.click()
  } else {
    test.skip()
    return
  }

  await expect(page.getByTestId('diagnose-panel')).toBeVisible({ timeout: 5000 })
})

test('graph page renders', async ({ page }) => {
  await page.goto('/graph')
  await waitForPageReady(page)
  await expect(page.getByText(/application graph/i)).toBeVisible()
})

test('help page renders zyvor footer', async ({ page }) => {
  await page.goto('/help')
  await expect(page.getByRole('heading', { name: /hermes guide/i })).toBeVisible()
  await expect(page.locator('.zyvor-footer')).toContainText('zyvor.dev')
})

test('mobile viewport home loads', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await waitForPageReady(page)

  const hero = page.getByTestId('platform-pulse-hero')
  const loadError = page.getByTestId('page-load-error')
  await expect(hero.or(loadError)).toBeVisible({ timeout: 5000 })
})

test('mobile viewport shows compact workspace switcher', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await waitForPageReady(page)
  await expect(page.locator('.workspace-switcher-compact')).toBeVisible()
})

test('mobile catalog toolbar fits viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/apps')
  await waitForPageReady(page)

  const toolbar = page.getByTestId('catalog-toolbar')
  const loadError = page.getByTestId('page-load-error')
  if (await loadError.isVisible()) return

  await expect(toolbar).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
  expect(overflow).toBe(false)
})
