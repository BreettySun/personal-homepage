import { mount } from '@vue/test-utils'
import { createHead } from '@unhead/vue/client'
import { describe, expect, it } from 'vitest'
import ProjectList from '@/pages/ProjectList.vue'

describe('ProjectList', () => {
  it('lists projects collapsed and expands one on click', async () => {
    const w = mount(ProjectList, { global: { plugins: [createHead()] } })
    const rows = w.findAll('.proj-row')
    expect(rows.length).toBeGreaterThan(0)
    expect(w.find('.proj-detail').exists()).toBe(false)
    await rows[0].trigger('click')
    expect(w.find('.proj-detail').exists()).toBe(true)
    await rows[0].trigger('click')
    expect(w.find('.proj-detail').exists()).toBe(false)
  })
})
