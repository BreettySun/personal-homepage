<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import Legend from '@/components/Legend.vue'
import TerrainCanvas from '@/components/TerrainCanvas.vue'
import { loadEssays } from '@/content/essays'
import { loadProjects } from '@/content/projects'
import type { MarkerId } from '@/terrain/heightfield'
import { prefersReducedMotion, supportsWebGL } from '@/terrain/support'
import { useTerrainParams } from '@/weather/terrainParams'

useHead({ title: 'Scream · 地形志' })
const router = useRouter()
const { params, loadLive } = useTerrainParams()
const essayCount = loadEssays().length
const projectCount = loadProjects().length

const use3d = ref(false)
const hovered = ref<MarkerId | null>(null)
const opacity = ref(1)
const intro = ref(false)
const introName = ref<HTMLElement>()
const legendEl = ref<InstanceType<typeof Legend>>()

const paths: Record<MarkerId, string> = { essays: '/essays', projects: '/projects', about: '/about' }
function go(id: MarkerId) { router.push(paths[id]) }

/** 开场动画结束（或失败）后一定要把地形亮回来，避免卡在 opacity 0。 */
function endIntro() {
  intro.value = false
  opacity.value = 1
}

async function playIntro() {
  let gsap: typeof import('gsap')['gsap']
  try { ({ gsap } = await import('gsap')) } catch { endIntro(); return }
  await nextTick()
  const from = introName.value
  const to = legendEl.value?.$el.querySelector('.legend-name') as HTMLElement | null
  if (!from || !to) { endIntro(); return }
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect()
  const tl = gsap.timeline({ onComplete() { intro.value = false; from.style.visibility = 'hidden' } })
  tl.fromTo(from, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' })
    .to(opacity, { value: 1, duration: 1.2, ease: 'power1.inOut' }, 0.2)
    .to(from, { x: b.left - a.left, y: b.top - a.top, scale: b.height / a.height, transformOrigin: 'top left', duration: 0.9, ease: 'power3.inOut' }, '+=0.6')
}

onMounted(() => {
  use3d.value = supportsWebGL() && !prefersReducedMotion()
  void loadLive()
  const played = (() => { try { return sessionStorage.getItem('introPlayed') === '1' } catch { return true } })()
  if (use3d.value && !played) {
    intro.value = true
    opacity.value = 0
    try { sessionStorage.setItem('introPlayed', '1') } catch { /* ignore */ }
  }
})
function onSceneReady() { if (intro.value) void playIntro() }
</script>

<template>
  <main class="home">
    <TerrainCanvas v-if="use3d" :hovered="hovered" :opacity="opacity" @hover="hovered = $event" @select="go" @ready="onSceneReady" />
    <img v-else class="fallback" src="/terrain-fallback.svg" alt="">
    <div v-if="intro" ref="introName" class="intro-name">Scream</div>
    <Legend ref="legendEl" :essay-count="essayCount" :project-count="projectCount" :params="params" :intro="intro" @navigate="go" @hover="hovered = $event" />
    <div class="mono hint">scroll · altitude &nbsp;&nbsp; ~ · terminal</div>
  </main>
</template>

<style scoped>
.home { position: fixed; inset: 0; overflow: hidden; background: var(--bg); }
.fallback { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; color: var(--fg); }
.intro-name { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); font-size: 96px; font-weight: 600; letter-spacing: .14em; opacity: 0; will-change: transform; }
.hint { position: absolute; right: 24px; bottom: 20px; }
@media (pointer: coarse) { .hint { display: none; } }
</style>
