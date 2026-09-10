import { describe, expect, it } from 'vitest'
import { buildHeightfield, heightAt, makeHeightFn, MARKERS } from '@/terrain/heightfield'

const spec = { cols: 40, rows: 30, width: 40, depth: 30, amplitude: 2, seed: 0x5c7e }

describe('makeHeightFn', () => {
  it('is deterministic for a seed and different across seeds', () => {
    const a = makeHeightFn(1), b = makeHeightFn(1), c = makeHeightFn(2)
    expect(a(3.3, 4.4)).toBe(b(3.3, 4.4))
    expect(a(3.3, 4.4)).not.toBe(c(3.3, 4.4))
  })
  it('stays within [-1, 1]', () => {
    const f = makeHeightFn(7)
    for (let i = 0; i < 500; i++) {
      const v = f(i * 0.37, i * 0.11)
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})

describe('buildHeightfield', () => {
  it('has cols*rows entries scaled by amplitude', () => {
    const h = buildHeightfield(spec)
    expect(h.length).toBe(1200)
    let max = 0
    for (const v of h) max = Math.max(max, Math.abs(v))
    expect(max).toBeLessThanOrEqual(2)
    expect(max).toBeGreaterThan(0.2)
  })
})

describe('heightAt', () => {
  it('matches the grid value at a grid vertex', () => {
    const h = buildHeightfield(spec)
    const col = 10, row = 7
    const x = -spec.width / 2 + (col / (spec.cols - 1)) * spec.width
    const z = -spec.depth / 2 + (row / (spec.rows - 1)) * spec.depth
    expect(heightAt(spec, x, z)).toBeCloseTo(h[row * spec.cols + col], 6)
  })
})

describe('MARKERS', () => {
  it('has the three entrances inside the field', () => {
    expect(MARKERS.map(m => m.id)).toEqual(['essays', 'projects', 'about'])
    for (const m of MARKERS) {
      expect(Math.abs(m.x)).toBeLessThan(20)
      expect(Math.abs(m.z)).toBeLessThan(15)
    }
  })
})
