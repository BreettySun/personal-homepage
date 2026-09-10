import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { useParagraphReveal } from '@/composables/useParagraphReveal'

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  callback: IntersectionObserverCallback
  observed: Element[] = []
  unobserved: Element[] = []
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    FakeIntersectionObserver.instances.push(this)
  }
  observe(el: Element) { this.observed.push(el) }
  unobserve(el: Element) { this.unobserved.push(el) }
  disconnect() {}
  trigger(el: Element, isIntersecting: boolean) {
    this.callback(
      [{ target: el, isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
}

const TestComponent = defineComponent({
  setup() {
    const container = ref<HTMLElement>()
    useParagraphReveal(container)
    return { container }
  },
  template: `
    <div ref="container">
      <p class="p-in-view">first paragraph in view</p>
      <p class="p-below">second paragraph below the fold</p>
    </div>
  `,
})

/**
 * Stubs Element.prototype.getBoundingClientRect for the duration of the
 * mount call: the in-view paragraph reports top/bottom within the viewport,
 * the below-fold paragraph reports coordinates far past it. The stub must be
 * installed before mount() so it is in place when onMounted runs.
 */
function withRectStub<T>(fn: () => T): T {
  const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const rect = this.classList.contains('p-below')
      ? { top: 2000, bottom: 2100 }
      : { top: 0, bottom: 100 }
    return { ...rect, left: 0, right: 0, width: 0, height: rect.bottom - rect.top, x: 0, y: rect.top, toJSON() { return {} } } as DOMRect
  })
  try {
    return fn()
  } finally {
    spy.mockRestore()
  }
}

describe('useParagraphReveal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    FakeIntersectionObserver.instances = []
  })

  it('skips in-view paragraphs and reveals/observes off-screen ones', () => {
    vi.stubGlobal('innerHeight', 800)
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)

    const w = withRectStub(() => mount(TestComponent, { attachTo: document.body }))

    const inView = w.find('.p-in-view')
    const below = w.find('.p-below')

    expect(inView.classes()).not.toContain('reveal')
    expect(below.classes()).toContain('reveal')

    const io = FakeIntersectionObserver.instances[0]
    expect(io.observed).not.toContain(inView.element)
    expect(io.observed).toContain(below.element)

    io.trigger(below.element, true)
    expect(below.classes()).toContain('is-visible')
    expect(io.unobserved).toContain(below.element)

    w.unmount()
  })

  it('adds no reveal class for anyone when prefers-reduced-motion is set', () => {
    vi.stubGlobal('innerHeight', 800)
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))

    const w = withRectStub(() => mount(TestComponent, { attachTo: document.body }))

    expect(w.find('.p-in-view').classes()).not.toContain('reveal')
    expect(w.find('.p-below').classes()).not.toContain('reveal')
    expect(FakeIntersectionObserver.instances.length).toBe(0)

    w.unmount()
  })
})
