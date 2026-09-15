import * as THREE from "three";
import type { Season, WeatherState } from "@/weather/openMeteo";
import {
	AMPLITUDE,
	buildHeightfield,
	FIELD,
	heightAt,
	MARKERS,
	QUALITY,
	type HeightfieldSpec,
	type MarkerId,
} from "./heightfield";
import {
	createParticles,
	particleCount,
	particleKindFor,
	type ParticleKind,
} from "./particles";
import { atmosphereFor, type Atmosphere } from "./atmosphere";
import { cloudOpacityFor, createClouds } from "./clouds";
import { ALTITUDE } from "./camera";

export interface TerrainColors {
	line: string;
	fog: string;
	accent: string;
	muted: string;
}
export interface TerrainScene {
	setSeed(seed: number): void;
	setColors(c: TerrainColors): void;
	setAltitude(a: number): void;
	setPointer(nx: number, ny: number): void;
	setWeather(state: WeatherState, season: Season, intensity: number): void;
	pickMarker(nx: number, ny: number): MarkerId | null;
	setHovered(id: MarkerId | null): void;
	setOpacity(o: number): void;
	dispose(): void;
}
export { ALTITUDE };

/** 把高度场变成"每一行一条折线"的线段索引几何。 */
function buildLineGeometry(spec: HeightfieldSpec): THREE.BufferGeometry {
	const heights = buildHeightfield(spec);
	const positions = new Float32Array(spec.cols * spec.rows * 3);
	for (let r = 0; r < spec.rows; r++) {
		const z = -spec.depth / 2 + (r / (spec.rows - 1)) * spec.depth;
		for (let c = 0; c < spec.cols; c++) {
			const i = r * spec.cols + c;
			positions[i * 3] = -spec.width / 2 + (c / (spec.cols - 1)) * spec.width;
			positions[i * 3 + 1] = heights[i];
			positions[i * 3 + 2] = z;
		}
	}
	const index: number[] = [];
	for (let r = 0; r < spec.rows; r++) {
		for (let c = 0; c < spec.cols - 1; c++) {
			const i = r * spec.cols + c;
			index.push(i, i + 1);
		}
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
	geo.setIndex(index);
	return geo;
}

export function createTerrainScene(
	canvas: HTMLCanvasElement,
	opts: { seed: number; colors: TerrainColors; quality: "high" | "low" },
): TerrainScene {
	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: true,
		alpha: true,
	});
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

	const scene = new THREE.Scene();
	// 天气决定"大气"：雾的远近、雾色偏灰程度、线条对比度（见 atmosphere.ts）。
	// 目标值在 frame 里缓动，切天气时不会跳变。
	let colors = opts.colors;
	let atmo: Atmosphere = atmosphereFor("clear");
	const fog = new THREE.Fog(
		new THREE.Color(colors.fog),
		atmo.fogNear,
		atmo.fogFar,
	);
	scene.fog = fog;
	const fogTarget = new THREE.Color(colors.fog);
	let atmoOpacity = atmo.lineOpacity; // 缓动中的天气系数
	let lineOpacityBase = 1; // setOpacity（开场淡入）给的基准
	function fogColorFor(a: Atmosphere) {
		return new THREE.Color(colors.fog).lerp(
			new THREE.Color(colors.muted),
			a.haze,
		);
	}
	/** 流云比雾再灰一点，才能从雾里分出来。 */
	function cloudColor() {
		return new THREE.Color(colors.fog).lerp(
			new THREE.Color(colors.muted),
			0.35,
		);
	}

	const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
	let altitude = ALTITUDE.initial;
	const pointer = new THREE.Vector2(0, 0);
	const pointerSmoothed = new THREE.Vector2(0, 0);

	let spec: HeightfieldSpec = {
		...QUALITY[opts.quality],
		...FIELD,
		amplitude: AMPLITUDE,
		seed: opts.seed,
	};
	const lineMaterial = new THREE.LineBasicMaterial({
		color: new THREE.Color(opts.colors.line),
		transparent: true,
		opacity: 1,
	});
	let lines = new THREE.LineSegments(buildLineGeometry(spec), lineMaterial);
	scene.add(lines);

	// 标记点：小球 + 立柱
	const markerGroup = new THREE.Group();
	const markerMat = new THREE.MeshBasicMaterial({
		color: new THREE.Color(opts.colors.accent),
		transparent: true,
	});
	const markerMeshes = new Map<MarkerId, THREE.Mesh>();
	for (const m of MARKERS) {
		const mesh = new THREE.Mesh(
			new THREE.SphereGeometry(0.18, 16, 16),
			markerMat.clone(),
		);
		mesh.userData.id = m.id;
		markerGroup.add(mesh);
		markerMeshes.set(m.id, mesh);
	}
	scene.add(markerGroup);
	function placeMarkers() {
		for (const m of MARKERS) {
			const mesh = markerMeshes.get(m.id)!;
			mesh.position.set(m.x, heightAt(spec, m.x, m.z) + 0.35, m.z);
			mesh.userData.baseY = mesh.position.y;
		}
	}
	placeMarkers();

	let hovered: MarkerId | null = null;
	const raycaster = new THREE.Raycaster();

	function resize() {
		const w = canvas.clientWidth,
			h = canvas.clientHeight;
		if (w === 0 || h === 0) return;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	}
	const ro = new ResizeObserver(resize);
	ro.observe(canvas);
	resize();

	let weatherTick: ((dt: number) => void) | null = null; // Task 9 挂粒子更新
	let particles: ReturnType<typeof createParticles> | null = null;
	let currentKind: ParticleKind = "none";
	const bounds = {
		halfW: FIELD.width / 2,
		halfD: FIELD.depth / 2,
		top: 12,
		floor: -2.5,
	};
	const clouds = createClouds(scene, cloudColor(), bounds);
	/** 落叶用强调色，柳絮用 muted 的浅色，雨雪跟线条同色。 */
	function particleColorFor(kind: ParticleKind) {
		return kind === "leaves"
			? colors.accent
			: kind === "catkins"
				? colors.muted
				: colors.line;
	}
	function rebuildParticles(kind: ParticleKind, count: number) {
		particles?.dispose();
		particles = null;
		weatherTick = null;
		currentKind = kind;
		if (kind === "none" || count === 0) return;
		particles = createParticles(
			scene,
			kind,
			count,
			particleColorFor(kind),
			bounds,
		);
		weatherTick = (dt) => particles!.tick(dt);
	}
	let raf = 0;
	let last = performance.now();
	function frame(now: number) {
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		pointerSmoothed.lerp(pointer, 0.06);
		// 相机：高度 altitude，向 -z 方向后退，看向原点略前方；鼠标带来左右/俯仰漂移
		camera.position.set(pointerSmoothed.x * 1.6, altitude, altitude * 0.9 + 4);
		camera.lookAt(pointerSmoothed.x * 0.8, -0.5 + pointerSmoothed.y * 0.6, -2);
		for (const mesh of markerMeshes.values()) {
			const isHover = mesh.userData.id === hovered;
			const targetY = mesh.userData.baseY + (isHover ? 0.6 : 0);
			mesh.position.y += (targetY - mesh.position.y) * 0.15;
			const s = isHover ? 1.6 : 1;
			mesh.scale.setScalar(mesh.scale.x + (s - mesh.scale.x) * 0.15);
		}
		weatherTick?.(dt);
		clouds.tick(dt);
		fog.near += (atmo.fogNear - fog.near) * 0.03;
		fog.far += (atmo.fogFar - fog.far) * 0.03;
		fog.color.lerp(fogTarget, 0.03);
		atmoOpacity += (atmo.lineOpacity - atmoOpacity) * 0.04;
		lineMaterial.opacity = lineOpacityBase * atmoOpacity;
		renderer.render(scene, camera);
		raf = requestAnimationFrame(frame);
	}
	raf = requestAnimationFrame(frame);

	const api: TerrainScene = {
		setSeed(seed) {
			spec = { ...spec, seed };
			lines.geometry.dispose();
			lines.geometry = buildLineGeometry(spec);
			placeMarkers();
		},
		setColors(c) {
			colors = c;
			lineMaterial.color.set(c.line);
			// 主题切换跟着 CSS 一起立刻换色，不缓动。
			fogTarget.copy(fogColorFor(atmo));
			fog.color.copy(fogTarget);
			clouds.setColor(cloudColor());
			for (const mesh of markerMeshes.values())
				(mesh.material as THREE.MeshBasicMaterial).color.set(c.accent);
			particles?.setColor(particleColorFor(currentKind));
		},
		setAltitude(a) {
			altitude = Math.max(ALTITUDE.min, Math.min(ALTITUDE.max, a));
		},
		setPointer(nx, ny) {
			pointer.set(nx, ny);
		},
		setWeather(state, season, intensity) {
			atmo = atmosphereFor(state);
			fogTarget.copy(fogColorFor(atmo));
			clouds.setWeatherOpacity(cloudOpacityFor(state, intensity));
			const kind = particleKindFor(state, season);
			rebuildParticles(kind, particleCount(kind, intensity, opts.quality));
		},
		pickMarker(nx, ny) {
			raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
			const hit = raycaster.intersectObjects(
				[...markerMeshes.values()],
				false,
			)[0];
			return hit ? (hit.object.userData.id as MarkerId) : null;
		},
		setHovered(id) {
			hovered = id;
		},
		setOpacity(o) {
			lineOpacityBase = o;
			lineMaterial.opacity = o * atmoOpacity;
			clouds.setBaseOpacity(o);
			for (const mesh of markerMeshes.values())
				(mesh.material as THREE.MeshBasicMaterial).opacity = o;
		},
		dispose() {
			particles?.dispose();
			clouds.dispose();
			cancelAnimationFrame(raf);
			ro.disconnect();
			lines.geometry.dispose();
			lineMaterial.dispose();
			for (const mesh of markerMeshes.values()) {
				mesh.geometry.dispose();
				(mesh.material as THREE.Material).dispose();
			}
			renderer.dispose();
		},
	};
	return api;
}
