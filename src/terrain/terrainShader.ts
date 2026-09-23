import * as THREE from "three";
import { EDGE_FADE, FIELD } from "./heightfield";

/**
 * 地形的两种材质，共用一套 uniform：
 * - 线条：LineBasicMaterial 注入远处抽行、边缘淡出、晕渲、云影、标记涟漪、开场铺开；
 * - 遮挡面：同一张高度网格的三角面，只写深度（被山挡住的线不画），阴天时顺带画一层很淡的云影墨色。
 * 所有效果都在 onBeforeCompile 里改 three 自带的 basic 着色器，雾、色彩空间照旧由 three 处理。
 */

/** 着色器里云影是定长数组，必须 ≥ clouds.ts 的 CLOUD_COUNT。 */
export const MAX_CLOUDS = 6;
/** 标记点槽位，和 MARKER_IDS 一一对应。 */
export const MARKER_SLOTS = 3;

/** 晕渲强度：受光偏差为 ±1 时线条最多淡掉多少。 */
export const SHADE_STRENGTH = 0.6;

/**
 * 标记点的涟漪：从标记脚下沿等高线往外扩的一圈强调色，提示"这里能点"。
 * 平时 period 秒一圈、很淡；悬停时更快更亮。
 */
export const RIPPLE = {
	period: 5.5,
	speed: 0.95,
	width: 0.34,
	hoverWidth: 0.6,
	strength: 0.6,
	hoverPeriod: 2.2,
	hoverSpeed: 1.5,
};

/** 云影：地形上的淡墨（遮挡面的颜色）不透明度，和线条的变化。 */
export const CLOUD_SHADOW = { wash: 0.2, washDark: 0.32, tint: 0.55 };

/** 开场铺开：线条从 origin 向外铺，半径 radius 时铺满，soft 是前沿的羽化宽度（归一化）。 */
export const REVEAL = { origin: { x: 0, z: -2 }, radius: 26, soft: 0.18 };

export interface TerrainUniforms {
	/** 抽行阈值 [l1a, l1b, l2a, l2b]，见 heightfield.ts thinningThresholds。 */
	uThin: THREE.IUniform<THREE.Vector4>;
	/** x = 晕渲强度，y = 1 表示线比底色亮（雨夜），0 表示线比底色暗（宣纸）。 */
	uInk: THREE.IUniform<THREE.Vector2>;
	/** 每个标记：x, z, 当前这圈涟漪走到哪了（0..1，见 advanceRipple）, 悬停程度 0..1。 */
	uMarkers: THREE.IUniform<THREE.Vector4[]>;
	uAccent: THREE.IUniform<THREE.Color>;
	/** 每片云在地面上的影子：中心 x, z, 半宽, 半深。 */
	uClouds: THREE.IUniform<THREE.Vector4[]>;
	/** 云影总强度（阴天缓动到 1）。 */
	uCloudShadow: THREE.IUniform<number>;
	/** 云影下线条偏向的冷色（--muted）。 */
	uShadeColor: THREE.IUniform<THREE.Color>;
	/** 云影淡墨的颜色。 */
	uWashColor: THREE.IUniform<THREE.Color>;
	/** 开场铺开进度：0 全隐，1 全显。 */
	uReveal: THREE.IUniform<number>;
}

/**
 * 推进一圈涟漪的进度（0..1）。周期随悬停程度连续变化，只改变推进的速度，不会让圆圈跳位；
 * 如果在着色器里用"总时间对周期取模"，周期一变，取模结果会在一瞬间扫过好几圈。
 */
export function advanceRipple(cycle: number, dt: number, hover: number): number {
	const period = RIPPLE.period + (RIPPLE.hoverPeriod - RIPPLE.period) * hover;
	return (cycle + dt / period) % 1;
}

export function createTerrainUniforms(): TerrainUniforms {
	return {
		uThin: { value: new THREE.Vector4(1e4, 1e4, 1e4, 1e4) },
		uInk: { value: new THREE.Vector2(SHADE_STRENGTH, 0) },
		uMarkers: {
			value: Array.from({ length: MARKER_SLOTS }, () => new THREE.Vector4(1e4, 1e4, 0, 0)),
		},
		uAccent: { value: new THREE.Color() },
		uClouds: {
			value: Array.from({ length: MAX_CLOUDS }, () => new THREE.Vector4(1e4, 1e4, 1, 1)),
		},
		uCloudShadow: { value: 0 },
		uShadeColor: { value: new THREE.Color() },
		uWashColor: { value: new THREE.Color() },
		uReveal: { value: 1 },
	};
}

/** GLSL 浮点字面量（保证带小数点）。 */
function f(n: number): string {
	const s = String(n);
	return s.includes(".") || s.includes("e") ? s : `${s}.0`;
}

const HW = f(FIELD.width / 2);
const HD = f(FIELD.depth / 2);

const VERTEX_PARS = /* glsl */ `
attribute float aLevel;
attribute float aShade;
varying float vLevel;
varying float vDepth;
varying float vShade;
varying float vEdge;
varying vec2 vXZ;
`;

const VERTEX_MAIN = /* glsl */ `
vLevel = aLevel;
vDepth = - mvPosition.z;
vShade = aShade;
vXZ = position.xz;
vEdge = smoothstep( 0.0, ${f(EDGE_FADE.side)}, ${HW} - abs( position.x ) )
	* smoothstep( 0.0, ${f(EDGE_FADE.far)}, position.z + ${HD} )
	* smoothstep( 0.0, ${f(EDGE_FADE.near)}, ${HD} - position.z );
`;

const FRAGMENT_PARS = /* glsl */ `
uniform vec4 uThin;
uniform vec2 uInk;
uniform vec4 uMarkers[ ${MARKER_SLOTS} ];
uniform vec3 uAccent;
uniform vec4 uClouds[ ${MAX_CLOUDS} ];
uniform float uCloudShadow;
uniform vec3 uShadeColor;
uniform vec3 uWashColor;
uniform float uReveal;
varying float vLevel;
varying float vDepth;
varying float vShade;
varying float vEdge;
varying vec2 vXZ;

float cloudShadow() {
	if ( uCloudShadow <= 0.0 ) return 0.0; // not cloudy: skip the loop
	float s = 0.0;
	for ( int i = 0; i < ${MAX_CLOUDS}; i ++ ) {
		vec2 q = ( vXZ - uClouds[ i ].xy ) / uClouds[ i ].zw;
		s = max( s, exp( - 2.2 * dot( q, q ) ) );
	}
	return s * uCloudShadow;
}

float revealMask() {
	float rd = distance( vXZ, vec2( ${f(REVEAL.origin.x)}, ${f(REVEAL.origin.z)} ) ) / ${f(REVEAL.radius)};
	float front = uReveal * ( 1.0 + ${f(REVEAL.soft)} );
	return 1.0 - smoothstep( front - ${f(REVEAL.soft)}, front, rd );
}

float markerRipple( vec4 m ) {
	float d = distance( vXZ, m.xy );
	float reach = mix( ${f(RIPPLE.period * RIPPLE.speed)}, ${f(RIPPLE.hoverPeriod * RIPPLE.hoverSpeed)}, m.w );
	float life = 1.0 - m.z;
	float x = ( d - m.z * reach ) / mix( ${f(RIPPLE.width)}, ${f(RIPPLE.hoverWidth)}, m.w );
	return exp( - x * x ) * life * life * mix( ${f(RIPPLE.strength)}, 1.0, m.w );
}
`;

/**
 * 线条片元，按顺序：
 * 1. 远处抽行（线条的 mipmap，防摩尔纹）与边缘淡出；
 * 2. 晕渲 × 云影：宣纸上朝光的坡留白，雨夜里背光的坡和云影下变暗，云影下线色偏冷；
 * 3. 标记点的涟漪：线条染上强调色，被淡掉的线也暂时描回来；
 * 4. 开场从中间往外铺开。
 * 着色器源码里只写 ASCII：个别驱动不接受 GLSL 里的非 ASCII 字符，注释也不行。
 */
const LINE_MAIN = /* glsl */ `
// 1. row thinning + edge fade
float thin = vLevel > 1.5 ? smoothstep( uThin.z, uThin.w, vDepth )
	: vLevel > 0.5 ? smoothstep( uThin.x, uThin.y, vDepth ) : 0.0;
float presence = ( 1.0 - thin ) * vEdge;
diffuseColor.a *= presence;
// 2. hillshade x cloud shadow
float shadow = cloudShadow();
float lit = max( vShade, 0.0 ) * ( 1.0 - shadow );
float dim = max( max( - vShade, 0.0 ), shadow );
diffuseColor.a *= 1.0 - uInk.x * mix( lit, dim, uInk.y );
diffuseColor.rgb = mix( diffuseColor.rgb, uShadeColor, shadow * ${f(CLOUD_SHADOW.tint)} );
// 3. marker ripples
float ripple = 0.0;
for ( int i = 0; i < ${MARKER_SLOTS}; i ++ ) ripple += markerRipple( uMarkers[ i ] );
ripple = min( ripple, 1.0 );
diffuseColor.rgb = mix( diffuseColor.rgb, uAccent, ripple );
diffuseColor.a = mix( diffuseColor.a, max( diffuseColor.a, presence ), ripple );
// 4. intro reveal
diffuseColor.a *= revealMask();
`;

/** 遮挡面平时完全透明，只写深度；阴天在云影下铺一层淡墨。 */
const WASH_MAIN = /* glsl */ `
diffuseColor.rgb = uWashColor;
diffuseColor.a = cloudShadow() * mix( ${f(CLOUD_SHADOW.wash)}, ${f(CLOUD_SHADOW.washDark)}, uInk.y ) * vEdge * revealMask();
`;

function patch(
	material: THREE.Material,
	uniforms: TerrainUniforms,
	fragmentMain: string,
) {
	material.onBeforeCompile = (shader) => {
		Object.assign(shader.uniforms, uniforms);
		shader.vertexShader = shader.vertexShader
			.replace("#include <common>", `#include <common>\n${VERTEX_PARS}`)
			.replace("#include <fog_vertex>", `#include <fog_vertex>\n${VERTEX_MAIN}`);
		shader.fragmentShader = shader.fragmentShader
			.replace("#include <common>", `#include <common>\n${FRAGMENT_PARS}`)
			.replace(
				"vec4 diffuseColor = vec4( diffuse, opacity );",
				`vec4 diffuseColor = vec4( diffuse, opacity );\n${fragmentMain}`,
			);
	};
}

export function createLineMaterial(
	color: THREE.ColorRepresentation,
	uniforms: TerrainUniforms,
): THREE.LineBasicMaterial {
	const material = new THREE.LineBasicMaterial({
		color,
		transparent: true,
		opacity: 1,
	});
	patch(material, uniforms, LINE_MAIN);
	return material;
}

/**
 * 遮挡面：先于线条画（renderOrder 更小），写深度，被山脊挡住的线条、雨雪就不再透出来。
 * polygonOffset 把它往后推一点，贴在面上的线条才不会和它抢深度。
 */
export function createOccluderMaterial(uniforms: TerrainUniforms): THREE.MeshBasicMaterial {
	const material = new THREE.MeshBasicMaterial({
		transparent: true,
		depthWrite: true,
		side: THREE.DoubleSide,
		polygonOffset: true,
		polygonOffsetFactor: 1,
		polygonOffsetUnits: 1,
	});
	patch(material, uniforms, WASH_MAIN);
	return material;
}
