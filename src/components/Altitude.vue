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
