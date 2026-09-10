import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MetaLine from '@/components/MetaLine.vue'

describe('MetaLine', () => {
  it('joins parts with the middle dot and prefixes a comment marker', () => {
    const w = mount(MetaLine, { props: { parts: ['2025-11-30', '随州', '雨', '1,203 字'] } })
    expect(w.text()).toBe('// 2025-11-30 · 随州 · 雨 · 1,203 字')
  })
  it('skips empty parts', () => {
    const w = mount(MetaLine, { props: { parts: ['a', '', undefined, 'b'] } })
    expect(w.text()).toBe('// a · b')
  })
})
