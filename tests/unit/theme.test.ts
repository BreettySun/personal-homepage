import { describe, expect, it } from 'vitest'
import { resolveTheme } from '@/theme/theme'

describe('resolveTheme', () => {
  it('uses the stored choice when present', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })
  it('falls back to the system preference', () => {
    expect(resolveTheme(null, true)).toBe('dark')
    expect(resolveTheme(null, false)).toBe('light')
  })
  it('ignores garbage in storage', () => {
    expect(resolveTheme('blue', true)).toBe('dark')
  })
})
