import * as THREE from "three";
import type { Season, WeatherState } from "@/weather/openMeteo";
import {
	AMPLITUDE,
	buildHeightfield,
	FIELD,
	heightAt,
	MARKERS,
	QUALITY,
	rowLevel,
	rowsFor,
	rowZ,
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
	/** 线条疏密倍率（1 = 默认行数），重建几何。 */
	setDensity(density: number): void;
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
	const zs = rowZ(spec); // 行距带抖动，见 heightfield.ts ROW_JITTER
	const positions = new Float32Array(spec.cols * spec.rows * 3);
	const levels = new Float32Array(spec.cols * spec.rows); // 每个顶点所在行的抽稀等级
	for (let r = 0; r < spec.rows; r++) {
		const level = rowLevel(r);
		for (let c = 0; c < spec.cols; c++) {
			const i = r * spec.cols + c;
			positions[i * 3] = -spec.width / 2 + (c / (spec.cols - 1)) * spec.width;
			positions[i * 3 + 1] = heights[i];
			positions[i * 3 + 2] = zs[r];
			levels[i] = level;
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
	geo.setAttribute("aLevel", new THREE.BufferAttribute(levels, 1));
	geo.setIndex(index);
	return geo;
}

/**
 * 远处抽行的视深阈值（场景单位），按 800px 高的视口、120 行标定：
 * 等级 1 的行在 [l1a, l1b] 之间淡出，等级 2 的行在 [l2a, l2b] 之间淡出。
 * 投影后的行距 ∝ 视口高度 / 视深，所以实际阈值随视口高度和行数线性缩放。
 */
const THIN_DEPTH = { l1a: 22, l1b: 32, l2a: 34, l2b: 46 };
const THIN_REF = { height: 800, rows: QUALITY.high.rows };

/**
 * 给 LineBasicMaterial 注入按视深抽行的逻辑：远处的行密度超过像素能分辨的程度就会
 * 出摩尔纹，MSAA 救不了；只能像 mipmap 一样在远处把奇数行淡掉、再淡掉 1/4 行。
 * uThin 是 vec4(l1a, l1b, l2a, l2b)。
 */
function installRowThinning(material: THREE.LineBasicMaterial, uThin: THREE.IUniform<THREE.Vector4>) {
	material.onBeforeCompile = (shader) => {
		shader.uniforms.uThin = uThin;
		shader.vertexShader = shader.vertexShader
			.replace(
				"#include <common>",
				"#include <common>\nattribute float aLevel;\nvarying float vLevel;\nvarying float vDepth;",
			)
			.replace(
				"#include <fog_vertex>",
				"#include <fog_vertex>\nvLevel = aLevel;\nvDepth = -mvPosition.z;",
			);
		shader.fragmentShader = shader.fragmentShader
			.replace(
				"#include <common>",
				"#include <common>\nuniform vec4 uThin;\nvarying float vLevel;\nvarying float vDepth;",
			)
			.replace(
				"vec4 diffuseColor = vec4( diffuse, opacity );",
				[
					"vec4 diffuseColor = vec4( diffuse, opacity );",
					"float thin = vLevel > 1.5 ? smoothstep( uThin.z, uThin.w, vDepth )",
					"  : vLevel > 0.5 ? smoothstep( uThin.x, uThin.y, vDepth ) : 0.0;",
					"diffuseColor.a *= 1.0 - thin;",
				].join("\n"),
			);
	};
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
	const uThin: THREE.IUniform<THREE.Vector4> = {
		value: new THREE.Vector4(THIN_DEPTH.l1a, THIN_DEPTH.l1b, THIN_DEPTH.l2a, THIN_DEPTH.l2b),
	};
	installRowThinning(lineMaterial, uThin);
	let viewportH = THIN_REF.height;
	function updateThinning(viewportHeight: number) {
		viewportH = viewportHeight;
		// 投影行距 ∝ 视口高度 / (行数 × 视深)，所以阈值 ∝ 视口高度 / 行数：行越少，越晚开始抽。
		const k = Math.max(0.6, Math.min(1.6, viewportHeight / THIN_REF.height)) * (THIN_REF.rows / spec.rows);
		uThin.value.set(THIN_DEPTH.l1a * k, THIN_DEPTH.l1b * k, THIN_DEPTH.l2a * k, THIN_DEPTH.l2b * k);
	}
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
		updateThinning(h);
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
		setDensity(density) {
			const rows = rowsFor(QUALITY[opts.quality].rows, density);
			if (rows === spec.rows) return;
			spec = { ...spec, rows };
			lines.geometry.dispose();
			lines.geometry = buildLineGeometry(spec);
			// 抽行阈值随行数反比缩放：行少了间距本来就大，远处不用再抽那么早。
			updateThinning(viewportH);
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
