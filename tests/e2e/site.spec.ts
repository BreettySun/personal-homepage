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

test('home paints the static terrain before any JS runs', async ({ browser }) => {
  // 预渲染的首页 HTML 里就有静态地形，首帧不是一片空白；实时场景建好之后才换掉它。
  const ctx = await browser.newContext({ javaScriptEnabled: false })
  const page = await ctx.newPage()
  await page.goto('/')
  await expect(page.locator('.fallback')).toBeVisible()
  await ctx.close()
})

test('reduced motion keeps the static terrain instead of WebGL', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto('/')
  await expect(page.locator('.legend')).toBeVisible()
  await expect(page.locator('.fallback')).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
  // 静态地形是一张遮罩图，颜色取主题色；确认遮罩真的指向生成的地形图
  const mask = await page.locator('.fallback').evaluate(el => {
    const s = getComputedStyle(el)
    return s.maskImage || s.getPropertyValue('-webkit-mask-image')
  })
  expect(mask).toContain('terrain-fallback')
  await ctx.close()
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
  // 主题切换走 View Transition，新主题在更新回调里才落到 <html> 上，比 click() 晚一帧
  await expect(html).not.toHaveAttribute('data-theme', before!)
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

test('content pages share the same container on direct entry', async ({ page }) => {
  // 回归：公共 .page 样式曾写在 EssayList 的 <style> 里，路由懒加载导致直达
  // /projects 时容器样式缺失。每个页面都是直接 goto，不经过站内跳转。
  // 比较的是 .page 的内边距：宽度各页可以自己收窄（关于页就是 560px），内边距没人覆盖。
  const paddings = new Set<string>()
  for (const path of ['/essays', '/projects', '/about']) {
    await page.goto(path)
    paddings.add(await page.locator('main.page').evaluate(el => getComputedStyle(el).paddingBottom))
  }
  expect(paddings.size).toBe(1)
  expect(paddings.has('0px')).toBe(false)
})

test('projects expand inline', async ({ page }) => {
  await page.goto('/projects')
  await page.locator('.proj-row').first().click()
  await expect(page.locator('.proj-detail')).toBeVisible()
})

test('404.html is prerendered for GitHub Pages (no JS)', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false })
  const page = await ctx.newPage()
  await page.goto('/404.html')
  await expect(page.locator('.not-found')).toContainText('404')
  // 至少一条出路；具体几个链接、去哪儿是设计决定，不锁。
  expect(await page.locator('.nf-links a').count()).toBeGreaterThan(0)
  await ctx.close()
})

test('unknown paths fall through to the not-found page', async ({ page }) => {
  // vite preview serves index.html for unknown paths (SPA fallback); the client router
  // must then land on the catch-all route and show the requested path.
  await page.goto('/this/does/not/exist/')
  await expect(page.locator('.not-found')).toContainText('404')
  await expect(page.locator('.nf-cmd')).toContainText('/this/does/not/exist')
})

test('visual: essay page', async ({ page }) => {
  test.skip(!!process.env.CI, 'screenshot baselines are per-platform; the repo only has darwin baselines')
  await page.goto('/essays')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page).toHaveScreenshot('essays.png', { maxDiffPixelRatio: 0.02 })
})
