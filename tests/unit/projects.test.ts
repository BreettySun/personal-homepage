import { describe, expect, it } from 'vitest'
import { parseProject } from '@/content/projects'
import { parseAbout } from '@/content/about'

describe('parseProject', () => {
  it('parses stack list and optional links', () => {
    const p = parseProject(`---\nname: 地形志\ntagline: 个人主页\nstack: [Vue, Three.js]\nyear: 2026\ngithub: https://github.com/x/y\n---\n说明。`, '/content/projects/terrain.md')
    expect(p.slug).toBe('terrain')
    expect(p.stack).toEqual(['Vue', 'Three.js'])
    expect(p.year).toBe(2026)
    expect(p.github).toBe('https://github.com/x/y')
    expect(p.url).toBeUndefined()
    expect(p.html).toContain('说明')
  })
  it('requires year to be a number', () => {
    expect(() => parseProject(`---\nname: a\ntagline: b\nstack: []\nyear: 今年\n---\n`, '/content/projects/a.md')).toThrow(/a\.md.*year/)
  })
})

describe('parseAbout', () => {
  it('parses label|href links', () => {
    const a = parseAbout(`---\nlinks: [github|https://github.com/x, mail|mailto:a@b.c]\n---\n我是谁。`)
    expect(a.links).toEqual([{ label: 'github', href: 'https://github.com/x' }, { label: 'mail', href: 'mailto:a@b.c' }])
    expect(a.html).toContain('我是谁')
  })
})
