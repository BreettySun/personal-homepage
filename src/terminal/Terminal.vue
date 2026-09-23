<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { loadEssays } from '@/content/essays'
import { loadProjects } from '@/content/projects'
import { switchTheme } from '@/theme/transition'
import { useTerrainParams } from '@/weather/terrainParams'
import { complete, displayWidth } from './parse'
import { commands, execute } from './registry'
import type { TerminalContext } from './types'

const open = ref(false)
const input = ref('')
const lines = ref<string[]>(['地形志 terminal · 输入 help'])
const history: string[] = []
let historyIndex = -1
const inputEl = ref<HTMLInputElement>()
const bodyEl = ref<HTMLElement>()
// help 的用法和说明之间是制表符（见 commands/help.ts）：制表位放在最长的用法后面再留三格。
// 不能从 commands/help.ts 引入：它和 registry 是刻意的循环引用，必须先加载 registry。
const tabSize = Math.max(...commands.map(c => displayWidth(c.usage))) + 3

const router = useRouter()
const { params, setManual } = useTerrainParams()

function ctx(): TerminalContext {
  return {
    essays: loadEssays(), projects: loadProjects(),
    navigate: p => { void router.push(p) },
    // 终端里没有点击位置：墨迹从视口中心晕开（面板本身固定深色，不跟主题变）
    setTheme: t => switchTheme(t), params: params.value, setManual,
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
  if (e.key !== '~') return
  const target = e.target as HTMLElement | null
  const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  // 终端自己的输入框里，只有空行时 ~ 才当开关；否则让它正常打出来（`cd ~`）。
  const toggles = !typing || (target === inputEl.value && input.value === '')
  if (!toggles) return
  e.preventDefault()
  void toggle()
}

onMounted(() => { if (matchMedia('(pointer: fine)').matches) window.addEventListener('keydown', onGlobalKey) })
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKey))
</script>

<template>
  <Transition name="term">
    <section v-if="open" class="term mono" role="dialog" aria-label="terminal">
      <div ref="bodyEl" class="term-body" :style="{ tabSize }" @click="inputEl?.focus()">
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
