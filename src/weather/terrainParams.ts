import { readonly, ref } from 'vue'
import { defaultWeatherFor, fetchBeijingWeather, seasonOf, type LiveWeather, type Season, type WeatherState } from './openMeteo'

export type ParamSource = 'live' | 'default' | 'manual'
export interface TerrainParams { weather: WeatherState; season: Season; seed: number; intensity: number; source: ParamSource }
type ManualPatch = Partial<Pick<TerrainParams, 'weather' | 'season' | 'seed' | 'intensity'>>

export const DEFAULT_SEED = 0x5c7e
export const DEFAULT_INTENSITY = 0.6
const STORAGE_KEY = 'terrain.override'
const WEATHERS: WeatherState[] = ['clear', 'cloudy', 'rain', 'snow']
const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']

export function readOverride(storage: Pick<Storage, 'getItem'>): ManualPatch | null {
  let parsed: unknown
  try { parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') } catch { return null }
  if (!parsed || typeof parsed !== 'object') return null
  const o = parsed as Record<string, unknown>
  const out: ManualPatch = {}
  if (WEATHERS.includes(o.weather as WeatherState)) out.weather = o.weather as WeatherState
  if (SEASONS.includes(o.season as Season)) out.season = o.season as Season
  if (Number.isInteger(o.seed)) out.seed = o.seed as number
  if (typeof o.intensity === 'number' && o.intensity >= 0 && o.intensity <= 1) out.intensity = o.intensity
  return Object.keys(out).length ? out : null
}

export function initialParams(now: Date, override: ManualPatch | null): TerrainParams {
  const season = seasonOf(now)
  const base: TerrainParams = { weather: defaultWeatherFor(season), season, seed: DEFAULT_SEED, intensity: DEFAULT_INTENSITY, source: 'default' }
  return override ? { ...base, ...override, source: 'manual' } : base
}

const params = ref<TerrainParams>(initialParams(new Date(), null))
let manual: ManualPatch | null = null
let booted = false

function persist() {
  try {
    if (manual) localStorage.setItem(STORAGE_KEY, JSON.stringify(manual))
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

export function useTerrainParams() {
  if (!booted && typeof window !== 'undefined') {
    booted = true
    manual = readOverride(localStorage)
    params.value = initialParams(new Date(), manual)
  }

  function applyDefault(now = new Date()) {
    if (manual) return
    params.value = initialParams(now, null)
  }
  function applyLive(w: LiveWeather) {
    if (manual) return
    params.value = { ...params.value, weather: w.state, source: 'live' }
  }
  async function loadLive(now = new Date()) {
    if (manual) return
    try { applyLive(await fetchBeijingWeather()) } catch { applyDefault(now) }
  }
  function setManual(patch: ManualPatch) {
    manual = { ...(manual ?? {}), ...patch }
    params.value = { ...params.value, ...patch, source: 'manual' }
    persist()
  }
  function clearManual() {
    manual = null
    persist()
    params.value = initialParams(new Date(), null)
    void loadLive()
  }
  return { params: readonly(params), setManual, clearManual, applyLive, applyDefault, loadLive }
}
