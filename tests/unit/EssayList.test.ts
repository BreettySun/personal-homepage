import { createHead } from '@unhead/vue/client'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import EssayList from '@/pages/EssayList.vue'
import { routes } from '@/router'

describe('EssayList', () => {
  it('renders year groups and one row per essay', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    const w = mount(EssayList, { global: { plugins: [router, createHead()] } })
    await router.isReady()
    expect(w.text()).toContain('$ ls ~/essays')
    expect(w.findAll('.toc-year').length).toBeGreaterThan(1)
    expect(w.findAll('.toc-row').length).toBe(8)
    expect(w.find('.toc-row').attributes('href')).toMatch(/^\/essays\//)
  })
})
