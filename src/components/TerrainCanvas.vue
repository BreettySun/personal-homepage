<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { MarkerId } from '@/terrain/heightfield'
import type { TerrainScene } from '@/terrain/scene'
import { altitudeFromWheel, normalizedPointer } from '@/terrain/camera'
import { isCoarsePointer } from '@/terrain/support'
import { useTerrainParams } from '@/weather/terrainParams'
import { useTheme } from '@/theme/theme'

const props = defineProps<{ hovered: MarkerId | null; opacity: number }>()
const emit = defineEmits<{ hover: [id: MarkerId | null]; select: [id: MarkerId]; ready: []; failed: [] }>()

const canvas = ref<HTMLCanvasElement>()
let sceneApi: TerrainScene | null = null
let altitude = 14
const { params } = useTerrainParams()
const { theme } = useTheme()

function readColors() {
  const s = getComputedStyle(document.documentElement)
  return { line: s.getPropertyValue('--fg').trim(), fog: s.getPropertyValue('--bg').trim(), accent: s.getPropertyValue('--accent').trim() }
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  altitude = altitudeFromWheel(altitude, e.deltaY)
  sceneApi?.setAltitude(altitude)
}
function onMove(e: PointerEvent) {
  if (!canvas.value || !sceneApi) return
  const { nx, ny } = normalizedPointer(e, canvas.value.getBoundingClientRect())
  if (!isCoarsePointer()) sceneApi.setPointer(nx, ny)
  emit('hover', sceneApi.pickMarker(nx, ny))
}
function onClick(e: PointerEvent) {
  if (!canvas.value || !sceneApi) return
  const { nx, ny } = normalizedPointer(e, canvas.value.getBoundingClientRect())
  const id = sceneApi.pickMarker(nx, ny)
  if (id) emit('select', id)
}

onMounted(async () => {
  // supportsWebGL() 只证明能拿到 context；真正建场景仍可能抛（驱动、显存、context lost）。
  // 这时必须让首页退回静态图，否则地形和图例都卡在 opacity 0。
  try {
    const { createTerrainScene, ALTITUDE } = await import('@/terrain/scene')
    if (!canvas.value) return
    altitude = ALTITUDE.initial
    sceneApi = createTerrainScene(canvas.value, {
      seed: params.value.seed,
      colors: readColors(),
      quality: isCoarsePointer() || window.innerWidth < 768 ? 'low' : 'high',
    })
    sceneApi.setWeather(params.value.weather, params.value.season, params.value.intensity)
    sceneApi.setOpacity(props.opacity)
    emit('ready')
  } catch (err) {
    sceneApi = null
    console.warn('[terrain] 场景创建失败，回退到静态地形图', err)
    emit('failed')
  }
})

watch(() => params.value.seed, s => sceneApi?.setSeed(s))
watch(() => [params.value.weather, params.value.season, params.value.intensity] as const, ([w, s, i]) => sceneApi?.setWeather(w, s, i))
watch(theme, () => requestAnimationFrame(() => sceneApi?.setColors(readColors())))
watch(() => props.hovered, h => sceneApi?.setHovered(h))
watch(() => props.opacity, o => sceneApi?.setOpacity(o))

onBeforeUnmount(() => { sceneApi?.dispose(); sceneApi = null })
</script>

<template>
  <canvas ref="canvas" class="terrain-canvas" :class="{ 'is-hover': hovered }" @wheel="onWheel" @pointermove="onMove" @click="onClick" />
</template>

<style scoped>
.terrain-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
.terrain-canvas.is-hover { cursor: pointer; }
</style>
