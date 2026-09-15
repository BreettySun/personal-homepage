import { describe, expect, it, vi } from "vitest";
import { execute } from "@/terminal/registry";
import type { TerminalContext } from "@/terminal/types";

function makeCtx(): TerminalContext {
	return {
		essays: [
			{
				slug: "丘陵",
				title: "丘陵",
				date: "2025-11-30",
				city: "随州",
				weather: "雨",
			},
		] as never,
		projects: [{ name: "地形志", year: 2026, stack: ["Vue"] }] as never,
		navigate: vi.fn(),
		setTheme: vi.fn(),
		setManual: vi.fn(),
		close: vi.fn(),
		params: {
			weather: "rain",
			season: "autumn",
			seed: 0x5c7e,
			intensity: 0.6,
			density: 1,
			source: "live",
		},
	};
}

describe("terminal commands", () => {
	it("ls lists essays by default and projects on request", async () => {
		const ctx = makeCtx();
		expect(await execute("ls", ctx)).toEqual(["2025-11-30  丘陵  # 随州 · 雨"]);
		expect(await execute("ls projects", ctx)).toEqual(["2026  地形志  # Vue"]);
	});
	it("cat navigates and closes", async () => {
		const ctx = makeCtx();
		await execute("cat 丘陵", ctx);
		expect(ctx.navigate).toHaveBeenCalledWith("/essays/丘陵");
		expect(ctx.close).toHaveBeenCalled();
		expect(ctx.navigate).toHaveBeenCalledTimes(1);
		expect(await execute("cat 不存在", ctx)).toEqual([
			expect.stringContaining("不存在"),
		]);
	});
	it("theme, seed and weather write through the context", async () => {
		const ctx = makeCtx();
		await execute("theme dark", ctx);
		expect(ctx.setTheme).toHaveBeenCalledWith("dark");
		await execute("seed 0x1234", ctx);
		expect(ctx.setManual).toHaveBeenCalledWith({ seed: 0x1234 });
		await execute("weather 雪", ctx);
		expect(ctx.setManual).toHaveBeenCalledWith({ weather: "snow" });
		// 状态行只锁"报了哪些参数"，不锁分隔符和顺序。
		const status = (await execute("weather", ctx)) as string[];
		expect(status).toHaveLength(1);
		for (const part of ["雨", "秋", "实时", "0.6"]) expect(status[0]).toContain(part);
	});
	it("clear returns the clear sentinel and unknown commands hint help", async () => {
		const ctx = makeCtx();
		expect(await execute("clear", ctx)).toEqual({ clear: true });
		const unknown = (await execute("rm -rf /", ctx)) as string[];
		expect(unknown.join(" ")).toContain("rm");
		expect(unknown.join(" ")).toContain("help");
		// sudo 是个彩蛋，只要求回一句话，文案随便改。
		expect(await execute("sudo", ctx)).toHaveLength(1);
	});
});
