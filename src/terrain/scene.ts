import * as THREE from "three";
import type { Season, WeatherState } from "@/weather/openMeteo";
import {
	AMPLITUDE,
	buildHeightfield,
	FIELD,
	makeHeightFn,
	MARKER_IDS,
	QUALITY,
	rowLevel,
	rowsFor,
	rowZ,
	thinningThresholds,
	THIN_REF,
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
import { ALTITUDE, CAMERA, cameraDrift, cameraPose } from "./camera";
import { LIGHT, vertexShade } from "./lighting";
import { createMarkers } from "./markers";
import {
	advanceRipple,
	createLineMaterial,
	createOccluderMaterial,
	createTerrainUniforms,
} from "./terrainShader";

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
	/** 开场进度 0..1：线条从画面中间往外铺开，标记、云、粒子跟着淡入。 */
	setOpacity(o: number): void;
	dispose(): void;
}
export { ALTITUDE };

/** 三个标记的涟漪错开起步（一圈的比例），不会同时"呼吸"。 */
const RIPPLE_PHASE: Record<MarkerId, number> = {
	essays: 0,
	projects: 0.35,
	about: 0.68,
};

/**
 * 把高度场变成两份共用顶点的几何：
 * lines 是"每一行一条折线"的线段索引，surface 是同一网格的三角面（遮挡用）。
 * 顶点属性：position、aLevel（所在行的抽稀等级）、aShade（晕渲的受光偏差）。
 */
function buildTerrainGeometry(spec: HeightfieldSpec) {
	const heights = buildHeightfield(spec);
	const zs = rowZ(spec); // 行距带抖动，见 heightfield.ts ROW_JITTER
	const { cols, rows } = spec;
	const positions = new Float32Array(cols * rows * 3);
	const levels = new Float32Array(cols * rows);
	for (let r = 0; r < rows; r++) {
		const level = rowLevel(r);
		for (let c = 0; c < cols; c++) {
			const i = r * cols + c;
			positions[i * 3] = -spec.width / 2 + (c / (cols - 1)) * spec.width;
			positions[i * 3 + 1] = heights[i];
			positions[i * 3 + 2] = zs[r];
			levels[i] = level;
		}
	}
	const attributes = {
		position: new THREE.BufferAttribute(positions, 3),
		aLevel: new THREE.BufferAttribute(levels, 1),
		aShade: new THREE.BufferAttribute(
			vertexShade(heights, cols, rows, spec.width, zs),
			1,
		),
	};
	const lineIndex: number[] = [];
	const triIndex: number[] = [];
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols - 1; c++) {
			const i = r * cols + c;
			lineIndex.push(i, i + 1);
			if (r < rows - 1) triIndex.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1);
		}
	}
	const lines = new THREE.BufferGeometry();
	const surface = new THREE.BufferGeometry();
	for (const [name, attr] of Object.entries(attributes)) {
		lines.setAttribute(name, attr);
		surface.setAttribute(name, attr);
	}
	lines.setIndex(lineIndex);
	surface.setIndex(triIndex);
	return { lines, surface };
}

function luminance(hex: string): number {
	const c = new THREE.Color(hex);
	return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
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
	let lightLines = false; // 线比底色亮（雨夜）
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

	const camera = new THREE.PerspectiveCamera(
		CAMERA.fov,
		1,
		CAMERA.near,
		CAMERA.far,
	);
	let altitude = ALTITUDE.initial;
	const pointer = new THREE.Vector2(0, 0);
	const pointerSmoothed = new THREE.Vector2(0, 0);

	let spec: HeightfieldSpec = {
		...QUALITY[opts.quality],
		...FIELD,
		amplitude: AMPLITUDE,
		seed: opts.seed,
	};
	const uniforms = createTerrainUniforms();
	const lineMaterial = createLineMaterial(opts.colors.line, uniforms);
	const occluderMaterial = createOccluderMaterial(uniforms);
	let viewportH = THIN_REF.height;
	let aspect = 1;
	function updateThinning(viewportHeight: number) {
		viewportH = viewportHeight;
		uniforms.uThin.value.set(...thinningThresholds(viewportHeight, spec.rows));
	}
	const geo = buildTerrainGeometry(spec);
	const lines = new THREE.LineSegments(geo.lines, lineMaterial);
	const surface = new THREE.Mesh(geo.surface, occluderMaterial);
	surface.renderOrder = -1; // 先写深度，再画线
	scene.add(surface, lines);
	function rebuildGeometry() {
		const next = buildTerrainGeometry(spec);
		lines.geometry.dispose();
		surface.geometry.dispose();
		lines.geometry = next.lines;
		surface.geometry = next.surface;
	}

	const markers = createMarkers(scene, {
		accent: colors.accent,
		muted: colors.muted,
		line: colors.line,
		halo: colors.fog,
	});
	let hovered: MarkerId | null = null;
	const rippleCycle = MARKER_IDS.map((id) => RIPPLE_PHASE[id]);

	function applyColors(c: TerrainColors) {
		lightLines = luminance(c.line) > luminance(c.fog);
		lineMaterial.color.set(c.line);
		uniforms.uInk.value.y = lightLines ? 1 : 0;
		uniforms.uAccent.value.set(c.accent);
		uniforms.uShadeColor.value.set(c.muted);
		// 云影的淡墨：宣纸上是一层冷灰，雨夜里是更深的底色
		uniforms.uWashColor.value = lightLines
			? new THREE.Color(c.fog).multiplyScalar(0.35)
			: new THREE.Color(c.muted);
		markers.setColors({
			accent: c.accent,
			muted: c.muted,
			line: c.line,
			halo: c.fog,
		});
	}
	applyColors(colors);

	function resize() {
		const w = canvas.clientWidth,
			h = canvas.clientHeight;
		if (w === 0 || h === 0) return;
		renderer.setSize(w, h, false);
		aspect = w / h;
		camera.aspect = aspect;
		camera.updateProjectionMatrix();
		updateThinning(h);
		markers.setViewport(w, h, camera.projectionMatrix.elements[5]);
		markers.layout(spec, aspect);
	}
	const ro = new ResizeObserver(resize);
	ro.observe(canvas);
	resize();

	let weatherTick: ((dt: number) => void) | null = null;
	let particles: ReturnType<typeof createParticles> | null = null;
	let currentKind: ParticleKind = "none";
	let baseOpacity = 1; // setOpacity（开场）给的基准
	const bounds = {
		halfW: FIELD.width / 2,
		halfD: FIELD.depth / 2,
		top: 12,
		floor: -2.5,
	};
	const clouds = createClouds(scene, cloudColor(), bounds);
	// 雨滴落地判定用的地面高度；换种子时换函数，粒子拿的是这个闭包。
	let heightFn = makeHeightFn(spec.seed);
	const ground = (x: number, z: number) => heightFn(x, z) * spec.amplitude;
	/** 落叶用强调色，柳絮用 muted；雪在雨夜是亮白、在宣纸上是逆光的冷灰；雨跟线条同色。 */
	function particleColorFor(kind: ParticleKind) {
		if (kind === "leaves") return colors.accent;
		if (kind === "catkins") return colors.muted;
		if (kind === "snow") return lightLines ? colors.line : colors.muted;
		return colors.line;
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
			ground,
		);
		particles.setBaseOpacity(baseOpacity);
		weatherTick = (dt) => particles!.tick(dt);
	}
	let raf = 0;
	let last = performance.now();
	let clock = 0; // 场景时间（秒），驱动镜头漂移
	function frame(now: number) {
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		pointerSmoothed.lerp(pointer, 0.06);
		clock += dt;
		const drift = cameraDrift(clock);
		const pose = cameraPose(
			altitude,
			pointerSmoothed.x + drift.x,
			pointerSmoothed.y + drift.y,
		);
		camera.position.set(pose.position.x, pose.position.y, pose.position.z);
		camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
		markers.tick(hovered);
		MARKER_IDS.forEach((id, i) => {
			const g = markers.ground(id);
			rippleCycle[i] = advanceRipple(rippleCycle[i], dt, g.hover);
			uniforms.uMarkers.value[i].set(g.x, g.z, rippleCycle[i], g.hover);
		});
		weatherTick?.(dt);
		clouds.tick(dt);
		clouds.shadows(uniforms.uClouds.value, LIGHT);
		uniforms.uCloudShadow.value = clouds.shadowStrength();
		fog.near += (atmo.fogNear - fog.near) * 0.03;
		fog.far += (atmo.fogFar - fog.far) * 0.03;
		fog.color.lerp(fogTarget, 0.03);
		atmoOpacity += (atmo.lineOpacity - atmoOpacity) * 0.04;
		lineMaterial.opacity = atmoOpacity;
		renderer.render(scene, camera);
		raf = requestAnimationFrame(frame);
	}
	raf = requestAnimationFrame(frame);

	const api: TerrainScene = {
		setSeed(seed) {
			spec = { ...spec, seed };
			heightFn = makeHeightFn(seed);
			rebuildGeometry();
			markers.layout(spec, aspect);
		},
		setDensity(density) {
			const rows = rowsFor(QUALITY[opts.quality].rows, density);
			if (rows === spec.rows) return;
			spec = { ...spec, rows };
			rebuildGeometry();
			// 抽行阈值随行数反比缩放：行少了间距本来就大，远处不用再抽那么早。
			updateThinning(viewportH);
		},
		setColors(c) {
			colors = c;
			applyColors(c);
			// 主题切换跟着 CSS 一起立刻换色，不缓动。
			fogTarget.copy(fogColorFor(atmo));
			fog.color.copy(fogTarget);
			clouds.setColor(cloudColor());
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
			return markers.pick(nx, ny, camera);
		},
		setHovered(id) {
			hovered = id;
		},
		setOpacity(o) {
			baseOpacity = o;
			uniforms.uReveal.value = o;
			clouds.setBaseOpacity(o);
			markers.setOpacity(o);
			particles?.setBaseOpacity(o);
		},
		dispose() {
			particles?.dispose();
			clouds.dispose();
			markers.dispose();
			cancelAnimationFrame(raf);
			ro.disconnect();
			lines.geometry.dispose();
			surface.geometry.dispose();
			lineMaterial.dispose();
			occluderMaterial.dispose();
			renderer.dispose();
		},
	};
	return api;
}
