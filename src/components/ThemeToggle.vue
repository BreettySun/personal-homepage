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
