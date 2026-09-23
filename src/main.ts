import '@fontsource/jetbrains-mono/400.css'
import { ViteSSG } from 'vite-ssg'
import App from './App.vue'
import { loadEssays } from './content/essays'
import { routes, scrollBehavior } from './router'
import './styles/tokens.css'
import './styles/base.css'

export const createApp = ViteSSG(
  App,
  { routes, base: import.meta.env.BASE_URL, scrollBehavior },
)

export async function includedRoutes(paths: string[]) {
  const expanded = paths.flatMap((p) => {
    if (p === '/essays/:slug') return loadEssays().map(e => `/essays/${e.slug}`)
    if (p.includes(':')) return [] // 兜底路由本身不预渲染
    return [p]
  })
  // 预渲染一页 /404，postbuild 再复制成 dist/404.html 供 GitHub Pages 使用
  return [...expanded, '/404']
}
