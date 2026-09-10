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
      setSeed() {}, setColors() {}, setAltitude() {}, setPointer() {},
      setWeather() {}, pickMarker: () => null, setHovered() {}, setOpacity() {}, dispose() {},
    }
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

describe('Home terrain fallback', () => {
  beforeEach(() => {
    support.webgl = true
    support.reducedMotion = false
    scene.throws = false
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

  it('renders the static image when WebGL is unsupported', async () => {
    support.webgl = false
    const w = await mountHome()

    expect(w.find('img.fallback').exists()).toBe(true)
    expect(w.find('canvas').exists()).toBe(false)
  })

  it('falls back to the static image when the scene fails to build', async () => {
    scene.throws = true
    const w = await mountHome()
    await flushPromises()

    expect(w.find('img.fallback').exists()).toBe(true)
    expect(w.find('canvas').exists()).toBe(false)
    expect(w.find('.legend-name').attributes('style') ?? '').not.toContain('visibility: hidden')
  })
})
