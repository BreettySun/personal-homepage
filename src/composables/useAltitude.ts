import { onBeforeUnmount, onMounted, ref } from "vue";

export function altitudePercent(
	scrollY: number,
	docHeight: number,
	viewportH: number,
): number {
	const range = docHeight - viewportH;
	if (range <= 0) return 100;
	return Math.round(Math.max(0, Math.min(1, scrollY / range)) * 100);
}

export function useAltitude() {
	const percent = ref(0);
	function update() {
		percent.value = altitudePercent(
			window.scrollY,
			document.documentElement.scrollHeight,
			window.innerHeight,
		);
	}
	onMounted(() => {
		update();
		window.addEventListener("scroll", update, { passive: true });
		window.addEventListener("resize", update);
	});
	onBeforeUnmount(() => {
		window.removeEventListener("scroll", update);
		window.removeEventListener("resize", update);
	});
	return { percent };
}
