import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '@/content/frontmatter'

describe('parseFrontmatter', () => {
  it('parses scalar and list values and returns the body', () => {
    const raw = `---\ntitle: 丘陵\ndate: 2025-11-30\nstack: [Vue, Three.js]\n---\n\n正文第一行\n`
    const { data, body } = parseFrontmatter(raw)
    expect(data.title).toBe('丘陵')
    expect(data.date).toBe('2025-11-30')
    expect(data.stack).toEqual(['Vue', 'Three.js'])
    expect(body).toBe('正文第一行\n')
  })
  it('returns empty data when there is no frontmatter', () => {
    const { data, body } = parseFrontmatter('# 标题\n正文')
    expect(data).toEqual({})
    expect(body).toBe('# 标题\n正文')
  })
  it('strips surrounding quotes', () => {
    const { data } = parseFrontmatter(`---\ntitle: "河流"\n---\n`)
    expect(data.title).toBe('河流')
  })
})
