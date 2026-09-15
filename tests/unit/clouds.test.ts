import { describe, expect, it } from 'vitest'
import { ALTITUDE } from '@/terrain/camera'
import { CLOUD_HEIGHT, cloudOpacityFor, spawnCloud, stepCloud } from '@/terrain/clouds'
import { AMPLITUDE } from '@/terrain/heightfield'

describe('clouds', () => {
  it('only cloudy weather shows clouds, denser with intensity', () => {
    expect(cloudOpacityFor('clear', 0.8)).toBe(0)
    expect(cloudOpacityFor('rain', 0.8)).toBe(0)
    expect(cloudOpacityFor('snow', 0.8)).toBe(0)
    expect(cloudOpacityFor('cloudy', 0.2)).toBeGreaterThan(0)
    expect(cloudOpacityFor('cloudy', 1)).toBeGreaterThan(cloudOpacityFor('cloudy', 0.2))
    expect(cloudOpacityFor('cloudy', 1)).toBeLessThanOrEqual(1)
  })

  it('floats above the peaks and below the lowest camera', () => {
    expect(CLOUD_HEIGHT.min).toBeGreaterThan(AMPLITUDE)
    expect(CLOUD_HEIGHT.max).toBeLessThan(ALTITUDE.min)
  })

  it('drifts right and re-enters from the left edge once fully out', () => {
    const rand = () => 0.5
    const c = spawnCloud(rand, 20, 15, false)
    const x0 = c.x
    expect(stepCloud(c, 1, 20, 15, rand)).toBe(false)
    expect(c.x).toBeGreaterThan(x0)

    c.x = 20 + c.w / 2 + 0.01
    expect(stepCloud(c, 0.016, 20, 15, rand)).toBe(true)
    expect(c.x + c.w / 2).toBeLessThanOrEqual(-20 + 1)
  })
})
