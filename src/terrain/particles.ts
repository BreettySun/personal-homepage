import * as THREE from 'three'
import type { Season, WeatherState } from '@/weather/openMeteo'

export type ParticleKind = 'none' | 'rain' | 'snow' | 'leaves'
export interface Bounds { halfW: number; halfD: number; top: number; floor: number }

export function particleKindFor(state: WeatherState, season: Season): ParticleKind {
  if (state === 'rain') return 'rain'
  if (state === 'snow') return 'snow'
  if (season === 'autumn') return 'leaves'
  return 'none'
}

const MAX_COUNT = { none: 0, rain: 2400, snow: 1400, leaves: 180 }
export function particleCount(kind: ParticleKind, intensity: number, quality: 'high' | 'low'): number {
  const q = quality === 'low' ? 1 / 3 : 1
  return Math.round(MAX_COUNT[kind] * Math.max(0, Math.min(1, intensity)) * q)
}

function respawn(p: Float32Array, i: number, b: Bounds) {
  p[i * 3] = (Math.random() * 2 - 1) * b.halfW
  p[i * 3 + 1] = b.floor + Math.random() * (b.top - b.floor)
  p[i * 3 + 2] = (Math.random() * 2 - 1) * b.halfD
}

/** 更新第 i 个粒子的位置。t 是场景总时间，用来做雪与落叶的摆动。 */
export function stepParticle(kind: ParticleKind, p: Float32Array, i: number, dt: number, t: number, b: Bounds): void {
  const ix = i * 3, iy = ix + 1, iz = ix + 2
  if (kind === 'rain') {
    p[iy] -= 28 * dt
  } else if (kind === 'snow') {
    p[iy] -= 1.6 * dt
    p[ix] += Math.sin(t * 1.3 + i) * 0.6 * dt
    p[iz] += Math.cos(t * 0.9 + i * 0.7) * 0.4 * dt
  } else if (kind === 'leaves') {
    p[iy] -= 0.9 * dt
    p[ix] += (0.8 + Math.sin(t + i) * 0.5) * dt
    p[iz] += Math.cos(t * 0.6 + i) * 0.5 * dt
  }
  if (p[iy] < b.floor || Math.abs(p[ix]) > b.halfW || Math.abs(p[iz]) > b.halfD) {
    respawn(p, i, b)
    p[iy] = b.top - Math.random() * 2
  }
}

export function createParticles(scene: THREE.Scene, kind: ParticleKind, count: number, color: string, bounds: Bounds) {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) respawn(positions, i, bounds)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const size = kind === 'rain' ? 0.05 : kind === 'snow' ? 0.12 : 0.2
  const mat = new THREE.PointsMaterial({ color: new THREE.Color(color), size, transparent: true, opacity: kind === 'rain' ? 0.55 : 0.85, sizeAttenuation: true, depthWrite: false })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  scene.add(points)
  let t = 0
  return {
    tick(dt: number) {
      t += dt
      for (let i = 0; i < count; i++) stepParticle(kind, positions, i, dt, t, bounds)
      geo.attributes.position.needsUpdate = true
    },
    setColor(c: string) { mat.color.set(c) },
    dispose() { scene.remove(points); geo.dispose(); mat.dispose() },
  }
}
