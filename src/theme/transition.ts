import { nextTick } from 'vue'
import { prefersReducedMotion } from '@/terrain/support'
import { useTheme, type Theme } from './theme'

export interface Point { x: number; y: number }

const DURATION = 650
const EASING = 'cubic-bezier(.4, 0, .2, 1)'
let current: ViewTransition | null = null

/**
 * 切换主题：支持 View Transitions 且没有要求减少动效时，新主题从 origin（默认视口中心）
 * 像墨迹一样圆形晕开，盖过旧画面；否则立即切换，和原来一样。
 * 主题本身仍只由 theme.ts 落地（html 的 data-theme + localStorage['theme']）。
 */
export function switchTheme(next: Theme, origin?: Point) {
  const { theme, setTheme } = useTheme()
  // 主题没变（比如终端里重复 theme dark）就不必晕开，只把这次选择记下来
  if (next === theme.value || typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
    setTheme(next)
    return
  }
  const root = document.documentElement
  const w = window.innerWidth, h = window.innerHeight
  const x = origin?.x ?? w / 2, y = origin?.y ?? h / 2
  // 半径量到最远的那个角，展开结束时正好盖满视口
  const r = Math.hypot(Math.max(x, w - x), Math.max(y, h - y))

  const t = document.startViewTransition(async () => {
    // 和换主题放在同一帧：新画面里颜色直接到位，不再走 body 的 0.3s 过渡（见 base.css）
    root.classList.add('theme-switching')
    setTheme(next)
    await nextTick() // 等开关上的"宣纸/雨夜"也换好，新画面才完整
  })
  current = t
  t.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: DURATION, easing: EASING, pseudoElement: '::view-transition-new(root)' },
    )
  }).catch(() => { /* 过渡被跳过（连点、页面隐藏）：主题已在回调里换好，不用管 */ })
  const done = () => {
    // 连点时旧过渡先结束，别替还在进行的新过渡把开关提前拿掉
    if (current !== t) return
    current = null
    root.classList.remove('theme-switching')
  }
  t.finished.then(done, done)
}
