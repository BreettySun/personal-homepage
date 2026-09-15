import * as THREE from "three";
import type { WeatherState } from "@/weather/openMeteo";

/**
 * 阴天的流云：几片半透明的椭圆雾斑贴在地形上方缓慢向右横移，任何季节的阴天都有。
 * 它和粒子是两层独立的东西：秋天的阴天是落叶 + 流云。
 */
export const CLOUD_COUNT = 6;
/** 云层高度：要压在地形最高点（AMPLITUDE 2.2）之上、相机最低高度（ALTITUDE.min 6）之下。 */
export const CLOUD_HEIGHT = { min: 3.2, max: 4.2 };

/** 阴天才有云，intensity 越大越浓；其他天气为 0，场景里会缓动淡出。 */
export function cloudOpacityFor(
	state: WeatherState,
	intensity: number,
): number {
	if (state !== "cloudy") return 0;
	const k = Math.max(0, Math.min(1, intensity));
	return 0.3 + 0.35 * k;
}

export interface Cloud {
	x: number;
	y: number;
	z: number;
	w: number;
	d: number;
	speed: number;
}

export function spawnCloud(
	rand: () => number,
	halfW: number,
	halfD: number,
	atLeftEdge: boolean,
): Cloud {
	const w = 10 + rand() * 12,
		d = 4 + rand() * 4;
	return {
		w,
		d,
		x: atLeftEdge ? -halfW - w / 2 : (rand() * 2 - 1) * halfW,
		y: CLOUD_HEIGHT.min + rand() * (CLOUD_HEIGHT.max - CLOUD_HEIGHT.min),
		z: (rand() * 2 - 1) * halfD * 0.9,
		speed: 0.35 + rand() * 0.3,
	};
}

/** 向 +x 漂；整片飘出右边界就从左边重新进来。返回是否重生。 */
export function stepCloud(
	c: Cloud,
	dt: number,
	halfW: number,
	halfD: number,
	rand: () => number,
): boolean {
	c.x += c.speed * dt;
	if (c.x - c.w / 2 > halfW) {
		Object.assign(c, spawnCloud(rand, halfW, halfD, true));
		return true;
	}
	return false;
}

/** 一张径向渐变的软边贴图，所有云共用。 */
function makeTexture(): THREE.Texture {
	const size = 128;
	const cv = document.createElement("canvas");
	cv.width = size;
	cv.height = size;
	const ctx = cv.getContext("2d")!;
	const g = ctx.createRadialGradient(
		size / 2,
		size / 2,
		0,
		size / 2,
		size / 2,
		size / 2,
	);
	g.addColorStop(0, "rgba(255,255,255,1)");
	g.addColorStop(0.55, "rgba(255,255,255,0.55)");
	g.addColorStop(1, "rgba(255,255,255,0)");
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, size, size);
	return new THREE.CanvasTexture(cv);
}

export function createClouds(
	scene: THREE.Scene,
	color: THREE.Color,
	bounds: { halfW: number; halfD: number },
) {
	const map = makeTexture();
	const mat = new THREE.MeshBasicMaterial({
		map,
		color,
		transparent: true,
		opacity: 0,
		depthWrite: false,
	});
	const geo = new THREE.PlaneGeometry(1, 1);
	const group = new THREE.Group();
	const clouds: Cloud[] = [];
	const meshes: THREE.Mesh[] = [];
	for (let i = 0; i < CLOUD_COUNT; i++) {
		const mesh = new THREE.Mesh(geo, mat);
		mesh.rotation.x = -Math.PI / 2; // 平躺，俯瞰时是贴在地形上方的一片雾斑
		mesh.frustumCulled = false;
		clouds.push(spawnCloud(Math.random, bounds.halfW, bounds.halfD, false));
		meshes.push(mesh);
		group.add(mesh);
	}
	function place(i: number) {
		const c = clouds[i],
			m = meshes[i];
		m.position.set(c.x, c.y, c.z);
		m.scale.set(c.w, c.d, 1);
	}
	for (let i = 0; i < CLOUD_COUNT; i++) place(i);
	group.visible = false;
	scene.add(group);

	let weatherOpacity = 0; // 天气给的目标值（cloudOpacityFor）
	let eased = 0; // 朝目标缓动中的值
	let base = 1; // 开场淡入给的基准，和线条共用
	return {
		tick(dt: number) {
			eased += (weatherOpacity - eased) * 0.03;
			const o = eased * base;
			mat.opacity = o;
			group.visible = o > 0.005;
			if (!group.visible) return;
			for (let i = 0; i < CLOUD_COUNT; i++) {
				stepCloud(clouds[i], dt, bounds.halfW, bounds.halfD, Math.random);
				place(i);
			}
		},
		setWeatherOpacity(o: number) {
			weatherOpacity = o;
		},
		setBaseOpacity(o: number) {
			base = o;
		},
		setColor(c: THREE.Color) {
			mat.color.copy(c);
		},
		dispose() {
			scene.remove(group);
			geo.dispose();
			mat.dispose();
			map.dispose();
		},
	};
}
