import { createNoise2D } from "simplex-noise";

export interface HeightfieldSpec {
	cols: number;
	rows: number;
	width: number;
	depth: number;
	amplitude: number;
	seed: number;
}
export type MarkerId = "essays" | "projects" | "about";

/** 地形默认规格：40 × 30 个世界单位，高质量 200 × 120 顶点。 */
export const FIELD = { width: 40, depth: 30 };
export const QUALITY = {
	high: { cols: 200, rows: 120 },
	low: { cols: 100, rows: 60 },
};
export const AMPLITUDE = 2.2;

/** 按疏密倍率算行数：density 1 = 该质量档的默认行数；下限 16 行，再少就不是地形了。 */
export function rowsFor(baseRows: number, density: number): number {
	return Math.max(16, Math.round(baseRows * density));
}

/** 三个入口在地形上的位置（世界坐标 x, z）。 */
export const MARKERS: { id: MarkerId; x: number; z: number }[] = [
	{ id: "essays", x: -6, z: 2 },
	{ id: "projects", x: 5, z: -3 },
	{ id: "about", x: 11, z: 5 },
];

/** mulberry32，给 simplex-noise 一个可复现的随机源。 */
function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** 三个八度叠加的 2D simplex，输出归一化到 [-1, 1]。 */
export function makeHeightFn(seed: number): (x: number, z: number) => number {
	const noise = createNoise2D(mulberry32(seed));
	const octaves = [
		{ freq: 0.045, amp: 1.0 },
		{ freq: 0.11, amp: 0.45 },
		{ freq: 0.27, amp: 0.18 },
	];
	const total = octaves.reduce((s, o) => s + o.amp, 0);
	return (x, z) => {
		let v = 0;
		for (const o of octaves) v += noise(x * o.freq, z * o.freq) * o.amp;
		return Math.max(-1, Math.min(1, v / total));
	};
}

/**
 * 行距的抖动比例。摩尔纹需要两套规则周期（等距的行 × 像素网格）叠加，
 * 把每一行的 z 随机挪动 ±15% 行距，远处的拍频就散成噪点；近处看不出来。
 */
export const ROW_JITTER = 0.3;

/** 每一行的 z 坐标：等距 + 按种子决定的抖动。首尾两行不动，地形边界保持整齐。 */
export function rowZ(spec: HeightfieldSpec): Float32Array {
	const rand = mulberry32((spec.seed ^ 0x9e3779b9) >>> 0);
	const spacing = spec.depth / (spec.rows - 1);
	const out = new Float32Array(spec.rows);
	for (let r = 0; r < spec.rows; r++) {
		const base = -spec.depth / 2 + r * spacing;
		const edge = r === 0 || r === spec.rows - 1;
		out[r] = edge ? base : base + (rand() - 0.5) * ROW_JITTER * spacing;
	}
	return out;
}

/**
 * 行的抽稀等级，给远处降密度用（等价于给线条做 mipmap）：
 * 0 永远画；1 在中距离淡出，密度减半；2 在更远处淡出，密度降到 1/4。
 */
export function rowLevel(r: number): 0 | 1 | 2 {
	return r % 2 === 1 ? 1 : r % 4 === 2 ? 2 : 0;
}

export function buildHeightfield(spec: HeightfieldSpec): Float32Array {
	const f = makeHeightFn(spec.seed);
	const zs = rowZ(spec);
	const out = new Float32Array(spec.cols * spec.rows);
	for (let r = 0; r < spec.rows; r++) {
		const z = zs[r];
		for (let c = 0; c < spec.cols; c++) {
			const x = -spec.width / 2 + (c / (spec.cols - 1)) * spec.width;
			out[r * spec.cols + c] = f(x, z) * spec.amplitude;
		}
	}
	return out;
}

export function heightAt(spec: HeightfieldSpec, x: number, z: number): number {
	return makeHeightFn(spec.seed)(x, z) * spec.amplitude;
}
