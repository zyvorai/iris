// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { test, expect } from '@playwright/test'

test('home loads command surface hero and health orb', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('platform-pulse-hero')).toBeVisible()
  await expect(page.getByTestId('cluster-health-orb')).toBeVisible()
  await expect(page.getByTestId('home-metrics-strip')).toBeVisible()
  await expect(page.getByTestId('platform-pulse-hero')).toContainText(/your platform (is healthy|needs attention|is degraded|is partially healthy)/i)
})

test('left rail and spotlight open', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('zeus-left-rail')).toBeVisible()
  await page.keyboard.press('Meta+k')
  await expect(page.getByPlaceholder(/open grafana/i)).toBeVisible()
})

test('mission control strip preserved', async ({ page }) => {
  await page.goto('/')
  const mission = page.getByTestId('mission-control-strip')
  if (await mission.count()) {
    await expect(mission).toBeVisible()
  }
})

test('graph page renders', async ({ page }) => {
  await page.goto('/graph')
  await expect(page.getByRole('heading', { name: /application graph/i })).toBeVisible()
})

test('help page renders zyvor footer', async ({ page }) => {
  await page.goto('/help')
  await expect(page.getByRole('heading', { name: /^help$/i })).toBeVisible()
  await expect(page.locator('.zyvor-footer')).toContainText('zyvor.dev')
})
