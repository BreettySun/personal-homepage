/**
 * 相机的纯函数与常量。这里不 import scene.ts，
 * 否则 three.js 会被静态拉进首页 chunk，降级路径（无 WebGL / 减少动态）也要下载它。
 */
export const ALTITUDE = { min: 6, max: 26, initial: 14 }

/** 滚轮每 100px 改变 1 个单位高度，夹在 ALTITUDE.min..max 之间。 */
export function altitudeFromWheel(current: number, deltaY: number): number {
  const next = current + deltaY / 100
  return Math.max(ALTITUDE.min, Math.min(ALTITUDE.max, next))
}

/** 把指针位置映射到 [-1,1]：x 向右为正，y 向上为正，矩形中心为 0,0。 */
export function normalizedPointer(
  e: { clientX: number; clientY: number },
  rect: { left: number; top: number; width: number; height: number },
): { nx: number; ny: number } {
  const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
  const ny = 1 - ((e.clientY - rect.top) / rect.height) * 2
  return { nx, ny }
}
