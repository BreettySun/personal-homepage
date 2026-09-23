<script setup lang="ts">
import { useTheme } from "@/theme/theme";
import { switchTheme } from "@/theme/transition";
const { theme } = useTheme();

/** 墨迹从点击处晕开；键盘触发的 click 没有坐标（detail 为 0），改从按钮中心开始。 */
function onClick(e: MouseEvent) {
	let origin = { x: e.clientX, y: e.clientY };
	if (e.detail === 0) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
	}
	switchTheme(theme.value === "dark" ? "light" : "dark", origin);
}
</script>

<template>
	<button
		class="theme-toggle mono"
		type="button"
		:aria-label="theme === 'dark' ? '切换到浅色' : '切换到深色'"
		@click="onClick">
		{{ theme === "dark" ? "雨夜" : "宣纸" }}
	</button>
</template>

<style scoped>
.theme-toggle {
	background: none;
	border: 1px solid var(--line);
	border-radius: 2px;
	padding: 2px 8px;
	cursor: pointer;
	color: var(--muted);
}
.theme-toggle:hover {
	color: var(--fg);
}
</style>
