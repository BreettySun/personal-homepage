import * as THREE from "three";
import {
	heightAt,
	MARKER_IDS,
	markerLayoutFor,
	type HeightfieldSpec,
	type MarkerId,
} from "./heightfield";

/**
 * 地图上的三个入口：符号和图例一一对应（文章 ●、项目 ▲、关于 □），
 * 一根细立柱把符号钉在地面上，脚下的涟漪在 terrainShader.ts 里画。
 * 符号是固定像素大小的精灵（像地图注记，飞高飞低都一样大），周围一圈底色"晕边"把等高线隔开。
 */

/** 符号离地高度（立柱长度，场景单位）与悬停时额外抬起的高度。 */
export const MARKER_LIFT = { rest: 0.55, hover: 0.35 };
/** 符号本身在屏幕上的直径（CSS px）：和图例里的字形差不多大。悬停放大到 hoverScale 倍。 */
export const MARKER_PX = 15;
export const MARKER_HOVER_SCALE = 1.35;
/** 立柱的不透明度。 */
const PIN_OPACITY = 0.8;
/** 点击判定半径（CSS px），比符号大一圈，触屏也点得中。 */
export const MARKER_HIT_PX = 22;

type Glyph = "dot" | "triangle" | "square";
const GLYPH: Record<MarkerId, Glyph> = {
	essays: "dot",
	projects: "triangle",
	about: "square",
};

export interface MarkerColors {
	/** 文章 ● */
	accent: string;
	/** 项目 ▲ */
	muted: string;
	/** 关于 □，也是立柱的颜色 */
	line: string;
	/** 晕边（底色） */
	halo: string;
}

const TEX = 128;
/** 纹理里符号本身占的比例；其余是晕边。 */
const GLYPH_FRACTION = 0.5;

/** 任意 CSS 颜色的同色全透明版本（借 2D context 把颜色规范成 #rrggbb）。 */
function transparentOf(ctx: CanvasRenderingContext2D, color: string): string {
	ctx.fillStyle = color;
	const hex = String(ctx.fillStyle);
	if (!/^#[0-9a-f]{6}$/i.test(hex)) return "rgba(0,0,0,0)";
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},0)`;
}

function drawGlyph(
	ctx: CanvasRenderingContext2D,
	glyph: Glyph,
	color: string,
	halo: string,
) {
	const c = TEX / 2;
	ctx.clearRect(0, 0, TEX, TEX);
	// 晕边：底色的软边圆，地图注记的"knockout"，让符号不被等高线穿过。
	// 渐变终点必须是同一颜色的全透明，渐到 transparent（透明黑）会在浅色底上勒出一圈灰边。
	const g = ctx.createRadialGradient(c, c, TEX * 0.3, c, c, TEX * 0.5);
	g.addColorStop(0, halo);
	g.addColorStop(1, transparentOf(ctx, halo));
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, TEX, TEX);
	const r = (TEX * GLYPH_FRACTION) / 2;
	ctx.fillStyle = color;
	ctx.strokeStyle = color;
	if (glyph === "dot") {
		ctx.beginPath();
		ctx.arc(c, c, r, 0, Math.PI * 2);
		ctx.fill();
	} else if (glyph === "triangle") {
		// 等边三角形，重心放在中心
		const h = r * 1.9;
		const half = h / Math.sqrt(3);
		ctx.beginPath();
		ctx.moveTo(c, c - (h * 2) / 3);
		ctx.lineTo(c + half, c + h / 3);
		ctx.lineTo(c - half, c + h / 3);
		ctx.closePath();
		ctx.fill();
	} else {
		const s = r * 1.62;
		const w = TEX * 0.055;
		ctx.lineWidth = w;
		ctx.strokeRect(c - s / 2 + w / 2, c - s / 2 + w / 2, s - w, s - w);
	}
}

export interface Markers {
	/** 按视口宽高比摆放，并按当前地形贴地。 */
	layout(spec: HeightfieldSpec, aspect: number): void;
	/** 每帧：悬停缓动、抬升、立柱；返回每个标记的悬停程度 0..1（涟漪用）。 */
	tick(hovered: MarkerId | null): void;
	/** 视口像素高度，精灵固定像素大小要用。 */
	setViewport(width: number, height: number, projectionY: number): void;
	setColors(c: MarkerColors): void;
	setOpacity(o: number): void;
	/** 屏幕空间命中：离指针最近、且在 MARKER_HIT_PX 以内的标记。 */
	pick(nx: number, ny: number, camera: THREE.Camera): MarkerId | null;
	/** 地面位置 (x, z) 与悬停程度，给涟漪着色器。 */
	ground(id: MarkerId): { x: number; z: number; hover: number };
	dispose(): void;
}

export function createMarkers(scene: THREE.Scene, colors: MarkerColors): Markers {
	const group = new THREE.Group();
	const state = new Map<
		MarkerId,
		{
			sprite: THREE.Sprite;
			canvas: HTMLCanvasElement;
			texture: THREE.CanvasTexture;
			x: number;
			z: number;
			groundY: number;
			hover: number;
		}
	>();
	for (const id of MARKER_IDS) {
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = TEX;
		const texture = new THREE.CanvasTexture(canvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		const material = new THREE.SpriteMaterial({
			map: texture,
			transparent: true,
			depthTest: false, // 注记永远压在地形上面，不会被山脊挡住
			depthWrite: false,
			fog: false, // 注记不参与雾化：雨雪天远处的符号也要保持图例里的颜色
			sizeAttenuation: false,
		});
		const sprite = new THREE.Sprite(material);
		sprite.renderOrder = 10;
		group.add(sprite);
		state.set(id, { sprite, canvas, texture, x: 0, z: 0, groundY: 0, hover: 0 });
	}
	// 立柱：每个标记一段竖线，从地面到符号底部
	const pinPositions = new Float32Array(MARKER_IDS.length * 6);
	const pinGeo = new THREE.BufferGeometry();
	pinGeo.setAttribute("position", new THREE.BufferAttribute(pinPositions, 3));
	const pinMat = new THREE.LineBasicMaterial({
		transparent: true,
		opacity: PIN_OPACITY,
	});
	const pins = new THREE.LineSegments(pinGeo, pinMat);
	pins.frustumCulled = false;
	group.add(pins);
	scene.add(group);

	let spriteScale = 0.03;
	let viewW = 1,
		viewH = 1;
	let opacity = 1;

	function paint(c: MarkerColors) {
		const glyphColor: Record<MarkerId, string> = {
			essays: c.accent,
			projects: c.muted,
			about: c.line,
		};
		for (const id of MARKER_IDS) {
			const s = state.get(id)!;
			drawGlyph(s.canvas.getContext("2d")!, GLYPH[id], glyphColor[id], c.halo);
			s.texture.needsUpdate = true;
		}
		pinMat.color.set(c.line);
	}
	paint(colors);

	const tmp = new THREE.Vector3();
	return {
		layout(spec, aspect) {
			const pos = markerLayoutFor(aspect);
			for (const id of MARKER_IDS) {
				const s = state.get(id)!;
				s.x = pos[id].x;
				s.z = pos[id].z;
				s.groundY = heightAt(spec, s.x, s.z);
			}
		},
		tick(hovered) {
			let i = 0;
			for (const id of MARKER_IDS) {
				const s = state.get(id)!;
				s.hover += ((id === hovered ? 1 : 0) - s.hover) * 0.12;
				const lift = MARKER_LIFT.rest + MARKER_LIFT.hover * s.hover;
				s.sprite.position.set(s.x, s.groundY + lift, s.z);
				const k = spriteScale * (1 + (MARKER_HOVER_SCALE - 1) * s.hover);
				s.sprite.scale.set(k, k, 1);
				// 立柱画到符号底边为止，不穿过符号
				pinPositions.set(
					[s.x, s.groundY, s.z, s.x, s.groundY + lift - 0.02, s.z],
					i * 6,
				);
				i++;
			}
			pinGeo.attributes.position.needsUpdate = true;
		},
		setViewport(width, height, projectionY) {
			viewW = width;
			viewH = height;
			// sizeAttenuation=false 时精灵在屏幕上高 scale × projectionY × H / 2 像素
			spriteScale = MARKER_PX / GLYPH_FRACTION / ((projectionY * height) / 2);
		},
		setColors(c) {
			paint(c);
		},
		setOpacity(o) {
			opacity = o;
			for (const s of state.values())
				(s.sprite.material as THREE.SpriteMaterial).opacity = o;
			pinMat.opacity = PIN_OPACITY * o;
		},
		pick(nx, ny, camera) {
			if (opacity < 0.5) return null;
			let best: MarkerId | null = null;
			let bestD = MARKER_HIT_PX * MARKER_HIT_PX;
			for (const id of MARKER_IDS) {
				const s = state.get(id)!;
				tmp.copy(s.sprite.position).project(camera);
				if (tmp.z > 1) continue;
				const dx = ((tmp.x - nx) * viewW) / 2,
					dy = ((tmp.y - ny) * viewH) / 2;
				const d = dx * dx + dy * dy;
				if (d < bestD) {
					bestD = d;
					best = id;
				}
			}
			return best;
		},
		ground(id) {
			const s = state.get(id)!;
			return { x: s.x, z: s.z, hover: s.hover };
		},
		dispose() {
			scene.remove(group);
			for (const s of state.values()) {
				s.texture.dispose();
				(s.sprite.material as THREE.Material).dispose();
			}
			pinGeo.dispose();
			pinMat.dispose();
		},
	};
}
