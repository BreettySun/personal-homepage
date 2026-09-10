import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Legend from '@/components/Legend.vue'

const params = { weather: 'rain', season: 'autumn', seed: 0x5c7e, intensity: 0.6, source: 'live' } as const

describe('Legend', () => {
  it('shows the three entrances and emits navigate', async () => {
    const w = mount(Legend, { props: { essayCount: 8, projectCount: 1, params, intro: false } })
    expect(w.text()).toContain('LEGEND')
    expect(w.text()).toContain('Scream')
    const rows = w.findAll('.legend-row')
    expect(rows.length).toBe(3)
    await rows[0].trigger('click')
    expect(w.emitted('navigate')?.[0]).toEqual(['essays'])
  })
  it('renders the meta line with the source label', () => {
    const w = mount(Legend, { props: { essayCount: 8, projectCount: 1, params: { ...params, source: 'manual' }, intro: false } })
    expect(w.text()).toContain('手动')
    expect(w.text()).toContain('0x5c7e')
  })
  it('hides the name while the intro is playing', () => {
    const w = mount(Legend, { props: { essayCount: 8, projectCount: 1, params, intro: true } })
    expect(w.find('.legend-name').attributes('style')).toContain('visibility: hidden')
  })
})
