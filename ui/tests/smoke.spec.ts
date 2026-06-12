// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { test, expect } from '@playwright/test'

test('home loads and spotlight opens', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()
  await page.keyboard.press('Meta+k')
  await expect(page.getByPlaceholder(/search/i)).toBeVisible()
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
