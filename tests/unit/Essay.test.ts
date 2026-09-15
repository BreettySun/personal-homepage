import { createHead } from '@unhead/vue/client'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
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
    expect(w.find('.meta-line').text()).toContain(essay.date)
    expect(w.find('.meta-line').text()).toContain(essay.city)

    const bodyParagraphs = w.findAll('.essay-body p')
    expect(bodyParagraphs.length).toBeGreaterThan(0)
  })

  // 上下篇只锁"链到哪一篇"，箭头、左右位置这类排版细节不锁。
  function footerHrefs(w: VueWrapper) {
    return w.findAll('.essay-footer a').map(a => a.attributes('href'))
  }

  it('newest essay links only to the older one', async () => {
    const { w } = await navigateAndMount(all[0].slug)
    expect(footerHrefs(w)).toEqual([`/essays/${all[1].slug}`])
    expect(w.find('.essay-footer').text()).toContain(all[1].title)
  })

  it('oldest essay links only to the newer one', async () => {
    const { w } = await navigateAndMount(all[all.length - 1].slug)
    expect(footerHrefs(w)).toEqual([`/essays/${all[all.length - 2].slug}`])
    expect(w.find('.essay-footer').text()).toContain(all[all.length - 2].title)
  })

  it('middle essay links to both neighbours', async () => {
    const { w } = await navigateAndMount(all[1].slug)
    const hrefs = footerHrefs(w)
    expect(hrefs.length).toBe(2)
    expect(hrefs).toContain(`/essays/${all[0].slug}`)
    expect(hrefs).toContain(`/essays/${all[2].slug}`)
  })

  it('unknown slug renders the shared not-found page', async () => {
    const { w } = await navigateAndMount('不存在')

    expect(w.find('.essay').exists()).toBe(false)
    expect(w.text()).toContain('404')
    expect(w.find('.nf-cmd').text()).toContain('/essays/不存在')
    expect(w.findAll('.nf-links a').map(a => a.attributes('href'))).toContain('/')
    expect(w.findAll('main').length).toBe(1)
  })
})
