export type WeatherState = 'clear' | 'cloudy' | 'rain' | 'snow'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export interface LiveWeather { state: WeatherState; temperature: number; code: number }

const BEIJING = { latitude: 39.9042, longitude: 116.4074 }
const URL = `https://api.open-meteo.com/v1/forecast?latitude=${BEIJING.latitude}&longitude=${BEIJING.longitude}&current=temperature_2m,weather_code&timezone=Asia%2FShanghai`

/** WMO 4677 天气代码 → 四态。未知代码按 cloudy。 */
export function mapWeatherCode(code: number): WeatherState {
  if (code === 0 || code === 1) return 'clear'
  if (code === 2 || code === 3 || code === 45 || code === 48) return 'cloudy'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  return 'cloudy'
}

export function seasonOf(date: Date): Season {
  const m = date.getMonth() + 1
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
}

export function defaultWeatherFor(season: Season): WeatherState {
  return { spring: 'cloudy', summer: 'rain', autumn: 'clear', winter: 'snow' }[season] as WeatherState
}

export async function fetchBeijingWeather(fetchImpl: typeof fetch = fetch, timeoutMs = 4000): Promise<LiveWeather> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(URL, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`open-meteo ${res.status}`)
    const json = await res.json() as { current: { temperature_2m: number; weather_code: number } }
    const code = json.current.weather_code
    return { state: mapWeatherCode(code), temperature: json.current.temperature_2m, code }
  } finally {
    clearTimeout(timer)
  }
}
