import { describe, expect, it, vi } from 'vitest'
import { defaultWeatherFor, fetchBeijingWeather, mapWeatherCode, seasonOf } from '@/weather/openMeteo'

describe('mapWeatherCode (WMO)', () => {
  it('maps codes to the four states', () => {
    expect(mapWeatherCode(0)).toBe('clear')
    expect(mapWeatherCode(1)).toBe('clear')
    expect(mapWeatherCode(2)).toBe('cloudy')
    expect(mapWeatherCode(3)).toBe('cloudy')
    expect(mapWeatherCode(45)).toBe('cloudy')
    expect(mapWeatherCode(51)).toBe('rain')
    expect(mapWeatherCode(65)).toBe('rain')
    expect(mapWeatherCode(71)).toBe('snow')
    expect(mapWeatherCode(77)).toBe('snow')
    expect(mapWeatherCode(81)).toBe('rain')
    expect(mapWeatherCode(86)).toBe('snow')
    expect(mapWeatherCode(95)).toBe('rain')
    expect(mapWeatherCode(999)).toBe('cloudy')
  })
})

describe('seasonOf', () => {
  it('uses meteorological seasons', () => {
    expect(seasonOf(new Date('2026-03-01'))).toBe('spring')
    expect(seasonOf(new Date('2026-05-31'))).toBe('spring')
    expect(seasonOf(new Date('2026-06-01'))).toBe('summer')
    expect(seasonOf(new Date('2026-09-10'))).toBe('autumn')
    expect(seasonOf(new Date('2026-12-01'))).toBe('winter')
    expect(seasonOf(new Date('2026-02-28'))).toBe('winter')
  })
})

describe('defaultWeatherFor', () => {
  it('gives a plausible default per season', () => {
    expect(defaultWeatherFor('spring')).toBe('cloudy')
    expect(defaultWeatherFor('summer')).toBe('rain')
    expect(defaultWeatherFor('autumn')).toBe('clear')
    expect(defaultWeatherFor('winter')).toBe('snow')
  })
})

describe('fetchBeijingWeather', () => {
  it('parses the current block', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ current: { temperature_2m: 21.3, weather_code: 61 } })))
    const w = await fetchBeijingWeather(fetchImpl as unknown as typeof fetch)
    expect(w).toEqual({ state: 'rain', temperature: 21.3, code: 61 })
    const url = String((fetchImpl.mock.calls[0] as unknown[])[0])
    expect(url).toContain('latitude=39.9042')
    expect(url).toContain('longitude=116.4074')
  })
  it('rejects on non-2xx', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 500 }))
    await expect(fetchBeijingWeather(fetchImpl as unknown as typeof fetch)).rejects.toThrow(/500/)
  })
})
