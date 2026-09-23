/**
 * 地形晕渲（hillshade）的纯函数部分：给每个顶点算一个"受光偏差"，着色器据此调线条的墨色。
 *
 * 光从画面左上方、略偏观众一侧打来：人眼默认光源在左上方（地图晕渲也按这个约定），
 * 光源若在观众身后，正对镜头的坡面全被照平，看不出起伏。
 * 平地记 0，朝光的坡为正，背光的坡为负，范围夹在 [-1, 1]。
 * 宣纸主题（线比底色深）朝光的坡少墨留白；雨夜主题（线比底色亮）背光的坡变暗。映射在 lineMaterial.ts。
 */
export const LIGHT = normalize({ x: -0.62, y: 0.7, z: 0.35 });

/** 坡度到受光偏差的放大系数：地形最陡处约 20°，放大后正好用满 [-1, 1]。 */
export const SHADE_GAIN = 2.6;

function normalize(v: { x: number; y: number; z: number }) {
	const l = Math.hypot(v.x, v.y, v.z);
	return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/**
 * 按网格上的高度算每个顶点的受光偏差。法线用相邻顶点的中心差分（边上用单侧差分），
 * 行的 z 带抖动，所以 z 方向的差分用真实行距而不是平均行距。
 */
export function vertexShade(
	heights: Float32Array,
	cols: number,
	rows: number,
	width: number,
	zs: Float32Array,
	light = LIGHT,
	gain = SHADE_GAIN,
): Float32Array {
	const out = new Float32Array(cols * rows);
	const dx = width / (cols - 1);
	for (let r = 0; r < rows; r++) {
		const r0 = Math.max(0, r - 1),
			r1 = Math.min(rows - 1, r + 1);
		const dz = zs[r1] - zs[r0];
		for (let c = 0; c < cols; c++) {
			const c0 = Math.max(0, c - 1),
				c1 = Math.min(cols - 1, c + 1);
			const dhdx = (heights[r * cols + c1] - heights[r * cols + c0]) / ((c1 - c0) * dx);
			const dhdz = (heights[r1 * cols + c] - heights[r0 * cols + c]) / dz;
			// 法线 = normalize(-dh/dx, 1, -dh/dz)
			const inv = 1 / Math.hypot(dhdx, 1, dhdz);
			const lit = (-dhdx * light.x + light.y - dhdz * light.z) * inv;
			out[r * cols + c] = Math.max(-1, Math.min(1, (lit - light.y) * gain));
		}
	}
	return out;
}
