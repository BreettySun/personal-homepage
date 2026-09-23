import * as THREE from "three";
import type { Season, WeatherState } from "@/weather/openMeteo";
import { AMPLITUDE } from "./heightfield";

export type ParticleKind = "none" | "rain" | "snow" | "leaves" | "catkins";
export interface Bounds {
	halfW: number;
	halfD: number;
	top: number;
	floor: number;
}

/** 天气优先于季节：下雨下雪就是雨雪；否则秋天落叶、春天晴日柳絮；夏天和阴天没有粒子（阴天靠流云）。 */
export function particleKindFor(
	state: WeatherState,
	season: Season,
): ParticleKind {
	if (state === "rain") return "rain";
	if (state === "snow") return "snow";
	if (season === "autumn") return "leaves";
	if (season === "spring" && state === "clear") return "catkins";
	return "none";
}

// 雨是线段不是点，1200 条已经够密；再多就盖住地形了。
const MAX_COUNT = {
	none: 0,
	rain: 1200,
	snow: 1400,
	leaves: 180,
	catkins: 200,
};
export function particleCount(
	kind: ParticleKind,
	intensity: number,
	quality: "high" | "low",
): number {
	const q = quality === "low" ? 1 / 3 : 1;
	return Math.round(MAX_COUNT[kind] * Math.max(0, Math.min(1, intensity)) * q);
}

/** 下落速度（场景单位/秒）。雨要快过雪，但可见区高约 14.5 个单位，太快就只剩闪烁。 */
export const FALL_SPEED = { rain: 11, snow: 1.6, leaves: 0.9 } as const;
/** 柳絮是往上飘的（场景单位/秒），带一点向右的微风。 */
export const CATKIN_RISE = 0.45;
/** 雨丝长度：雨不是点而是一小段线，沿速度反方向拖在雨滴后面。 */
export const RAIN_STREAK = 0.55; // 有 +z 分量后投影会变短，比纯竖直时略长一点补回来
/**
 * 雨的横向漂移，按下落速度的比例。z 为正是朝相机（观众）方向：相机俯视约 45°，
 * 纯竖直的雨在屏幕上会向远处收敛，看起来像掉进屏幕里；带一点 +z 就落向观众。
 * x 是侧风，0 = 不斜。
 */
export const RAIN_DRIFT = { x: Math.random() * 0.4 - 0.2, z: 0.8 };

/**
 * 雨落地溅起的小水圈：同时最多 pool 个，每个活 life 秒，只取 chance 比例的雨滴，
 * 免得满地都在闪。size 是水圈最大时的直径（场景单位）。
 */
export const SPLASH = { pool: 160, life: 0.42, chance: 0.35, size: 0.6 };

/** 地面高度 (x, z) → y；雨滴穿过它就算落地。 */
export type Ground = (x: number, z: number) => number;

function respawn(p: Float32Array, i: number, b: Bounds) {
	p[i * 3] = (Math.random() * 2 - 1) * b.halfW;
	p[i * 3 + 1] = b.floor + Math.random() * (b.top - b.floor);
	p[i * 3 + 2] = (Math.random() * 2 - 1) * b.halfD;
}

/**
 * 更新第 i 个粒子的位置。t 是场景总时间，用来做雪与落叶的摆动。
 * 给了 ground 时，雨滴穿过地面就算落地：先回调 onLand（落点），再回到顶上重生。
 */
export function stepParticle(
	kind: ParticleKind,
	p: Float32Array,
	i: number,
	dt: number,
	t: number,
	b: Bounds,
	ground?: Ground,
	onLand?: (x: number, y: number, z: number) => void,
): void {
	const ix = i * 3,
		iy = ix + 1,
		iz = ix + 2;
	if (kind === "rain") {
		p[iy] -= FALL_SPEED.rain * dt;
		p[ix] += FALL_SPEED.rain * RAIN_DRIFT.x * dt;
		p[iz] += FALL_SPEED.rain * RAIN_DRIFT.z * dt;
	} else if (kind === "snow") {
		p[iy] -= FALL_SPEED.snow * dt;
		p[ix] += Math.sin(t * 1.3 + i) * 0.6 * dt;
		p[iz] += Math.cos(t * 0.9 + i * 0.7) * 0.4 * dt;
	} else if (kind === "leaves") {
		p[iy] -= FALL_SPEED.leaves * dt;
		p[ix] += (0.8 + Math.sin(t + i) * 0.5) * dt;
		p[iz] += Math.cos(t * 0.6 + i) * 0.5 * dt;
	} else if (kind === "catkins") {
		p[iy] += CATKIN_RISE * dt;
		p[ix] += (0.25 + Math.sin(t * 0.7 + i) * 0.5) * dt;
		p[iz] += Math.cos(t * 0.5 + i * 0.3) * 0.3 * dt;
	}
	// 雨滴只在低于地形最高点之后才去查地面高度，其余时候不花这个钱。
	let landed = false;
	if (kind === "rain" && ground && p[iy] < AMPLITUDE) {
		const g = ground(p[ix], p[iz]);
		if (p[iy] < g) {
			landed = true;
			onLand?.(p[ix], g, p[iz]);
		}
	}
	// 落体掉出底部（或落地）、柳絮飘出顶部，或任何粒子飞出横向边界：重生到起点那一侧。
	const rising = kind === "catkins";
	const gone = landed || (rising ? p[iy] > b.top : p[iy] < b.floor);
	if (gone || Math.abs(p[ix]) > b.halfW || Math.abs(p[iz]) > b.halfD) {
		respawn(p, i, b);
		p[iy] = rising
			? b.floor + 1 + Math.random() * 2
			: b.top - Math.random() * 2;
	}
}

/**
 * 点状粒子的形状（片元着色器里画，不用贴图）：
 * 0 雪 = 软边圆点；1 落叶 = 两头尖的叶片，绕自身旋转、翻面时变窄；2 柳絮 = 高斯绒团。
 * 每个粒子有自己的 aSeed（0..1），决定大小、转速和深浅，避免整齐划一。
 */
const SHAPE: Partial<Record<ParticleKind, number>> = { snow: 0, leaves: 1, catkins: 2 };
const POINT_SIZE: Partial<Record<ParticleKind, number>> = {
	snow: 0.17,
	leaves: 0.36,
	catkins: 0.36,
};
const OPACITY: Record<ParticleKind, number> = {
	none: 0,
	rain: 0.4,
	snow: 0.85,
	leaves: 0.9,
	catkins: 0.9,
};

/** 着色器字符串里只写 ASCII（见 terrainShader.ts）：叶片翻面时变窄，颜色深浅不一、带一条叶脉。 */
function shapePoints(
	mat: THREE.PointsMaterial,
	shape: number,
	uTime: THREE.IUniform<number>,
) {
	mat.defines = { PARTICLE_SHAPE: shape };
	mat.onBeforeCompile = (shader) => {
		shader.uniforms.uTime = uTime;
		shader.vertexShader = shader.vertexShader
			.replace(
				"#include <common>",
				"#include <common>\nattribute float aSeed;\nuniform float uTime;\nvarying float vSeed;\nvarying float vSpin;",
			)
			.replace(
				"gl_PointSize = size;",
				[
					"gl_PointSize = size * ( 0.6 + aSeed * 0.8 );",
					"vSeed = aSeed;",
					// 一半顺时针一半逆时针，转速各不相同
					"vSpin = uTime * ( 0.7 + aSeed * 1.6 ) * ( aSeed > 0.5 ? 1.0 : -1.0 ) + aSeed * 6.2831;",
				].join("\n"),
			);
		shader.fragmentShader = shader.fragmentShader
			.replace(
				"#include <common>",
				"#include <common>\nvarying float vSeed;\nvarying float vSpin;",
			)
			.replace(
				"#include <map_particle_fragment>",
				[
					"vec2 p = gl_PointCoord - 0.5;",
					"float shapeA = 0.0;",
					"#if PARTICLE_SHAPE == 1",
					"	float cs = cos( vSpin ), sn = sin( vSpin );",
					"	vec2 q = vec2( cs * p.x - sn * p.y, sn * p.x + cs * p.y );",
					"	q.x /= max( abs( cos( vSpin * 0.63 + vSeed * 9.0 ) ), 0.18 ); // flip",
					"	float ly = q.y * 2.1;",
					"	float halfW = 0.36 * ( 1.0 - ly * ly );",
					"	shapeA = smoothstep( 0.0, 0.05, halfW - abs( q.x ) * 2.0 ) * step( abs( ly ), 1.0 );",
					"	diffuseColor.rgb *= ( 0.78 + 0.22 * fract( vSeed * 13.7 ) )",
					"		* ( 1.0 - 0.3 * ( 1.0 - smoothstep( 0.0, 0.035, abs( q.x ) ) ) ); // tone + midrib",
					"#elif PARTICLE_SHAPE == 2",
					"	float r = length( p ) * 2.0;",
					"	shapeA = exp( - r * r * 2.2 ) * ( 1.0 - smoothstep( 0.75, 1.0, r ) );",
					"#else",
					"	float r = length( p ) * 2.0;",
					"	shapeA = 1.0 - smoothstep( 0.35, 1.0, r );",
					"#endif",
					"diffuseColor.a *= shapeA;",
					"if ( diffuseColor.a < 0.003 ) discard;",
				].join("\n"),
			);
	};
}

/**
 * 水圈：一池点精灵，每个记下出生时间，着色器按年龄放大、变淡；
 * 片元里画一个压扁的圆环，斜着看就像贴在地上的一圈涟漪。
 */
function createSplashes(scene: THREE.Scene, color: string) {
	const positions = new Float32Array(SPLASH.pool * 3);
	const births = new Float32Array(SPLASH.pool).fill(-1e3);
	const geo = new THREE.BufferGeometry();
	geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
	geo.setAttribute("aBirth", new THREE.BufferAttribute(births, 1));
	const uTime: THREE.IUniform<number> = { value: 0 };
	const mat = new THREE.PointsMaterial({
		color: new THREE.Color(color),
		size: SPLASH.size,
		transparent: true,
		opacity: 0.6,
		sizeAttenuation: true,
		depthWrite: false,
	});
	mat.onBeforeCompile = (shader) => {
		shader.uniforms.uTime = uTime;
		shader.vertexShader = shader.vertexShader
			.replace(
				"#include <common>",
				"#include <common>\nattribute float aBirth;\nuniform float uTime;\nvarying float vAge;",
			)
			.replace(
				"gl_PointSize = size;",
				[
					`vAge = ( uTime - aBirth ) / ${SPLASH.life.toFixed(3)};`,
					"gl_PointSize = vAge >= 0.0 && vAge <= 1.0 ? size * ( 0.3 + 0.7 * vAge ) : 0.0;",
				].join("\n"),
			);
		shader.fragmentShader = shader.fragmentShader
			.replace("#include <common>", "#include <common>\nvarying float vAge;")
			.replace(
				"#include <map_particle_fragment>",
				[
					"vec2 p = gl_PointCoord - 0.5;",
					"p.y /= 0.45; // ground seen at an angle: circle -> ellipse",
					"float r = length( p ) * 2.0;",
					"float ring = smoothstep( 0.6, 0.85, r ) * ( 1.0 - smoothstep( 0.85, 1.0, r ) );",
					"diffuseColor.a *= ring * pow( 1.0 - clamp( vAge, 0.0, 1.0 ), 1.5 );",
					"if ( diffuseColor.a < 0.003 ) discard;",
				].join("\n"),
			);
	};
	const points = new THREE.Points(geo, mat);
	points.frustumCulled = false;
	scene.add(points);
	let next = 0;
	let dirty = false;
	return {
		spawn(x: number, y: number, z: number, t: number) {
			if (Math.random() > SPLASH.chance) return;
			positions.set([x, y + 0.02, z], next * 3);
			births[next] = t;
			next = (next + 1) % SPLASH.pool;
			dirty = true;
		},
		tick(t: number) {
			uTime.value = t;
			if (!dirty) return;
			geo.attributes.position.needsUpdate = true;
			geo.attributes.aBirth.needsUpdate = true;
			dirty = false;
		},
		setColor(c: string) {
			mat.color.set(c);
		},
		setOpacity(o: number) {
			mat.opacity = 0.6 * o;
		},
		dispose() {
			scene.remove(points);
			geo.dispose();
			mat.dispose();
		},
	};
}

export function createParticles(
	scene: THREE.Scene,
	kind: ParticleKind,
	count: number,
	color: string,
	bounds: Bounds,
	ground?: Ground,
) {
	// positions 是每个粒子的"头"，stepParticle 只操作它；雨另外维护一份线段顶点。
	const positions = new Float32Array(count * 3);
	for (let i = 0; i < count; i++) respawn(positions, i, bounds);
	const geo = new THREE.BufferGeometry();
	const uTime: THREE.IUniform<number> = { value: 0 };

	let object: THREE.Object3D;
	let mat: THREE.PointsMaterial | THREE.LineBasicMaterial;
	let sync: () => void;
	const splashes = kind === "rain" && ground ? createSplashes(scene, color) : null;
	if (kind === "rain") {
		const segments = new Float32Array(count * 6);
		geo.setAttribute("position", new THREE.BufferAttribute(segments, 3));
		// 头实尾虚：雨丝的头端不透明、尾端透明，看起来是一道拖影而不是一根棍；每滴深浅不一。
		const rgba = new Float32Array(count * 8);
		for (let i = 0; i < count; i++) {
			rgba.set([1, 1, 1, 0.45 + Math.random() * 0.55, 1, 1, 1, 0], i * 8);
		}
		geo.setAttribute("color", new THREE.BufferAttribute(rgba, 4));
		mat = new THREE.LineBasicMaterial({
			color: new THREE.Color(color),
			vertexColors: true,
			transparent: true,
			opacity: OPACITY.rain,
			depthWrite: false,
		});
		object = new THREE.LineSegments(geo, mat);
		// 尾点 = 头点沿速度反方向退 RAIN_STREAK；速度方向 (drift.x, -1, drift.z) 归一化。
		const len = Math.hypot(RAIN_DRIFT.x, 1, RAIN_DRIFT.z);
		const tail = {
			x: (-RAIN_DRIFT.x / len) * RAIN_STREAK,
			y: RAIN_STREAK / len,
			z: (-RAIN_DRIFT.z / len) * RAIN_STREAK,
		};
		sync = () => {
			for (let i = 0; i < count; i++) {
				const s = i * 3,
					d = i * 6;
				segments[d] = positions[s];
				segments[d + 1] = positions[s + 1];
				segments[d + 2] = positions[s + 2];
				segments[d + 3] = positions[s] + tail.x;
				segments[d + 4] = positions[s + 1] + tail.y;
				segments[d + 5] = positions[s + 2] + tail.z;
			}
		};
	} else {
		geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		const seeds = new Float32Array(count);
		for (let i = 0; i < count; i++) seeds[i] = Math.random();
		geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
		const points = new THREE.PointsMaterial({
			color: new THREE.Color(color),
			size: POINT_SIZE[kind] ?? 0.2,
			transparent: true,
			opacity: OPACITY[kind],
			sizeAttenuation: true,
			depthWrite: false,
		});
		shapePoints(points, SHAPE[kind] ?? 0, uTime);
		mat = points;
		object = new THREE.Points(geo, mat);
		sync = () => {};
	}
	sync();
	object.frustumCulled = false;
	scene.add(object);
	let t = 0;
	const onLand = splashes
		? (x: number, y: number, z: number) => splashes.spawn(x, y, z, t)
		: undefined;
	return {
		tick(dt: number) {
			t += dt;
			uTime.value = t;
			for (let i = 0; i < count; i++)
				stepParticle(kind, positions, i, dt, t, bounds, ground, onLand);
			sync();
			geo.attributes.position.needsUpdate = true;
			splashes?.tick(t);
		},
		setColor(c: string) {
			mat.color.set(c);
			splashes?.setColor(c);
		},
		/** 开场淡入给的基准，和各粒子自己的不透明度相乘。 */
		setBaseOpacity(o: number) {
			mat.opacity = OPACITY[kind] * o;
			splashes?.setOpacity(o);
		},
		dispose() {
			scene.remove(object);
			geo.dispose();
			mat.dispose();
			splashes?.dispose();
		},
	};
}
