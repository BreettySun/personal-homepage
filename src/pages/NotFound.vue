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
		<div class="nf-container">
			<span class="mono nf-cmd">
				$ cd{{ requested ? " " + requested : "" }}
			</span>
			<span class="mono nf-err">cd: no such file or directory</span>
			<span class="mono nf-meta">// 404</span>
			<span class="mono nf-meta">// 生活有时如此荒谬，有时如此真实</span>
			<p class="mono nf-links">
				<RouterLink to="/">cd /home</RouterLink>
			</p>
		</div>
	</main>
</template>

<style scoped>
.not-found {
	display: flex;
	align-items: center;
	justify-content: center;
	height: calc(100vh - 120px);
}
.nf-container {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 6px;
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
	font-size: 14px;
	letter-spacing: 0.06em;
}
.nf-links a:hover {
	color: var(--accent);
}
</style>
