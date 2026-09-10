import { describe, expect, it } from 'vitest'
import { routes } from '@/router'

describe('routes', () => {
  it('has the five fixed route names', () => {
    expect(routes.map(r => r.name)).toEqual(['home', 'essays', 'essay', 'projects', 'about'])
  })
})
