import { describe, expect, it } from 'vitest'
import { buildHeightfield, heightAt, makeHeightFn, MARKERS, ROW_JITTER, rowLevel, rowsFor, rowZ } from '@/terrain/heightfield'

const spec = { cols: 40, rows: 30, width: 40, depth: 30, amplitude: 2, seed: 0x5c7e }

describe('rowZ', () => {
  const spacing = spec.depth / (spec.rows - 1)
  it('is deterministic per seed and keeps the two edge rows exactly on the boundary', () => {
    const a = rowZ(spec), b = rowZ(spec), c = rowZ({ ...spec, seed: 1 })
    expect(Array.from(a)).toEqual(Array.from(b))
    expect(Array.from(a)).not.toEqual(Array.from(c))
    expect(a[0]).toBe(-spec.depth / 2)
    expect(a[spec.rows - 1]).toBe(spec.depth / 2)
  })
  it('jitters every inner row by at most half of ROW_JITTER × spacing and never reorders rows', () => {
    const zs = rowZ(spec)
    let jittered = 0
    for (let r = 1; r < spec.rows - 1; r++) {
      const base = -spec.depth / 2 + r * spacing
      const off = Math.abs(zs[r] - base)
      expect(off).toBeLessThanOrEqual((ROW_JITTER / 2) * spacing + 1e-9)
      if (off > 1e-6) jittered++
      expect(zs[r]).toBeGreaterThan(zs[r - 1])
    }
    expect(jittered).toBeGreaterThan(spec.rows / 2)
  })
})

describe('rowsFor', () => {
  it('scales the base row count and never goes below 16', () => {
    expect(rowsFor(120, 1)).toBe(120)
    expect(rowsFor(120, 0.5)).toBe(60)
    expect(rowsFor(120, 1.6)).toBe(192)
    expect(rowsFor(60, 0.1)).toBe(16)
  })
})

describe('rowLevel', () => {
  it('keeps every 4th row, drops odd rows first, then the remaining even rows', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(rowLevel)).toEqual([0, 1, 2, 1, 0, 1, 2, 1])
  })
})

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
    const z = rowZ(spec)[row] // 行的 z 带抖动，高度也是在抖动后的 z 上采样的
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
