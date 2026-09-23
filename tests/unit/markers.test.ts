import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ALTITUDE, CAMERA, cameraPose } from '@/terrain/camera'
import { AMPLITUDE, FIELD, heightAt, MARKER_IDS, markerLayoutFor, QUALITY } from '@/terrain/heightfield'
import { MARKER_LIFT } from '@/terrain/markers'

// 契约：默认相机下，常见视口里三个标记都在画面内，而且不压在左下角（手机上是底部）的图例卡片下面。
// 图例的尺寸取自 Legend.vue 的布局（收起参数面板时约 342px 高），多留一圈余量。
const LEGEND_H = 360
function legendRect(w: number, h: number) {
  return w <= 640
    ? { left: 16, right: w - 16, top: h - 16 - LEGEND_H, bottom: h - 16 }
    : { left: 48, right: 348, top: h - 48 - LEGEND_H, bottom: h - 48 }
}

function project(w: number, h: number, x: number, y: number, z: number) {
  const cam = new THREE.PerspectiveCamera(CAMERA.fov, w / h, CAMERA.near, CAMERA.far)
  const pose = cameraPose(ALTITUDE.initial)
  cam.position.set(pose.position.x, pose.position.y, pose.position.z)
  cam.lookAt(pose.target.x, pose.target.y, pose.target.z)
  cam.updateMatrixWorld()
  const v = new THREE.Vector3(x, y, z).project(cam)
  return { px: ((v.x + 1) / 2) * w, py: ((1 - v.y) / 2) * h }
}

const VIEWPORTS = [
  [1280, 800], [1440, 900], [1920, 1080], [2560, 1080], [1024, 768], [1000, 1000],
  [768, 1024], [820, 1180], [390, 844], [360, 740],
] as const

describe('marker layout on screen', () => {
  const spec = { ...QUALITY.high, ...FIELD, amplitude: AMPLITUDE, seed: 0x5c7e }
  for (const [w, h] of VIEWPORTS) {
    it(`${w}×${h}: all three entrances are on screen and clear of the legend`, () => {
      const layout = markerLayoutFor(w / h)
      const legend = legendRect(w, h)
      for (const id of MARKER_IDS) {
        const { x, z } = layout[id]
        // 无论地形起伏，符号都在地面上方 MARKER_LIFT 处；取最高、最低两种情况都要满足
        for (const y of [heightAt(spec, x, z) + MARKER_LIFT.rest, AMPLITUDE + MARKER_LIFT.rest, -AMPLITUDE + MARKER_LIFT.rest]) {
          const p = project(w, h, x, y, z)
          expect(p.px, `${id} x`).toBeGreaterThan(24)
          expect(p.px, `${id} x`).toBeLessThan(w - 24)
          expect(p.py, `${id} y`).toBeGreaterThan(56)
          expect(p.py, `${id} y`).toBeLessThan(h - 24)
          const underLegend = p.px > legend.left - 20 && p.px < legend.right + 20 && p.py > legend.top - 20 && p.py < legend.bottom
          expect(underLegend, `${id} under legend`).toBe(false)
        }
      }
    })
  }
})
