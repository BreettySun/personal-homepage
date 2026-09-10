import { describe, expect, it, vi } from 'vitest'
import { prefersReducedMotion, supportsWebGL } from '@/terrain/support'

describe('support', () => {
  it('reports no WebGL when getContext returns null (jsdom)', () => {
    expect(supportsWebGL()).toBe(false)
  })
  it('reads prefers-reduced-motion from matchMedia', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    expect(prefersReducedMotion()).toBe(true)
    vi.unstubAllGlobals()
  })
})
