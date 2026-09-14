import { describe, expect, it } from 'vitest'
import { routes } from '@/router'

describe('routes', () => {
  it('has the five fixed route names plus the not-found fallback last', () => {
    expect(routes.map(r => r.name)).toEqual(['home', 'essays', 'essay', 'projects', 'about', 'not-found'])
  })
})
