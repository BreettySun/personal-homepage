<script setup lang="ts">
import { useHead } from "@unhead/vue";
import { loadAbout } from "@/content/about";

const about = loadAbout();
useHead({ title: "whoami · Scream" });
</script>

<template>
	<main class="page about">
		<span class="mono">$ whoami</span>
		<div
			class="about-body"
			v-html="about.html" />
		<p class="mono about-links">
			<template
				v-for="(l, i) in about.links"
				:key="l.href">
				<a
					:href="l.href"
					target="_blank"
					rel="noopener"
					>{{ l.label }}</a
				><span v-if="i < about.links.length - 1"> · </span>
			</template>
		</p>
	</main>
</template>

<style scoped>
.about {
	max-width: 560px;
}
.about-body {
	margin-top: 32px;
}
.about-body :deep(p) {
	font-size: 17px;
	line-height: 2.1;
	margin: 0 0 18px;
}
.about-links {
	margin-top: 48px;
}
.about-links a:hover {
	color: var(--accent);
}
</style>
