import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { prefersReducedMotion } from '@/terrain/support'

export function useParagraphReveal(container: Ref<HTMLElement | undefined>) {
  let io: IntersectionObserver | null = null
  onMounted(() => {
    const root = container.value
    if (!root || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return
    const targets = root.querySelectorAll<HTMLElement>(':scope > p, :scope > blockquote, :scope > img, :scope > h2, :scope > h3')
    io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-visible'); io?.unobserve(en.target) }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 })
    targets.forEach((el) => {
      const r = el.getBoundingClientRect()
      const inView = r.top < window.innerHeight && r.bottom > 0
      if (inView) return
      el.classList.add('reveal')
      io!.observe(el)
    })
  })
  onBeforeUnmount(() => io?.disconnect())
}
