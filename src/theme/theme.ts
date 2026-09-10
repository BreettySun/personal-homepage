import { ref, type Ref } from 'vue'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'theme'

export function resolveTheme(stored: string | null, systemDark: boolean): Theme {
  if (stored === 'dark' || stored === 'light') return stored
  return systemDark ? 'dark' : 'light'
}

const theme: Ref<Theme> = ref('light')
let initialized = false

function readStored(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

function apply(t: Theme) {
  theme.value = t
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = t
}

export function useTheme() {
  if (!initialized && typeof window !== 'undefined') {
    initialized = true
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    apply(resolveTheme(readStored(), mq.matches))
    mq.addEventListener('change', (e) => {
      if (readStored() === null) apply(resolveTheme(null, e.matches))
    })
  }
  function setTheme(t: Theme) {
    apply(t)
    try { localStorage.setItem(STORAGE_KEY, t) } catch { /* 私密模式等，忽略 */ }
  }
  function toggle() { setTheme(theme.value === 'dark' ? 'light' : 'dark') }
  return { theme, setTheme, toggle }
}
