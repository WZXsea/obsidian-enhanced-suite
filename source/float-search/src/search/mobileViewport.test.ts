import {describe, expect, it} from "vitest";
import {bindMobileSearchViewport, getMobileSearchViewport} from "./mobileViewport";

describe("mobile search visible viewport", () => {
	it("fits portrait, landscape and keyboard-panned viewports", () => {
		for (const visual of [
			{width: 412, height: 915, offsetLeft: 0, offsetTop: 0},
			{width: 360, height: 312, offsetLeft: 0, offsetTop: 38},
			{width: 720, height: 240, offsetLeft: 24, offsetTop: 64},
			{width: 15, height: 8, offsetLeft: 0, offsetTop: 0},
		]) {
			const v = getMobileSearchViewport({innerWidth: 1024, innerHeight: 800, visualViewport: visual});
			expect(v.width).toBe(visual.width);
			expect(v.height).toBe(visual.height);
			expect(v.left).toBe(visual.offsetLeft);
			expect(v.top).toBe(visual.offsetTop);
			expect(v.width - 2 * v.margin).toBeGreaterThan(0);
			expect(v.height - 2 * v.margin).toBeGreaterThan(0);
		}
	});

	it("uses window dimensions when WebView lacks a usable visual viewport", () => {
		expect(getMobileSearchViewport({innerWidth: 360, innerHeight: 640})).toEqual({width: 360, height: 640, left: 0, top: 0, margin: 8});
		expect(getMobileSearchViewport({innerWidth: 360, innerHeight: 640, visualViewport: {width: 0, height: NaN, offsetLeft: -5, offsetTop: -8}})).toEqual({width: 360, height: 640, left: 0, top: 0, margin: 8});
	});

	it("reflows on keyboard resize and panning and removes every listener on close", () => {
		class Surface {
			listeners = new Map<string, Set<() => void>>();
			addEventListener(type: string, fn: () => void) {
				const group = this.listeners.get(type) ?? new Set(); group.add(fn); this.listeners.set(type, group);
			}
			removeEventListener(type: string, fn: () => void) { this.listeners.get(type)?.delete(fn); }
			emit(type: string) { for (const fn of this.listeners.get(type) ?? []) fn(); }
		}
		const visual = Object.assign(new Surface(), {width: 412, height: 915, offsetLeft: 0, offsetTop: 0});
		const win = Object.assign(new Surface(), {innerWidth: 412, innerHeight: 915, visualViewport: visual});
		const values = new Map<string, string>([["--fs-visible-width", "75vw"]]);
		const priorities = new Map<string, string>([["--fs-visible-width", "important"]]);
		const el = {style: {
			getPropertyValue: (key: string) => values.get(key) ?? "",
			getPropertyPriority: (key: string) => priorities.get(key) ?? "",
			setProperty: (key: string, value: string, priority = "") => {values.set(key, value); priorities.set(key, priority);},
			removeProperty: (key: string) => {values.delete(key); priorities.delete(key);},
		}} as unknown as HTMLElement;
		const dispose = bindMobileSearchViewport(el, win as unknown as Window);
		expect(values.get("--fs-visible-height")).toBe("915px");
		visual.height = 320; visual.emit("resize");
		expect(values.get("--fs-visible-height")).toBe("320px");
		visual.offsetTop = 40; visual.emit("scroll");
		expect(values.get("--fs-visible-top")).toBe("40px");
		dispose(); dispose();
		expect(values.size).toBe(1);
		expect(values.get("--fs-visible-width")).toBe("75vw");
		expect(priorities.get("--fs-visible-width")).toBe("important");
		for (const surface of [win, visual]) for (const fns of surface.listeners.values()) expect(fns.size).toBe(0);
	});
});
