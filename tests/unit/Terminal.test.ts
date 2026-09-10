import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import Terminal from '@/terminal/Terminal.vue'
import { routes } from '@/router'

/** Terminal 只在 `(pointer: fine)` 上挂全局按键；jsdom 没有 matchMedia，得自己造一个。 */
function stubMatchMedia() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('pointer: fine'),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }))
}

async function mountTerminal() {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/about')
  await router.isReady()
  const w = mount(Terminal, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return w
}

function press(target: EventTarget, key: string) {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  target.dispatchEvent(e)
  return e
}

describe('Terminal', () => {
  beforeEach(stubMatchMedia)
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('opens on ~ and focuses the input', async () => {
    const w = await mountTerminal()
    expect(w.find('.term').exists()).toBe(false)

    press(window, '~')
    await flushPromises()

    expect(w.find('.term').exists()).toBe(true)
    expect(document.activeElement).toBe(w.find('.term-prompt input').element)
    w.unmount()
  })

  it('types ~ into a non-empty input instead of toggling', async () => {
    const w = await mountTerminal()
    press(window, '~')
    await flushPromises()

    const input = w.find('.term-prompt input')
    await input.setValue('cd ')
    const e = press(input.element, '~')
    await flushPromises()

    expect(w.find('.term').exists()).toBe(true)
    expect(e.defaultPrevented).toBe(false)
    w.unmount()
  })

  it('closes on ~ when its own input is empty', async () => {
    const w = await mountTerminal()
    press(window, '~')
    await flushPromises()

    const input = w.find<HTMLInputElement>('.term-prompt input')
    expect(input.element.value).toBe('')
    press(input.element, '~')
    await flushPromises()

    expect(w.find('.term').exists()).toBe(false)
    w.unmount()
  })

  it('closes on Escape even with text typed', async () => {
    const w = await mountTerminal()
    press(window, '~')
    await flushPromises()

    const input = w.find('.term-prompt input')
    await input.setValue('cd ')
    press(input.element, 'Escape')
    await flushPromises()

    expect(w.find('.term').exists()).toBe(false)
    w.unmount()
  })
})
