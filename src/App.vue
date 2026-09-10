<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import ThemeToggle from '@/components/ThemeToggle.vue'
</script>

<template>
  <header v-if="$route.name !== 'home'" class="site-nav">
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
  <RouterView v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" :key="$route.fullPath" />
    </Transition>
  </RouterView>
</template>

<style>
.site-nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 32px; }
.site-nav__right { display: flex; align-items: center; gap: 24px; }
.site-nav nav { display: flex; gap: 24px; font-size: 14px; letter-spacing: .1em; }
.site-nav a.router-link-active { border-bottom: 1px solid currentColor; }
</style>
