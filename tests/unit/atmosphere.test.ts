import { describe, expect, it } from 'vitest'
import { atmosphereFor } from '@/terrain/atmosphere'

describe('atmosphereFor', () => {
  it('makes cloudy visibly hazier than clear', () => {
    const clear = atmosphereFor('clear'), cloudy = atmosphereFor('cloudy')
    expect(cloudy.fogFar).toBeLessThan(clear.fogFar)
    expect(cloudy.fogNear).toBeLessThan(clear.fogNear)
    expect(cloudy.haze).toBeGreaterThan(clear.haze)
    expect(cloudy.lineOpacity).toBeLessThan(clear.lineOpacity)
  })
  it('keeps the terrain visible from the highest altitude in every weather', () => {
    // 相机最高 26 时到地形中心约 38 个单位；雾 far 必须在这之外，否则地形整片消失。
    for (const state of ['clear', 'cloudy', 'rain', 'snow'] as const) {
      const a = atmosphereFor(state)
      expect(a.fogFar).toBeGreaterThan(38)
      expect(a.fogNear).toBeLessThan(a.fogFar)
      expect(a.lineOpacity).toBeGreaterThan(0.5)
      expect(a.haze).toBeLessThanOrEqual(0.25)
    }
  })
})
