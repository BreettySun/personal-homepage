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
