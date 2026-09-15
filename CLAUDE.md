# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Hard rules

- **Never run git commands that change state on your own** — no `git add`, `commit`, `push`, `branch`, `checkout`, `reset`, `stash`, `rebase`, `merge`, `tag`, or `remote` changes — unless the user explicitly asks for that specific action in the current message. Read-only inspection (`git status`, `git log`, `git diff`, `git show`) is fine. Finishing a task means leaving the changes in the working tree and reporting them; the user decides when and how they are committed.

## Commands

```bash
npm run dev                                   # Vite dev server
npm test                                      # Vitest unit tests (tests/unit/**/*.test.ts, jsdom)
npx vitest run tests/unit/essays.test.ts      # one test file
npx vitest run -t "groupByYear"               # tests matching a name
npm run typecheck                             # vue-tsc --noEmit
npm run build                                 # prebuild (font subsetting) → vite-ssg build → postbuild (dist/404.html)
npm run test:e2e                              # build + Playwright (projects: desktop, mobile)
npx playwright test -g "terminal" --project=desktop   # one e2e test
npm run test:e2e:update                       # refresh visual snapshot baselines (darwin only)
```

The first `npm run build` downloads two ~24 MB Noto Serif CJK OTFs into `.cache/fonts/` (git-ignored); later builds reuse them. The Playwright visual test is skipped when `CI` is set. Design spec and the original implementation plan live in `docs/superpowers/`; content-authoring rules (frontmatter fields, parser limits) are in `README.md`.

## Architecture

Vite 8 + Vue 3.5 + vue-router 5, prerendered with **vite-ssg** (`dirStyle: 'nested'`) and served from GitHub Pages. Everything a page needs is computed at build time from `content/`; the browser only adds weather, WebGL and interactivity.

**Content pipeline (`src/content/`)** is UI-free. `import.meta.glob('/content/essays/*.md', { query: '?raw', eager: true })` feeds `parseEssay(raw, filePath)`; a hand-written `frontmatter.ts` (flat `key: value` / `key: [a, b]` only, deliberately not gray-matter) plus markdown-it (`html: false`) produce the `Essay`/`Project`/`About` types in `types.ts`. Missing required fields throw with the file path so the build fails loudly. The filename is the slug and the URL; `includedRoutes` in `src/main.ts` expands `/essays/:slug` to one path per essay using the raw (not percent-encoded) slug, filters out the `/:pathMatch(.*)*` fallback, and adds `/404`.

**Terrain (`src/terrain/`)** is the only place that imports `three`. `heightfield.ts` is pure: seeded simplex noise → `Float32Array`, and `heightAt()` uses the same function so the three `MARKERS` sit on the surface. `scene.ts` draws it as `LineSegments` (one polyline per grid row, contour look) and exposes a small `TerrainScene` API. Two anti-moiré measures live here and must stay: `rowZ()` jitters each row's z by ±15 % of the spacing (seeded, edge rows fixed) so the row period cannot beat against the pixel grid, and `installRowThinning()` patches the line shader (`onBeforeCompile`) with a per-vertex `aLevel` attribute from `rowLevel()` so odd rows fade out with view depth and every-other-even row fades further out — a mipmap for lines; `THIN_DEPTH` thresholds are calibrated for an 800 px viewport and 120 rows and rescaled in `resize()`. Fog and colour tweaks do not fix moiré (they only lower its contrast); density does. (`setSeed/setColors/setAltitude/setPointer/setWeather/pickMarker/setHovered/setOpacity/dispose`). `atmosphere.ts` is a pure table: per weather state → fog near/far, haze (fog colour blended toward `--muted`) and a line-opacity factor; `scene.ts` eases toward it every frame and multiplies it with the intro's `setOpacity`, so clear vs cloudy differ even though neither has particles. `particles.ts` renders rain as short `LineSegments` streaks (points fell too fast to read) and adds rising `catkins` on spring clear days; `FALL_SPEED`, `CATKIN_RISE` and `RAIN_STREAK` are the knobs. `clouds.ts` is a separate layer, not a particle kind: translucent horizontal patches (canvas radial-gradient texture) drifting above the terrain on any cloudy day, opacity eased and scaled by `intensity`, kept between `AMPLITUDE` and `ALTITUDE.min` so the camera never sits inside them. `camera.ts` owns `ALTITUDE` and the pure wheel/pointer math so `TerrainCanvas.vue` can import it statically while `scene.ts` is only ever `import()`ed inside `onMounted` — keep it that way, or three.js lands in the Home chunk and in SSR.

**Terrain parameters flow one way.** `src/weather/terrainParams.ts` is a module-level singleton (`useTerrainParams()`) holding `{ weather, season, seed, intensity, source }`. Open-Meteo (`openMeteo.ts`), the legend's `ParamPanel`, and terminal commands all *write* to it via `setManual`/`applyLive`; `TerrainCanvas.vue` *watches* it and calls the scene API. Nothing else touches the scene. Manual overrides win over live/default and persist in `localStorage['terrain.override']`.

**Theme** (`src/theme/theme.ts`) only sets `data-theme` on `<html>` and `localStorage['theme']`; all colors are CSS variables in `src/styles/tokens.css` (宣纸 light / 雨夜 dark). The inline script in `index.html` applies the theme before paint. The terrain reads colors through `getComputedStyle`, so new colors must be variables, never literals.

**Terminal** (`src/terminal/`) is a command registry: one file per command in `commands/`, each `{ name, usage, description, run(args, ctx), complete? }`; `registry.ts` aggregates them and `parse.ts` does tokenizing and Tab completion. `help.ts` imports `commands` from the registry (a deliberate, run-time-safe circular import). Add a command by adding a file and listing it in `registry.ts`. The panel is always dark-colored on purpose and is mounted in `App.vue` inside `<ClientOnly>`.

**SSR/hydration rules that bite.** Anything browser-only must resolve after mount and render identically on server and first client paint: `use3d` starts `false` so SSR emits the `img.fallback` and the canvas appears after mount; the legend date and the 404 page's requested path start as `''` and are filled in `onMounted`; `MetaLine` skips empty parts so this stays invisible. `App.vue` sets `useHead({ htmlAttrs: { lang: 'zh-CN' } })` because unhead's SSR default is `en`. The routed `<component>` carries `:key="$route.fullPath"` so essay→essay navigation transitions and remounts (which re-arms the paragraph-reveal observer).

## Testing conventions

- Pages/components that call `useHead()` must be mounted with `createHead()` from `@unhead/vue/client` in `global.plugins`, plus a memory-history router built from `routes` when they use the router.
- Module-level singletons (`terrainParams`, `theme`) are isolated in tests with `vi.resetModules()` and a fresh dynamic `import()` per test; stub `fetch`/`matchMedia`/`IntersectionObserver` with `vi.stubGlobal` and restore in `afterEach`.
- e2e runs against `vite preview` of `dist/`, which SPA-falls-back to `index.html` for unknown paths and percent-decodes URLs like a real static host; tests that must hit prerendered HTML use a `javaScriptEnabled: false` context and a trailing slash. `page.keyboard.press('~')` (not `Shift+\``) opens the terminal.

## Deployment

`.github/workflows/deploy.yml` computes `BASE_PATH` from the repo name (`/` for `<user>.github.io`, else `/<repo>/`) and exports it via `$GITHUB_ENV`; `vite.config.ts` reads `process.env.BASE_PATH` as `base`. The e2e step must run with its own `env: BASE_PATH: /` because its preview server also reads that variable. Local `npm run build` uses `/`, so a `/personal-homepage/`-prefixed check needs `BASE_PATH=/personal-homepage/ npm run build`.
