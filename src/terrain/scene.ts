import * as THREE from 'three'
import type { Season, WeatherState } from '@/weather/openMeteo'
import { AMPLITUDE, buildHeightfield, FIELD, heightAt, MARKERS, QUALITY, type HeightfieldSpec, type MarkerId } from './heightfield'
import { createParticles, particleCount, particleKindFor, type ParticleKind } from './particles'
import { ALTITUDE } from './camera'

export interface TerrainColors { line: string; fog: string; accent: string }
export interface TerrainScene {
  setSeed(seed: number): void
  setColors(c: TerrainColors): void
  setAltitude(a: number): void
  setPointer(nx: number, ny: number): void
  setWeather(state: WeatherState, season: Season, intensity: number): void
  pickMarker(nx: number, ny: number): MarkerId | null
  setHovered(id: MarkerId | null): void
  setOpacity(o: number): void
  dispose(): void
}
export { ALTITUDE }

/** 把高度场变成"每一行一条折线"的线段索引几何。 */
function buildLineGeometry(spec: HeightfieldSpec): THREE.BufferGeometry {
  const heights = buildHeightfield(spec)
  const positions = new Float32Array(spec.cols * spec.rows * 3)
  for (let r = 0; r < spec.rows; r++) {
    const z = -spec.depth / 2 + (r / (spec.rows - 1)) * spec.depth
    for (let c = 0; c < spec.cols; c++) {
      const i = r * spec.cols + c
      positions[i * 3] = -spec.width / 2 + (c / (spec.cols - 1)) * spec.width
      positions[i * 3 + 1] = heights[i]
      positions[i * 3 + 2] = z
    }
  }
  const index: number[] = []
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols - 1; c++) {
      const i = r * spec.cols + c
      index.push(i, i + 1)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setIndex(index)
  return geo
}

export function createTerrainScene(canvas: HTMLCanvasElement, opts: { seed: number; colors: TerrainColors; quality: 'high' | 'low' }): TerrainScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(new THREE.Color(opts.colors.fog), 14, 46)

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)
  let altitude = ALTITUDE.initial
  const pointer = new THREE.Vector2(0, 0)
  const pointerSmoothed = new THREE.Vector2(0, 0)

  let spec: HeightfieldSpec = { ...QUALITY[opts.quality], ...FIELD, amplitude: AMPLITUDE, seed: opts.seed }
  const lineMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(opts.colors.line), transparent: true, opacity: 1 })
  let lines = new THREE.LineSegments(buildLineGeometry(spec), lineMaterial)
  scene.add(lines)

  // 标记点：小球 + 立柱
  const markerGroup = new THREE.Group()
  const markerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(opts.colors.accent), transparent: true })
  const markerMeshes = new Map<MarkerId, THREE.Mesh>()
  for (const m of MARKERS) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), markerMat.clone())
    mesh.userData.id = m.id
    markerGroup.add(mesh)
    markerMeshes.set(m.id, mesh)
  }
  scene.add(markerGroup)
  function placeMarkers() {
    for (const m of MARKERS) {
      const mesh = markerMeshes.get(m.id)!
      mesh.position.set(m.x, heightAt(spec, m.x, m.z) + 0.35, m.z)
      mesh.userData.baseY = mesh.position.y
    }
  }
  placeMarkers()

  let hovered: MarkerId | null = null
  const raycaster = new THREE.Raycaster()

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (w === 0 || h === 0) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()

  let weatherTick: ((dt: number) => void) | null = null   // Task 9 挂粒子更新
  let particles: ReturnType<typeof createParticles> | null = null
  let currentKind: ParticleKind = 'none'
  let particleColor = opts.colors.line
  const bounds = { halfW: FIELD.width / 2, halfD: FIELD.depth / 2, top: 12, floor: -2.5 }
  function rebuildParticles(kind: ParticleKind, count: number) {
    particles?.dispose()
    particles = null
    weatherTick = null
    currentKind = kind
    if (kind === 'none' || count === 0) return
    particles = createParticles(scene, kind, count, kind === 'leaves' ? opts.colors.accent : particleColor, bounds)
    weatherTick = dt => particles!.tick(dt)
  }
  let raf = 0
  let last = performance.now()
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    pointerSmoothed.lerp(pointer, 0.06)
    // 相机：高度 altitude，向 -z 方向后退，看向原点略前方；鼠标带来左右/俯仰漂移
    camera.position.set(pointerSmoothed.x * 1.6, altitude, altitude * 0.9 + 4)
    camera.lookAt(pointerSmoothed.x * 0.8, -0.5 + pointerSmoothed.y * 0.6, -2)
    for (const mesh of markerMeshes.values()) {
      const isHover = mesh.userData.id === hovered
      const targetY = mesh.userData.baseY + (isHover ? 0.6 : 0)
      mesh.position.y += (targetY - mesh.position.y) * 0.15
      const s = isHover ? 1.6 : 1
      mesh.scale.setScalar(mesh.scale.x + (s - mesh.scale.x) * 0.15)
    }
    weatherTick?.(dt)
    renderer.render(scene, camera)
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  const api: TerrainScene = {
    setSeed(seed) {
      spec = { ...spec, seed }
      lines.geometry.dispose()
      lines.geometry = buildLineGeometry(spec)
      placeMarkers()
    },
    setColors(c) {
      lineMaterial.color.set(c.line)
      ;(scene.fog as THREE.Fog).color.set(c.fog)
      for (const mesh of markerMeshes.values()) (mesh.material as THREE.MeshBasicMaterial).color.set(c.accent)
      particleColor = c.line
      particles?.setColor(currentKind === 'leaves' ? c.accent : c.line)
    },
    setAltitude(a) { altitude = Math.max(ALTITUDE.min, Math.min(ALTITUDE.max, a)) },
    setPointer(nx, ny) { pointer.set(nx, ny) },
    setWeather(state, season, intensity) {
      const kind = particleKindFor(state, season)
      rebuildParticles(kind, particleCount(kind, intensity, opts.quality))
    },
    pickMarker(nx, ny) {
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera)
      const hit = raycaster.intersectObjects([...markerMeshes.values()], false)[0]
      return hit ? (hit.object.userData.id as MarkerId) : null
    },
    setHovered(id) { hovered = id },
    setOpacity(o) {
      lineMaterial.opacity = o
      for (const mesh of markerMeshes.values()) (mesh.material as THREE.MeshBasicMaterial).opacity = o
    },
    dispose() {
      particles?.dispose()
      cancelAnimationFrame(raf)
      ro.disconnect()
      lines.geometry.dispose()
      lineMaterial.dispose()
      for (const mesh of markerMeshes.values()) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() }
      renderer.dispose()
    },
  }
  return api
}
