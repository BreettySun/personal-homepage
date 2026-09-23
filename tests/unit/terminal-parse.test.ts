import { describe, expect, it } from 'vitest'
import { complete, parseCommand } from '@/terminal/parse'
import { commands } from '@/terminal/registry'
import type { TerminalContext } from '@/terminal/types'

const ctx = {
  essays: [{ slug: '丘陵', title: '丘陵' }, { slug: '河流', title: '河流' }, { slug: '湖泊', title: '湖泊' }],
  projects: [],
  navigate() {}, setTheme() {}, setManual() {}, close() {},
  params: { weather: 'rain', season: 'autumn', seed: 1, intensity: 0.6, density: 1, source: 'live' },
} as unknown as TerminalContext

describe('parseCommand', () => {
  it('splits on whitespace and trims', () => {
    expect(parseCommand('  cat   丘陵 ')).toEqual({ name: 'cat', args: ['丘陵'] })
    expect(parseCommand('')).toEqual({ name: '', args: [] })
  })
})

describe('complete', () => {
  it('completes command names', () => {
    expect(complete('wh', commands, ctx)).toEqual(['whoami'])
    expect(complete('c', commands, ctx).sort()).toEqual(['cat', 'cd', 'clear'])
  })
  it('completes essay titles after cat', () => {
    expect(complete('cat 河', commands, ctx)).toEqual(['cat 河流'])
    expect(complete('cat ', commands, ctx)).toEqual(['cat 丘陵', 'cat 河流', 'cat 湖泊'])
  })
  it('completes fixed arguments', () => {
    expect(complete('theme d', commands, ctx)).toEqual(['theme dark'])
    expect(complete('cd p', commands, ctx)).toEqual(['cd projects'])
    expect(complete('ls e', commands, ctx)).toEqual(['ls essays'])
  })
})

describe('displayWidth', () => {
  it('counts CJK characters as two monospace cells', async () => {
    const { displayWidth } = await import('@/terminal/parse')
    expect(displayWidth('help')).toBe(4)
    expect(displayWidth('cat <文章>')).toBe(10)
  })
})
