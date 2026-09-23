<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import Legend from "@/components/Legend.vue";
import TerrainCanvas from "@/components/TerrainCanvas.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import { loadEssays } from "@/content/essays";
import { loadProjects } from "@/content/projects";
import type { MarkerId } from "@/terrain/heightfield";
import { prefersReducedMotion, supportsWebGL } from "@/terrain/support";
import { useTerrainParams } from "@/weather/terrainParams";

useHead({ title: "Scream · Terrain" });
const router = useRouter();
const { params, loadLive } = useTerrainParams();
const essayCount = loadEssays().length;
const projectCount = loadProjects().length;

const use3d = ref(false);
/**
 * 静态地形垫在画布下面，场景建好之前一直在（建不起来就一直留着），不留空白帧；和 use3d 一样
 * 从 false 起步，SSR 与客户端首帧一致。开场动画期间它不跟着撤，而是随地形铺开的进度淡出，播完再撤。
 */
const sceneReady = ref(false);
const hovered = ref<MarkerId | null>(null);
const opacity = ref(1);
const intro = ref(false);
const introName = ref<HTMLElement>();
const legendEl = ref<InstanceType<typeof Legend>>();

const paths: Record<MarkerId, string> = {
	essays: "/essays",
	projects: "/projects",
	about: "/about",
};
function go(id: MarkerId) {
	router.push(paths[id]);
}

/** 开场动画结束（或失败）后一定要把地形亮回来，避免卡在 opacity 0。 */
function endIntro() {
	intro.value = false;
	opacity.value = 1;
}

async function playIntro() {
	let gsap: (typeof import("gsap"))["gsap"];
	try {
		({ gsap } = await import("gsap"));
	} catch {
		endIntro();
		return;
	}
	await nextTick();
	const from = introName.value;
	const to = legendEl.value?.$el.querySelector(
		".legend-name",
	) as HTMLElement | null;
	if (!from || !to) {
		endIntro();
		return;
	}
	gsap.set(from, { xPercent: -50, yPercent: -50 });
	const a = from.getBoundingClientRect(),
		b = to.getBoundingClientRect();
	const tl = gsap.timeline({
		onComplete() {
			endIntro();
			from.style.visibility = "hidden";
		},
	});
	tl.fromTo(
		from,
		{ opacity: 0, y: 20 },
		{ opacity: 1, y: 0, duration: 0.9, ease: "power2.out" },
	)
		.to(opacity, { value: 1, duration: 1.2, ease: "power1.inOut" }, 0.2)
		.to(
			from,
			{
				x: b.left - (a.left + a.width / 2),
				y: b.top - (a.top + a.height / 2),
				xPercent: 0,
				yPercent: 0,
				scale: b.height / a.height,
				transformOrigin: "top left",
				duration: 0.9,
				ease: "power3.inOut",
			},
			"+=0.6",
		);
}

onMounted(() => {
	use3d.value = supportsWebGL() && !prefersReducedMotion();
	void loadLive();
	const played = (() => {
		try {
			return sessionStorage.getItem("introPlayed") === "1";
		} catch {
			return true;
		}
	})();
	if (use3d.value && !played) {
		intro.value = true;
		opacity.value = 0;
		try {
			sessionStorage.setItem("introPlayed", "1");
		} catch {
			/* ignore */
		}
	}
});
function onSceneReady() {
	sceneReady.value = true;
	if (intro.value) void playIntro();
}
/** 地形建不起来：退回静态图，并保证开场动画不会把图例名字留在隐藏状态。 */
function onSceneFailed() {
	use3d.value = false;
	endIntro();
}
</script>

<template>
	<main class="home">
		<Transition name="fallback">
			<div
				v-if="!sceneReady || intro"
				class="fallback"
				:style="intro ? { '--reveal': opacity } : undefined"
				aria-hidden="true" />
		</Transition>
		<TerrainCanvas
			v-if="use3d"
			:class="{ 'is-ready': sceneReady }"
			:hovered="hovered"
			:opacity="opacity"
			@hover="hovered = $event"
			@select="go"
			@ready="onSceneReady"
			@failed="onSceneFailed" />
		<div
			v-if="intro"
			ref="introName"
			class="intro-name">
			Scream
		</div>
		<Legend
			ref="legendEl"
			:essay-count="essayCount"
			:project-count="projectCount"
			:params="params"
			:intro="intro"
			:hovered="hovered"
			@navigate="go"
			@hover="hovered = $event" />
		<div class="home-theme"><ThemeToggle /></div>
		<div class="mono hint">scroll · altitude &nbsp;&nbsp; ~ · terminal</div>
	</main>
</template>

<style scoped>
.home {
	position: fixed;
	inset: 0;
	overflow: hidden;
}
/*
 * 静态地形（scripts/render-fallback.mjs 生成）：SVG 只是一张 alpha 遮罩，颜色取 --fg，两套主题都对。
 * cover 在比画幅窄的视口上只裁两边，和固定竖直视角的实时相机看到的一致。
 * 开场动画期间 --reveal 是地形的铺开进度，静态图随之淡出。
 */
.fallback {
	position: absolute;
	top: 0;
	left: 0;
	width: calc(var(--pixel-ratio, 1) * 100%);
	height: calc(var(--pixel-ratio, 1) * 100%);
	transform: scale(calc(1 / var(--pixel-ratio, 1)));
	transform-origin: 0 0;
	background-color: var(--fg);
	-webkit-mask: url(/terrain-fallback.svg) center / cover no-repeat;
	mask: url(/terrain-fallback.svg) center / cover no-repeat;
	opacity: calc(1 - var(--reveal, 0));
}
/*
 * WebGL 的线永远是 1 个设备像素（场景的 pixelRatio 封顶 2），SVG 里 1px 的描边在高分屏上却是
 * 2 个设备像素，粗一倍。所以按 pixelRatio 倍大排版、再缩回来，描边落到屏幕上正好 1 个设备像素。
 */
@media (min-resolution: 1.5dppx) {
	.fallback {
		--pixel-ratio: 1.5;
	}
}
@media (min-resolution: 2dppx) {
	.fallback {
		--pixel-ratio: 2;
	}
}
/* 窄屏或触屏上实时场景用 low 档（见 TerrainCanvas.vue），行距不同，静态图换成对应的那张 */
@media (max-width: 767px), (pointer: coarse) {
	.fallback {
		-webkit-mask-image: url(/terrain-fallback-low.svg);
		mask-image: url(/terrain-fallback-low.svg);
	}
}
/* 静态图淡出、画布淡入，同一个节奏 */
.fallback-leave-active,
.terrain-canvas {
	transition: opacity 0.6s ease;
}
.fallback-leave-to,
.terrain-canvas:not(.is-ready) {
	opacity: 0;
}
.intro-name {
	position: absolute;
	z-index: 2;
	left: 50%;
	top: 45%;
	font-size: clamp(48px, 16vw, 96px);
	font-weight: 600;
	letter-spacing: 0.14em;
	white-space: nowrap;
	opacity: 0;
	will-change: transform;
}
.home-theme {
	position: absolute;
	top: 20px;
	right: 24px;
}
.hint {
	position: absolute;
	right: 24px;
	bottom: 20px;
}
/* 触屏上没有滚轮和键盘；窄窗口里它会压到图例上 */
@media (pointer: coarse), (max-width: 640px) {
	.hint {
		display: none;
	}
}
</style>
