import { describe, expect, it } from 'vitest'
import { DENSITY, initialParams, readOverride } from '@/weather/terrainParams'

describe('readOverride', () => {
  it('returns null when nothing stored or JSON is broken', () => {
    expect(readOverride({ getItem: () => null })).toBeNull()
    expect(readOverride({ getItem: () => '{oops' })).toBeNull()
  })
  it('keeps only known keys with valid values', () => {
    const o = readOverride({ getItem: () => JSON.stringify({ weather: 'snow', season: 'nope', seed: 42, intensity: 3, junk: 1 }) })
    expect(o).toEqual({ weather: 'snow', seed: 42 })
  })
  it('accepts density only inside the DENSITY range', () => {
    expect(readOverride({ getItem: () => JSON.stringify({ density: 0.7 }) })).toEqual({ density: 0.7 })
    expect(readOverride({ getItem: () => JSON.stringify({ density: DENSITY.max + 1 }) })).toBeNull()
    expect(readOverride({ getItem: () => JSON.stringify({ density: 0 }) })).toBeNull()
  })
})

describe('initialParams', () => {
  const now = new Date('2026-09-10T10:00:00')
  it('uses season defaults when there is no override', () => {
    expect(initialParams(now, null)).toEqual({ weather: 'clear', season: 'autumn', seed: 0x5c7e, intensity: 0.6, density: 1, source: 'default' })
  })
  it('applies the override and marks source manual', () => {
    const p = initialParams(now, { weather: 'rain', seed: 7 })
    expect(p.weather).toBe('rain')
    expect(p.season).toBe('autumn')
    expect(p.seed).toBe(7)
    expect(p.source).toBe('manual')
  })
})
