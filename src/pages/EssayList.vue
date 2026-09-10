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
