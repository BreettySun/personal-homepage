import { createHead } from '@unhead/vue/client'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import Home from '@/pages/Home.vue'
import { routes } from '@/router'

const support = { webgl: true, reducedMotion: false }
vi.mock('@/terrain/support', () => ({
  supportsWebGL: () => support.webgl,
  prefersReducedMotion: () => support.reducedMotion,
  isCoarsePointer: () => false,
}))

const scene = { throws: false }
vi.mock('@/terrain/scene', () => ({
  ALTITUDE: { min: 6, max: 26, initial: 14 },
  createTerrainScene: () => {
    if (scene.throws) throw new Error('WebGL context creation failed')
    return {
      setSeed() {}, setDensity() {}, setColors() {}, setAltitude() {}, setPointer() {},
      setWeather() {}, pickMarker: () => null, setHovered() {}, setOpacity() {}, dispose() {},
    }
  },
}))

// 开场动画的时间线不自己播，测试调 intro.finish() 才算播完。
type Timeline = { fromTo(): Timeline, to(): Timeline }
const intro = { finish: () => {} }
vi.mock('gsap', () => ({
  gsap: {
    set() {},
    timeline({ onComplete }: { onComplete: () => void }) {
      intro.finish = onComplete
      const tl: Timeline = { fromTo: () => tl, to: () => tl }
      return tl
    },
  },
}))

async function mountHome() {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/')
  await router.isReady()
  const w = mount(Home, { global: { plugins: [router, createHead()] } })
  await flushPromises()
  return w
}

describe('Home static terrain', () => {
  beforeEach(() => {
    support.webgl = true
    support.reducedMotion = false
    scene.throws = false
    intro.finish = () => { throw new Error('the intro timeline was never started') }
    sessionStorage.clear()
    // jsdom 没有 matchMedia；useTheme 会用到。
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows the static terrain when WebGL is unsupported', async () => {
    support.webgl = false
    const w = await mountHome()

    expect(w.find('.fallback').exists()).toBe(true)
    expect(w.find('canvas').exists()).toBe(false)
  })

  it('keeps the static terrain when the scene fails to build', async () => {
    scene.throws = true
    const w = await mountHome()
    await flushPromises()

    expect(w.find('.fallback').exists()).toBe(true)
    expect(w.find('canvas').exists()).toBe(false)
    expect(w.find('.legend-name').attributes('style') ?? '').not.toContain('visibility: hidden')
  })

  it('hands over to the canvas once the scene is ready', async () => {
    sessionStorage.setItem('introPlayed', '1')
    const w = await mountHome()

    expect(w.find('canvas').exists()).toBe(true)
    expect(w.find('.fallback').exists()).toBe(false)
  })

  it('keeps the static terrain under the first-visit intro until the intro has played', async () => {
    const w = await mountHome()
    expect(w.find('canvas').exists()).toBe(true)
    expect(w.find('.fallback').exists()).toBe(true)

    intro.finish()
    await flushPromises()
    expect(w.find('.fallback').exists()).toBe(false)
  })
})
