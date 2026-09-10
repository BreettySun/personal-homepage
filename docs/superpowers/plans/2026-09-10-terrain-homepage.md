# 「地形志」个人主页 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Vite + Vue 3 + vite-ssg 建一个部署在 GitHub Pages 的个人主页：首页是带实时天气的 3D 线框地形地图，内容页是纸感排版的散文与项目，全站带明暗主题和终端彩蛋。

**Architecture:** 内容管线在构建时把 `content/` 下的 Markdown 解析成纯数据，页面与终端都从这份数据读。地形模块用 Three.js 在 CPU 上生成可复现的高度场并以线段绘制，对外只暴露天气 / 季节 / 种子三个响应式参数；天气模块、参数面板、终端都只往这三个值上写。主题模块只管根元素上的 CSS 变量。vite-ssg 把每个路由预渲染成静态 HTML。

**Tech Stack:** Vite 8, Vue 3.5, vue-router 5, vite-ssg 28, TypeScript, Three.js 0.186, simplex-noise 4, GSAP 3.15, markdown-it 15, Vitest 5, @vue/test-utils, Playwright 1.63, subset-font 2.7, @fontsource/jetbrains-mono, Node 24。

**Spec:** `docs/superpowers/specs/2026-09-10-terrain-homepage-design.md`

## Global Constraints

- Node >= 24（本机 v24.17.0），npm >= 11。所有包用 `npm`。
- 颜色只用 CSS 变量，色值取自 spec 3.1：宣纸 `#F3EEE4 / #E4DCCB / #5B6B7A / #2B2A28 / #B5453C`；雨夜 `#151A20 / #232B34 / #7C8A99 / #8A97A6 / #E6E0D4 / #D9A441`。
- 正文字体 Noto Serif SC（构建时子集化），等宽字体 JetBrains Mono。系统回退 `"Songti SC", "STSong", "SimSun", serif`。
- 元数据一律写成等宽注释 `// a · b · c` 形式，分隔符是 ` · `（空格 间隔号 空格）。
- 所有可交互动效尊重 `prefers-reduced-motion: reduce`。
- 路由固定为 `/`、`/essays`、`/essays/:slug`、`/projects`、`/about`。
- 天气状态类型固定为 `'clear' | 'cloudy' | 'rain' | 'snow'`，季节固定为 `'spring' | 'summer' | 'autumn' | 'winter'`。
- 与 spec 的两处有意偏离（原因写在对应任务里）：头部解析不用 gray-matter 而是自写 40 行解析器；地形高度在 JS 中计算而不是 GLSL。
- 每个任务结束提交一次，提交信息用英文 conventional commits。
- 目前目录不是 git 仓库，Task 1 第一步初始化。

## 文件结构总览

```
personal-homepage/
├─ content/
│  ├─ essays/*.md                 文章，头部 title/date/city/weather
│  ├─ projects/*.md               项目，头部 name/tagline/stack/year/github/url
│  └─ about.md                    关于，头部 links
├─ public/
│  ├─ fonts/                      构建脚本产出的 woff2（gitignore）
│  └─ terrain-fallback.svg        无 WebGL / 减少动效时的静态地形
├─ scripts/subset-fonts.mjs       下载 Noto Serif CJK 并按内容子集化
├─ src/
│  ├─ main.ts                     ViteSSG 入口 + includedRoutes
│  ├─ App.vue                     根布局：导航、主题开关、终端、路由过渡
│  ├─ router.ts                   路由表
│  ├─ styles/tokens.css           两套主题的 CSS 变量 + 字体 face
│  ├─ styles/base.css             重置与排版基础
│  ├─ theme/theme.ts              resolveTheme / useTheme
│  ├─ content/frontmatter.ts      头部解析器（纯函数）
│  ├─ content/markdown.ts         markdown-it 实例 + 字数/阅读时长（纯函数）
│  ├─ content/types.ts            Essay / Project / About 类型
│  ├─ content/essays.ts           parseEssay + loadEssays + groupByYear
│  ├─ content/projects.ts         parseProject + loadProjects
│  ├─ content/about.ts            parseAbout + loadAbout
│  ├─ weather/openMeteo.ts        映射 WMO 代码、季节、默认天气、请求
│  ├─ weather/terrainParams.ts    响应式参数单例 + 手动覆盖 + localStorage
│  ├─ terrain/heightfield.ts      可复现高度场（纯函数，simplex-noise）
│  ├─ terrain/scene.ts            Three.js 场景：线段地形、雾、相机、标记
│  ├─ terrain/particles.ts        雨 / 雪 / 落叶粒子
│  ├─ terrain/support.ts          supportsWebGL / prefersReducedMotion
│  ├─ terminal/types.ts           Command / TerminalContext / TerminalOutput
│  ├─ terminal/parse.ts           parseCommand / complete（纯函数）
│  ├─ terminal/commands/*.ts      一个命令一个文件
│  ├─ terminal/registry.ts        汇总命令
│  ├─ terminal/Terminal.vue       终端组件（~ 呼出）
│  ├─ components/MetaLine.vue     等宽注释行
│  ├─ components/ThemeToggle.vue  主题开关
│  ├─ components/Legend.vue       首页图例卡（含参数面板）
│  ├─ components/ParamPanel.vue   参数面板
│  ├─ components/Altitude.vue     正文页海拔进度
│  ├─ components/TerrainCanvas.vue  地形画布组件（只在首页挂载）
│  ├─ composables/useParagraphReveal.ts  段落逐段淡入
│  ├─ composables/useAltitude.ts  阅读进度（纯函数 altitudePercent + composable）
│  └─ pages/Home.vue, EssayList.vue, Essay.vue, ProjectList.vue, About.vue
├─ tests/unit/**                  Vitest
├─ tests/e2e/**                   Playwright
├─ .github/workflows/deploy.yml
├─ index.html, vite.config.ts, vitest.config.ts, playwright.config.ts, tsconfig.json
```

任务顺序按"每步都能跑出可见结果"排：先骨架与内容页（Task 1 到 6，做完即可上线一个纸感文章站），再首页 3D 与天气（Task 7 到 10），最后动效细节、终端与端到端测试（Task 11 到 13）。

---

### Task 1: 项目脚手架

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`
- Create: `src/main.ts`, `src/App.vue`, `src/router.ts`, `src/pages/Home.vue`（占位）, `src/styles/base.css`
- Test: `tests/unit/smoke.test.ts`

**Interfaces:**
- Produces: `src/router.ts` 导出 `routes: RouteRecordRaw[]`，五条路由的 `name` 固定为 `home | essays | essay | projects | about`。后续任务只替换各页面组件内容，不改路由名。
- Produces: `src/main.ts` 导出 `createApp` 与 `includedRoutes`（Task 4 往 includedRoutes 里填文章 slug）。

- [ ] **Step 1: 初始化 git 与 npm**

```bash
cd /Users/scream/demo/personal-homepage
git init -b main
npm init -y
```

- [ ] **Step 2: 安装依赖**

```bash
npm i vue@^3.5 vue-router@^5 @unhead/vue@^2
npm i -D vite@^8 @vitejs/plugin-vue@^6 vite-ssg@^28 typescript@^5.9 vue-tsc@^3 vitest@^5 jsdom @vue/test-utils @types/node
```

注意 typescript 装 5.x（vue-tsc 3 对 TS 7 的支持未稳定）。

- [ ] **Step 3: 写 `.gitignore`**

```
node_modules
dist
.cache
public/fonts
.superpowers
test-results
playwright-report
```

- [ ] **Step 4: 写 `package.json` 的 scripts 与 type**

把 `package.json` 改成包含：

```json
{
  "name": "personal-homepage",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite-ssg build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "vue-tsc --noEmit"
  }
}
```

- [ ] **Step 5: 写 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client", "node"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "tests/**/*.ts", "scripts/**/*.mjs", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 6: 写 `vite.config.ts`**

```ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages 子路径：CI 通过 BASE_PATH 注入，本地默认 '/'
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
  },
})
```

- [ ] **Step 7: 写 `vitest.config.ts`**

```ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
  },
})
```

- [ ] **Step 8: 写 `index.html`**

主题属性要在首屏脚本里就设好，避免闪白，逻辑与 Task 2 的 `resolveTheme` 一致。

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Scream</title>
    <script>
      (function () {
        try {
          var stored = localStorage.getItem('theme');
          var dark = stored === 'dark' || (stored !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
          document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        } catch (e) { document.documentElement.dataset.theme = 'light'; }
      })();
    </script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 9: 写 `src/router.ts`**

```ts
import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('./pages/Home.vue') },
  { path: '/essays', name: 'essays', component: () => import('./pages/EssayList.vue') },
  { path: '/essays/:slug', name: 'essay', component: () => import('./pages/Essay.vue') },
  { path: '/projects', name: 'projects', component: () => import('./pages/ProjectList.vue') },
  { path: '/about', name: 'about', component: () => import('./pages/About.vue') },
]
```

- [ ] **Step 10: 写五个占位页面**

`src/pages/Home.vue`、`EssayList.vue`、`Essay.vue`、`ProjectList.vue`、`About.vue` 内容各自只有一行标题，例如 `Home.vue`：

```vue
<template>
  <main><h1>Home</h1></main>
</template>
```

其余四个把 `Home` 换成 `Essays`、`Essay`、`Projects`、`About`。

- [ ] **Step 11: 写 `src/styles/base.css`**

```css
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-serif);
  line-height: 2;
  transition: background-color .3s ease, color .3s ease;
}
a { color: inherit; text-decoration: none; }
img { max-width: 100%; display: block; }
.mono { font-family: var(--font-mono); font-size: 12px; letter-spacing: .02em; color: var(--muted); }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }
}
```

`--bg`、`--fg`、`--muted`、`--font-serif`、`--font-mono` 在 Task 2 的 `tokens.css` 里定义；本任务先在 `App.vue` 里给临时值，Task 2 删掉。

- [ ] **Step 12: 写 `src/App.vue`**

```vue
<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header class="site-nav">
    <RouterLink to="/" class="mono">~/</RouterLink>
    <nav>
      <RouterLink to="/essays">文章</RouterLink>
      <RouterLink to="/projects">项目</RouterLink>
      <RouterLink to="/about">关于</RouterLink>
    </nav>
  </header>
  <RouterView />
</template>

<style>
/* 临时 token，Task 2 移入 tokens.css */
:root { --bg: #F3EEE4; --fg: #2B2A28; --muted: #6B7280; --font-serif: "Songti SC", serif; --font-mono: Menlo, monospace; }
.site-nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 32px; }
.site-nav nav { display: flex; gap: 24px; font-size: 14px; letter-spacing: .1em; }
.site-nav a.router-link-active { border-bottom: 1px solid currentColor; }
</style>
```

- [ ] **Step 13: 写 `src/main.ts`**

```ts
import { ViteSSG } from 'vite-ssg'
import App from './App.vue'
import { routes } from './router'
import './styles/base.css'

export const createApp = ViteSSG(
  App,
  { routes, base: import.meta.env.BASE_URL },
)

// Task 4 会在这里把 /essays/:slug 展开成每篇文章的静态路径
export async function includedRoutes(paths: string[]) {
  return paths.filter(p => !p.includes(':'))
}
```

- [ ] **Step 14: 写冒烟测试 `tests/unit/smoke.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { routes } from '@/router'

describe('routes', () => {
  it('has the five fixed route names', () => {
    expect(routes.map(r => r.name)).toEqual(['home', 'essays', 'essay', 'projects', 'about'])
  })
})
```

- [ ] **Step 15: 跑测试与构建**

```bash
npm test
npm run build
ls dist
```

Expected: 测试 1 passed；`dist/` 下有 `index.html`、`essays/index.html`、`projects/index.html`、`about/index.html`，没有 `essays/:slug`。

- [ ] **Step 16: 提交**

```bash
git add -A
git commit -m "chore: scaffold vite + vue + vite-ssg project"
```

---

### Task 2: 主题模块（宣纸 / 雨夜）

**Files:**
- Create: `src/styles/tokens.css`, `src/theme/theme.ts`, `src/components/ThemeToggle.vue`
- Modify: `src/App.vue`（删临时 token，挂开关）, `src/main.ts`（引入 tokens.css）
- Test: `tests/unit/theme.test.ts`

**Interfaces:**
- Produces: `resolveTheme(stored: string | null, systemDark: boolean): Theme`，`type Theme = 'light' | 'dark'`。
- Produces: `useTheme(): { theme: Ref<Theme>; setTheme(t: Theme): void; toggle(): void }`，模块级单例；`setTheme` 写 `document.documentElement.dataset.theme` 与 `localStorage['theme']`。终端 `theme` 命令（Task 12）调用 `setTheme`。
- Produces: CSS 变量名：`--bg --bg-2 --fg --muted --accent --line --font-serif --font-mono`。地形场景（Task 8）用 `getComputedStyle(document.documentElement).getPropertyValue('--fg')` 等读颜色。

- [ ] **Step 1: 写失败测试 `tests/unit/theme.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { resolveTheme } from '@/theme/theme'

describe('resolveTheme', () => {
  it('uses the stored choice when present', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })
  it('falls back to the system preference', () => {
    expect(resolveTheme(null, true)).toBe('dark')
    expect(resolveTheme(null, false)).toBe('light')
  })
  it('ignores garbage in storage', () => {
    expect(resolveTheme('blue', true)).toBe('dark')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/theme.test.ts`
Expected: FAIL，找不到模块 `@/theme/theme`。

- [ ] **Step 3: 写 `src/theme/theme.ts`**

```ts
import { ref, type Ref } from 'vue'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'theme'

export function resolveTheme(stored: string | null, systemDark: boolean): Theme {
  if (stored === 'dark' || stored === 'light') return stored
  return systemDark ? 'dark' : 'light'
}

const theme: Ref<Theme> = ref('light')
let initialized = false

function readStored(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

function apply(t: Theme) {
  theme.value = t
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = t
}

export function useTheme() {
  if (!initialized && typeof window !== 'undefined') {
    initialized = true
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    apply(resolveTheme(readStored(), mq.matches))
    mq.addEventListener('change', (e) => {
      if (readStored() === null) apply(resolveTheme(null, e.matches))
    })
  }
  function setTheme(t: Theme) {
    apply(t)
    try { localStorage.setItem(STORAGE_KEY, t) } catch { /* 私密模式等，忽略 */ }
  }
  function toggle() { setTheme(theme.value === 'dark' ? 'light' : 'dark') }
  return { theme, setTheme, toggle }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/theme.test.ts`
Expected: 3 passed。

- [ ] **Step 5: 写 `src/styles/tokens.css`**

```css
:root {
  --font-serif: "Noto Serif SC", "Songti SC", "STSong", "SimSun", serif;
  --font-mono: "JetBrains Mono", "SF Mono", Menlo, monospace;

  /* 宣纸 */
  --bg: #F3EEE4;
  --bg-2: #E4DCCB;
  --fg: #2B2A28;
  --muted: #5B6B7A;
  --accent: #B5453C;
  --line: #d8cfbd;
  color-scheme: light;
}

:root[data-theme="dark"] {
  /* 雨夜 */
  --bg: #151A20;
  --bg-2: #232B34;
  --fg: #E6E0D4;
  --muted: #8A97A6;
  --accent: #D9A441;
  --line: #2c3540;
  color-scheme: dark;
}
```

字体 `@font-face` 在 Task 6 子集化后追加到这个文件。

- [ ] **Step 6: 写 `src/components/ThemeToggle.vue`**

```vue
<script setup lang="ts">
import { useTheme } from '@/theme/theme'
const { theme, toggle } = useTheme()
</script>

<template>
  <button class="theme-toggle mono" type="button" :aria-label="theme === 'dark' ? '切换到浅色' : '切换到深色'" @click="toggle">
    {{ theme === 'dark' ? '雨夜' : '宣纸' }}
  </button>
</template>

<style scoped>
.theme-toggle { background: none; border: 1px solid var(--line); border-radius: 2px; padding: 2px 8px; cursor: pointer; color: var(--muted); }
.theme-toggle:hover { color: var(--fg); }
</style>
```

- [ ] **Step 7: 更新 `App.vue` 与 `main.ts`**

`App.vue`：删掉 `<style>` 里的 `:root { … }` 临时 token 那一行；`<script setup>` 里加 `import ThemeToggle from '@/components/ThemeToggle.vue'`；在 `<nav>` 之后、`</header>` 之前加 `<ThemeToggle />`，并给 header 加一个右侧容器：

```vue
<header class="site-nav">
  <RouterLink to="/" class="mono">~/</RouterLink>
  <div class="site-nav__right">
    <nav>
      <RouterLink to="/essays">文章</RouterLink>
      <RouterLink to="/projects">项目</RouterLink>
      <RouterLink to="/about">关于</RouterLink>
    </nav>
    <ThemeToggle />
  </div>
</header>
```

样式加 `.site-nav__right { display: flex; align-items: center; gap: 24px; }`。

`main.ts` 在 `import './styles/base.css'` 之前加 `import './styles/tokens.css'`。

- [ ] **Step 8: 手动验证**

```bash
npm run dev
```

打开页面：点开关，背景在 `#F3EEE4` 与 `#151A20` 间切换；刷新后保持；清掉 localStorage 后跟随系统。关闭 dev server。

- [ ] **Step 9: 提交**

```bash
git add -A
git commit -m "feat: light/dark theme tokens and toggle"
```

---

### Task 3: 内容管线

**Files:**
- Create: `src/content/types.ts`, `src/content/frontmatter.ts`, `src/content/markdown.ts`, `src/content/essays.ts`, `src/content/projects.ts`, `src/content/about.ts`
- Create: `content/essays/*.md`（8 篇）, `content/projects/example.md`, `content/about.md`
- Test: `tests/unit/frontmatter.test.ts`, `tests/unit/markdown.test.ts`, `tests/unit/essays.test.ts`, `tests/unit/projects.test.ts`

**Interfaces:**
- Produces（`types.ts`）：

```ts
export interface Essay { slug: string; title: string; date: string; year: number; city: string; weather: string; summary: string; html: string; wordCount: number; readingMinutes: number }
export interface Project { slug: string; name: string; tagline: string; stack: string[]; year: number; github?: string; url?: string; cover?: string; html: string }
export interface AboutLink { label: string; href: string }
export interface About { html: string; links: AboutLink[] }
```

- Produces：`parseFrontmatter(raw: string): { data: Record<string, string | string[]>; body: string }`；`renderMarkdown(md: string): string`；`countWords(text: string): number`；`readingMinutes(wordCount: number): number`；`firstSentence(text: string): string`。
- Produces：`parseEssay(raw: string, filePath: string): Essay`，`loadEssays(): Essay[]`（按 date 降序），`groupByYear(essays: Essay[]): { year: number; essays: Essay[] }[]`（年份降序），`findEssay(slug: string): Essay | undefined`。
- Produces：`parseProject(raw, filePath): Project`，`loadProjects(): Project[]`（按 year 降序）。
- Produces：`loadAbout(): About`。
- 偏离 spec：不用 gray-matter。原因：它会把 Node 的 Buffer 相关依赖带进客户端包；我们的头部只有 `key: value` 与 `key: [a, b]` 两种形式，自写解析器 40 行即可，且便于给出带文件名的报错。

- [ ] **Step 1: 写失败测试 `tests/unit/frontmatter.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '@/content/frontmatter'

describe('parseFrontmatter', () => {
  it('parses scalar and list values and returns the body', () => {
    const raw = `---\ntitle: 丘陵\ndate: 2025-11-30\nstack: [Vue, Three.js]\n---\n\n正文第一行\n`
    const { data, body } = parseFrontmatter(raw)
    expect(data.title).toBe('丘陵')
    expect(data.date).toBe('2025-11-30')
    expect(data.stack).toEqual(['Vue', 'Three.js'])
    expect(body).toBe('正文第一行\n')
  })
  it('returns empty data when there is no frontmatter', () => {
    const { data, body } = parseFrontmatter('# 标题\n正文')
    expect(data).toEqual({})
    expect(body).toBe('# 标题\n正文')
  })
  it('strips surrounding quotes', () => {
    const { data } = parseFrontmatter(`---\ntitle: "河流"\n---\n`)
    expect(data.title).toBe('河流')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/frontmatter.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 写 `src/content/frontmatter.ts`**

```ts
export type FrontmatterValue = string | string[]
export interface Frontmatter { data: Record<string, FrontmatterValue>; body: string }

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function unquote(s: string): string {
  const t = s.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1)
  return t
}

function parseValue(v: string): FrontmatterValue {
  const t = v.trim()
  if (t.startsWith('[') && t.endsWith(']')) {
    const inner = t.slice(1, -1).trim()
    return inner === '' ? [] : inner.split(',').map(unquote)
  }
  return unquote(t)
}

export function parseFrontmatter(raw: string): Frontmatter {
  const m = raw.match(FENCE)
  if (!m) return { data: {}, body: raw }
  const data: Record<string, FrontmatterValue> = {}
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    data[line.slice(0, idx).trim()] = parseValue(line.slice(idx + 1))
  }
  const body = raw.slice(m[0].length).replace(/^\r?\n/, '')
  return { data, body }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/frontmatter.test.ts`
Expected: 3 passed。

- [ ] **Step 5: 安装 markdown-it，写失败测试 `tests/unit/markdown.test.ts`**

```bash
npm i markdown-it
npm i -D @types/markdown-it
```

```ts
import { describe, expect, it } from 'vitest'
import { countWords, firstSentence, readingMinutes, renderMarkdown } from '@/content/markdown'

describe('markdown helpers', () => {
  it('renders paragraphs', () => {
    expect(renderMarkdown('你好\n\n世界')).toBe('<p>你好</p>\n<p>世界</p>\n')
  })
  it('counts CJK characters and latin words, ignoring punctuation and spaces', () => {
    expect(countWords('我在实习，写前端。')).toBe(7)
    expect(countWords('hello world 你好')).toBe(4)
    expect(countWords('')).toBe(0)
  })
  it('estimates reading minutes at 400 words per minute, minimum 1', () => {
    expect(readingMinutes(0)).toBe(1)
    expect(readingMinutes(400)).toBe(1)
    expect(readingMinutes(401)).toBe(2)
    expect(readingMinutes(1203)).toBe(4)
  })
  it('takes the first sentence of the body', () => {
    expect(firstSentence('我在实习，写前端。\n\n摸鱼的时候会刷到一个问题。')).toBe('我在实习，写前端。')
    expect(firstSentence('没有句号的一段')).toBe('没有句号的一段')
  })
})
```

- [ ] **Step 6: 运行确认失败**

Run: `npx vitest run tests/unit/markdown.test.ts`
Expected: FAIL。

- [ ] **Step 7: 写 `src/content/markdown.ts`**

```ts
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: false, linkify: true, typographer: false })

export function renderMarkdown(source: string): string {
  return md.render(source)
}

/** 中日韩字符每字计 1，拉丁字母/数字连续串计 1，标点与空白不计。 */
export function countWords(text: string): number {
  const cjk = text.match(/[㐀-䶿一-鿿豈-﫿]/g)?.length ?? 0
  const latin = text.match(/[A-Za-z0-9]+/g)?.length ?? 0
  return cjk + latin
}

export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 400))
}

/** 正文第一句：到第一个句号/问号/叹号（中英文）为止，否则取第一行。 */
export function firstSentence(body: string): string {
  const firstLine = body.split(/\r?\n/).find(l => l.trim() !== '') ?? ''
  const m = firstLine.match(/^.*?[。！？.!?]/)
  return (m ? m[0] : firstLine).trim()
}

export function stripMarkdown(body: string): string {
  return body.replace(/!\[[^\]]*]\([^)]*\)/g, '').replace(/[#>*_`~-]/g, '')
}
```

- [ ] **Step 8: 运行确认通过**

Run: `npx vitest run tests/unit/markdown.test.ts`
Expected: 4 passed。

- [ ] **Step 9: 写 `src/content/types.ts`**

```ts
export interface Essay {
  slug: string
  title: string
  date: string       // YYYY-MM-DD
  year: number
  city: string
  weather: string    // 自由文本，如 "阴"、"雨"，只用于展示
  summary: string
  html: string
  wordCount: number
  readingMinutes: number
}

export interface Project {
  slug: string
  name: string
  tagline: string
  stack: string[]
  year: number
  github?: string
  url?: string
  cover?: string
  html: string
}

export interface AboutLink { label: string; href: string }
export interface About { html: string; links: AboutLink[] }
```

- [ ] **Step 10: 写失败测试 `tests/unit/essays.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { groupByYear, parseEssay } from '@/content/essays'

const raw = `---
title: 丘陵
date: 2025-11-30
city: 随州
weather: 雨
---

当车轮驶过积水的波浪潮水一般向我涌来的时候，我知道，我不该期待什么狂风暴雨。

北京今年下太多雨了。
`

describe('parseEssay', () => {
  it('builds an Essay from frontmatter and body', () => {
    const e = parseEssay(raw, '/content/essays/丘陵.md')
    expect(e.slug).toBe('丘陵')
    expect(e.title).toBe('丘陵')
    expect(e.year).toBe(2025)
    expect(e.city).toBe('随州')
    expect(e.weather).toBe('雨')
    expect(e.summary).toBe('当车轮驶过积水的波浪潮水一般向我涌来的时候，我知道，我不该期待什么狂风暴雨。')
    expect(e.html).toContain('<p>北京今年下太多雨了。</p>')
    expect(e.wordCount).toBeGreaterThan(30)
    expect(e.readingMinutes).toBe(1)
  })
  it('throws a message that names the file when a field is missing', () => {
    expect(() => parseEssay(`---\ntitle: x\n---\n正文`, '/content/essays/x.md'))
      .toThrow(/x\.md.*date/)
  })
})

describe('groupByYear', () => {
  it('groups newest year first, keeping input order inside a year', () => {
    const mk = (slug: string, date: string) => parseEssay(`---\ntitle: ${slug}\ndate: ${date}\ncity: c\nweather: w\n---\n正文。`, `/content/essays/${slug}.md`)
    const groups = groupByYear([mk('a', '2026-01-02'), mk('b', '2025-06-01'), mk('c', '2026-01-01')])
    expect(groups.map(g => g.year)).toEqual([2026, 2025])
    expect(groups[0].essays.map(e => e.slug)).toEqual(['a', 'c'])
  })
})
```

- [ ] **Step 11: 运行确认失败**

Run: `npx vitest run tests/unit/essays.test.ts`
Expected: FAIL。

- [ ] **Step 12: 写 `src/content/essays.ts`**

```ts
import { parseFrontmatter } from './frontmatter'
import { countWords, firstSentence, readingMinutes, renderMarkdown, stripMarkdown } from './markdown'
import type { Essay } from './types'

function slugFromPath(filePath: string): string {
  return filePath.split('/').pop()!.replace(/\.md$/, '')
}

function requireString(data: Record<string, unknown>, key: string, filePath: string): string {
  const v = data[key]
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`${filePath}: frontmatter 缺少字段 "${key}"`)
  return v.trim()
}

export function parseEssay(raw: string, filePath: string): Essay {
  const { data, body } = parseFrontmatter(raw)
  const date = requireString(data, 'date', filePath)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${filePath}: date 必须是 YYYY-MM-DD，得到 "${date}"`)
  const plain = stripMarkdown(body)
  const wordCount = countWords(plain)
  return {
    slug: slugFromPath(filePath),
    title: requireString(data, 'title', filePath),
    date,
    year: Number(date.slice(0, 4)),
    city: requireString(data, 'city', filePath),
    weather: requireString(data, 'weather', filePath),
    summary: typeof data.summary === 'string' && data.summary ? data.summary : firstSentence(plain),
    html: renderMarkdown(body),
    wordCount,
    readingMinutes: readingMinutes(wordCount),
  }
}

const files = import.meta.glob('/content/essays/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

let cache: Essay[] | null = null
export function loadEssays(): Essay[] {
  if (!cache) {
    cache = Object.entries(files)
      .map(([path, raw]) => parseEssay(raw, path))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }
  return cache
}

export function findEssay(slug: string): Essay | undefined {
  return loadEssays().find(e => e.slug === slug)
}

export function groupByYear(essays: Essay[]): { year: number; essays: Essay[] }[] {
  const map = new Map<number, Essay[]>()
  for (const e of essays) map.set(e.year, [...(map.get(e.year) ?? []), e])
  return [...map.entries()].sort((a, b) => b[0] - a[0]).map(([year, list]) => ({ year, essays: list }))
}
```

- [ ] **Step 13: 运行确认通过**

Run: `npx vitest run tests/unit/essays.test.ts`
Expected: 3 passed。（`import.meta.glob` 在 Vitest 下由 Vite 处理，目录为空时返回 `{}`。）

- [ ] **Step 14: 写失败测试 `tests/unit/projects.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { parseProject } from '@/content/projects'
import { parseAbout } from '@/content/about'

describe('parseProject', () => {
  it('parses stack list and optional links', () => {
    const p = parseProject(`---\nname: 地形志\ntagline: 个人主页\nstack: [Vue, Three.js]\nyear: 2026\ngithub: https://github.com/x/y\n---\n说明。`, '/content/projects/terrain.md')
    expect(p.slug).toBe('terrain')
    expect(p.stack).toEqual(['Vue', 'Three.js'])
    expect(p.year).toBe(2026)
    expect(p.github).toBe('https://github.com/x/y')
    expect(p.url).toBeUndefined()
    expect(p.html).toContain('说明')
  })
  it('requires year to be a number', () => {
    expect(() => parseProject(`---\nname: a\ntagline: b\nstack: []\nyear: 今年\n---\n`, '/content/projects/a.md')).toThrow(/a\.md.*year/)
  })
})

describe('parseAbout', () => {
  it('parses label|href links', () => {
    const a = parseAbout(`---\nlinks: [github|https://github.com/x, mail|mailto:a@b.c]\n---\n我是谁。`)
    expect(a.links).toEqual([{ label: 'github', href: 'https://github.com/x' }, { label: 'mail', href: 'mailto:a@b.c' }])
    expect(a.html).toContain('我是谁')
  })
})
```

- [ ] **Step 15: 运行确认失败**

Run: `npx vitest run tests/unit/projects.test.ts`
Expected: FAIL。

- [ ] **Step 16: 写 `src/content/projects.ts` 与 `src/content/about.ts`**

`projects.ts`：

```ts
import { parseFrontmatter } from './frontmatter'
import { renderMarkdown } from './markdown'
import type { Project } from './types'

function str(data: Record<string, unknown>, key: string, filePath: string): string {
  const v = data[key]
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`${filePath}: frontmatter 缺少字段 "${key}"`)
  return v.trim()
}
function optional(data: Record<string, unknown>, key: string): string | undefined {
  const v = data[key]
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

export function parseProject(raw: string, filePath: string): Project {
  const { data, body } = parseFrontmatter(raw)
  const yearRaw = str(data, 'year', filePath)
  const year = Number(yearRaw)
  if (!Number.isInteger(year)) throw new Error(`${filePath}: year 必须是整数，得到 "${yearRaw}"`)
  const stack = Array.isArray(data.stack) ? data.stack : []
  return {
    slug: filePath.split('/').pop()!.replace(/\.md$/, ''),
    name: str(data, 'name', filePath),
    tagline: str(data, 'tagline', filePath),
    stack,
    year,
    github: optional(data, 'github'),
    url: optional(data, 'url'),
    cover: optional(data, 'cover'),
    html: renderMarkdown(body),
  }
}

const files = import.meta.glob('/content/projects/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

let cache: Project[] | null = null
export function loadProjects(): Project[] {
  if (!cache) {
    cache = Object.entries(files).map(([p, raw]) => parseProject(raw, p)).sort((a, b) => b.year - a.year)
  }
  return cache
}
```

`about.ts`：

```ts
import { parseFrontmatter } from './frontmatter'
import { renderMarkdown } from './markdown'
import type { About, AboutLink } from './types'
import raw from '/content/about.md?raw'

export function parseAbout(source: string): About {
  const { data, body } = parseFrontmatter(source)
  const list = Array.isArray(data.links) ? data.links : []
  const links: AboutLink[] = list.map((item) => {
    const [label, ...rest] = item.split('|')
    return { label: label.trim(), href: rest.join('|').trim() }
  })
  return { html: renderMarkdown(body), links }
}

export function loadAbout(): About {
  return parseAbout(raw)
}
```

`?raw` 导入需要类型声明，新建 `src/env.d.ts`：

```ts
declare module '*.md?raw' { const content: string; export default content }
```

- [ ] **Step 17: 放入内容文件**

`content/about.md`（占位，站主自己改）：

```md
---
links: [github|https://github.com/your-name, mail|mailto:you@example.com]
---

我叫 Scream，写前端，也写点别的。

名字来自张悬的一首歌。
```

`content/projects/terrain-homepage.md`：

```md
---
name: 地形志
tagline: 这个站本身
stack: [Vue, Three.js, vite-ssg]
year: 2026
github: https://github.com/your-name/personal-homepage
---

首页是一片实时天气的线框地形，内容页是纸。
```

把 `~/Downloads` 里的 8 篇文章复制进 `content/essays/`，每篇顶部加头部。日期是从正文推断的，站主之后自行修正：

| 文件 | date | city | weather |
|---|---|---|---|
| 保安.md | 2022-08-20 | 石家庄 | 晴 |
| 秦皇岛.md | 2024-03-20 | 秦皇岛 | 雨 |
| 青岛.md | 2024-07-15 | 青岛 | 阴 |
| 平原.md | 2025-02-10 | 北京 | 晴 |
| 河流.md | 2025-05-20 | 北京 | 冰雹 |
| 丘陵.md | 2025-11-30 | 随州 | 雨 |
| 人间四月芳菲尽.md | 2026-04-20 | 石家庄 | 晴 |
| 湖泊.md | 2026-09-01 | 北京 | 凉 |

操作：

```bash
mkdir -p content/essays
for f in 保安 秦皇岛 青岛 平原 河流 丘陵 人间四月芳菲尽 湖泊; do cp "$HOME/Downloads/$f.md" "content/essays/$f.md"; done
```

然后用编辑器把每个文件开头的 `# 标题` 行替换为头部块，例如 `丘陵.md` 开头改成：

```md
---
title: 丘陵
date: 2025-11-30
city: 随州
weather: 雨
---
```

`人间四月芳菲尽.md` 最后一行的本机图片路径 `![...](/Users/scream/Library/...)` 删掉（图片不在仓库里）。

- [ ] **Step 18: 写一个加载测试，确认真实内容能全部解析**

在 `tests/unit/essays.test.ts` 末尾追加：

```ts
import { loadEssays } from '@/content/essays'
import { loadProjects } from '@/content/projects'
import { loadAbout } from '@/content/about'

describe('real content', () => {
  it('loads all essays sorted newest first', () => {
    const list = loadEssays()
    expect(list.length).toBe(8)
    for (let i = 1; i < list.length; i++) expect(list[i - 1].date >= list[i].date).toBe(true)
  })
  it('loads projects and about', () => {
    expect(loadProjects().length).toBeGreaterThan(0)
    expect(loadAbout().links.length).toBe(2)
  })
})
```

Run: `npm test`
Expected: 全部通过。若某篇报 "缺少字段"，按报错里的文件名补头部。

- [ ] **Step 19: 提交**

```bash
git add -A
git commit -m "feat: markdown content pipeline with essays, projects and about"
```

---

### Task 4: 文章列表页与正文页（静态版）

**Files:**
- Create: `src/components/MetaLine.vue`, `src/pages/EssayList.vue`, `src/pages/Essay.vue`（覆盖占位）
- Modify: `src/main.ts`（includedRoutes 展开文章路径）
- Test: `tests/unit/MetaLine.test.ts`, `tests/unit/EssayList.test.ts`

**Interfaces:**
- Consumes: `loadEssays / groupByYear / findEssay`（Task 3）。
- Produces: `MetaLine` 组件，props `parts: (string | number)[]`，渲染 `// a · b · c`，空值自动跳过。全站所有等宽注释都用它。
- Produces: 正文页 DOM 结构：`<article class="essay"><header>…</header><div class="essay-body">…html…</div></article>`。Task 11 的段落淡入依赖 `.essay-body > p`。

- [ ] **Step 1: 写失败测试 `tests/unit/MetaLine.test.ts`**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MetaLine from '@/components/MetaLine.vue'

describe('MetaLine', () => {
  it('joins parts with the middle dot and prefixes a comment marker', () => {
    const w = mount(MetaLine, { props: { parts: ['2025-11-30', '随州', '雨', '1,203 字'] } })
    expect(w.text()).toBe('// 2025-11-30 · 随州 · 雨 · 1,203 字')
  })
  it('skips empty parts', () => {
    const w = mount(MetaLine, { props: { parts: ['a', '', undefined, 'b'] } })
    expect(w.text()).toBe('// a · b')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/MetaLine.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写 `src/components/MetaLine.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ parts: (string | number | undefined | null)[] }>()
const text = computed(() => '// ' + props.parts.filter(p => p !== undefined && p !== null && p !== '').join(' · '))
</script>

<template>
  <span class="mono meta-line">{{ text }}</span>
</template>
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/MetaLine.test.ts`
Expected: 2 passed。

- [ ] **Step 5: 写失败测试 `tests/unit/EssayList.test.ts`**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import EssayList from '@/pages/EssayList.vue'
import { routes } from '@/router'

describe('EssayList', () => {
  it('renders year groups and one row per essay', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    const w = mount(EssayList, { global: { plugins: [router] } })
    await router.isReady()
    expect(w.text()).toContain('$ ls ~/essays')
    expect(w.findAll('.toc-year').length).toBeGreaterThan(1)
    expect(w.findAll('.toc-row').length).toBe(8)
    expect(w.find('.toc-row').attributes('href')).toMatch(/^\/essays\//)
  })
})
```

- [ ] **Step 6: 运行确认失败**

Run: `npx vitest run tests/unit/EssayList.test.ts`
Expected: FAIL（占位页面没有这些元素）。

- [ ] **Step 7: 写 `src/pages/EssayList.vue`**

```vue
<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { groupByYear, loadEssays } from '@/content/essays'

const essays = loadEssays()
const groups = groupByYear(essays)
useHead({ title: '目录 · Scream' })
</script>

<template>
  <main class="page toc">
    <span class="mono">$ ls ~/essays &nbsp;# {{ essays.length }} files</span>
    <h1 class="page-title">目 录</h1>
    <section v-for="g in groups" :key="g.year">
      <div class="mono toc-year">// {{ g.year }}</div>
      <RouterLink v-for="e in g.essays" :key="e.slug" :to="`/essays/${e.slug}`" class="toc-row">
        <span class="toc-title">{{ e.title }}</span>
        <span class="toc-dots" />
        <span class="mono toc-meta">{{ e.city }} · {{ e.weather }}</span>
      </RouterLink>
    </section>
  </main>
</template>

<style>
.page { max-width: 720px; margin: 0 auto; padding: 48px 24px 96px; }
.page-title { font-size: 30px; font-weight: 400; letter-spacing: .2em; margin: 14px 0 8px; }
</style>

<style scoped>
.toc-year { margin: 28px 0 6px; }
.toc-row { display: flex; align-items: baseline; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--bg-2); }
.toc-title { font-size: 20px; letter-spacing: .06em; }
.toc-dots { flex: 1; border-bottom: 1px dotted var(--line); transform: translateY(-6px); transition: border-color .2s; }
.toc-row:hover .toc-dots { border-color: var(--accent); }
</style>
```

- [ ] **Step 8: 运行确认通过**

Run: `npx vitest run tests/unit/EssayList.test.ts`
Expected: 1 passed。

- [ ] **Step 9: 写 `src/pages/Essay.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import MetaLine from '@/components/MetaLine.vue'
import { findEssay, loadEssays } from '@/content/essays'

const route = useRoute()
const essay = computed(() => findEssay(String(route.params.slug)))
const all = loadEssays()
const index = computed(() => all.findIndex(e => e.slug === essay.value?.slug))
const newer = computed(() => (index.value > 0 ? all[index.value - 1] : undefined))
const older = computed(() => (index.value >= 0 && index.value < all.length - 1 ? all[index.value + 1] : undefined))

useHead({ title: computed(() => (essay.value ? `${essay.value.title} · Scream` : '未找到 · Scream')) })

function fmt(n: number) { return n.toLocaleString('en-US') }
</script>

<template>
  <main class="page">
    <article v-if="essay" class="essay">
      <header>
        <MetaLine :parts="[essay.date, essay.city, essay.weather, `${fmt(essay.wordCount)} 字`, `${essay.readingMinutes} min`]" />
        <h1 class="essay-title">{{ essay.title }}</h1>
        <p class="essay-lead">{{ essay.summary }}</p>
      </header>
      <div class="essay-body" v-html="essay.html" />
      <footer class="essay-footer mono">
        <RouterLink v-if="older" :to="`/essays/${older.slug}`">← {{ older.title }}</RouterLink>
        <span v-else />
        <RouterLink v-if="newer" :to="`/essays/${newer.slug}`">{{ newer.title }} →</RouterLink>
      </footer>
    </article>
    <p v-else class="mono">// 404 · 这里没有这篇文章 · <RouterLink to="/essays">返回目录</RouterLink></p>
  </main>
</template>

<style scoped>
.essay { max-width: 640px; margin: 0 auto; }
.essay-title { font-size: 44px; font-weight: 600; letter-spacing: .1em; margin: 16px 0 10px; line-height: 1.3; }
.essay-lead { font-size: 14px; color: var(--muted); margin: 0 0 30px; line-height: 1.8; }
.essay-body :deep(p) { font-size: 17px; line-height: 2.1; margin: 0 0 18px; text-align: justify; }
.essay-body :deep(img) { margin: 24px auto; }
.essay-footer { display: flex; justify-content: space-between; margin-top: 64px; padding-top: 16px; border-top: 1px solid var(--bg-2); }
</style>
```

- [ ] **Step 10: 展开文章静态路径**

`src/main.ts` 的 `includedRoutes` 改为：

```ts
import { loadEssays } from './content/essays'

export async function includedRoutes(paths: string[]) {
  return paths.flatMap(p => (p === '/essays/:slug' ? loadEssays().map(e => `/essays/${encodeURIComponent(e.slug)}`) : [p]))
}
```

- [ ] **Step 11: 构建并检查产物**

```bash
npm run build
ls dist/essays
```

Expected: `dist/essays/` 下有 `index.html` 和 8 个文章目录（中文名或其百分号编码），每个含 `index.html`；打开任一 `index.html` 能看到正文 HTML 已预渲染在里面。

- [ ] **Step 12: 提交**

```bash
git add -A
git commit -m "feat: essay list and essay pages with prerendered routes"
```

---

### Task 5: 项目页与关于页

**Files:**
- Create: `src/pages/ProjectList.vue`, `src/pages/About.vue`（覆盖占位）
- Test: `tests/unit/ProjectList.test.ts`

**Interfaces:**
- Consumes: `loadProjects`, `loadAbout`（Task 3），`MetaLine`（Task 4）。

- [ ] **Step 1: 写失败测试 `tests/unit/ProjectList.test.ts`**

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProjectList from '@/pages/ProjectList.vue'

describe('ProjectList', () => {
  it('lists projects collapsed and expands one on click', async () => {
    const w = mount(ProjectList)
    expect(w.text()).toContain('$ ls -la ~/projects')
    const rows = w.findAll('.proj-row')
    expect(rows.length).toBeGreaterThan(0)
    expect(w.find('.proj-detail').exists()).toBe(false)
    await rows[0].trigger('click')
    expect(w.find('.proj-detail').exists()).toBe(true)
    await rows[0].trigger('click')
    expect(w.find('.proj-detail').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/ProjectList.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写 `src/pages/ProjectList.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useHead } from '@unhead/vue'
import { loadProjects } from '@/content/projects'

const projects = loadProjects()
const open = ref<string | null>(null)
function toggle(slug: string) { open.value = open.value === slug ? null : slug }
useHead({ title: '项目 · Scream' })
</script>

<template>
  <main class="page">
    <span class="mono">$ ls -la ~/projects</span>
    <h1 class="page-title">项 目</h1>
    <section v-for="p in projects" :key="p.slug" class="proj">
      <button type="button" class="proj-row" :aria-expanded="open === p.slug" @click="toggle(p.slug)">
        <span class="proj-name">{{ p.name }}<span class="proj-tagline">{{ p.tagline }}</span></span>
        <span class="mono proj-meta">{{ p.stack.join(' ') }} &nbsp; {{ p.year }}</span>
      </button>
      <div v-if="open === p.slug" class="proj-detail">
        <img v-if="p.cover" :src="p.cover" :alt="p.name">
        <div class="proj-body" v-html="p.html" />
        <p class="mono">
          <a v-if="p.github" :href="p.github" target="_blank" rel="noopener">github ↗</a>
          <a v-if="p.url" :href="p.url" target="_blank" rel="noopener">live ↗</a>
        </p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.proj-row { width: 100%; display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 14px 0; background: none; border: 0; border-bottom: 1px solid var(--bg-2); color: inherit; font: inherit; text-align: left; cursor: pointer; }
.proj-name { font-size: 20px; letter-spacing: .06em; }
.proj-tagline { font-size: 14px; color: var(--muted); margin-left: 12px; }
.proj-row:hover .proj-name { color: var(--accent); }
.proj-detail { padding: 12px 0 24px 12px; border-left: 2px solid var(--accent); margin: 8px 0 16px; }
.proj-body :deep(p) { font-size: 15px; line-height: 1.9; margin: 0 0 12px; }
.proj-detail a { margin-right: 16px; }
</style>
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/ProjectList.test.ts`
Expected: 1 passed。

- [ ] **Step 5: 写 `src/pages/About.vue`**

```vue
<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { loadAbout } from '@/content/about'

const about = loadAbout()
useHead({ title: 'whoami · Scream' })
</script>

<template>
  <main class="page about">
    <span class="mono">$ whoami</span>
    <div class="about-body" v-html="about.html" />
    <p class="mono about-links">
      <template v-for="(l, i) in about.links" :key="l.href">
        <a :href="l.href" target="_blank" rel="noopener">{{ l.label }}</a><span v-if="i < about.links.length - 1"> · </span>
      </template>
    </p>
  </main>
</template>

<style scoped>
.about { max-width: 560px; }
.about-body { margin-top: 32px; }
.about-body :deep(p) { font-size: 17px; line-height: 2.1; margin: 0 0 18px; }
.about-links { margin-top: 48px; }
.about-links a:hover { color: var(--accent); }
</style>
```

- [ ] **Step 6: 构建与目检**

```bash
npm run build && npm run preview
```

打开 `/projects` 点击一行展开，`/about` 看到链接一行。关闭 preview。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: project list with inline details and about page"
```

---

### Task 6: 字体子集化与 GitHub Pages 部署

**Files:**
- Create: `scripts/subset-fonts.mjs`, `.github/workflows/deploy.yml`
- Modify: `src/styles/tokens.css`（@font-face）, `src/main.ts`（引入 JetBrains Mono）, `package.json`（scripts）
- Test: 脚本产出文件的存在与体积检查（Step 5）

**Interfaces:**
- Produces: `public/fonts/noto-serif-sc-400.woff2`、`public/fonts/noto-serif-sc-600.woff2`；`npm run fonts` 生成，`npm run build` 前置调用。

- [ ] **Step 1: 安装依赖**

```bash
npm i -D subset-font
npm i @fontsource/jetbrains-mono
```

- [ ] **Step 2: 写 `scripts/subset-fonts.mjs`**

```js
// 下载 Noto Serif CJK SC 的 Regular / SemiBold（各约 24MB，缓存在 .cache/fonts），
// 收集 content/ 与 src/ 中出现过的全部字符，子集化为 woff2 写到 public/fonts。
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import subsetFont from 'subset-font'

const ROOT = path.resolve(import.meta.dirname, '..')
const CACHE = path.join(ROOT, '.cache/fonts')
const OUT = path.join(ROOT, 'public/fonts')
const BASE = 'https://github.com/notofonts/noto-cjk/raw/main/Serif/OTF/SimplifiedChinese'
const FACES = [
  { weight: 400, file: 'NotoSerifCJKsc-Regular.otf' },
  { weight: 600, file: 'NotoSerifCJKsc-SemiBold.otf' },
]
// 固定保留：ASCII 可见字符、常用中文标点、界面里可能动态出现的字
const ALWAYS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'
  + '，。、；：？！「」『』（）《》〈〉【】—…·～　'
  + '目录项目关于文章字分钟晴阴雨雪春夏秋冬手动默认实时年月日北京'

async function walk(dir, exts, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) await walk(p, exts, acc)
    else if (exts.includes(path.extname(entry.name))) acc.push(p)
  }
  return acc
}

async function collectText() {
  const files = [
    ...(await walk(path.join(ROOT, 'content'), ['.md'])),
    ...(await walk(path.join(ROOT, 'src'), ['.vue', '.ts'])),
  ]
  const chars = new Set(ALWAYS)
  for (const f of files) for (const ch of await readFile(f, 'utf8')) chars.add(ch)
  return [...chars].join('')
}

async function download(file) {
  await mkdir(CACHE, { recursive: true })
  const target = path.join(CACHE, file)
  if (existsSync(target) && (await stat(target)).size > 1_000_000) return target
  process.stdout.write(`downloading ${file} … `)
  const res = await fetch(`${BASE}/${file}`)
  if (!res.ok) throw new Error(`download failed: ${res.status} ${file}`)
  await writeFile(target, Buffer.from(await res.arrayBuffer()))
  console.log('ok')
  return target
}

const text = await collectText()
const hash = createHash('sha1').update(text).digest('hex').slice(0, 8)
await mkdir(OUT, { recursive: true })
console.log(`subsetting ${text.length} distinct chars (hash ${hash})`)
for (const face of FACES) {
  const src = await readFile(await download(face.file))
  const out = await subsetFont(src, text, { targetFormat: 'woff2' })
  const dest = path.join(OUT, `noto-serif-sc-${face.weight}.woff2`)
  await writeFile(dest, out)
  console.log(`${path.relative(ROOT, dest)}  ${(out.length / 1024).toFixed(0)} KB`)
}
```

- [ ] **Step 3: 加 scripts**

`package.json` 的 scripts 改成：

```json
"fonts": "node scripts/subset-fonts.mjs",
"prebuild": "npm run fonts",
"build": "vite-ssg build",
```

- [ ] **Step 4: 追加 @font-face 并引入等宽字体**

`src/styles/tokens.css` 顶部加：

```css
@font-face { font-family: "Noto Serif SC"; font-weight: 400; font-display: swap; src: url("/fonts/noto-serif-sc-400.woff2") format("woff2"); }
@font-face { font-family: "Noto Serif SC"; font-weight: 600; font-display: swap; src: url("/fonts/noto-serif-sc-600.woff2") format("woff2"); }
```

注意 `base` 不是 `/` 时 CSS 里的绝对路径会错，改为相对路径 `url("../../public/fonts/…")` 不可行（public 不经打包）。正确做法：把 url 写成 `url("/fonts/…")` 并在 `vite.config.ts` 里保持默认的 `base` 注入，Vite 会重写 CSS 中以 `/` 开头的 public 资源路径。构建后在 `dist/assets/*.css` 里 grep `fonts/` 确认前缀正确（Step 6）。

`src/main.ts` 顶部加：

```ts
import '@fontsource/jetbrains-mono/400.css'
```

- [ ] **Step 5: 运行脚本并检查**

```bash
npm run fonts
ls -la public/fonts
```

Expected: 两个 woff2 文件，各在 300 KB 到 900 KB 之间（8 篇文章约 1500 个不同汉字）。若超过 1.5 MB，检查 `collectText` 是否误读了 `node_modules`（walk 只走 content 与 src，不应该）。

- [ ] **Step 6: 构建并检查路径**

```bash
BASE_PATH=/personal-homepage/ npm run build
grep -o '/personal-homepage/fonts/[^)"]*' dist/assets/*.css | head
```

Expected: 输出含 `/personal-homepage/fonts/noto-serif-sc-400.woff2`。然后再跑一次不带 BASE_PATH 的 `npm run build` 恢复本地产物。

- [ ] **Step 7: 写 `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - uses: actions/cache@v4
        with:
          path: .cache/fonts
          key: noto-serif-cjk-sc-v1
      - run: npm ci
      - name: Compute base path
        run: |
          REPO="${GITHUB_REPOSITORY#*/}"
          if [[ "$REPO" == *.github.io ]]; then echo "BASE_PATH=/" >> "$GITHUB_ENV"; else echo "BASE_PATH=/$REPO/" >> "$GITHUB_ENV"; fi
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

仓库设置里 Pages 的 Source 需选 "GitHub Actions"，这一步由站主在 GitHub 网页上操作。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "build: subset Noto Serif SC at build time and deploy to GitHub Pages"
```

到这里，仓库推到 GitHub 后就是一个可上线的纸感文章站。

---

### Task 7: 天气模块与地形参数

**Files:**
- Create: `src/weather/openMeteo.ts`, `src/weather/terrainParams.ts`
- Test: `tests/unit/openMeteo.test.ts`, `tests/unit/terrainParams.test.ts`

**Interfaces:**
- Produces（`openMeteo.ts`）：

```ts
export type WeatherState = 'clear' | 'cloudy' | 'rain' | 'snow'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export function mapWeatherCode(code: number): WeatherState
export function seasonOf(date: Date): Season
export function defaultWeatherFor(season: Season): WeatherState
export interface LiveWeather { state: WeatherState; temperature: number; code: number }
export function fetchBeijingWeather(fetchImpl?: typeof fetch, timeoutMs?: number): Promise<LiveWeather>
```

- Produces（`terrainParams.ts`）：

```ts
export type ParamSource = 'live' | 'default' | 'manual'
export interface TerrainParams { weather: WeatherState; season: Season; seed: number; intensity: number; source: ParamSource }
export function useTerrainParams(): {
  params: Readonly<Ref<TerrainParams>>
  setManual(patch: Partial<Pick<TerrainParams, 'weather' | 'season' | 'seed' | 'intensity'>>): void
  clearManual(): void
  applyLive(w: LiveWeather): void
  applyDefault(now?: Date): void
  loadLive(now?: Date): Promise<void>
}
export function readOverride(storage: Pick<Storage, 'getItem'>): Partial<TerrainParams> | null
export function initialParams(now: Date, override: Partial<TerrainParams> | null): TerrainParams
```

  模块级单例。地形组件（Task 10）读 `params`；参数面板与终端（Task 10、12）调 `setManual / clearManual`。`intensity` 取值 0 到 1，默认 0.6。`seed` 是 32 位整数，默认 `0x5c7e`。

- [ ] **Step 1: 写失败测试 `tests/unit/openMeteo.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest'
import { defaultWeatherFor, fetchBeijingWeather, mapWeatherCode, seasonOf } from '@/weather/openMeteo'

describe('mapWeatherCode (WMO)', () => {
  it('maps codes to the four states', () => {
    expect(mapWeatherCode(0)).toBe('clear')
    expect(mapWeatherCode(1)).toBe('clear')
    expect(mapWeatherCode(2)).toBe('cloudy')
    expect(mapWeatherCode(3)).toBe('cloudy')
    expect(mapWeatherCode(45)).toBe('cloudy')
    expect(mapWeatherCode(51)).toBe('rain')
    expect(mapWeatherCode(65)).toBe('rain')
    expect(mapWeatherCode(71)).toBe('snow')
    expect(mapWeatherCode(77)).toBe('snow')
    expect(mapWeatherCode(81)).toBe('rain')
    expect(mapWeatherCode(86)).toBe('snow')
    expect(mapWeatherCode(95)).toBe('rain')
    expect(mapWeatherCode(999)).toBe('cloudy')
  })
})

describe('seasonOf', () => {
  it('uses meteorological seasons', () => {
    expect(seasonOf(new Date('2026-03-01'))).toBe('spring')
    expect(seasonOf(new Date('2026-05-31'))).toBe('spring')
    expect(seasonOf(new Date('2026-06-01'))).toBe('summer')
    expect(seasonOf(new Date('2026-09-10'))).toBe('autumn')
    expect(seasonOf(new Date('2026-12-01'))).toBe('winter')
    expect(seasonOf(new Date('2026-02-28'))).toBe('winter')
  })
})

describe('defaultWeatherFor', () => {
  it('gives a plausible default per season', () => {
    expect(defaultWeatherFor('spring')).toBe('cloudy')
    expect(defaultWeatherFor('summer')).toBe('rain')
    expect(defaultWeatherFor('autumn')).toBe('clear')
    expect(defaultWeatherFor('winter')).toBe('snow')
  })
})

describe('fetchBeijingWeather', () => {
  it('parses the current block', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ current: { temperature_2m: 21.3, weather_code: 61 } })))
    const w = await fetchBeijingWeather(fetchImpl as unknown as typeof fetch)
    expect(w).toEqual({ state: 'rain', temperature: 21.3, code: 61 })
    const url = String((fetchImpl.mock.calls[0] as unknown[])[0])
    expect(url).toContain('latitude=39.9042')
    expect(url).toContain('longitude=116.4074')
  })
  it('rejects on non-2xx', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 500 }))
    await expect(fetchBeijingWeather(fetchImpl as unknown as typeof fetch)).rejects.toThrow(/500/)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/openMeteo.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写 `src/weather/openMeteo.ts`**

```ts
export type WeatherState = 'clear' | 'cloudy' | 'rain' | 'snow'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export interface LiveWeather { state: WeatherState; temperature: number; code: number }

const BEIJING = { latitude: 39.9042, longitude: 116.4074 }
const URL = `https://api.open-meteo.com/v1/forecast?latitude=${BEIJING.latitude}&longitude=${BEIJING.longitude}&current=temperature_2m,weather_code&timezone=Asia%2FShanghai`

/** WMO 4677 天气代码 → 四态。未知代码按 cloudy。 */
export function mapWeatherCode(code: number): WeatherState {
  if (code === 0 || code === 1) return 'clear'
  if (code === 2 || code === 3 || code === 45 || code === 48) return 'cloudy'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  return 'cloudy'
}

export function seasonOf(date: Date): Season {
  const m = date.getMonth() + 1
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
}

export function defaultWeatherFor(season: Season): WeatherState {
  return { spring: 'cloudy', summer: 'rain', autumn: 'clear', winter: 'snow' }[season] as WeatherState
}

export async function fetchBeijingWeather(fetchImpl: typeof fetch = fetch, timeoutMs = 4000): Promise<LiveWeather> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(URL, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`open-meteo ${res.status}`)
    const json = await res.json() as { current: { temperature_2m: number; weather_code: number } }
    const code = json.current.weather_code
    return { state: mapWeatherCode(code), temperature: json.current.temperature_2m, code }
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/openMeteo.test.ts`
Expected: 全部通过。

- [ ] **Step 5: 写失败测试 `tests/unit/terrainParams.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { initialParams, readOverride } from '@/weather/terrainParams'

describe('readOverride', () => {
  it('returns null when nothing stored or JSON is broken', () => {
    expect(readOverride({ getItem: () => null })).toBeNull()
    expect(readOverride({ getItem: () => '{oops' })).toBeNull()
  })
  it('keeps only known keys with valid values', () => {
    const o = readOverride({ getItem: () => JSON.stringify({ weather: 'snow', season: 'nope', seed: 42, intensity: 3, junk: 1 }) })
    expect(o).toEqual({ weather: 'snow', seed: 42 })
  })
})

describe('initialParams', () => {
  const now = new Date('2026-09-10T10:00:00')
  it('uses season defaults when there is no override', () => {
    expect(initialParams(now, null)).toEqual({ weather: 'clear', season: 'autumn', seed: 0x5c7e, intensity: 0.6, source: 'default' })
  })
  it('applies the override and marks source manual', () => {
    const p = initialParams(now, { weather: 'rain', seed: 7 })
    expect(p.weather).toBe('rain')
    expect(p.season).toBe('autumn')
    expect(p.seed).toBe(7)
    expect(p.source).toBe('manual')
  })
})
```

- [ ] **Step 6: 运行确认失败**

Run: `npx vitest run tests/unit/terrainParams.test.ts`
Expected: FAIL。

- [ ] **Step 7: 写 `src/weather/terrainParams.ts`**

```ts
import { readonly, ref } from 'vue'
import { defaultWeatherFor, fetchBeijingWeather, seasonOf, type LiveWeather, type Season, type WeatherState } from './openMeteo'

export type ParamSource = 'live' | 'default' | 'manual'
export interface TerrainParams { weather: WeatherState; season: Season; seed: number; intensity: number; source: ParamSource }
type ManualPatch = Partial<Pick<TerrainParams, 'weather' | 'season' | 'seed' | 'intensity'>>

export const DEFAULT_SEED = 0x5c7e
export const DEFAULT_INTENSITY = 0.6
const STORAGE_KEY = 'terrain.override'
const WEATHERS: WeatherState[] = ['clear', 'cloudy', 'rain', 'snow']
const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']

export function readOverride(storage: Pick<Storage, 'getItem'>): ManualPatch | null {
  let parsed: unknown
  try { parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') } catch { return null }
  if (!parsed || typeof parsed !== 'object') return null
  const o = parsed as Record<string, unknown>
  const out: ManualPatch = {}
  if (WEATHERS.includes(o.weather as WeatherState)) out.weather = o.weather as WeatherState
  if (SEASONS.includes(o.season as Season)) out.season = o.season as Season
  if (Number.isInteger(o.seed)) out.seed = o.seed as number
  if (typeof o.intensity === 'number' && o.intensity >= 0 && o.intensity <= 1) out.intensity = o.intensity
  return Object.keys(out).length ? out : null
}

export function initialParams(now: Date, override: ManualPatch | null): TerrainParams {
  const season = seasonOf(now)
  const base: TerrainParams = { weather: defaultWeatherFor(season), season, seed: DEFAULT_SEED, intensity: DEFAULT_INTENSITY, source: 'default' }
  return override ? { ...base, ...override, source: 'manual' } : base
}

const params = ref<TerrainParams>(initialParams(new Date(), null))
let manual: ManualPatch | null = null
let booted = false

function persist() {
  try {
    if (manual) localStorage.setItem(STORAGE_KEY, JSON.stringify(manual))
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

export function useTerrainParams() {
  if (!booted && typeof window !== 'undefined') {
    booted = true
    manual = readOverride(localStorage)
    params.value = initialParams(new Date(), manual)
  }

  function applyDefault(now = new Date()) {
    if (manual) return
    params.value = initialParams(now, null)
  }
  function applyLive(w: LiveWeather) {
    if (manual) return
    params.value = { ...params.value, weather: w.state, source: 'live' }
  }
  async function loadLive(now = new Date()) {
    if (manual) return
    try { applyLive(await fetchBeijingWeather()) } catch { applyDefault(now) }
  }
  function setManual(patch: ManualPatch) {
    manual = { ...(manual ?? {}), ...patch }
    params.value = { ...params.value, ...patch, source: 'manual' }
    persist()
  }
  function clearManual() {
    manual = null
    persist()
    params.value = initialParams(new Date(), null)
    void loadLive()
  }
  return { params: readonly(params), setManual, clearManual, applyLive, applyDefault, loadLive }
}
```

- [ ] **Step 8: 运行确认通过**

Run: `npm test`
Expected: 全部通过。

- [ ] **Step 9: 提交**

```bash
git add -A
git commit -m "feat: open-meteo weather mapping and terrain params store"
```

---

### Task 8: 高度场与 Three.js 地形场景

**Files:**
- Create: `src/terrain/heightfield.ts`, `src/terrain/scene.ts`, `src/terrain/support.ts`
- Test: `tests/unit/heightfield.test.ts`, `tests/unit/support.test.ts`

**Interfaces:**
- Produces（`heightfield.ts`，纯函数，无 Three 依赖）：

```ts
export interface HeightfieldSpec { cols: number; rows: number; width: number; depth: number; amplitude: number; seed: number }
export function makeHeightFn(seed: number): (x: number, z: number) => number   // 归一化 [-1, 1]
export function buildHeightfield(spec: HeightfieldSpec): Float32Array          // 长度 cols*rows，行主序，单位与 width/depth 相同
export function heightAt(spec: HeightfieldSpec, x: number, z: number): number  // 世界坐标处的高度，用于放标记点
export const MARKERS: { id: 'essays' | 'projects' | 'about'; x: number; z: number }[]
```

- Produces（`scene.ts`）：

```ts
export interface TerrainColors { line: string; fog: string; accent: string }
export interface TerrainScene {
  setSeed(seed: number): void
  setColors(c: TerrainColors): void
  setAltitude(a: number): void               // 相机高度，范围见 ALTITUDE
  setPointer(nx: number, ny: number): void   // 归一化 [-1,1]，用于视差
  setWeather(state: WeatherState, season: Season, intensity: number): void   // Task 9 实现，Task 8 先留空方法
  pickMarker(nx: number, ny: number): MarkerId | null
  setHovered(id: MarkerId | null): void
  setOpacity(o: number): void                // 开场动画用
  dispose(): void
}
export const ALTITUDE = { min: 6, max: 26, initial: 14 }
export function createTerrainScene(canvas: HTMLCanvasElement, opts: { seed: number; colors: TerrainColors; quality: 'high' | 'low' }): TerrainScene
```

- Produces（`support.ts`）：`supportsWebGL(): boolean`，`prefersReducedMotion(): boolean`，`isCoarsePointer(): boolean`。
- 偏离 spec：高度在 JS 里用 simplex-noise 生成并写进顶点，不用 GLSL。原因：标记点要落在地形表面上，JS 与 GPU 用同一函数最可靠；纯函数可单测；也少了一条 shader 编译失败的降级路径。

- [ ] **Step 1: 安装依赖**

```bash
npm i three simplex-noise
npm i -D @types/three
```

- [ ] **Step 2: 写失败测试 `tests/unit/heightfield.test.ts`**

```ts
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
```

- [ ] **Step 3: 运行确认失败**

Run: `npx vitest run tests/unit/heightfield.test.ts`
Expected: FAIL。

- [ ] **Step 4: 写 `src/terrain/heightfield.ts`**

```ts
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
```

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run tests/unit/heightfield.test.ts`
Expected: 全部通过。

- [ ] **Step 6: 写失败测试 `tests/unit/support.test.ts` 与 `src/terrain/support.ts`**

测试：

```ts
import { describe, expect, it, vi } from 'vitest'
import { prefersReducedMotion, supportsWebGL } from '@/terrain/support'

describe('support', () => {
  it('reports no WebGL when getContext returns null (jsdom)', () => {
    expect(supportsWebGL()).toBe(false)
  })
  it('reads prefers-reduced-motion from matchMedia', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    expect(prefersReducedMotion()).toBe(true)
    vi.unstubAllGlobals()
  })
})
```

实现：

```ts
export function supportsWebGL(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isCoarsePointer(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
}
```

Run: `npx vitest run tests/unit/support.test.ts`
Expected: 2 passed。

- [ ] **Step 7: 写 `src/terrain/scene.ts`**

```ts
import * as THREE from 'three'
import type { Season, WeatherState } from '@/weather/openMeteo'
import { AMPLITUDE, buildHeightfield, FIELD, heightAt, MARKERS, QUALITY, type HeightfieldSpec, type MarkerId } from './heightfield'

export interface TerrainColors { line: string; fog: string; accent: string }
export interface TerrainScene {
  setSeed(seed: number): void
  setColors(c: TerrainColors): void
  setAltitude(a: number): void
  setPointer(nx: number, ny: number): void
  setWeather(state: WeatherState, season: Season, intensity: number): void
  pickMarker(nx: number, ny: number): MarkerId | null
  setHovered(id: MarkerId | null): void
  setOpacity(o: number): void
  dispose(): void
}
export const ALTITUDE = { min: 6, max: 26, initial: 14 }

/** 把高度场变成"每一行一条折线"的线段索引几何。 */
function buildLineGeometry(spec: HeightfieldSpec): THREE.BufferGeometry {
  const heights = buildHeightfield(spec)
  const positions = new Float32Array(spec.cols * spec.rows * 3)
  for (let r = 0; r < spec.rows; r++) {
    const z = -spec.depth / 2 + (r / (spec.rows - 1)) * spec.depth
    for (let c = 0; c < spec.cols; c++) {
      const i = r * spec.cols + c
      positions[i * 3] = -spec.width / 2 + (c / (spec.cols - 1)) * spec.width
      positions[i * 3 + 1] = heights[i]
      positions[i * 3 + 2] = z
    }
  }
  const index: number[] = []
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols - 1; c++) {
      const i = r * spec.cols + c
      index.push(i, i + 1)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setIndex(index)
  return geo
}

export function createTerrainScene(canvas: HTMLCanvasElement, opts: { seed: number; colors: TerrainColors; quality: 'high' | 'low' }): TerrainScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(new THREE.Color(opts.colors.fog), 14, 46)

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)
  let altitude = ALTITUDE.initial
  const pointer = new THREE.Vector2(0, 0)
  const pointerSmoothed = new THREE.Vector2(0, 0)

  let spec: HeightfieldSpec = { ...QUALITY[opts.quality], ...FIELD, amplitude: AMPLITUDE, seed: opts.seed }
  const lineMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(opts.colors.line), transparent: true, opacity: 1 })
  let lines = new THREE.LineSegments(buildLineGeometry(spec), lineMaterial)
  scene.add(lines)

  // 标记点：小球 + 立柱
  const markerGroup = new THREE.Group()
  const markerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(opts.colors.accent), transparent: true })
  const markerMeshes = new Map<MarkerId, THREE.Mesh>()
  for (const m of MARKERS) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), markerMat.clone())
    mesh.userData.id = m.id
    markerGroup.add(mesh)
    markerMeshes.set(m.id, mesh)
  }
  scene.add(markerGroup)
  function placeMarkers() {
    for (const m of MARKERS) {
      const mesh = markerMeshes.get(m.id)!
      mesh.position.set(m.x, heightAt(spec, m.x, m.z) + 0.35, m.z)
      mesh.userData.baseY = mesh.position.y
    }
  }
  placeMarkers()

  let hovered: MarkerId | null = null
  const raycaster = new THREE.Raycaster()

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (w === 0 || h === 0) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()

  let weatherTick: ((dt: number) => void) | null = null   // Task 9 挂粒子更新
  let raf = 0
  let last = performance.now()
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    pointerSmoothed.lerp(pointer, 0.06)
    // 相机：高度 altitude，向 -z 方向后退，看向原点略前方；鼠标带来左右/俯仰漂移
    camera.position.set(pointerSmoothed.x * 1.6, altitude, altitude * 0.9 + 4)
    camera.lookAt(pointerSmoothed.x * 0.8, -0.5 + pointerSmoothed.y * 0.6, -2)
    for (const mesh of markerMeshes.values()) {
      const isHover = mesh.userData.id === hovered
      const targetY = mesh.userData.baseY + (isHover ? 0.6 : 0)
      mesh.position.y += (targetY - mesh.position.y) * 0.15
      const s = isHover ? 1.6 : 1
      mesh.scale.setScalar(mesh.scale.x + (s - mesh.scale.x) * 0.15)
    }
    weatherTick?.(dt)
    renderer.render(scene, camera)
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  const api: TerrainScene & { _setWeatherTick(fn: ((dt: number) => void) | null): void; _scene: THREE.Scene; _spec(): HeightfieldSpec } = {
    setSeed(seed) {
      spec = { ...spec, seed }
      lines.geometry.dispose()
      lines.geometry = buildLineGeometry(spec)
      placeMarkers()
    },
    setColors(c) {
      lineMaterial.color.set(c.line)
      ;(scene.fog as THREE.Fog).color.set(c.fog)
      for (const mesh of markerMeshes.values()) (mesh.material as THREE.MeshBasicMaterial).color.set(c.accent)
    },
    setAltitude(a) { altitude = Math.max(ALTITUDE.min, Math.min(ALTITUDE.max, a)) },
    setPointer(nx, ny) { pointer.set(nx, ny) },
    setWeather() { /* Task 9 替换 */ },
    pickMarker(nx, ny) {
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera)
      const hit = raycaster.intersectObjects([...markerMeshes.values()], false)[0]
      return hit ? (hit.object.userData.id as MarkerId) : null
    },
    setHovered(id) { hovered = id },
    setOpacity(o) {
      lineMaterial.opacity = o
      for (const mesh of markerMeshes.values()) (mesh.material as THREE.MeshBasicMaterial).opacity = o
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      lines.geometry.dispose()
      lineMaterial.dispose()
      for (const mesh of markerMeshes.values()) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() }
      renderer.dispose()
    },
    _setWeatherTick(fn) { weatherTick = fn },
    _scene: scene,
    _spec: () => spec,
  }
  return api
}
```

`_setWeatherTick / _scene / _spec` 是给 Task 9 粒子模块用的内部钩子，不出现在 `TerrainScene` 类型上。

- [ ] **Step 8: 类型检查**

```bash
npm run typecheck
```

Expected: 无错误。若 `@types/three` 与 `three` 小版本不一致导致报错，把 `@types/three` 装到与 `three` 相同的次版本。

- [ ] **Step 9: 提交**

```bash
git add -A
git commit -m "feat: reproducible heightfield and three.js line terrain scene"
```

---

### Task 9: 天气粒子（雨 / 雪 / 落叶）

**Files:**
- Create: `src/terrain/particles.ts`
- Modify: `src/terrain/scene.ts`（`setWeather` 接入粒子）
- Test: `tests/unit/particles.test.ts`

**Interfaces:**
- Produces（纯函数部分，可测）：

```ts
export type ParticleKind = 'none' | 'rain' | 'snow' | 'leaves'
export function particleKindFor(state: WeatherState, season: Season): ParticleKind
export function particleCount(kind: ParticleKind, intensity: number, quality: 'high' | 'low'): number
export function stepParticle(kind: ParticleKind, p: Float32Array, i: number, dt: number, t: number, bounds: { halfW: number; halfD: number; top: number; floor: number }): void
```

- Produces（Three 部分）：`createParticles(scene: THREE.Scene, kind: ParticleKind, count: number, color: string, quality): { tick(dt: number): void; setColor(c: string): void; dispose(): void }`。
- 规则：`rain` 与 `snow` 由天气状态决定；天气为 `clear` 或 `cloudy` 且季节为 `autumn` 时为 `leaves`；其余 `none`。

- [ ] **Step 1: 写失败测试 `tests/unit/particles.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { particleCount, particleKindFor, stepParticle } from '@/terrain/particles'

describe('particleKindFor', () => {
  it('follows weather first, then autumn leaves', () => {
    expect(particleKindFor('rain', 'spring')).toBe('rain')
    expect(particleKindFor('snow', 'autumn')).toBe('snow')
    expect(particleKindFor('clear', 'autumn')).toBe('leaves')
    expect(particleKindFor('cloudy', 'autumn')).toBe('leaves')
    expect(particleKindFor('clear', 'summer')).toBe('none')
  })
})

describe('particleCount', () => {
  it('scales with intensity and drops on low quality', () => {
    expect(particleCount('none', 1, 'high')).toBe(0)
    expect(particleCount('rain', 1, 'high')).toBe(2400)
    expect(particleCount('rain', 0.5, 'high')).toBe(1200)
    expect(particleCount('rain', 1, 'low')).toBe(800)
    expect(particleCount('leaves', 1, 'high')).toBe(180)
  })
})

describe('stepParticle', () => {
  const bounds = { halfW: 20, halfD: 15, top: 12, floor: -2 }
  it('moves rain straight down and recycles below the floor', () => {
    const p = new Float32Array([0, 5, 0])
    stepParticle('rain', p, 0, 0.1, 0, bounds)
    expect(p[1]).toBeLessThan(5)
    expect(p[0]).toBe(0)
    p[1] = -3
    stepParticle('rain', p, 0, 0.1, 0, bounds)
    expect(p[1]).toBeGreaterThan(bounds.floor)
    expect(p[1]).toBeLessThanOrEqual(bounds.top)
  })
  it('lets snow drift sideways while falling slowly', () => {
    const p = new Float32Array([0, 5, 0])
    stepParticle('snow', p, 0, 0.1, 1.3, bounds)
    expect(p[1]).toBeLessThan(5)
    expect(p[1]).toBeGreaterThan(4.5)
    expect(p[0]).not.toBe(0)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/particles.test.ts`
Expected: FAIL。

- [ ] **Step 3: 写 `src/terrain/particles.ts`**

```ts
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
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/unit/particles.test.ts`
Expected: 全部通过。

- [ ] **Step 5: 在 `scene.ts` 里接入**

`src/terrain/scene.ts` 顶部加：

```ts
import { createParticles, particleCount, particleKindFor, type ParticleKind } from './particles'
```

在 `createTerrainScene` 内、`let weatherTick` 之后加：

```ts
  let particles: ReturnType<typeof createParticles> | null = null
  let currentKind: ParticleKind = 'none'
  let particleColor = opts.colors.line
  const bounds = { halfW: FIELD.width / 2, halfD: FIELD.depth / 2, top: 12, floor: -2.5 }
  function rebuildParticles(kind: ParticleKind, count: number) {
    particles?.dispose()
    particles = null
    weatherTick = null
    currentKind = kind
    if (kind === 'none' || count === 0) return
    particles = createParticles(scene, kind, count, kind === 'leaves' ? opts.colors.accent : particleColor, bounds)
    weatherTick = dt => particles!.tick(dt)
  }
```

把 `setWeather() { /* Task 9 替换 */ }` 替换为：

```ts
    setWeather(state, season, intensity) {
      const kind = particleKindFor(state, season)
      rebuildParticles(kind, particleCount(kind, intensity, opts.quality))
    },
```

`setColors(c)` 内追加：

```ts
      particleColor = c.line
      particles?.setColor(currentKind === 'leaves' ? c.accent : c.line)
```

`dispose()` 内第一行加 `particles?.dispose()`。删掉不再需要的 `_setWeatherTick` 钩子（保留 `_scene`、`_spec` 也可以删，Task 10 不用它们）。

- [ ] **Step 6: 类型检查并提交**

```bash
npm run typecheck
git add -A
git commit -m "feat: rain, snow and leaf particles driven by weather state"
```

---

### Task 10: 首页（地形画布、图例、参数面板、开场动画、降级）

**Files:**
- Create: `src/components/TerrainCanvas.vue`, `src/components/Legend.vue`, `src/components/ParamPanel.vue`, `src/pages/Home.vue`（覆盖占位）, `public/terrain-fallback.svg`, `src/terrain/camera.ts`
- Modify: `src/App.vue`（首页隐藏顶部导航）
- Test: `tests/unit/camera.test.ts`, `tests/unit/Legend.test.ts`

**Interfaces:**
- Consumes: `createTerrainScene / ALTITUDE`（Task 8），`useTerrainParams`（Task 7），`useTheme`（Task 2），`supportsWebGL / prefersReducedMotion / isCoarsePointer`（Task 8），`MetaLine`（Task 4），`loadEssays / loadProjects`（Task 3，图例上显示数量）。
- Produces（`camera.ts`，纯函数）：`altitudeFromWheel(current: number, deltaY: number): number`（每 100px 滚动改变 1 个单位，夹在 `ALTITUDE.min..max`）；`normalizedPointer(e: { clientX: number; clientY: number }, rect: { left: number; top: number; width: number; height: number }): { nx: number; ny: number }`（x 向右为正，y 向上为正，范围 [-1,1]）。
- Produces: `Legend` 组件，props `{ essayCount: number; projectCount: number; params: TerrainParams; intro: boolean }`，emits `navigate(id: MarkerId)` 与 `hover(id: MarkerId | null)`（悬停图例行时让地形上的对应小球抬高）；内含 `ParamPanel`。
- Produces: `TerrainCanvas` 组件，props `{ hovered: MarkerId | null; opacity: number }`，emits `hover(id: MarkerId | null)`、`select(id: MarkerId)`、`ready()`。
- 开场动画使用 GSAP，session 内只播一次：`sessionStorage['introPlayed'] = '1'`。

- [ ] **Step 1: 安装 GSAP，写失败测试 `tests/unit/camera.test.ts`**

```bash
npm i gsap
```

```ts
import { describe, expect, it } from 'vitest'
import { altitudeFromWheel, normalizedPointer } from '@/terrain/camera'
import { ALTITUDE } from '@/terrain/scene'

describe('altitudeFromWheel', () => {
  it('moves one unit per 100px and clamps', () => {
    expect(altitudeFromWheel(14, 100)).toBe(15)
    expect(altitudeFromWheel(14, -250)).toBe(11.5)
    expect(altitudeFromWheel(ALTITUDE.max, 500)).toBe(ALTITUDE.max)
    expect(altitudeFromWheel(ALTITUDE.min, -500)).toBe(ALTITUDE.min)
  })
})

describe('normalizedPointer', () => {
  it('maps the rect center to 0,0 and corners to ±1', () => {
    const rect = { left: 100, top: 50, width: 200, height: 100 }
    expect(normalizedPointer({ clientX: 200, clientY: 100 }, rect)).toEqual({ nx: 0, ny: 0 })
    expect(normalizedPointer({ clientX: 300, clientY: 50 }, rect)).toEqual({ nx: 1, ny: 1 })
    expect(normalizedPointer({ clientX: 100, clientY: 150 }, rect)).toEqual({ nx: -1, ny: -1 })
  })
})
```

- [ ] **Step 2: 运行确认失败，然后写 `src/terrain/camera.ts`**

Run: `npx vitest run tests/unit/camera.test.ts` → FAIL。

```ts
import { ALTITUDE } from './scene'

export function altitudeFromWheel(current: number, deltaY: number): number {
  const next = current + deltaY / 100
  return Math.max(ALTITUDE.min, Math.min(ALTITUDE.max, next))
}

export function normalizedPointer(e: { clientX: number; clientY: number }, rect: { left: number; top: number; width: number; height: number }) {
  const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
  const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
  return { nx, ny }
}
```

Run again → 2 passed。注意 `scene.ts` 顶部 `import * as THREE` 在 jsdom 下可以加载（不创建 renderer 就不需要 WebGL）。

- [ ] **Step 3: 写 `src/components/TerrainCanvas.vue`**

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { MarkerId } from '@/terrain/heightfield'
import type { TerrainScene } from '@/terrain/scene'
import { altitudeFromWheel, normalizedPointer } from '@/terrain/camera'
import { isCoarsePointer } from '@/terrain/support'
import { useTerrainParams } from '@/weather/terrainParams'
import { useTheme } from '@/theme/theme'

const props = defineProps<{ hovered: MarkerId | null; opacity: number }>()
const emit = defineEmits<{ hover: [id: MarkerId | null]; select: [id: MarkerId]; ready: [] }>()

const canvas = ref<HTMLCanvasElement>()
let sceneApi: TerrainScene | null = null
let altitude = 14
const { params } = useTerrainParams()
const { theme } = useTheme()

function readColors() {
  const s = getComputedStyle(document.documentElement)
  return { line: s.getPropertyValue('--fg').trim(), fog: s.getPropertyValue('--bg').trim(), accent: s.getPropertyValue('--accent').trim() }
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  altitude = altitudeFromWheel(altitude, e.deltaY)
  sceneApi?.setAltitude(altitude)
}
function onMove(e: PointerEvent) {
  if (!canvas.value || !sceneApi) return
  const { nx, ny } = normalizedPointer(e, canvas.value.getBoundingClientRect())
  if (!isCoarsePointer()) sceneApi.setPointer(nx, ny)
  emit('hover', sceneApi.pickMarker(nx, ny))
}
function onClick(e: PointerEvent) {
  if (!canvas.value || !sceneApi) return
  const { nx, ny } = normalizedPointer(e, canvas.value.getBoundingClientRect())
  const id = sceneApi.pickMarker(nx, ny)
  if (id) emit('select', id)
}

onMounted(async () => {
  const { createTerrainScene, ALTITUDE } = await import('@/terrain/scene')
  if (!canvas.value) return
  altitude = ALTITUDE.initial
  sceneApi = createTerrainScene(canvas.value, {
    seed: params.value.seed,
    colors: readColors(),
    quality: isCoarsePointer() || window.innerWidth < 768 ? 'low' : 'high',
  })
  sceneApi.setWeather(params.value.weather, params.value.season, params.value.intensity)
  sceneApi.setOpacity(props.opacity)
  emit('ready')
})

watch(() => params.value.seed, s => sceneApi?.setSeed(s))
watch(() => [params.value.weather, params.value.season, params.value.intensity] as const, ([w, s, i]) => sceneApi?.setWeather(w, s, i))
watch(theme, () => requestAnimationFrame(() => sceneApi?.setColors(readColors())))
watch(() => props.hovered, h => sceneApi?.setHovered(h))
watch(() => props.opacity, o => sceneApi?.setOpacity(o))

onBeforeUnmount(() => { sceneApi?.dispose(); sceneApi = null })
</script>

<template>
  <canvas ref="canvas" class="terrain-canvas" :class="{ 'is-hover': hovered }" @wheel="onWheel" @pointermove="onMove" @click="onClick" />
</template>

<style scoped>
.terrain-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
.terrain-canvas.is-hover { cursor: pointer; }
</style>
```

- [ ] **Step 4: 写 `src/components/ParamPanel.vue`**

```vue
<script setup lang="ts">
import { useTerrainParams } from '@/weather/terrainParams'
import type { Season, WeatherState } from '@/weather/openMeteo'

const { params, setManual, clearManual } = useTerrainParams()
const weathers: WeatherState[] = ['clear', 'cloudy', 'rain', 'snow']
const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter']
const zh = { clear: '晴', cloudy: '阴', rain: '雨', snow: '雪', spring: '春', summer: '夏', autumn: '秋', winter: '冬' } as const

function reseed() { setManual({ seed: Math.floor(Math.random() * 0xffff) }) }
function hex(n: number) { return '0x' + n.toString(16).padStart(4, '0') }
</script>

<template>
  <div class="panel mono">
    <div class="row"><span>weather</span>
      <span class="opts"><button v-for="w in weathers" :key="w" type="button" :class="{ on: params.weather === w }" @click="setManual({ weather: w })">{{ zh[w] }}</button></span>
    </div>
    <div class="row"><span>season</span>
      <span class="opts"><button v-for="s in seasons" :key="s" type="button" :class="{ on: params.season === s }" @click="setManual({ season: s })">{{ zh[s] }}</button></span>
    </div>
    <div class="row"><span>intensity</span>
      <input type="range" min="0" max="1" step="0.05" :value="params.intensity" @input="setManual({ intensity: Number(($event.target as HTMLInputElement).value) })">
      <b>{{ params.intensity.toFixed(2) }}</b>
    </div>
    <div class="row"><span>seed</span><button type="button" class="link" @click="reseed">{{ hex(params.seed) }} ↻</button></div>
    <div v-if="params.source === 'manual'" class="row"><button type="button" class="link" @click="clearManual">reset → live</button></div>
  </div>
</template>

<style scoped>
.panel { display: grid; gap: 6px; padding-top: 10px; margin-top: 10px; border-top: 1px solid var(--line); font-size: 11px; }
.row { display: flex; align-items: center; gap: 10px; }
.row > span:first-child { width: 64px; color: var(--muted); }
.opts { display: flex; gap: 4px; }
button { background: none; border: 1px solid var(--line); color: var(--muted); font: inherit; padding: 1px 6px; border-radius: 2px; cursor: pointer; }
button.on, button:hover { color: var(--accent); border-color: var(--accent); }
button.link { border: 0; padding: 0; }
input[type=range] { width: 80px; accent-color: var(--accent); }
b { color: var(--accent); font-weight: 400; }
</style>
```

- [ ] **Step 5: 写失败测试 `tests/unit/Legend.test.ts` 与 `src/components/Legend.vue`**

测试：

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Legend from '@/components/Legend.vue'

const params = { weather: 'rain', season: 'autumn', seed: 0x5c7e, intensity: 0.6, source: 'live' } as const

describe('Legend', () => {
  it('shows the three entrances and emits navigate', async () => {
    const w = mount(Legend, { props: { essayCount: 8, projectCount: 1, params, intro: false } })
    expect(w.text()).toContain('LEGEND')
    expect(w.text()).toContain('Scream')
    const rows = w.findAll('.legend-row')
    expect(rows.length).toBe(3)
    await rows[0].trigger('click')
    expect(w.emitted('navigate')?.[0]).toEqual(['essays'])
  })
  it('renders the meta line with the source label', () => {
    const w = mount(Legend, { props: { essayCount: 8, projectCount: 1, params: { ...params, source: 'manual' }, intro: false } })
    expect(w.text()).toContain('手动')
    expect(w.text()).toContain('0x5c7e')
  })
  it('hides the name while the intro is playing', () => {
    const w = mount(Legend, { props: { essayCount: 8, projectCount: 1, params, intro: true } })
    expect(w.find('.legend-name').attributes('style')).toContain('visibility: hidden')
  })
})
```

组件：

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import MetaLine from '@/components/MetaLine.vue'
import ParamPanel from '@/components/ParamPanel.vue'
import type { MarkerId } from '@/terrain/heightfield'
import type { TerrainParams } from '@/weather/terrainParams'

const props = defineProps<{ essayCount: number; projectCount: number; params: TerrainParams; intro: boolean }>()
const emit = defineEmits<{ navigate: [id: MarkerId]; hover: [id: MarkerId | null] }>()
const showPanel = ref(false)

const zhWeather = { clear: '晴', cloudy: '阴', rain: '雨', snow: '雪' } as const
const zhSource = { live: '实时', default: '默认', manual: '手动' } as const
const today = computed(() => new Date().toISOString().slice(0, 10))
const rows: { id: MarkerId; glyph: string; label: string; path: string }[] = [
  { id: 'essays', glyph: '●', label: '文章', path: 'essays/' },
  { id: 'projects', glyph: '▲', label: '项目', path: 'projects/' },
  { id: 'about', glyph: '□', label: '关于', path: 'whoami' },
]
function count(id: MarkerId) { return id === 'essays' ? props.essayCount : id === 'projects' ? props.projectCount : '' }
</script>

<template>
  <aside class="legend">
    <div class="mono legend-title">LEGEND · 图例</div>
    <div class="legend-name" :style="{ visibility: intro ? 'hidden' : 'visible' }">Scream</div>
    <div class="legend-rows">
      <button v-for="r in rows" :key="r.id" type="button" class="legend-row" @click="emit('navigate', r.id)" @mouseenter="emit('hover', r.id)" @mouseleave="emit('hover', null)">
        <span class="glyph" :data-id="r.id">{{ r.glyph }}</span> {{ r.label }}
        <span class="mono">{{ r.path }} <template v-if="count(r.id) !== ''">· {{ count(r.id) }}</template></span>
      </button>
    </div>
    <div class="legend-meta">
      <MetaLine :parts="[today, '北京', zhWeather[params.weather], zhSource[params.source]]" />
      <button type="button" class="mono legend-toggle" @click="showPanel = !showPanel">seed {{ '0x' + params.seed.toString(16).padStart(4, '0') }} {{ showPanel ? '▴' : '▾' }}</button>
    </div>
    <ParamPanel v-if="showPanel" />
  </aside>
</template>

<style scoped>
.legend { position: absolute; left: 48px; bottom: 48px; width: 300px; padding: 22px 24px; background: color-mix(in srgb, var(--bg) 88%, transparent); border: 1px solid var(--line); backdrop-filter: blur(6px); }
.legend-title { margin-bottom: 10px; }
.legend-name { font-size: 30px; font-weight: 600; letter-spacing: .12em; margin-bottom: 14px; }
.legend-rows { display: grid; gap: 2px; }
.legend-row { display: flex; align-items: baseline; gap: 8px; background: none; border: 0; padding: 4px 0; color: inherit; font: inherit; font-size: 15px; text-align: left; cursor: pointer; }
.legend-row:hover { color: var(--accent); }
.glyph[data-id=essays] { color: var(--accent); }
.glyph[data-id=projects] { color: var(--muted); }
.legend-meta { margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 4px; }
.legend-toggle { background: none; border: 0; padding: 0; text-align: left; cursor: pointer; }
.legend-toggle:hover { color: var(--accent); }
@media (max-width: 640px) { .legend { left: 16px; right: 16px; bottom: 16px; width: auto; } }
</style>
```

Run: `npx vitest run tests/unit/Legend.test.ts` → 3 passed。

- [ ] **Step 6: 写静态降级图 `public/terrain-fallback.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
  <g fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1">
    <path d="M0 420 C200 370 300 460 500 400 S800 320 1000 370 S1350 460 1600 380"/>
    <path d="M0 480 C220 440 320 530 520 470 S820 390 1020 440 S1370 530 1600 450"/>
    <path d="M0 540 C240 510 340 600 540 540 S840 460 1040 510 S1390 600 1600 520"/>
    <path d="M0 600 C260 580 360 670 560 610 S860 530 1060 580 S1410 670 1600 590"/>
    <path d="M0 660 C280 650 380 740 580 680 S880 600 1080 650 S1430 740 1600 660"/>
    <path d="M0 720 C300 720 400 810 600 750 S900 670 1100 720 S1450 810 1600 730"/>
    <path d="M0 780 C320 790 420 880 620 830 S920 750 1120 800 S1470 880 1600 810"/>
  </g>
</svg>
```

`stroke="currentColor"` 让它跟随主题文字色。

- [ ] **Step 7: 写 `src/pages/Home.vue`**

```vue
<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import Legend from '@/components/Legend.vue'
import TerrainCanvas from '@/components/TerrainCanvas.vue'
import { loadEssays } from '@/content/essays'
import { loadProjects } from '@/content/projects'
import type { MarkerId } from '@/terrain/heightfield'
import { prefersReducedMotion, supportsWebGL } from '@/terrain/support'
import { useTerrainParams } from '@/weather/terrainParams'

useHead({ title: 'Scream · 地形志' })
const router = useRouter()
const { params, loadLive } = useTerrainParams()
const essayCount = loadEssays().length
const projectCount = loadProjects().length

const use3d = ref(false)
const hovered = ref<MarkerId | null>(null)
const opacity = ref(1)
const intro = ref(false)
const introName = ref<HTMLElement>()
const legendEl = ref<InstanceType<typeof Legend>>()

const paths: Record<MarkerId, string> = { essays: '/essays', projects: '/projects', about: '/about' }
function go(id: MarkerId) { router.push(paths[id]) }

async function playIntro() {
  const { gsap } = await import('gsap')
  await nextTick()
  const from = introName.value
  const to = legendEl.value?.$el.querySelector('.legend-name') as HTMLElement | null
  if (!from || !to) { intro.value = false; return }
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect()
  const tl = gsap.timeline({ onComplete() { intro.value = false; from.style.visibility = 'hidden' } })
  tl.fromTo(from, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out' })
    .to(opacity, { value: 1, duration: 1.2, ease: 'power1.inOut' }, 0.2)
    .to(from, { x: b.left - a.left, y: b.top - a.top, scale: b.height / a.height, transformOrigin: 'top left', duration: 0.9, ease: 'power3.inOut' }, '+=0.6')
}

onMounted(() => {
  use3d.value = supportsWebGL() && !prefersReducedMotion()
  void loadLive()
  const played = (() => { try { return sessionStorage.getItem('introPlayed') === '1' } catch { return true } })()
  if (use3d.value && !played) {
    intro.value = true
    opacity.value = 0
    try { sessionStorage.setItem('introPlayed', '1') } catch { /* ignore */ }
  }
})
function onSceneReady() { if (intro.value) void playIntro() }
</script>

<template>
  <main class="home">
    <TerrainCanvas v-if="use3d" :hovered="hovered" :opacity="opacity" @hover="hovered = $event" @select="go" @ready="onSceneReady" />
    <img v-else class="fallback" src="/terrain-fallback.svg" alt="">
    <div v-if="intro" ref="introName" class="intro-name">Scream</div>
    <Legend ref="legendEl" :essay-count="essayCount" :project-count="projectCount" :params="params" :intro="intro" @navigate="go" @hover="hovered = $event" />
    <div class="mono hint">scroll · altitude &nbsp;&nbsp; ~ · terminal</div>
  </main>
</template>

<style scoped>
.home { position: fixed; inset: 0; overflow: hidden; background: var(--bg); }
.fallback { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; color: var(--fg); }
.intro-name { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); font-size: 96px; font-weight: 600; letter-spacing: .14em; opacity: 0; will-change: transform; }
.hint { position: absolute; right: 24px; bottom: 20px; }
@media (pointer: coarse) { .hint { display: none; } }
</style>
```

注意 `gsap.to(opacity, { value: 1 })` 直接补间 Vue 的 `ref` 对象上的 `value` 属性，`TerrainCanvas` 的 `watch(() => props.opacity)` 会同步到场景。`intro-name` 用 `transform: translate(-50%,-50%)` 定位，GSAP 的 `x/y/scale` 会覆盖 transform，所以起点矩形 `a` 要在动画开始前读取（代码里就是这么做的）。

- [ ] **Step 8: 首页隐藏顶部导航**

`App.vue` 的 `<header>` 加 `v-if="$route.name !== 'home'"`。

- [ ] **Step 9: 手动验收**

```bash
npm run dev
```

检查清单：
- 首屏地形线框浮现，"Scream" 大字停顿后滑入左下图例；刷新不再重播（新开标签会重播）。
- 滚轮推近拉远，有上下限；鼠标移动有轻微漂移。
- 鼠标靠近地形上的小球会变大抬高，光标变手型，点击跳转；图例三行悬停时对应小球也抬高。
- 切换主题，线与雾的颜色跟着变。
- 图例底部 seed 点开参数面板，切 weather 到"雪"出现雪花，"雨"出现雨丝，季节切"秋"且天气晴/阴时出现落叶；reset 回到 live。
- 系统开启"减少动态效果"后刷新，显示静态 SVG，图例照常可点。

- [ ] **Step 10: 构建检查 SSR**

```bash
npm run build
```

Expected: 构建成功，`dist/index.html` 中包含图例卡片的 HTML 与 `<canvas` 或 fallback（SSR 时 `use3d` 为 false，输出的是 fallback `<img>`，客户端挂载后切换到 canvas；这正是我们要的无 JS 也能看的效果）。

- [ ] **Step 11: 提交**

```bash
git add -A
git commit -m "feat: home page with terrain canvas, legend, param panel and intro"
```

---

### Task 11: 正文页动效（段落淡入、海拔进度、页面过渡）

**Files:**
- Create: `src/composables/useParagraphReveal.ts`, `src/composables/useAltitude.ts`, `src/components/Altitude.vue`
- Modify: `src/pages/Essay.vue`, `src/App.vue`（路由过渡）, `src/styles/base.css`
- Test: `tests/unit/altitude.test.ts`

**Interfaces:**
- Consumes: `.essay-body > p` DOM 结构（Task 4）；`prefersReducedMotion`（Task 8）。
- Produces: `altitudePercent(scrollY: number, docHeight: number, viewportH: number): number`（0 到 100 的整数）。
- Produces: `useParagraphReveal(container: Ref<HTMLElement | undefined>)`：给容器内每个直接子元素 `p`、`blockquote`、`img` 加类 `reveal`，进入视口后加 `is-visible`。

- [ ] **Step 1: 写失败测试 `tests/unit/altitude.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { altitudePercent } from '@/composables/useAltitude'

describe('altitudePercent', () => {
  it('is 0 at the top and 100 at the bottom', () => {
    expect(altitudePercent(0, 3000, 800)).toBe(0)
    expect(altitudePercent(2200, 3000, 800)).toBe(100)
  })
  it('is linear in between and clamps', () => {
    expect(altitudePercent(1100, 3000, 800)).toBe(50)
    expect(altitudePercent(-10, 3000, 800)).toBe(0)
    expect(altitudePercent(9999, 3000, 800)).toBe(100)
  })
  it('returns 100 when the page does not scroll', () => {
    expect(altitudePercent(0, 700, 800)).toBe(100)
  })
})
```

- [ ] **Step 2: 运行确认失败，写 `src/composables/useAltitude.ts`**

Run: `npx vitest run tests/unit/altitude.test.ts` → FAIL。

```ts
import { onBeforeUnmount, onMounted, ref } from 'vue'

export function altitudePercent(scrollY: number, docHeight: number, viewportH: number): number {
  const range = docHeight - viewportH
  if (range <= 0) return 100
  return Math.round(Math.max(0, Math.min(1, scrollY / range)) * 100)
}

export function useAltitude() {
  const percent = ref(0)
  function update() {
    percent.value = altitudePercent(window.scrollY, document.documentElement.scrollHeight, window.innerHeight)
  }
  onMounted(() => { update(); window.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update) })
  onBeforeUnmount(() => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) })
  return { percent }
}
```

Run again → 3 passed。

- [ ] **Step 3: 写 `src/components/Altitude.vue`**

```vue
<script setup lang="ts">
import { useAltitude } from '@/composables/useAltitude'
const { percent } = useAltitude()
</script>

<template>
  <div class="altitude mono" aria-hidden="true">
    <span>海拔</span>
    <i><b :style="{ height: percent + '%' }" /></i>
    <span>{{ percent }}%</span>
  </div>
</template>

<style scoped>
.altitude { position: fixed; right: 22px; top: 96px; display: flex; flex-direction: column; align-items: center; gap: 8px; writing-mode: vertical-rl; font-size: 10px; letter-spacing: .1em; color: var(--muted); }
.altitude i { display: block; width: 1px; height: 140px; background: var(--line); position: relative; }
.altitude b { position: absolute; top: 0; left: -1px; width: 3px; background: var(--accent); transition: height .15s linear; }
@media (max-width: 900px) { .altitude { display: none; } }
</style>
```

- [ ] **Step 4: 写 `src/composables/useParagraphReveal.ts`**

```ts
import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { prefersReducedMotion } from '@/terrain/support'

export function useParagraphReveal(container: Ref<HTMLElement | undefined>) {
  let io: IntersectionObserver | null = null
  onMounted(() => {
    const root = container.value
    if (!root || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return
    const targets = root.querySelectorAll<HTMLElement>(':scope > p, :scope > blockquote, :scope > img, :scope > h2, :scope > h3')
    io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add('is-visible'); io?.unobserve(en.target) }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 })
    targets.forEach((el) => { el.classList.add('reveal'); io!.observe(el) })
  })
  onBeforeUnmount(() => io?.disconnect())
}
```

- [ ] **Step 5: 接入 `Essay.vue`，加 CSS**

`Essay.vue` 的 `<script setup>` 里加：

```ts
import { ref } from 'vue'   // 与已有 computed 合并到同一行 import
import Altitude from '@/components/Altitude.vue'
import { useParagraphReveal } from '@/composables/useParagraphReveal'
const body = ref<HTMLElement>()
useParagraphReveal(body)
```

模板里 `<div class="essay-body" v-html="essay.html" />` 改为 `<div ref="body" class="essay-body" v-html="essay.html" />`，并在 `<article v-if="essay" …>` 内第一行加 `<Altitude />`。

`src/styles/base.css` 末尾加：

```css
.reveal { opacity: .18; transform: translateY(6px); transition: opacity .7s ease, transform .7s ease; }
.reveal.is-visible { opacity: 1; transform: none; }

.page-enter-active, .page-leave-active { transition: opacity .28s ease; }
.page-enter-from, .page-leave-to { opacity: 0; }
```

- [ ] **Step 6: 路由过渡**

`App.vue` 中 `<RouterView />` 改为：

```vue
<RouterView v-slot="{ Component }">
  <Transition name="page" mode="out-in">
    <component :is="Component" />
  </Transition>
</RouterView>
```

- [ ] **Step 7: 手动验收**

```bash
npm run dev
```

打开一篇文章：首屏内段落立即可见，往下滚动时后续段落淡入；右侧"海拔"随滚动增长到 100%；页面切换有淡入淡出；开启系统"减少动态效果"后段落全部直接可见。

- [ ] **Step 8: 跑全部测试并提交**

```bash
npm test
git add -A
git commit -m "feat: paragraph reveal, altitude progress and page transitions"
```

---

### Task 12: 终端彩蛋

**Files:**
- Create: `src/terminal/types.ts`, `src/terminal/parse.ts`, `src/terminal/registry.ts`, `src/terminal/Terminal.vue`
- Create: `src/terminal/commands/help.ts`, `ls.ts`, `cat.ts`, `cd.ts`, `whoami.ts`, `weather.ts`, `seed.ts`, `theme.ts`, `clear.ts`, `sudo.ts`
- Modify: `src/App.vue`（挂载终端）
- Test: `tests/unit/terminal-parse.test.ts`, `tests/unit/terminal-commands.test.ts`

**Interfaces:**
- Produces（`types.ts`）：

```ts
export type TerminalOutput = string[] | { clear: true }
export interface TerminalContext {
  essays: Essay[]
  projects: Project[]
  navigate(path: string): void
  setTheme(t: Theme): void
  params: TerrainParams
  setManual(patch: Partial<Pick<TerrainParams, 'weather' | 'season' | 'seed' | 'intensity'>>): void
  close(): void
}
export interface Command {
  name: string
  usage: string
  description: string
  run(args: string[], ctx: TerminalContext): TerminalOutput | Promise<TerminalOutput>
  complete?(partial: string, ctx: TerminalContext): string[]
}
```

- Produces（`parse.ts`）：`parseCommand(input: string): { name: string; args: string[] }`；`complete(input: string, commands: Command[], ctx: TerminalContext): string[]`（返回可替换整行输入的候选）。
- Produces（`registry.ts`）：`commands: Command[]`，`findCommand(name: string): Command | undefined`，`execute(input: string, ctx: TerminalContext): Promise<TerminalOutput>`。
- 终端只在 `(pointer: fine)` 设备上绑定快捷键；按键判断用 `e.key === '~'`。

- [ ] **Step 1: 写失败测试 `tests/unit/terminal-parse.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { complete, parseCommand } from '@/terminal/parse'
import { commands } from '@/terminal/registry'
import type { TerminalContext } from '@/terminal/types'

const ctx = {
  essays: [{ slug: '丘陵', title: '丘陵' }, { slug: '河流', title: '河流' }, { slug: '湖泊', title: '湖泊' }],
  projects: [],
  navigate() {}, setTheme() {}, setManual() {}, close() {},
  params: { weather: 'rain', season: 'autumn', seed: 1, intensity: 0.6, source: 'live' },
} as unknown as TerminalContext

describe('parseCommand', () => {
  it('splits on whitespace and trims', () => {
    expect(parseCommand('  cat   丘陵 ')).toEqual({ name: 'cat', args: ['丘陵'] })
    expect(parseCommand('')).toEqual({ name: '', args: [] })
  })
})

describe('complete', () => {
  it('completes command names', () => {
    expect(complete('wh', commands, ctx)).toEqual(['whoami'])
    expect(complete('c', commands, ctx).sort()).toEqual(['cat', 'cd', 'clear'])
  })
  it('completes essay titles after cat', () => {
    expect(complete('cat 河', commands, ctx)).toEqual(['cat 河流'])
    expect(complete('cat ', commands, ctx)).toEqual(['cat 丘陵', 'cat 河流', 'cat 湖泊'])
  })
  it('completes fixed arguments', () => {
    expect(complete('theme d', commands, ctx)).toEqual(['theme dark'])
    expect(complete('cd p', commands, ctx)).toEqual(['cd projects'])
    expect(complete('ls e', commands, ctx)).toEqual(['ls essays'])
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/unit/terminal-parse.test.ts` → FAIL。

- [ ] **Step 3: 写 `types.ts` 与 `parse.ts`**

`src/terminal/types.ts`：

```ts
import type { Essay, Project } from '@/content/types'
import type { Theme } from '@/theme/theme'
import type { TerrainParams } from '@/weather/terrainParams'

export type TerminalOutput = string[] | { clear: true }
export interface TerminalContext {
  essays: Essay[]
  projects: Project[]
  navigate(path: string): void
  setTheme(t: Theme): void
  params: TerrainParams
  setManual(patch: Partial<Pick<TerrainParams, 'weather' | 'season' | 'seed' | 'intensity'>>): void
  close(): void
}
export interface Command {
  name: string
  usage: string
  description: string
  run(args: string[], ctx: TerminalContext): TerminalOutput | Promise<TerminalOutput>
  complete?(partial: string, ctx: TerminalContext): string[]
}
```

`src/terminal/parse.ts`：

```ts
import type { Command, TerminalContext } from './types'

export function parseCommand(input: string): { name: string; args: string[] } {
  const [name = '', ...args] = input.trim().split(/\s+/).filter(Boolean)
  return { name, args }
}

export function complete(input: string, commands: Command[], ctx: TerminalContext): string[] {
  const hasSpace = /\s/.test(input.trim()) || input.endsWith(' ')
  const { name, args } = parseCommand(input)
  if (!hasSpace) return commands.map(c => c.name).filter(n => n.startsWith(name))
  const cmd = commands.find(c => c.name === name)
  if (!cmd?.complete) return []
  const partial = args[0] ?? ''
  return cmd.complete(partial, ctx).filter(c => c.startsWith(partial)).map(c => `${name} ${c}`)
}
```

- [ ] **Step 4: 写命令文件**

`src/terminal/commands/help.ts`：

```ts
import type { Command } from '../types'
import { commands } from '../registry'
export const help: Command = {
  name: 'help', usage: 'help', description: '列出命令',
  run() {
    const w = Math.max(...commands.map(c => c.usage.length))
    return commands.filter(c => c.name !== 'sudo').map(c => `${c.usage.padEnd(w + 2)}${c.description}`)
  },
}
```

`ls.ts`：

```ts
import type { Command } from '../types'
export const ls: Command = {
  name: 'ls', usage: 'ls [essays|projects]', description: '列出文章或项目',
  run(args, ctx) {
    const what = args[0] ?? 'essays'
    if (what === 'essays') return ctx.essays.map(e => `${e.date}  ${e.title}  # ${e.city} · ${e.weather}`)
    if (what === 'projects') return ctx.projects.map(p => `${p.year}  ${p.name}  # ${p.stack.join(' ')}`)
    return [`ls: ${what}: No such directory`]
  },
  complete: () => ['essays', 'projects'],
}
```

`cat.ts`：

```ts
import type { Command } from '../types'
export const cat: Command = {
  name: 'cat', usage: 'cat <文章>', description: '打开一篇文章',
  run(args, ctx) {
    const key = args.join(' ')
    if (!key) return ['cat: 缺少文件名，试试 ls']
    const e = ctx.essays.find(x => x.title === key || x.slug === key || x.slug === key.replace(/\.md$/, ''))
    if (!e) return [`cat: ${key}: No such file`]
    ctx.navigate(`/essays/${e.slug}`)
    ctx.close()
    return [`opening ${e.title} …`]
  },
  complete: (_p, ctx) => ctx.essays.map(e => e.title),
}
```

`cd.ts`：

```ts
import type { Command } from '../types'
const DIRS: Record<string, string> = { '~': '/', essays: '/essays', projects: '/projects', about: '/about' }
export const cd: Command = {
  name: 'cd', usage: 'cd <essays|projects|about|~>', description: '去一个地方',
  run(args, ctx) {
    const d = args[0] ?? '~'
    if (!(d in DIRS)) return [`cd: ${d}: No such directory`]
    ctx.navigate(DIRS[d]); ctx.close()
    return []
  },
  complete: () => Object.keys(DIRS),
}
```

`whoami.ts`：

```ts
import type { Command } from '../types'
export const whoami: Command = {
  name: 'whoami', usage: 'whoami', description: '我是谁',
  run: () => ['scream', '# 写前端，也写点别的。', '# 名字来自张悬的一首歌。'],
}
```

`weather.ts`：

```ts
import type { Command } from '../types'
const zhW = { clear: '晴', cloudy: '阴', rain: '雨', snow: '雪' } as const
const zhS = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' } as const
const zhSrc = { live: '实时', default: '默认', manual: '手动' } as const
export const weather: Command = {
  name: 'weather', usage: 'weather [晴|阴|雨|雪]', description: '看或改天气',
  run(args, ctx) {
    const p = ctx.params
    if (!args[0]) return [`北京 · ${zhW[p.weather]} · ${zhS[p.season]} · ${zhSrc[p.source]} · intensity ${p.intensity}`]
    const entry = (Object.entries(zhW) as [keyof typeof zhW, string][]).find(([, v]) => v === args[0])
    if (!entry) return [`weather: 只认识 晴 阴 雨 雪`]
    ctx.setManual({ weather: entry[0] })
    return [`weather → ${args[0]} (manual)`]
  },
  complete: () => Object.values(zhW),
}
```

`seed.ts`：

```ts
import type { Command } from '../types'
export const seed: Command = {
  name: 'seed', usage: 'seed [0xhex|random]', description: '换一片地形',
  run(args, ctx) {
    if (!args[0]) return [`seed 0x${ctx.params.seed.toString(16)}`]
    const n = args[0] === 'random' ? Math.floor(Math.random() * 0xffff) : Number(args[0])
    if (!Number.isInteger(n) || n < 0) return [`seed: "${args[0]}" 不是整数`]
    ctx.setManual({ seed: n })
    return [`seed → 0x${n.toString(16)}`]
  },
  complete: () => ['random'],
}
```

`theme.ts`：

```ts
import type { Command } from '../types'
export const theme: Command = {
  name: 'theme', usage: 'theme <dark|light>', description: '雨夜 / 宣纸',
  run(args, ctx) {
    if (args[0] !== 'dark' && args[0] !== 'light') return ['theme: dark 或 light']
    ctx.setTheme(args[0])
    return [`theme → ${args[0] === 'dark' ? '雨夜' : '宣纸'}`]
  },
  complete: () => ['dark', 'light'],
}
```

`clear.ts`：

```ts
import type { Command } from '../types'
export const clear: Command = { name: 'clear', usage: 'clear', description: '清屏', run: () => ({ clear: true }) }
```

`sudo.ts`：

```ts
import type { Command } from '../types'
export const sudo: Command = { name: 'sudo', usage: 'sudo', description: '', run: () => ['你没有权限，去找老王。'] }
```

- [ ] **Step 5: 写 `src/terminal/registry.ts`**

```ts
import { parseCommand } from './parse'
import type { Command, TerminalContext, TerminalOutput } from './types'
import { cat } from './commands/cat'
import { cd } from './commands/cd'
import { clear } from './commands/clear'
import { help } from './commands/help'
import { ls } from './commands/ls'
import { seed } from './commands/seed'
import { sudo } from './commands/sudo'
import { theme } from './commands/theme'
import { weather } from './commands/weather'
import { whoami } from './commands/whoami'

export const commands: Command[] = [help, ls, cat, cd, whoami, weather, seed, theme, clear, sudo]

export function findCommand(name: string): Command | undefined {
  return commands.find(c => c.name === name)
}

export async function execute(input: string, ctx: TerminalContext): Promise<TerminalOutput> {
  const { name, args } = parseCommand(input)
  if (!name) return []
  const cmd = findCommand(name)
  if (!cmd) return [`${name}: command not found. 试试 help`]
  return cmd.run(args, ctx)
}
```

`help.ts` 与 `registry.ts` 互相引用：`help` 在运行时才读 `commands`，ESM 循环引用下没问题。

- [ ] **Step 6: 运行 parse 测试确认通过，再写失败测试 `tests/unit/terminal-commands.test.ts`**

Run: `npx vitest run tests/unit/terminal-parse.test.ts` → 全部通过。

```ts
import { describe, expect, it, vi } from 'vitest'
import { execute } from '@/terminal/registry'
import type { TerminalContext } from '@/terminal/types'

function makeCtx(): TerminalContext {
  return {
    essays: [{ slug: '丘陵', title: '丘陵', date: '2025-11-30', city: '随州', weather: '雨' }] as never,
    projects: [{ name: '地形志', year: 2026, stack: ['Vue'] }] as never,
    navigate: vi.fn(), setTheme: vi.fn(), setManual: vi.fn(), close: vi.fn(),
    params: { weather: 'rain', season: 'autumn', seed: 0x5c7e, intensity: 0.6, source: 'live' },
  }
}

describe('terminal commands', () => {
  it('ls lists essays by default and projects on request', async () => {
    const ctx = makeCtx()
    expect(await execute('ls', ctx)).toEqual(['2025-11-30  丘陵  # 随州 · 雨'])
    expect(await execute('ls projects', ctx)).toEqual(['2026  地形志  # Vue'])
  })
  it('cat navigates and closes', async () => {
    const ctx = makeCtx()
    await execute('cat 丘陵', ctx)
    expect(ctx.navigate).toHaveBeenCalledWith('/essays/丘陵')
    expect(ctx.close).toHaveBeenCalled()
    expect(await execute('cat 不存在', ctx)).toEqual(['cat: 不存在: No such file'])
  })
  it('theme, seed and weather write through the context', async () => {
    const ctx = makeCtx()
    await execute('theme dark', ctx)
    expect(ctx.setTheme).toHaveBeenCalledWith('dark')
    await execute('seed 0x1234', ctx)
    expect(ctx.setManual).toHaveBeenCalledWith({ seed: 0x1234 })
    await execute('weather 雪', ctx)
    expect(ctx.setManual).toHaveBeenCalledWith({ weather: 'snow' })
    expect(await execute('weather', ctx)).toEqual(['北京 · 雨 · 秋 · 实时 · intensity 0.6'])
  })
  it('clear returns the clear sentinel and unknown commands hint help', async () => {
    const ctx = makeCtx()
    expect(await execute('clear', ctx)).toEqual({ clear: true })
    expect(await execute('rm -rf /', ctx)).toEqual(['rm: command not found. 试试 help'])
    expect(await execute('sudo', ctx)).toEqual(['你没有权限，去找老王。'])
  })
})
```

Run: `npx vitest run tests/unit/terminal-commands.test.ts` → 全部通过（命令已写好，此测试主要锁定行为）。

- [ ] **Step 7: 写 `src/terminal/Terminal.vue`**

```vue
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { loadEssays } from '@/content/essays'
import { loadProjects } from '@/content/projects'
import { useTheme } from '@/theme/theme'
import { useTerrainParams } from '@/weather/terrainParams'
import { complete } from './parse'
import { commands, execute } from './registry'
import type { TerminalContext } from './types'

const open = ref(false)
const input = ref('')
const lines = ref<string[]>(['地形志 terminal · 输入 help'])
const history: string[] = []
let historyIndex = -1
const inputEl = ref<HTMLInputElement>()
const bodyEl = ref<HTMLElement>()

const router = useRouter()
const { setTheme } = useTheme()
const { params, setManual } = useTerrainParams()

function ctx(): TerminalContext {
  return {
    essays: loadEssays(), projects: loadProjects(),
    navigate: p => { void router.push(p) },
    setTheme, params: params.value, setManual,
    close: () => { open.value = false },
  }
}

async function toggle() {
  open.value = !open.value
  if (open.value) { await nextTick(); inputEl.value?.focus() }
}

async function submit() {
  const cmd = input.value
  input.value = ''
  if (cmd.trim()) { history.push(cmd); historyIndex = history.length }
  lines.value.push(`$ ${cmd}`)
  const out = await execute(cmd, ctx())
  if (Array.isArray(out)) lines.value.push(...out)
  else lines.value = []
  await nextTick()
  bodyEl.value?.scrollTo({ top: bodyEl.value.scrollHeight })
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { open.value = false; return }
  if (e.key === 'Tab') {
    e.preventDefault()
    const c = complete(input.value, commands, ctx())
    if (c.length === 1) input.value = c[0] + (c[0].includes(' ') ? '' : ' ')
    else if (c.length > 1) lines.value.push(c.join('   '))
    return
  }
  if (e.key === 'ArrowUp' && history.length) { historyIndex = Math.max(0, historyIndex - 1); input.value = history[historyIndex]; e.preventDefault() }
  if (e.key === 'ArrowDown') { historyIndex = Math.min(history.length, historyIndex + 1); input.value = history[historyIndex] ?? ''; e.preventDefault() }
}

function onGlobalKey(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  if (e.key === '~' && (!typing || target === inputEl.value)) { e.preventDefault(); void toggle() }
}

onMounted(() => { if (matchMedia('(pointer: fine)').matches) window.addEventListener('keydown', onGlobalKey) })
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKey))
</script>

<template>
  <Transition name="term">
    <section v-if="open" class="term mono" role="dialog" aria-label="terminal">
      <div ref="bodyEl" class="term-body" @click="inputEl?.focus()">
        <div v-for="(l, i) in lines" :key="i" class="term-line">{{ l }}</div>
        <div class="term-prompt">$ <input ref="inputEl" v-model="input" type="text" spellcheck="false" autocomplete="off" @keydown="onKey" @keydown.enter="submit"></div>
      </div>
    </section>
  </Transition>
</template>

<style scoped>
.term { position: fixed; left: 0; right: 0; bottom: 0; height: 40vh; background: color-mix(in srgb, #151A20 92%, transparent); color: #E6E0D4; border-top: 1px solid #2c3540; backdrop-filter: blur(8px); z-index: 50; font-size: 13px; }
.term-body { height: 100%; overflow-y: auto; padding: 16px 24px; }
.term-line { white-space: pre-wrap; line-height: 1.7; }
.term-prompt { display: flex; gap: 6px; line-height: 1.7; }
.term-prompt input { flex: 1; background: none; border: 0; outline: 0; color: inherit; font: inherit; caret-color: #D9A441; }
.term-enter-active, .term-leave-active { transition: transform .25s ease, opacity .25s ease; }
.term-enter-from, .term-leave-to { transform: translateY(100%); opacity: 0; }
</style>
```

终端面板始终是雨夜色，不跟主题变，spec 4.6 如此规定。

- [ ] **Step 8: 挂到 `App.vue`**

`<script setup>` 加 `import Terminal from '@/terminal/Terminal.vue'`；模板 `<RouterView>` 之后加 `<ClientOnly><Terminal /></ClientOnly>`（`ClientOnly` 由 vite-ssg 全局注册，SSR 时不渲染终端）。

- [ ] **Step 9: 手动验收**

```bash
npm run dev
```

任意页面按 `~`：面板升起并聚焦；`help` 列命令；`ls`；`cat 丘` 按 Tab 补全成 `cat 丘陵`，回车跳转并关闭；`~` 再开，`↑` 找回上一条；`theme light`、`seed random`、`weather 雪` 生效；`clear`；`sudo`；Esc 关闭。在文章页 `~` 也能开。

- [ ] **Step 10: 提交**

```bash
npm test
git add -A
git commit -m "feat: terminal easter egg with command registry and completion"
```

---

### Task 13: Playwright 端到端测试与移动端收尾

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/site.spec.ts`
- Modify: `package.json`（scripts）, `.github/workflows/deploy.yml`（跑 e2e）, `src/styles/base.css`（移动端字号）
- Test: 本任务本身就是测试

**Interfaces:**
- Consumes: 全站已完成的页面与 `data-theme`、`.toc-row`、`.essay-body`、`.term`、`.legend` 等类名。

- [ ] **Step 1: 安装 Playwright**

```bash
npm i -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: 写 `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 60_000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
```

`preview` 服务的是 `dist/`，所以运行前要先 `npm run build`。

- [ ] **Step 3: 写 `tests/e2e/site.spec.ts`**

```ts
import { expect, test } from '@playwright/test'

test('home renders legend and entrances', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.legend')).toBeVisible()
  await expect(page.locator('.legend-row')).toHaveCount(3)
  await page.locator('.legend-row').first().click()
  await expect(page).toHaveURL(/\/essays$/)
})

test('essay list links to a prerendered essay page', async ({ page }) => {
  await page.goto('/essays')
  const rows = page.locator('.toc-row')
  await expect(rows).toHaveCount(8)
  await rows.first().click()
  await expect(page.locator('.essay-body p').first()).toBeVisible()
  await expect(page.locator('.meta-line')).toContainText('//')
})

test('essay page is server-rendered (no JS)', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false })
  const page = await ctx.newPage()
  await page.goto('/essays')
  await expect(page.locator('.toc-row')).toHaveCount(8)
  await ctx.close()
})

test('theme toggle flips data-theme and persists', async ({ page }) => {
  await page.goto('/essays')
  const html = page.locator('html')
  const before = await html.getAttribute('data-theme')
  await page.locator('.theme-toggle').click()
  const after = await html.getAttribute('data-theme')
  expect(after).not.toBe(before)
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', after!)
})

test('terminal opens with ~ and runs ls', async ({ page, isMobile }) => {
  test.skip(isMobile, 'no keyboard shortcut on touch devices')
  await page.goto('/about')
  await page.keyboard.press('Shift+`')
  await expect(page.locator('.term')).toBeVisible()
  await page.keyboard.type('ls')
  await page.keyboard.press('Enter')
  await expect(page.locator('.term-line').last()).toContainText('#')
  await page.keyboard.press('Escape')
  await expect(page.locator('.term')).toHaveCount(0)
})

test('projects expand inline', async ({ page }) => {
  await page.goto('/projects')
  await page.locator('.proj-row').first().click()
  await expect(page.locator('.proj-detail')).toBeVisible()
})

test('visual: essay page', async ({ page }) => {
  await page.goto('/essays')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page).toHaveScreenshot('essays.png', { maxDiffPixelRatio: 0.02 })
})
```

`Shift+\`` 在 Playwright 里产生 `~` 键事件。截图基线第一次运行用 `--update-snapshots` 生成并提交。

- [ ] **Step 4: 加 scripts**

`package.json`：

```json
"test:e2e": "npm run build && playwright test",
"test:e2e:update": "npm run build && playwright test --update-snapshots"
```

- [ ] **Step 5: 生成基线并运行**

```bash
npm run test:e2e:update
npm run test:e2e
```

Expected: 全部通过（mobile 项目里 terminal 用例 skipped）。若截图在你机器和 CI 之间抖动，把 `maxDiffPixelRatio` 提到 0.05 或删掉这个用例；不要为了通过而降低其他断言。

- [ ] **Step 6: 移动端排版收尾**

`src/styles/base.css` 末尾加：

```css
@media (max-width: 640px) {
  .page { padding: 32px 20px 72px; }
  .essay-title { font-size: 34px; }
  .essay-body p { font-size: 16px; }
  .site-nav { padding: 16px 20px; }
}
```

在 Playwright mobile 项目下重跑 `npm run test:e2e`，并用浏览器的设备模拟看一遍首页：图例卡贴底占满宽度，地形用低质量网格，滚动仍控制高度。

- [ ] **Step 7: CI 跑 e2e**

`.github/workflows/deploy.yml` 的 `build` job 中，`- run: npm test` 之后加：

```yaml
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
        env:
          BASE_PATH: /
```

注意此处 e2e 在 `BASE_PATH=/` 下跑，与随后带子路径的正式构建是两次 build；`npm run test:e2e` 脚本已含 build，所以这里直接用 `npx playwright test` 前需先有一次 `BASE_PATH=/ npm run build`。把这一段改成：

```yaml
      - run: npx playwright install --with-deps chromium
      - run: BASE_PATH=/ npm run build && npx playwright test
```

然后原有的 `npm run build`（带计算出的 BASE_PATH）照常执行产出部署产物。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "test: playwright e2e across desktop and mobile, responsive polish"
```

---

## 自查记录

**Spec 覆盖：**

| Spec 章节 | 任务 |
|---|---|
| 3.1 主题两套色值、系统偏好、手动开关、localStorage | Task 2 |
| 3.2 字体：思源宋体子集化、JetBrains Mono、回退栏 | Task 6, Task 2 |
| 3.3 动效原则、reduced-motion | Task 10, 11 |
| 4.1 首页：线框地形、图例卡、标记点、开场动画、滚轮镜头、视差、天气粒子 | Task 8, 9, 10 |
| 4.2 文章列表：目录版式 | Task 4 |
| 4.3 正文页：注释头、导语、段落淡入、海拔、上一篇下一篇 | Task 4, 11 |
| 4.4 项目页：ls -la、原地展开 | Task 5 |
| 4.5 关于页：whoami、链接 | Task 5 |
| 4.6 终端：命令、历史、补全、快捷键隔离 | Task 12 |
| 5.1 内容源与头部字段 | Task 3 |
| 5.2 天气：Open-Meteo、映射、降级、手动覆盖 | Task 7 |
| 6.1 目录、6.2 模块边界 | 全部任务遵循文件结构总览 |
| 6.3 性能与降级：子集化、离开首页销毁、静态图、移动端低质量、触屏无终端入口 | Task 6, 10, 12, 13 |
| 6.4 错误处理：天气失败、头部缺字段、未知命令 | Task 7, 3, 12；shader 编译失败一项因改为 CPU 高度场而不再适用，由 WebGL 不可用降级覆盖 |
| 6.5 测试：Vitest 纯函数、Playwright 渲染与截图 | 各任务 + Task 13 |
| 6.6 部署：Actions、base 路径、.gitignore | Task 6, 1 |

**类型一致性检查：** `TerrainParams` 字段在 Task 7、10、12 一致；`MarkerId` 在 Task 8、10 一致；`TerrainScene.setWeather(state, season, intensity)` 在 Task 8 定义、Task 9 实现、Task 10 调用参数顺序一致；`TerminalContext.params` 是 `TerrainParams` 值而不是 Ref，Task 12 的 `ctx()` 每次调用时取 `params.value`，与命令实现一致。

**已知取舍：** 开场动画的大字滑入使用两个 DOM 元素测量矩形后补间，若窗口在动画中被缩放会有偏差，可接受。`Essay.vue` 的 `<Altitude />` 是 `position: fixed`，与 `.home { position: fixed }` 不会同时出现。

<!-- END -->
