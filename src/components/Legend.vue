<script setup lang="ts">
import { onMounted, ref } from "vue";
import MetaLine from "@/components/MetaLine.vue";
import ParamPanel from "@/components/ParamPanel.vue";
import type { MarkerId } from "@/terrain/heightfield";
import type { TerrainParams } from "@/weather/terrainParams";

const props = defineProps<{
	essayCount: number;
	projectCount: number;
	params: TerrainParams;
	intro: boolean;
}>();
const emit = defineEmits<{
	navigate: [id: MarkerId];
	hover: [id: MarkerId | null];
}>();
const showPanel = ref(false);

const zhWeather = {
	clear: "晴",
	cloudy: "阴",
	rain: "雨",
	snow: "雪",
} as const;
const zhSource = { live: "实时", default: "默认", manual: "手动" } as const;
// 日期按北京时区算，且必须在客户端算：预渲染会把构建当天的 UTC 日期焊死在 HTML 里。
// MetaLine 会跳过空串，所以 SSR 输出 `// 北京 · 晴 · 默认`，挂载后再补上日期。
const today = ref("");
onMounted(() => {
	today.value = new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Asia/Shanghai",
	}).format(new Date());
});
const rows: { id: MarkerId; glyph: string; label: string; path: string }[] = [
	{ id: "essays", glyph: "●", label: "文章", path: "essays/" },
	{ id: "projects", glyph: "▲", label: "项目", path: "projects/" },
	{ id: "about", glyph: "□", label: "关于", path: "whoami" },
];
function count(id: MarkerId) {
	return id === "essays"
		? props.essayCount
		: id === "projects"
			? props.projectCount
			: "";
}
</script>

<template>
	<aside class="legend">
		<div class="mono legend-title">LEGEND · 图例</div>
		<div
			class="legend-name"
			:style="{ visibility: intro ? 'hidden' : 'visible' }">
			Scream
		</div>
		<div class="legend-rows">
			<button
				v-for="r in rows"
				:key="r.id"
				type="button"
				class="legend-row"
				@click="emit('navigate', r.id)"
				@mouseenter="emit('hover', r.id)"
				@mouseleave="emit('hover', null)">
				<span
					class="glyph"
					:data-id="r.id"
					>{{ r.glyph }}</span
				>
				{{ r.label }}
				<span class="mono"
					>{{ r.path }}
					<template v-if="count(r.id) !== ''"
						>· {{ count(r.id) }}</template
					></span
				>
			</button>
		</div>
		<div class="legend-meta">
			<MetaLine
				:parts="[
					today,
					'北京',
					zhWeather[params.weather],
					zhSource[params.source],
				]" />
			<button
				type="button"
				class="mono legend-toggle"
				@click="showPanel = !showPanel">
				seed {{ "0x" + params.seed.toString(16).padStart(4, "0") }}
				{{ showPanel ? "▴" : "▾" }}
			</button>
		</div>
		<ParamPanel v-if="showPanel" />
	</aside>
</template>

<style scoped>
.legend {
	position: absolute;
	left: 48px;
	bottom: 48px;
	width: 300px;
	padding: 22px 24px;
	background: color-mix(in srgb, var(--bg) 88%, transparent);
	border: 1px solid var(--line);
	backdrop-filter: blur(6px);
}
.legend-title {
	margin-bottom: 10px;
}
.legend-name {
	font-size: 30px;
	font-weight: 600;
	letter-spacing: 0.12em;
	margin-bottom: 14px;
}
.legend-rows {
	display: grid;
	gap: 2px;
}
.legend-row {
	display: flex;
	align-items: baseline;
	gap: 8px;
	background: none;
	border: 0;
	padding: 4px 0;
	color: inherit;
	font: inherit;
	font-size: 15px;
	text-align: left;
	cursor: pointer;
}
.legend-row:hover {
	color: var(--accent);
}
.glyph[data-id="essays"] {
	color: var(--accent);
}
.glyph[data-id="projects"] {
	color: var(--muted);
}
.legend-meta {
	margin-top: 14px;
	padding-top: 10px;
	border-top: 1px solid var(--line);
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.legend-toggle {
	background: none;
	border: 0;
	padding: 0;
	text-align: left;
	cursor: pointer;
}
.legend-toggle:hover {
	color: var(--accent);
}
@media (max-width: 640px) {
	.legend {
		left: 16px;
		right: 16px;
		bottom: 16px;
		width: auto;
	}
}
</style>
