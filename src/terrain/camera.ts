/**
 * 相机的纯函数与常量。这里不 import scene.ts，
 * 否则 three.js 会被静态拉进首页 chunk，降级路径（无 WebGL / 减少动态）也要下载它。
 * 静态降级图的生成脚本（scripts/render-fallback.mjs）也从这里取相机，保证两边构图一致。
 */
export const ALTITUDE = { min: 6, max: 26, initial: 14 }

/** 透视相机参数（竖直视角，单位度）。 */
export const CAMERA = { fov: 42, near: 0.1, far: 200 } as const

export interface Vec3 { x: number; y: number; z: number }

/**
 * 相机位姿：高度 altitude，向 +z 后退，看向原点略前方；
 * px, py 是平滑后的指针位置（[-1, 1]），带来左右 / 俯仰的轻微漂移。
 */
export function cameraPose(altitude: number, px = 0, py = 0): { position: Vec3; target: Vec3 } {
  return {
    position: { x: px * 1.6, y: altitude, z: altitude * 0.9 + 4 },
    target: { x: px * 0.8, y: -0.5 + py * 0.6, z: -2 },
  }
}

/**
 * 镜头的慢漂移（叠加在指针位置上，单位同指针 [-1, 1]）：两个互质周期的正弦，
 * 约一分半钟才重复一次。没有粒子的天气、触屏上没有指针时，山脊之间也有缓慢的视差。
 * 两个分量都从 0 起步：刚建好场景的第一帧和静态降级图（指针 0, 0）构图一致，交叉淡化时不错位。
 */
export const DRIFT = { x: 0.16, y: 0.1, periodX: 57, periodY: 83 }

export function cameraDrift(t: number): { x: number; y: number } {
  return {
    x: Math.sin((t / DRIFT.periodX) * Math.PI * 2) * DRIFT.x,
    y: Math.sin((t / DRIFT.periodY) * Math.PI * 2) * DRIFT.y,
  }
}

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
