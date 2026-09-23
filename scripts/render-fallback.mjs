// 生成首页的静态地形图 public/terrain-fallback.svg 和手机用的 terrain-fallback-low.svg（npm run fallback）。
// 改了地形、相机、雾或默认种子之后手动重跑，不挂在 build 上。
//
// 实时地形建好之前、以及无 WebGL / 减少动态效果时，首页显示的就是这张图，它必须和随后接管的
// WebGL 地形重合，否则换上画布那一下会跳。所以几何（高度场、行的 z 抖动）、相机、雾、远处抽行、
// 边缘淡出都直接取自场景用的纯函数模块，这里只做投影、消隐和压缩。
//
// 输出是一张不带颜色的 alpha 遮罩：<mask> 里从远到近逐行画，先把这一行以下的区域涂黑（画家算法
// 消隐，被这道山脊挡住的远处的行就此抹掉），再用白色描这一行，白色的不透明度就是这条线在实时场景
// 里的可见度。遮罩作用在一块白色矩形上，整张图的 alpha 因而就是线条可见度；Home.vue 把它当 CSS
// mask-image 用、颜色取 var(--fg)，明暗两套主题都对。
import { statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ATMOSPHERE } from "../src/terrain/atmosphere.ts";
import { ALTITUDE, CAMERA, cameraPose } from "../src/terrain/camera.ts";
import {
	AMPLITUDE,
	buildHeightfield,
	edgeFade,
	FIELD,
	QUALITY,
	rowLevel,
	rowZ,
	thinningThresholds,
	THIN_REF,
} from "../src/terrain/heightfield.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
/** 手机（窄屏或触屏）上实时场景用 low 档（见 TerrainCanvas.vue），行数少一半，单独出一张。 */
const VARIANTS = [
	{ quality: "high", file: "public/terrain-fallback.svg" },
	{ quality: "low", file: "public/terrain-fallback-low.svg" },
];

// 即 src/weather/terrainParams.ts 的 DEFAULT_SEED。那个模块会带进 vue 和不写扩展名的
// ./openMeteo，Node 不能直接 import，只好在这里抄一份。
const SEED = 0x5c7e;

/**
 * 画幅（viewBox 单位）。实时相机固定竖直视角，视口比画幅窄时 cover 只裁两边，剩下的正好是
 * 相机看到的那一片；比画幅宽时 cover 只能放大、上下被裁，就对不上了。桌面浏览器去掉工具栏后的
 * 视口大多在 1.75–2.2 之间，都比 16:10 宽，所以画幅取 2.4:1。
 */
const W = 2400;
const H = 1000;
/** 折线只留到画幅外 MARGIN 为止；画幅下沿以下的部分压到 FLOOR 上。 */
const MARGIN = 4;
const FLOOR = H + MARGIN;
/** 折线简化（Ramer–Douglas–Peucker）的容差，viewBox 单位。 */
const TOLERANCE = 0.35;
/** 渐变色标允许的不透明度误差；一行里起伏不超过它就用纯色描边。 */
const OPACITY_TOLERANCE = 0.04;
/** 画幅内可见度最高还不到这个值的行不描。 */
const MIN_VISIBILITY = 0.02;
/** 雾和抽行沿行取走势时滑动平均的窗口（前后各多少个点）。 */
const SMOOTH = 12;
/**
 * 线宽，CSS px（non-scaling-stroke，不随缩放变粗变细）。高分屏上 Home.vue 把整张图按 pixelRatio
 * 倍大排版再缩回来，落到屏幕上是 1 个设备像素，和 WebGL 画的线一样。
 */
const STROKE_WIDTH = 1;
/**
 * 消隐的余量（viewBox 单位）：身后的线比这一行高出不到 DELTA 也照样涂黑，留出半个线宽加抗锯齿
 * （视口矮到 500px 时一个像素约 2 个单位）；涂黑的范围再往左右各放 PAD。
 */
const DELTA = 2;
const PAD = 4;
/** 坐标取整到 0.1，写成以 0.1 为单位的整数（外面套 scale(.1)），每个数省掉一个小数点。 */
const TENTHS = 10;

const atmosphere = ATMOSPHERE.clear;

// 相机：和 three.js 的 lookAt 一样看向自身 −z、up 为 +y；透视只取竖直视角，
// 所以投影比例只和画幅高度有关。
const { position: eye, target } = cameraPose(ALTITUDE.initial);
const axisZ = normalize(sub(eye, target));
const axisX = normalize(cross({ x: 0, y: 1, z: 0 }, axisZ));
const axisY = cross(axisZ, axisX);
const focal = H / 2 / Math.tan(((CAMERA.fov / 2) * Math.PI) / 180);

function sub(a, b) {
	return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function dot(a, b) {
	return a.x * b.x + a.y * b.y + a.z * b.z;
}
function cross(a, b) {
	return {
		x: a.y * b.z - a.z * b.y,
		y: a.z * b.x - a.x * b.z,
		z: a.x * b.y - a.y * b.x,
	};
}
function normalize(v) {
	const l = Math.hypot(v.x, v.y, v.z);
	return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/** 世界坐标 → viewBox 坐标，外加视深（three.js 里的 −mvPosition.z，雾和抽行都按它算）。 */
function project(x, y, z) {
	const d = sub({ x, y, z }, eye);
	const depth = -dot(d, axisZ);
	return {
		x: W / 2 + (focal * dot(d, axisX)) / depth,
		y: H / 2 - (focal * dot(d, axisY)) / depth,
		depth,
	};
}

function smoothstep(a, b, v) {
	const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
	return t * t * (3 - 2 * t);
}

/**
 * 线条可见度里随视深变的部分，与 terrainShader.ts 的线条着色器一致：(1 − 雾) × (1 − 远处抽行) × 天气系数，
 * 再乘边缘淡出就是整条线的可见度。THREE.Fog 的雾因子是 smoothstep(near, far, 视深)，不是线性的。
 * 晕渲不算进来：它随主题反向（宣纸上朝光的坡淡、雨夜里背光的坡淡），一张遮罩只能两边都不偏。
 */
function depthFactor(depth, level, [l1a, l1b, l2a, l2b]) {
	const fog = smoothstep(atmosphere.fogNear, atmosphere.fogFar, depth);
	const thin =
		level === 2
			? smoothstep(l2a, l2b, depth)
			: level === 1
				? smoothstep(l1a, l1b, depth)
				: 0;
	return (1 - fog) * (1 - thin) * atmosphere.lineOpacity;
}

/** 滑动平均，窗口为前后各 k 个点（两头窗口截短）。 */
function smooth(values, k) {
	return values.map((_, i) => {
		const a = Math.max(0, i - k),
			b = Math.min(values.length - 1, i + k);
		let sum = 0;
		for (let j = a; j <= b; j++) sum += values[j];
		return sum / (b - a + 1);
	});
}

/** 只留画幅内的一段，两头各多留一个画幅外的点，线才画得到边上。要求 x 沿行递增。 */
function trim(pts) {
	let a = 0,
		b = pts.length - 1;
	while (a < b && pts[a + 1].x < -MARGIN) a++;
	while (b > a && pts[b - 1].x > W + MARGIN) b--;
	return pts.slice(a, b + 1);
}

/** 画幅下沿以下的部分压到 FLOOR 上；穿过 FLOOR 的地方插入交点，画幅内的线形不变。 */
function clampBelow(pts) {
	const out = [];
	pts.forEach((p, i) => {
		const q = pts[i - 1];
		if (q && (q.y - FLOOR) * (p.y - FLOOR) < 0) {
			const t = (FLOOR - q.y) / (p.y - q.y);
			out.push({ x: q.x + t * (p.x - q.x), y: FLOOR });
		}
		out.push(p.y > FLOOR ? { x: p.x, y: FLOOR } : p);
	});
	return out;
}

/** Ramer–Douglas–Peucker：保留首尾，偏离 error(p, a, b) 超过 tol 的点才留下。 */
function simplify(pts, tol, error) {
	const keep = new Uint8Array(pts.length);
	keep[0] = keep[pts.length - 1] = 1;
	const stack = [[0, pts.length - 1]];
	while (stack.length) {
		const [a, b] = stack.pop();
		let worst = tol,
			index = -1;
		for (let i = a + 1; i < b; i++) {
			const e = error(pts[i], pts[a], pts[b]);
			if (e > worst) {
				worst = e;
				index = i;
			}
		}
		if (index < 0) continue;
		keep[index] = 1;
		stack.push([a, index], [index, b]);
	}
	return pts.filter((_, i) => keep[i]);
}

/** 点到线段的距离。 */
function segmentError(p, a, b) {
	const dx = b.x - a.x,
		dy = b.y - a.y;
	const len2 = dx * dx + dy * dy;
	const t = len2
		? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
		: 0;
	return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/** 不透明度曲线上的竖直误差（t 是渐变上的位置，v 是不透明度）。 */
function opacityError(p, a, b) {
	const k = (p.t - a.t) / (b.t - a.t);
	return Math.abs(p.v - (a.v + k * (b.v - a.v)));
}

/** 取整到 TENTHS 单位，并去掉取整后重合的相邻点。 */
function quantize(pts) {
	const out = [];
	for (const p of pts) {
		const q = { x: Math.round(p.x * TENTHS), y: Math.round(p.y * TENTHS) };
		const last = out[out.length - 1];
		if (!last || last.x !== q.x || last.y !== q.y) out.push(q);
	}
	return out;
}

/** 折线（x 递增）在 x 处的 y。 */
function yAt(pts, x) {
	let j = 0;
	while (j < pts.length - 2 && pts[j + 1].x < x) j++;
	const a = pts[j],
		b = pts[j + 1];
	return b.x > a.x ? a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y) : a.y;
}

/** 数字尽量短：去掉多余的 0，0.50 → .5，1.000 → 1。 */
function num(v, digits) {
	const s = v
		.toFixed(digits)
		.replace(/(\.\d*?)0+$/, "$1")
		.replace(/\.$/, "")
		.replace(/^0\./, ".");
	return s === "-0" ? "0" : s;
}

/** 整数折线的 path 数据：相对坐标，负号本身就是分隔，只在非负数前补空格。 */
function pathData(pts) {
	let d = `M${pts[0].x}${pts[0].y < 0 ? "" : " "}${pts[0].y}l`;
	for (let i = 1; i < pts.length; i++) {
		const dx = pts[i].x - pts[i - 1].x,
			dy = pts[i].y - pts[i - 1].y;
		d += `${i > 1 && dx >= 0 ? " " : ""}${dx}${dy >= 0 ? " " : ""}${dy}`;
	}
	return d;
}

/**
 * 这一行的遮挡范围（TENTHS 单位的 [xa, xb] 列表）。lowest[i] 是 x = i − MARGIN 这一列上
 * 已描的线里屏幕上最靠下的那条；这一行在那里比它高、或者低得不到 DELTA，这一列才要涂黑。
 * 其余地方涂了也只是盖在黑底上，白白让光栅化变慢。
 */
function occluded(drawn, lowest) {
	const x0 = drawn[0].x,
		x1 = drawn[drawn.length - 1].x;
	const ranges = [];
	lowest.forEach((low, i) => {
		const x = (i - MARGIN) * TENTHS;
		if (x < x0 || x > x1 || !(low > yAt(drawn, x) - DELTA * TENTHS)) return;
		const a = Math.max(x0, x - PAD * TENTHS),
			b = Math.min(x1, x + PAD * TENTHS);
		const last = ranges[ranges.length - 1];
		if (last && a <= last[1]) last[1] = b;
		else ranges.push([a, b]);
	});
	return ranges;
}

/** 一段遮挡：这一行在 [xa, xb] 之间的折线，往下一直涂到画幅外。 */
function occluder(drawn, xa, xb) {
	const top = [
		{ x: xa, y: Math.round(yAt(drawn, xa)) },
		...drawn.filter((p) => p.x > xa && p.x < xb),
		{ x: xb, y: Math.round(yAt(drawn, xb)) },
	];
	return `<path d="${pathData(top)}V${FLOOR * TENTHS}H${xa}z"/>`;
}

function render(quality) {
	const spec = { ...QUALITY[quality], ...FIELD, amplitude: AMPLITUDE, seed: SEED };
	// 远处抽行按实时场景标定用的视口高度（800px）算：常见笔记本窗口就是这个高度，交叉淡化时远处的疏密对得上
	const thresholds = thinningThresholds(THIN_REF.height, spec.rows);
	const heights = buildHeightfield(spec);
	const zs = rowZ(spec);
	const lowest = new Float64Array(W + 2 * MARGIN + 1).fill(-Infinity);
	const gradients = [];
	const body = [];
	let strokes = 0;

	// r = 0 是最远的一行（z = −depth/2）：从远到近画，近处的山脊才能盖住远处的线。
	for (let r = 0; r < spec.rows; r++) {
		const level = rowLevel(r);
		const row = [];
		for (let c = 0; c < spec.cols; c++) {
			const x = -spec.width / 2 + (c / (spec.cols - 1)) * spec.width;
			const p = project(x, heights[r * spec.cols + c], zs[r]);
			row.push({ ...p, edge: edgeFade(x, zs[r]) });
		}
		const samples = trim(row);
		const inFrame = samples.map((p) => p.x >= 0 && p.x <= W && p.y <= H);
		if (!inFrame.includes(true)) continue; // 整行在画幅外，连遮挡都用不上

		const drawn = quantize(
			simplify(clampBelow(samples), TOLERANCE, segmentError),
		);
		for (const [xa, xb] of occluded(drawn, lowest))
			body.push(occluder(drawn, xa, xb));

		// 雾和抽行按视深算，视深随每个点的高低起伏；一条横向渐变表达不了逐点的起伏，
		// 只取它沿行的走势（滑动平均），边缘淡出照原样乘上去。
		const factor = smooth(
			samples.map((p) => depthFactor(p.depth, level, thresholds)),
			SMOOTH,
		);
		const x0 = drawn[0].x,
			x1 = drawn[drawn.length - 1].x;
		const profile = samples.map((p, i) => ({
			t: (p.x * TENTHS - x0) / (x1 - x0),
			v: factor[i] * p.edge,
		}));
		const stroked =
			Math.max(...profile.filter((_, i) => inFrame[i]).map((p) => p.v)) >=
			MIN_VISIBILITY;

		// 这一行画完之后，它下面的线要么被涂掉了、要么本来就没有：描了线，它自己就是最低的；
		// 没描，最低的也不会低过它。
		lowest.forEach((low, i) => {
			const x = (i - MARGIN) * TENTHS;
			if (x < x0 || x > x1) return;
			const y = yAt(drawn, x);
			lowest[i] = stroked ? y : Math.min(low, y);
		});
		if (!stroked) continue;
		strokes++;

		// 可见度沿行的变化（主要是左右两侧的边缘淡出）做成横向渐变；起伏在误差以内就用纯色。
		const vs = profile.map((p) => p.v);
		const lo = Math.min(...vs),
			hi = Math.max(...vs);
		let paint;
		if (hi - lo <= 2 * OPACITY_TOLERANCE) {
			const o = (hi + lo) / 2;
			paint =
				o > 0.995
					? `stroke="#fff"`
					: `stroke="#fff" stroke-opacity="${num(o, 2)}"`;
		} else {
			const id = `g${gradients.length.toString(36)}`;
			const stops = simplify(profile, OPACITY_TOLERANCE, opacityError).map(
				(p) =>
					`<stop offset="${num(Math.max(0, Math.min(1, p.t)), 3)}" stop-opacity="${num(p.v, 2)}"/>`,
			);
			gradients.push(
				`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x0}" x2="${x1}">${stops.join("")}</linearGradient>`,
			);
			paint = `stroke="url(#${id})"`;
		}
		body.push(`<path ${paint} d="${pathData(drawn)}"/>`);
	}

	const svg = [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">`,
		`<!-- 由 scripts/render-fallback.mjs 生成（npm run fallback），不要手改。${quality} 档，seed 0x${SEED.toString(16)}，高度 ${ALTITUDE.initial}，晴 -->`,
		"<defs>",
		// 带 stroke 属性的是线，其余 path 是遮挡用的黑色填充
		`<style>stop{stop-color:#fff}[stroke]{fill:none;stroke-width:${STROKE_WIDTH};vector-effect:non-scaling-stroke}</style>`,
		...gradients,
		`<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">`,
		`<rect width="${W}" height="${H}"/>`,
		`<g transform="scale(${num(1 / TENTHS, 3)})">`,
		...body,
		"</g>",
		"</mask>",
		"</defs>",
		`<rect width="${W}" height="${H}" fill="#fff" mask="url(#m)"/>`,
		"</svg>",
		"",
	].join("\n");
	return { svg, strokes, gradients: gradients.length, occluders: body.length - strokes };
}

for (const { quality, file } of VARIANTS) {
	const { svg, strokes, gradients, occluders } = render(quality);
	const out = path.join(ROOT, file);
	writeFileSync(out, svg);
	console.log(
		`${file}  ${(statSync(out).size / 1024).toFixed(1)} KB  (${strokes} lines, ${gradients} gradients, ${occluders} occluders)`,
	);
}
