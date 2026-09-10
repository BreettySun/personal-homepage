import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'terrain.override'

function successResponse(code: number, temperature = 20) {
  return new Response(JSON.stringify({ current: { temperature_2m: temperature, weather_code: code } }))
}

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useTerrainParams (stateful singleton)', () => {
  it('boots without a stored override to season defaults', async () => {
    const { useTerrainParams } = await import('@/weather/terrainParams')
    const { seasonOf } = await import('@/weather/openMeteo')
    const { params } = useTerrainParams()

    expect(params.value.source).toBe('default')
    expect(params.value.seed).toBe(0x5c7e)
    expect(params.value.intensity).toBe(0.6)
    expect(params.value.season).toBe(seasonOf(new Date()))
  })

  it('boots with a stored override applied as manual', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ weather: 'snow' }))
    const { useTerrainParams } = await import('@/weather/terrainParams')
    const { params } = useTerrainParams()

    expect(params.value.weather).toBe('snow')
    expect(params.value.source).toBe('manual')
  })

  it('setManual merges patches and persists the merged result', async () => {
    const { useTerrainParams } = await import('@/weather/terrainParams')
    const { setManual, params } = useTerrainParams()

    setManual({ seed: 42 })
    setManual({ weather: 'rain' })

    expect(params.value.seed).toBe(42)
    expect(params.value.weather).toBe('rain')
    expect(params.value.source).toBe('manual')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual({ seed: 42, weather: 'rain' })
  })

  it('applyLive and applyDefault are no-ops while a manual override is active', async () => {
    const { useTerrainParams } = await import('@/weather/terrainParams')
    const { setManual, applyLive, applyDefault, params } = useTerrainParams()

    setManual({ weather: 'snow' })

    applyLive({ state: 'rain', temperature: 1, code: 61 })
    expect(params.value.weather).toBe('snow')
    expect(params.value.source).toBe('manual')

    applyDefault()
    expect(params.value.weather).toBe('snow')
    expect(params.value.source).toBe('manual')
  })

  it('loadLive applies the fetched weather on success', async () => {
    const fetchImpl = vi.fn(async () => successResponse(71))
    vi.stubGlobal('fetch', fetchImpl)

    const { useTerrainParams } = await import('@/weather/terrainParams')
    const { loadLive, params } = useTerrainParams()

    await loadLive()

    expect(params.value.weather).toBe('snow')
    expect(params.value.source).toBe('live')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('loadLive falls back to the season default on fetch failure, without rejecting', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 500 }))
    vi.stubGlobal('fetch', fetchImpl)

    const { useTerrainParams } = await import('@/weather/terrainParams')
    const { defaultWeatherFor, seasonOf } = await import('@/weather/openMeteo')
    const { loadLive, params } = useTerrainParams()

    await expect(loadLive()).resolves.toBeUndefined()

    expect(params.value.source).toBe('default')
    expect(params.value.weather).toBe(defaultWeatherFor(seasonOf(new Date())))
  })

  it('clearManual removes the stored override and re-fetches live weather', async () => {
    const fetchImpl = vi.fn(async () => successResponse(71))
    vi.stubGlobal('fetch', fetchImpl)

    const { useTerrainParams } = await import('@/weather/terrainParams')
    const { setManual, clearManual, params } = useTerrainParams()

    setManual({ weather: 'snow' })
    clearManual()

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    await new Promise(resolve => setTimeout(resolve, 0))

    expect(fetchImpl).toHaveBeenCalled()
    expect(params.value.source).toBe('live')
    expect(params.value.weather).toBe('snow')
  })

  it('a late setManual wins over an in-flight loadLive', async () => {
    let resolveFetch!: (response: Response) => void
    const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve }))
    vi.stubGlobal('fetch', fetchImpl)

    const { useTerrainParams } = await import('@/weather/terrainParams')
    const { loadLive, setManual, params } = useTerrainParams()

    const pending = loadLive()
    setManual({ weather: 'clear' })
    resolveFetch(successResponse(61))
    await pending

    expect(params.value.weather).toBe('clear')
    expect(params.value.source).toBe('manual')
  })
})
