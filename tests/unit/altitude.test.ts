import { describe, expect, it } from 'vitest'
import { altitudePercent } from '@/composables/useAltitude'

describe('altitudePercent', () => {
  it('is 0 at the top and 100 at the bottom', () => {
    expect(altitudePercent(0, 3000, 800)).toBe(0)
    expect(altitudePercent(2200, 3000, 800)).toBe(100)
  })
  it('is linear in between and clamps', () => {
    expect(altitudePercent(1100, 3000, 800)).toBe(50)
    expect(altitudePercent(-10, 3000, 800)).toBe(0)
    expect(altitudePercent(9999, 3000, 800)).toBe(100)
  })
  it('returns 100 when the page does not scroll', () => {
    expect(altitudePercent(0, 700, 800)).toBe(100)
  })
})
