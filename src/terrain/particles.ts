import * as THREE from "three";
import type { Season, WeatherState } from "@/weather/openMeteo";

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

function respawn(p: Float32Array, i: number, b: Bounds) {
	p[i * 3] = (Math.random() * 2 - 1) * b.halfW;
	p[i * 3 + 1] = b.floor + Math.random() * (b.top - b.floor);
	p[i * 3 + 2] = (Math.random() * 2 - 1) * b.halfD;
}

/** 更新第 i 个粒子的位置。t 是场景总时间，用来做雪与落叶的摆动。 */
export function stepParticle(
	kind: ParticleKind,
	p: Float32Array,
	i: number,
	dt: number,
	t: number,
	b: Bounds,
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
	// 落体掉出底部、柳絮飘出顶部，或任何粒子飞出横向边界：重生到起点那一侧。
	const rising = kind === "catkins";
	const gone = rising ? p[iy] > b.top : p[iy] < b.floor;
	if (gone || Math.abs(p[ix]) > b.halfW || Math.abs(p[iz]) > b.halfD) {
		respawn(p, i, b);
		p[iy] = rising
			? b.floor + 1 + Math.random() * 2
			: b.top - Math.random() * 2;
	}
}

export function createParticles(
	scene: THREE.Scene,
	kind: ParticleKind,
	count: number,
	color: string,
	bounds: Bounds,
) {
	// positions 是每个粒子的"头"，stepParticle 只操作它；雨另外维护一份线段顶点。
	const positions = new Float32Array(count * 3);
	for (let i = 0; i < count; i++) respawn(positions, i, bounds);
	const geo = new THREE.BufferGeometry();

	let object: THREE.Object3D;
	let mat: THREE.PointsMaterial | THREE.LineBasicMaterial;
	let sync: () => void;
	if (kind === "rain") {
		const segments = new Float32Array(count * 6);
		geo.setAttribute("position", new THREE.BufferAttribute(segments, 3));
		mat = new THREE.LineBasicMaterial({
			color: new THREE.Color(color),
			transparent: true,
			opacity: 0.32,
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
		const size = kind === "snow" ? 0.12 : kind === "catkins" ? 0.18 : 0.2;
		const opacity = kind === "catkins" ? 0.75 : 0.85;
		mat = new THREE.PointsMaterial({
			color: new THREE.Color(color),
			size,
			transparent: true,
			opacity,
			sizeAttenuation: true,
			depthWrite: false,
		});
		object = new THREE.Points(geo, mat);
		sync = () => {};
	}
	sync();
	object.frustumCulled = false;
	scene.add(object);
	let t = 0;
	return {
		tick(dt: number) {
			t += dt;
			for (let i = 0; i < count; i++)
				stepParticle(kind, positions, i, dt, t, bounds);
			sync();
			geo.attributes.position.needsUpdate = true;
		},
		setColor(c: string) {
			mat.color.set(c);
		},
		dispose() {
			scene.remove(object);
			geo.dispose();
			mat.dispose();
		},
	};
}
