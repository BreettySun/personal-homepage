import { createNoise2D } from 'simplex-noise'

export interface HeightfieldSpec { cols: number; rows: number; width: number; depth: number; amplitude: number; seed: number }
export type MarkerId = 'essays' | 'projects' | 'about'

/** 地形默认规格：40 × 30 个世界单位，高质量 200 × 120 顶点。 */
export const FIELD = { width: 40, depth: 30 }
export const QUALITY = { high: { cols: 200, rows: 120 }, low: { cols: 100, rows: 60 } }
export const AMPLITUDE = 2.2

/** 三个入口在地形上的位置（世界坐标 x, z）。 */
export const MARKERS: { id: MarkerId; x: number; z: number }[] = [
  { id: 'essays', x: -6, z: 2 },
  { id: 'projects', x: 5, z: -3 },
  { id: 'about', x: 11, z: 5 },
]

/** mulberry32，给 simplex-noise 一个可复现的随机源。 */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 三个八度叠加的 2D simplex，输出归一化到 [-1, 1]。 */
export function makeHeightFn(seed: number): (x: number, z: number) => number {
  const noise = createNoise2D(mulberry32(seed))
  const octaves = [
    { freq: 0.045, amp: 1.0 },
    { freq: 0.11, amp: 0.45 },
    { freq: 0.27, amp: 0.18 },
  ]
  const total = octaves.reduce((s, o) => s + o.amp, 0)
  return (x, z) => {
    let v = 0
    for (const o of octaves) v += noise(x * o.freq, z * o.freq) * o.amp
    return Math.max(-1, Math.min(1, v / total))
  }
}

export function buildHeightfield(spec: HeightfieldSpec): Float32Array {
  const f = makeHeightFn(spec.seed)
  const out = new Float32Array(spec.cols * spec.rows)
  for (let r = 0; r < spec.rows; r++) {
    const z = -spec.depth / 2 + (r / (spec.rows - 1)) * spec.depth
    for (let c = 0; c < spec.cols; c++) {
      const x = -spec.width / 2 + (c / (spec.cols - 1)) * spec.width
      out[r * spec.cols + c] = f(x, z) * spec.amplitude
    }
  }
  return out
}

export function heightAt(spec: HeightfieldSpec, x: number, z: number): number {
  return makeHeightFn(spec.seed)(x, z) * spec.amplitude
}
