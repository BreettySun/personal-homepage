import { describe, expect, it } from 'vitest'
import { advanceRipple, RIPPLE } from '@/terrain/terrainShader'

describe('advanceRipple', () => {
  it('wraps within one cycle and runs faster while hovered', () => {
    const rest = advanceRipple(0, 1, 0)
    const hover = advanceRipple(0, 1, 1)
    expect(rest).toBeCloseTo(1 / RIPPLE.period, 6)
    expect(hover).toBeGreaterThan(rest)
    expect(advanceRipple(0.95, 1, 1)).toBeLessThan(0.95)   // 走完一圈从头开始
  })
  it('never jumps when the hover amount changes: the next step only depends on the rate', () => {
    // 同一帧里悬停程度从 0 渐变到 1，进度的增量有界（≤ dt / hoverPeriod）
    let c = 0.4
    for (let h = 0; h <= 1; h += 0.1) {
      const next = advanceRipple(c, 1 / 60, h)
      expect(next - c).toBeGreaterThan(0)
      expect(next - c).toBeLessThanOrEqual(1 / 60 / RIPPLE.hoverPeriod + 1e-9)
      c = next
    }
  })
})
