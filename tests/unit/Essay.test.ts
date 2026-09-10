import { createHead } from '@unhead/vue/client'
import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import Essay from '@/pages/Essay.vue'
import { loadEssays } from '@/content/essays'
import { routes } from '@/router'

describe('Essay', () => {
  const all = loadEssays()

  async function navigateAndMount(slug: string) {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push(`/essays/${slug}`)
    await router.isReady()
    const w = mount(Essay, { global: { plugins: [router, createHead()] } })
    await flushPromises()
    return { w, router }
  }

  it('renders an essay: title, meta line, and body paragraphs', async () => {
    const essay = all[0] // newest essay
    const { w } = await navigateAndMount(essay.slug)

    expect(w.find('.essay-title').text()).toBe(essay.title)
    expect(w.find('.meta-line').text()).toContain('//')
    expect(w.find('.meta-line').text()).toContain(essay.city)

    const bodyParagraphs = w.findAll('.essay-body p')
    expect(bodyParagraphs.length).toBeGreaterThan(0)
  })

  it('newest essay has only the older link', async () => {
    const essay = all[0] // newest essay
    const { w } = await navigateAndMount(essay.slug)

    const footer = w.find('.essay-footer')
    const links = footer.findAll('a')
    expect(links.length).toBe(1)
    expect(links[0].text()).toContain(all[1].title)
    expect(links[0].text()).toContain('←')
    expect(footer.text()).not.toContain('→')
  })

  it('oldest essay has only the newer link', async () => {
    const essay = all[all.length - 1] // oldest essay
    const { w } = await navigateAndMount(essay.slug)

    const footer = w.find('.essay-footer')
    const links = footer.findAll('a')
    expect(links.length).toBe(1)
    expect(links[0].text()).toContain(all[all.length - 2].title)
    expect(links[0].text()).toContain('→')
    expect(footer.text()).not.toContain('←')
  })

  it('middle essay has both links', async () => {
    const essay = all[1] // second essay (in the middle)
    const { w } = await navigateAndMount(essay.slug)

    const footer = w.find('.essay-footer')
    const links = footer.findAll('a')
    expect(links.length).toBe(2)
    expect(footer.text()).toContain('←')
    expect(footer.text()).toContain('→')
  })

  it('unknown slug shows the 404 line', async () => {
    const { w } = await navigateAndMount('不存在')

    expect(w.text()).toContain('404')
    expect(w.find('a').attributes('href')).toBe('/essays')
    expect(w.find('.essay').exists()).toBe(false)
  })
})
