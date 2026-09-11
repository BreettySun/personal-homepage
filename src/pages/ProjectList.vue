<script setup lang="ts">
import { ref } from "vue";
import { useHead } from "@unhead/vue";
import { loadProjects } from "@/content/projects";

const projects = loadProjects();
const open = ref<string | null>(null);
function toggle(slug: string) {
	open.value = open.value === slug ? null : slug;
}
useHead({ title: "项目 · Scream" });
</script>

<template>
	<main class="page">
		<span class="mono">$ ls -la ~/projects</span>
		<h1 class="page-title">项 目</h1>
		<section
			v-for="p in projects"
			:key="p.slug"
			class="proj">
			<button
				type="button"
				class="proj-row"
				:aria-expanded="open === p.slug"
				@click="toggle(p.slug)">
				<span class="proj-name"
					>{{ p.name }}<span class="proj-tagline">{{ p.tagline }}</span></span
				>
				<span class="mono proj-meta"
					>{{ p.stack.join(" ") }} &nbsp; {{ p.year }}</span
				>
			</button>
			<div
				v-if="open === p.slug"
				class="proj-detail">
				<img
					v-if="p.cover"
					:src="p.cover"
					:alt="p.name" />
				<div
					class="proj-body"
					v-html="p.html" />
				<p class="mono">
					<a
						v-if="p.github"
						:href="p.github"
						target="_blank"
						rel="noopener"
						>github ↗</a
					>
					<a
						v-if="p.url"
						:href="p.url"
						target="_blank"
						rel="noopener"
						>live ↗</a
					>
				</p>
			</div>
		</section>
	</main>
</template>

<style scoped>
.proj-row {
	width: 100%;
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	gap: 16px;
	padding: 14px 0;
	background: none;
	border: 0;
	border-bottom: 1px solid var(--bg-2);
	color: inherit;
	font: inherit;
	text-align: left;
	cursor: pointer;
}
.proj-name {
	font-size: 20px;
	letter-spacing: 0.06em;
}
.proj-tagline {
	font-size: 14px;
	color: var(--muted);
	margin-left: 12px;
}
.proj-row:hover .proj-name {
	color: var(--accent);
}
.proj-detail {
	padding: 12px 0 24px 12px;
	border-left: 2px solid var(--accent);
	margin: 8px 0 16px;
}
.proj-body :deep(p) {
	font-size: 15px;
	line-height: 1.9;
	margin: 0 0 12px;
}
.proj-detail a {
	margin-right: 16px;
}
</style>
