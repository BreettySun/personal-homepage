<script setup lang="ts">
import { useTerrainParams } from "@/weather/terrainParams";
import type { Season, WeatherState } from "@/weather/openMeteo";

const { params, setManual, clearManual } = useTerrainParams();
const weathers: WeatherState[] = ["clear", "cloudy", "rain", "snow"];
const seasons: Season[] = ["spring", "summer", "autumn", "winter"];
const zh = {
	clear: "晴",
	cloudy: "阴",
	rain: "雨",
	snow: "雪",
	spring: "春",
	summer: "夏",
	autumn: "秋",
	winter: "冬",
} as const;

function reseed() {
	setManual({ seed: Math.floor(Math.random() * 0xffff) });
}
function hex(n: number) {
	return "0x" + n.toString(16).padStart(4, "0");
}
</script>

<template>
	<div class="panel mono">
		<div class="row">
			<span>weather</span>
			<span class="opts"
				><button
					v-for="w in weathers"
					:key="w"
					type="button"
					:class="{ on: params.weather === w }"
					@click="setManual({ weather: w })">
					{{ zh[w] }}
				</button></span
			>
		</div>
		<div class="row">
			<span>season</span>
			<span class="opts"
				><button
					v-for="s in seasons"
					:key="s"
					type="button"
					:class="{ on: params.season === s }"
					@click="setManual({ season: s })">
					{{ zh[s] }}
				</button></span
			>
		</div>
		<div class="row">
			<span>intensity</span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.05"
				:value="params.intensity"
				@input="
					setManual({
						intensity: Number(($event.target as HTMLInputElement).value),
					})
				" />
			<b>{{ params.intensity.toFixed(2) }}</b>
		</div>
		<div class="row">
			<span>seed</span
			><button
				type="button"
				class="link"
				@click="reseed">
				{{ hex(params.seed) }} ↻
			</button>
		</div>
		<div
			v-if="params.source === 'manual'"
			class="row">
			<button
				type="button"
				class="link"
				@click="clearManual">
				reset → live
			</button>
		</div>
	</div>
</template>

<style scoped>
.panel {
	display: grid;
	gap: 6px;
	padding-top: 10px;
	margin-top: 10px;
	border-top: 1px solid var(--line);
	font-size: 11px;
}
.row {
	display: flex;
	align-items: center;
	gap: 10px;
}
.row > span:first-child {
	width: 64px;
	color: var(--muted);
}
.opts {
	display: flex;
	gap: 4px;
}
button {
	background: none;
	border: 1px solid var(--line);
	color: var(--muted);
	font: inherit;
	padding: 1px 6px;
	border-radius: 2px;
	cursor: pointer;
}
button.on,
button:hover {
	color: var(--accent);
	border-color: var(--accent);
}
button.link {
	border: 0;
	padding: 0;
}
input[type="range"] {
	width: 80px;
	accent-color: var(--accent);
}
b {
	color: var(--accent);
	font-weight: 400;
}
</style>
