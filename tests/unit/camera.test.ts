import { describe, expect, it } from 'vitest'
import { altitudeFromWheel, normalizedPointer } from '@/terrain/camera'
import { ALTITUDE } from '@/terrain/scene'

describe('altitudeFromWheel', () => {
  it('moves one unit per 100px and clamps', () => {
    expect(altitudeFromWheel(14, 100)).toBe(15)
    expect(altitudeFromWheel(14, -250)).toBe(11.5)
    expect(altitudeFromWheel(ALTITUDE.max, 500)).toBe(ALTITUDE.max)
    expect(altitudeFromWheel(ALTITUDE.min, -500)).toBe(ALTITUDE.min)
  })
})

describe('normalizedPointer', () => {
  it('maps the rect center to 0,0 and corners to ±1', () => {
    const rect = { left: 100, top: 50, width: 200, height: 100 }
    expect(normalizedPointer({ clientX: 200, clientY: 100 }, rect)).toEqual({ nx: 0, ny: 0 })
    expect(normalizedPointer({ clientX: 300, clientY: 50 }, rect)).toEqual({ nx: 1, ny: 1 })
    expect(normalizedPointer({ clientX: 100, clientY: 150 }, rect)).toEqual({ nx: -1, ny: -1 })
  })
})
