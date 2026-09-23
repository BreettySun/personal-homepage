import { describe, expect, it } from 'vitest'
import { LIGHT, vertexShade } from '@/terrain/lighting'

function field(cols: number, rows: number, h: (x: number, z: number) => number) {
  const width = cols - 1
  const zs = Float32Array.from({ length: rows }, (_, r) => r)
  const heights = new Float32Array(cols * rows)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights[r * cols + c] = h(c, zs[r])
  return { heights, cols, rows, width, zs }
}

describe('vertexShade', () => {
  it('is zero on flat ground', () => {
    const f = field(6, 5, () => 1.3)
    const s = vertexShade(f.heights, f.cols, f.rows, f.width, f.zs)
    for (const v of s) expect(v).toBeCloseTo(0, 6)
  })
  it('is positive on slopes facing the light and negative on slopes facing away', () => {
    // 光从 -x 方向来：高度随 x 升高的坡面朝向 -x，朝光
    expect(LIGHT.x).toBeLessThan(0)
    const toward = field(6, 5, (x) => x * 0.3)
    const away = field(6, 5, (x) => -x * 0.3)
    const a = vertexShade(toward.heights, toward.cols, toward.rows, toward.width, toward.zs)
    const b = vertexShade(away.heights, away.cols, away.rows, away.width, away.zs)
    expect(a[7]).toBeGreaterThan(0)
    expect(b[7]).toBeLessThan(0)
  })
  it('stays within [-1, 1] even on cliffs', () => {
    const f = field(6, 5, (x, z) => (x * 7) % 5 + z * 9)
    for (const v of vertexShade(f.heights, f.cols, f.rows, f.width, f.zs)) {
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
