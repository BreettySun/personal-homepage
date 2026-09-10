# 地形志

个人主页。首页是一片按北京实时天气变化的线框地形（Three.js 线段绘制，无 WebGL 或用户要求减少动效时退回静态 SVG），点图例上的三个标记进入文章、项目和关于页；内容页是纸感排版的散文。全站用 Vite + Vue 3 + vue-router，由 vite-ssg 把每个路由（含每篇文章）预渲染成静态 HTML，部署在 GitHub Pages。`content/` 下的 Markdown 在构建时被解析成纯数据，页面和终端都读这一份。

## 脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地开发服务器 |
| `npm run build` | 预渲染构建到 `dist/`（`prebuild` 会先跑一次字体子集化，结果缓存在 `.cache/fonts`） |
| `npm run preview` | 预览 `dist/` |
| `npm test` | Vitest 单元测试 |
| `npm run test:e2e` | 构建后跑 Playwright（desktop + mobile 两套） |
| `npm run test:e2e:update` | 同上，并刷新视觉快照基线 |
| `npm run fonts` | 单独跑 Noto Serif SC 子集化 |
| `npm run typecheck` | vue-tsc 类型检查 |

## 加一篇文章

在 `content/essays/` 下新建 `<slug>.md`，**文件名就是 slug**，也就是 URL（`/essays/<slug>`，中文文件名直接用中文，不要自己转义）。头部字段：

```markdown
---
title: 丘陵
date: 2025-11-30
city: 随州
weather: 雨
summary: 可选，不写就取正文第一句
---

正文第一段……
```

`title` / `date` / `city` / `weather` 必填，缺一个构建就会失败并报出文件名；`date` 必须是 `YYYY-MM-DD`。不写 `summary` 时摘要取正文第一句；如果第一段正好就是这一句，渲染正文时会把这段去掉，避免页面上重复（写了 `summary` 则正文原样保留）。

## 加一个项目

`content/projects/<slug>.md`，头部 `name`、`tagline`、`stack: [a, b]`、`year` 必填，`github`、`url`、`cover` 可选。

## 关于页

`content/about.md`，头部只有 `links: [标签|地址, 标签|地址]`，正文是 Markdown。

## 头部解析器的限制

自写的 40 行解析器（`src/content/frontmatter.ts`），只认平铺的 `key: value` 和 `key: [a, b]`：不支持嵌套、多行值、注释以外的 YAML 语法，数组按逗号硬切，**所以值里不能带逗号**（引号也救不了）。Markdown 用 markdown-it 渲染，`html: false`，正文里的原始 HTML 会被转义。

## 主题 / 天气 / 终端

- 主题：宣纸（浅）与雨夜（深）两套 CSS 变量，右上角开关切换，选择存在 `localStorage`；没选过时跟随系统 `prefers-color-scheme`。
- 天气：启动后拉一次 Open-Meteo 的北京实时天气，WMO 代码映射成 晴/阴/雨/雪 四态，请求失败就按当前季节取默认天气；图例里的参数面板或终端可以手动覆盖，覆盖值存在 `localStorage`。
- 终端：桌面端按 `~` 呼出／收起（输入框里已经有字时 `~` 正常输入，方便打 `cd ~`），`Esc` 关闭。
- 终端命令：`help` 列出全部（`ls`、`cat`、`cd`、`whoami`、`weather`、`seed`、`theme`、`clear`），支持 Tab 补全和上下键历史。

## 部署

推到 `main` 由 `.github/workflows/deploy.yml` 自动构建并发布到 GitHub Pages。仓库 Settings → Pages 的 Source 必须选 **GitHub Actions**。`BASE_PATH` 由仓库名推出：`<user>.github.io` 用 `/`，其它仓库用 `/<repo>/`；e2e 那一步单独用 `BASE_PATH=/`，因为它自己起 `vite preview`。

## 测试说明

Playwright 里的视觉快照（`visual: essay page`）只在本地跑：仓库里只有 darwin 基线，CI 上会跳过。移动端项目会跳过终端那条用例（触屏没有键盘快捷键）。
