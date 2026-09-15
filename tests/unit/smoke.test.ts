import { describe, expect, it } from 'vitest'
import { routes } from '@/router'

describe('routes', () => {
  it('has the five fixed routes and keeps the not-found fallback last', () => {
    const names = routes.map(r => r.name)
    for (const name of ['home', 'essays', 'essay', 'projects', 'about']) expect(names).toContain(name)
    // 兜底路由必须排在最后，否则会抢走后面路由的匹配。
    expect(names.at(-1)).toBe('not-found')
  })
})
