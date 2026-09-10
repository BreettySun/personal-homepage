import { ViteSSG } from 'vite-ssg'
import App from './App.vue'
import { routes } from './router'
import './styles/tokens.css'
import './styles/base.css'

export const createApp = ViteSSG(
  App,
  { routes, base: import.meta.env.BASE_URL },
)

// Task 4 会在这里把 /essays/:slug 展开成每篇文章的静态路径
export async function includedRoutes(paths: string[]) {
  return paths.filter(p => !p.includes(':'))
}
