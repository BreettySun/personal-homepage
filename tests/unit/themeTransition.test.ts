import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import ThemeToggle from '@/components/ThemeToggle.vue'
import Terminal from '@/terminal/Terminal.vue'
import { routes } from '@/router'

/** jsdom 没有 matchMedia。reduced 决定 prefers-reduced-motion；pointer: fine 恒真（终端靠它挂 ~ 键）。 */
function stubMatchMedia({ reduced = false } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('pointer: fine') || (reduced && query.includes('prefers-reduced-motion')),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }))
}

/** 假的 View Transitions API：和真的一样，更新回调是异步调用的。 */
function stubViewTransition() {
  const start = vi.fn((update: () => unknown) => {
    const done = Promise.resolve().then(update).then(() => undefined)
    return { updateCallbackDone: done, ready: done, finished: done, skipTransition() {} }
  })
  const animate = vi.fn()
  Object.defineProperty(document, 'startViewTransition', { value: start, configurable: true, writable: true })
  Object.defineProperty(document.documentElement, 'animate', { value: animate, configurable: true, writable: true })
  return { start, animate }
}

/** theme.ts 是模块级单例：每条用例拿一份新的，互不串味。 */
async function freshSwitchTheme() {
  vi.resetModules()
  return (await import('@/theme/transition')).switchTheme
}

const html = document.documentElement

beforeEach(() => {
  localStorage.clear()
  delete html.dataset.theme
})
afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, 'startViewTransition')
  Reflect.deleteProperty(html, 'animate')
  document.body.innerHTML = ''
})

describe('switchTheme', () => {
  it('applies and persists the theme at once without the View Transitions API', async () => {
    stubMatchMedia()
    const switchTheme = await freshSwitchTheme()
    switchTheme('dark')
    expect(html.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('goes through a view transition when available and still ends up applied and persisted', async () => {
    stubMatchMedia()
    const { start, animate } = stubViewTransition()
    const switchTheme = await freshSwitchTheme()
    switchTheme('dark', { x: 12, y: 34 })
    await vi.waitFor(() => expect(animate).toHaveBeenCalled())
    expect(start).toHaveBeenCalledTimes(1)
    expect(html.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('does not animate when the requested theme is already showing, but still remembers the choice', async () => {
    stubMatchMedia() // 没存过选择、系统是浅色 → 当前就是浅色
    const { start } = stubViewTransition()
    const switchTheme = await freshSwitchTheme()
    switchTheme('light')
    expect(start).not.toHaveBeenCalled()
    expect(html.dataset.theme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('skips the animation when the user prefers reduced motion', async () => {
    stubMatchMedia({ reduced: true })
    const { start, animate } = stubViewTransition()
    const switchTheme = await freshSwitchTheme()
    switchTheme('dark')
    expect(html.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(start).not.toHaveBeenCalled()
    expect(animate).not.toHaveBeenCalled()
  })
})

describe('theme switch entry points', () => {
  it('the toggle flips the theme and its label', async () => {
    stubMatchMedia()
    const w = mount(ThemeToggle)
    const before = { theme: html.dataset.theme, label: w.text() }
    await w.trigger('click')
    expect(html.dataset.theme).not.toBe(before.theme)
    expect(w.text()).not.toBe(before.label)
    w.unmount()
  })

  it('the terminal theme command applies the theme', async () => {
    stubMatchMedia()
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/about')
    await router.isReady()
    const w = mount(Terminal, { attachTo: document.body, global: { plugins: [router] } })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '~', bubbles: true, cancelable: true }))
    await flushPromises()
    // 每条命令后终端会滚到底，jsdom 的元素没有 scrollTo
    Object.assign(w.find('.term-body').element, { scrollTo() {} })

    const input = w.find('.term-prompt input')
    for (const t of ['dark', 'light'] as const) {
      await input.setValue(`theme ${t}`)
      await input.trigger('keydown', { key: 'Enter' })
      await flushPromises()
      expect(html.dataset.theme).toBe(t)
      expect(localStorage.getItem('theme')).toBe(t)
    }
    w.unmount()
  })
})
