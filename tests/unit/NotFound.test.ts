import { createHead } from '@unhead/vue/client'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import NotFound from '@/pages/NotFound.vue'
import { routes } from '@/router'

describe('NotFound', () => {
  async function mountAt(path: string) {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push(path)
    await router.isReady()
    const w = mount(NotFound, { global: { plugins: [router, createHead()] } })
    await flushPromises()
    return { w, router }
  }

  it('is the fallback route for unknown paths', async () => {
    const { router } = await mountAt('/nowhere/at/all')
    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('shows the 404 line, the requested path and two ways out', async () => {
    const { w } = await mountAt('/nowhere/at/all')
    expect(w.text()).toContain('404')
    expect(w.find('.nf-cmd').text()).toBe('$ cd /nowhere/at/all')
    expect(w.text()).toContain('no such file or directory')
    const links = w.findAll('a')
    expect(links.map(a => a.attributes('href'))).toEqual(['/', '/essays'])
  })
})
