import { readdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const essayCount = readdirSync('content/essays').filter(f => f.endsWith('.md')).length

test('home renders legend and entrances', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.legend')).toBeVisible()
  await expect(page.locator('.legend-row')).toHaveCount(3)
  await page.locator('.legend-row').first().click()
  await expect(page).toHaveURL(/\/essays$/)
})

test('essay list links to a prerendered essay page', async ({ page }) => {
  await page.goto('/essays')
  const rows = page.locator('.toc-row')
  await expect(rows).toHaveCount(essayCount)
  await rows.first().click()
  await expect(page.locator('.essay-body p').first()).toBeVisible()
  await expect(page.locator('.meta-line')).toContainText('//')
})

test('essay page is server-rendered (no JS)', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false })
  const page = await ctx.newPage()
  // Trailing slash: vite-ssg's `dirStyle: 'nested'` emits dist/essays/index.html.
  // `vite preview`'s static server only resolves that file for the trailing-slash
  // path; the bare `/essays` path (matching the client router) falls through to
  // its SPA fallback (dist/index.html) when there's no client-side JS to route it.
  await page.goto('/essays/')
  await expect(page.locator('.toc-row')).toHaveCount(essayCount)
  await ctx.close()
})

test('a CJK essay URL resolves to its own prerendered page', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false })
  const page = await ctx.newPage()
  // vite-ssg writes the route string verbatim as a directory name, so the route
  // must stay UTF-8 (`/essays/丘陵`). `vite preview` — like a real static host —
  // percent-decodes the request path, so an encoded route name would 404 here.
  await page.goto(`/essays/${encodeURIComponent('丘陵')}/`)
  await expect(page.locator('.essay-body p').first()).toBeVisible()
  expect(await page.locator('.essay-body p').count()).toBeGreaterThan(0)
  await expect(page.locator('.essay-title')).toHaveText('丘陵')
  await ctx.close()
})

test('theme toggle flips data-theme and persists', async ({ page }) => {
  await page.goto('/essays')
  const html = page.locator('html')
  const before = await html.getAttribute('data-theme')
  await page.locator('.theme-toggle').click()
  const after = await html.getAttribute('data-theme')
  expect(after).not.toBe(before)
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', after!)
})

test('terminal opens with ~ and runs ls', async ({ page, isMobile }) => {
  test.skip(isMobile, 'no keyboard shortcut on touch devices')
  await page.goto('/about')
  // Playwright's `Shift+\`` combo dispatches a keydown with key: '`' (shiftKey: true)
  // rather than the shifted character, so it doesn't match the app's `e.key === '~'`
  // listener. Pressing '~' directly reproduces the real keydown a physical Shift+`
  // press fires in an actual browser (key: '~').
  await page.keyboard.press('~')
  await expect(page.locator('.term')).toBeVisible()
  await page.keyboard.type('ls')
  await page.keyboard.press('Enter')
  await expect(page.locator('.term-line').last()).toContainText('#')
  await page.keyboard.press('Escape')
  await expect(page.locator('.term')).toHaveCount(0)
})

test('projects expand inline', async ({ page }) => {
  await page.goto('/projects')
  await page.locator('.proj-row').first().click()
  await expect(page.locator('.proj-detail')).toBeVisible()
})

test('visual: essay page', async ({ page }) => {
  test.skip(!!process.env.CI, 'screenshot baselines are per-platform; the repo only has darwin baselines')
  await page.goto('/essays')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page).toHaveScreenshot('essays.png', { maxDiffPixelRatio: 0.02 })
})
