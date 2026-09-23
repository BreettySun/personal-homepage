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

export const MARKER_IDS: readonly MarkerId[] = ["essays", "projects", "about"];

/**
 * 三个入口在地形上的位置（世界坐标 x, z），按视口宽高比分两套：
 * 横屏的图例在左下角，标记铺在画面中上部偏右；竖屏的图例占掉下方四成，标记收进上半屏。
 * 两套都用真实相机投影校验过（tests/unit/markers.test.ts）：常见视口下三个都在画面里、不压在图例下面。
 */
export const MARKER_LAYOUT: Record<
	"wide" | "tall",
	Record<MarkerId, { x: number; z: number }>
> = {
	wide: {
		essays: { x: -2.5, z: -3 },
		projects: { x: 4, z: -8 },
		about: { x: 7, z: 1.5 },
	},
	tall: {
		essays: { x: -2.1, z: -7 },
		projects: { x: 2.3, z: -9.8 },
		about: { x: 0.7, z: -5 },
	},
};

/** 宽高比到这个值以上才用横屏布局：方屏（1:1）左右不够宽，"关于"会出画。 */
export const WIDE_ASPECT = 1.2;

export function markerLayoutFor(aspect: number) {
	return MARKER_LAYOUT[aspect >= WIDE_ASPECT ? "wide" : "tall"];
}

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

/**
 * 远处抽行的视深阈值（场景单位），按 800px 高的视口、120 行标定：
 * 等级 1 的行在 [l1a, l1b] 之间淡出，等级 2 的行在 [l2a, l2b] 之间淡出。
 */
export const THIN_DEPTH = { l1a: 22, l1b: 32, l2a: 34, l2b: 46 };
export const THIN_REF = { height: 800, rows: QUALITY.high.rows };

/**
 * 按视口高度和行数缩放后的抽行阈值 [l1a, l1b, l2a, l2b]。
 * 投影行距 ∝ 视口高度 / (行数 × 视深)，所以阈值 ∝ 视口高度 / 行数：行越少，越晚开始抽。
 */
export function thinningThresholds(
	viewportHeight: number,
	rows: number,
): [number, number, number, number] {
	const k =
		Math.max(0.6, Math.min(1.6, viewportHeight / THIN_REF.height)) *
		(THIN_REF.rows / rows);
	return [
		THIN_DEPTH.l1a * k,
		THIN_DEPTH.l1b * k,
		THIN_DEPTH.l2a * k,
		THIN_DEPTH.l2b * k,
	];
}

/**
 * 地形边缘的淡出宽度（场景单位）：左右两侧和最远一排不再是一刀切的边，而是化进雾里。
 * 近处那条边只有飞到最高才看得见，淡得短一些。
 */
export const EDGE_FADE = { side: 4.5, far: 5, near: 2 };

function smoothstep(a: number, b: number, v: number): number {
	const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
	return t * t * (3 - 2 * t);
}

/** (x, z) 处的边缘淡出系数：1 = 完全可见，0 = 正在边界上。scene.ts 的着色器是同一个公式。 */
export function edgeFade(
	x: number,
	z: number,
	field: { width: number; depth: number } = FIELD,
): number {
	const hw = field.width / 2,
		hd = field.depth / 2;
	return (
		smoothstep(0, EDGE_FADE.side, hw - Math.abs(x)) *
		smoothstep(0, EDGE_FADE.far, z + hd) *
		smoothstep(0, EDGE_FADE.near, hd - z)
	);
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
