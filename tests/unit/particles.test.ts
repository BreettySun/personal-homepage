import { describe, expect, it } from 'vitest'
import { FALL_SPEED, RAIN_DRIFT, particleCount, particleKindFor, stepParticle } from '@/terrain/particles'
import { vi } from 'vitest'

describe('particleKindFor', () => {
  it('follows weather first, then autumn leaves', () => {
    expect(particleKindFor('rain', 'spring')).toBe('rain')
    expect(particleKindFor('snow', 'autumn')).toBe('snow')
    expect(particleKindFor('clear', 'autumn')).toBe('leaves')
    expect(particleKindFor('cloudy', 'autumn')).toBe('leaves')
    expect(particleKindFor('clear', 'summer')).toBe('none')
  })
  it('spring clear days get catkins; spring cloudy and summer get nothing', () => {
    expect(particleKindFor('clear', 'spring')).toBe('catkins')
    expect(particleKindFor('cloudy', 'spring')).toBe('none')
    expect(particleKindFor('cloudy', 'summer')).toBe('none')
  })
})

describe('particleCount', () => {
  it('scales with intensity and drops on low quality', () => {
    expect(particleCount('none', 1, 'high')).toBe(0)
    const full = particleCount('rain', 1, 'high')
    expect(full).toBeGreaterThan(0)
    expect(particleCount('rain', 0.5, 'high')).toBe(full / 2)
    expect(particleCount('rain', 1, 'low')).toBe(Math.round(full / 3))
    expect(particleCount('leaves', 1, 'high')).toBe(180)
  })
})

describe('stepParticle', () => {
  const bounds = { halfW: 20, halfD: 15, top: 12, floor: -2 }
  it('moves rain down, drifting toward the camera, and recycles below the floor', () => {
    const p = new Float32Array([0, 5, 0])
    stepParticle('rain', p, 0, 0.1, 0, bounds)
    expect(p[1]).toBeLessThan(5)
    expect(Math.sign(p[0])).toBe(Math.sign(RAIN_DRIFT.x))
    expect(Math.sign(p[2])).toBe(Math.sign(RAIN_DRIFT.z))
    expect(RAIN_DRIFT.z).toBeGreaterThan(0)   // +z 朝相机，雨落向观众而不是屏幕深处
    p[1] = -3
    stepParticle('rain', p, 0, 0.1, 0, bounds)
    expect(p[1]).toBeGreaterThan(bounds.floor)
    expect(p[1]).toBeLessThanOrEqual(bounds.top)
  })
  it('lands rain on the ground it is given: reports the impact point, then recycles to the top', () => {
    const p = new Float32Array([1, 0.05, 2])
    const onLand = vi.fn()
    stepParticle('rain', p, 0, 0.1, 0, bounds, () => 0, onLand)
    expect(onLand).toHaveBeenCalledTimes(1)
    const [x, y, z] = onLand.mock.calls[0]
    expect(y).toBe(0)
    expect(Math.abs(x - 1)).toBeLessThan(0.5)
    expect(Math.abs(z - 2)).toBeLessThan(1.5)
    expect(p[1]).toBeGreaterThan(bounds.top - 2.01)
    // 还在半空的雨滴不算落地
    const q = new Float32Array([0, 8, 0])
    stepParticle('rain', q, 0, 0.1, 0, bounds, () => 0, onLand)
    expect(onLand).toHaveBeenCalledTimes(1)
  })
  it('rain is faster than snow but slow enough to be seen', () => {
    // 可见区高约 14.5 个单位：一滴雨从顶落到底至少要有 1 秒。
    expect(FALL_SPEED.rain).toBeGreaterThan(FALL_SPEED.snow * 3)
    expect(14.5 / FALL_SPEED.rain).toBeGreaterThanOrEqual(1)
  })
  it('catkins rise slowly and recycle from near the ground once above the top', () => {
    const p = new Float32Array([0, 5, 0])
    stepParticle('catkins', p, 0, 0.1, 0.4, bounds)
    expect(p[1]).toBeGreaterThan(5)
    expect(p[1]).toBeLessThan(5.2)
    p[1] = bounds.top + 1
    stepParticle('catkins', p, 0, 0.1, 0.4, bounds)
    expect(p[1]).toBeLessThan(bounds.top / 2)
    expect(p[1]).toBeGreaterThan(bounds.floor)
  })
  it('lets snow drift sideways while falling slowly', () => {
    const p = new Float32Array([0, 5, 0])
    stepParticle('snow', p, 0, 0.1, 1.3, bounds)
    expect(p[1]).toBeLessThan(5)
    expect(p[1]).toBeGreaterThan(4.5)
    expect(p[0]).not.toBe(0)
  })
})
