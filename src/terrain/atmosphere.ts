import type { WeatherState } from "@/weather/openMeteo";

/**
 * 天气决定的"大气"参数。粒子只覆盖雨雪落叶，晴和阴就靠这里区分：
 * 晴天雾推得远、线条满对比；阴天雾贴得近、雾色向 --muted 偏灰、线条变淡。
 * 数值相对相机高度范围（6–26）调过：阴天飞到最高处地形仍应可见。
 */
export interface Atmosphere {
	/** THREE.Fog 的 near / far（场景单位）。 */
	fogNear: number;
	fogFar: number;
	/** 雾色向 --muted 混合的比例，0 = 纯背景色。 */
	haze: number;
	/** 地形线条 opacity 的天气系数，和开场淡入的 opacity 相乘。 */
	lineOpacity: number;
}

export const ATMOSPHERE: Record<WeatherState, Atmosphere> = {
	clear: { fogNear: 18, fogFar: 60, haze: 0, lineOpacity: 1 },
	cloudy: { fogNear: 12, fogFar: 42, haze: 0.18, lineOpacity: 0.7 },
	rain: { fogNear: 13, fogFar: 44, haze: 0.12, lineOpacity: 0.85 },
	snow: { fogNear: 12, fogFar: 40, haze: 0.08, lineOpacity: 0.8 },
};

export function atmosphereFor(state: WeatherState): Atmosphere {
	return ATMOSPHERE[state];
}
