<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{ parts: (string | number | undefined | null)[] }>();
const text = computed(
	() =>
		"// " +
		props.parts
			.filter((p) => p !== undefined && p !== null && p !== "")
			.join(" · "),
);
</script>

<template>
	<span class="mono meta-line">{{ text }}</span>
</template>
