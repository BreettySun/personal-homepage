import { describe, expect, it } from 'vitest'
import { particleCount, particleKindFor, stepParticle } from '@/terrain/particles'

describe('particleKindFor', () => {
  it('follows weather first, then autumn leaves', () => {
    expect(particleKindFor('rain', 'spring')).toBe('rain')
    expect(particleKindFor('snow', 'autumn')).toBe('snow')
    expect(particleKindFor('clear', 'autumn')).toBe('leaves')
    expect(particleKindFor('cloudy', 'autumn')).toBe('leaves')
    expect(particleKindFor('clear', 'summer')).toBe('none')
  })
})

describe('particleCount', () => {
  it('scales with intensity and drops on low quality', () => {
    expect(particleCount('none', 1, 'high')).toBe(0)
    expect(particleCount('rain', 1, 'high')).toBe(2400)
    expect(particleCount('rain', 0.5, 'high')).toBe(1200)
    expect(particleCount('rain', 1, 'low')).toBe(800)
    expect(particleCount('leaves', 1, 'high')).toBe(180)
  })
})

describe('stepParticle', () => {
  const bounds = { halfW: 20, halfD: 15, top: 12, floor: -2 }
  it('moves rain straight down and recycles below the floor', () => {
    const p = new Float32Array([0, 5, 0])
    stepParticle('rain', p, 0, 0.1, 0, bounds)
    expect(p[1]).toBeLessThan(5)
    expect(p[0]).toBe(0)
    p[1] = -3
    stepParticle('rain', p, 0, 0.1, 0, bounds)
    expect(p[1]).toBeGreaterThan(bounds.floor)
    expect(p[1]).toBeLessThanOrEqual(bounds.top)
  })
  it('lets snow drift sideways while falling slowly', () => {
    const p = new Float32Array([0, 5, 0])
    stepParticle('snow', p, 0, 0.1, 1.3, bounds)
    expect(p[1]).toBeLessThan(5)
    expect(p[1]).toBeGreaterThan(4.5)
    expect(p[0]).not.toBe(0)
  })
})
