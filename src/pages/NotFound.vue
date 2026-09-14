<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useHead } from "@unhead/vue";

useHead({ title: "404 · Scream" });

// 预渲染的是 /404 这一页，访客真正请求的地址只有在客户端挂载后才知道，
// 所以先渲染空的 `$ cd`，挂载后再补上路径，避免水合不一致。
const route = useRoute();
const requested = ref("");
onMounted(() => {
	requested.value = route.fullPath;
});
</script>

<template>
	<main class="page not-found">
		<span class="mono nf-cmd">$ cd{{ requested ? " " + requested : "" }}</span>
		<span class="mono nf-err">cd: no such file or directory</span>
		<span class="mono nf-meta">// 404 · 这里没有路</span>
		<p class="nf-links">
			<RouterLink to="/">回到地图 →</RouterLink>
			<RouterLink to="/essays">去目录 →</RouterLink>
		</p>
	</main>
</template>

<style scoped>
.not-found {
	max-width: 560px;
	display: flex;
	flex-direction: column;
	gap: 6px;
	min-height: 60vh;
	justify-content: center;
}
.nf-err {
	color: var(--accent);
}
.nf-meta {
	margin-top: 18px;
}
.nf-links {
	display: flex;
	gap: 28px;
	margin-top: 40px;
	font-size: 17px;
	letter-spacing: 0.06em;
}
.nf-links a:hover {
	color: var(--accent);
}
</style>
