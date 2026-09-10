import '@fontsource/jetbrains-mono/400.css'
import { ViteSSG } from 'vite-ssg'
import App from './App.vue'
import { loadEssays } from './content/essays'
import { routes } from './router'
import './styles/tokens.css'
import './styles/base.css'

export const createApp = ViteSSG(
  App,
  { routes, base: import.meta.env.BASE_URL },
)

export async function includedRoutes(paths: string[]) {
  return paths.flatMap(p => (p === '/essays/:slug' ? loadEssays().map(e => `/essays/${encodeURIComponent(e.slug)}`) : [p]))
}
