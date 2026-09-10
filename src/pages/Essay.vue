<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import MetaLine from '@/components/MetaLine.vue'
import Altitude from '@/components/Altitude.vue'
import { findEssay, loadEssays } from '@/content/essays'
import { useParagraphReveal } from '@/composables/useParagraphReveal'

const route = useRoute()
const essay = computed(() => findEssay(String(route.params.slug)))
const all = loadEssays()
const index = computed(() => all.findIndex(e => e.slug === essay.value?.slug))
const newer = computed(() => (index.value > 0 ? all[index.value - 1] : undefined))
const older = computed(() => (index.value >= 0 && index.value < all.length - 1 ? all[index.value + 1] : undefined))

useHead({ title: computed(() => (essay.value ? `${essay.value.title} · Scream` : '未找到 · Scream')) })

const body = ref<HTMLElement>()
useParagraphReveal(body)

function fmt(n: number) { return n.toLocaleString('en-US') }
</script>

<template>
  <main class="page">
    <article v-if="essay" class="essay">
      <Altitude />
      <header>
        <MetaLine :parts="[essay.date, essay.city, essay.weather, `${fmt(essay.wordCount)} 字`, `${essay.readingMinutes} min`]" />
        <h1 class="essay-title">{{ essay.title }}</h1>
        <p class="essay-lead">{{ essay.summary }}</p>
      </header>
      <div ref="body" class="essay-body" v-html="essay.html" />
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
