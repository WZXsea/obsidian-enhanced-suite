import {readFileSync} from "fs";
import {fileURLToPath} from "url";
import {runInNewContext} from "vm";
import {transformSync} from "esbuild";
import {describe, expect, it, vi} from "vitest";

interface Owner {
	closed: boolean;
	scrollLoadRaf: number | null;
	onResultScroll(): void;
	scheduleResultWindowLoad(): void;
}

function fixture() {
	const source = readFileSync(fileURLToPath(new URL("../floatSearchIndex.ts", import.meta.url)), "utf8");
	const scrollStart = source.indexOf("\tprivate readonly onResultScroll =");
	const scrollEnd = source.indexOf("\n\tprivate readonly onPreviewMouseDown", scrollStart);
	const loadStart = source.indexOf("\t\tprivate scheduleResultWindowLoad()");
	const loadEnd = source.indexOf("\n\t\tprivate renderDisclosure", loadStart);
	if ([scrollStart, scrollEnd, loadStart, loadEnd].some(index => index < 0)) throw Error("Result motion integration methods missing");
	const code = transformSync(`class Harness {${source.slice(scrollStart, scrollEnd)}${source.slice(loadStart, loadEnd)}};exports.Harness=Harness;`, {loader: "ts", format: "cjs"}).code;
	let active = false, limit = 100;
	const frames: Array<() => void> = [], rendered = vi.fn(), advance = vi.fn(() => {limit += 50;});
	const exports: {Harness?: new () => Owner} = {};
	runInNewContext(code, {exports, isResultMotionActive: () => active, isSearchableCmdkResult: () => true,
		window: {requestAnimationFrame(callback: () => void) {frames.push(callback); return frames.length;}}});
	if (!exports.Harness) throw Error("Result motion integration harness missing");
	const owner = new exports.Harness();
	Object.assign(owner, {closed: false, scrollLoadRaf: null,
		getCmdkResultContainer: () => ({scrollHeight: 400, scrollTop: 200, clientHeight: 200}),
		resultWindow: {snapshot: () => ({fileGroupLimit: limit}), autoLoadMoreFileGroups: advance},
		cmdkSourceResults: [], buildFileGroups: () => new Array(200), getCmdkChooser: () => ({}), setSortedSuggestions: rendered});
	return {owner, advance, rendered, frames, setActive: (value: boolean) => {active = value;}};
}

describe("fold motion and automatic result pagination", () => {
	it("keeps layout scroll events from rebuilding an animating group", () => {
		const f = fixture(); f.setActive(true);
		for (let index = 0; index < 20; index++) f.owner.onResultScroll();
		expect(f.frames).toHaveLength(0); expect(f.advance).not.toHaveBeenCalled(); expect(f.rendered).not.toHaveBeenCalled();
	});

	it("rechecks motion at the frame boundary and resumes after motion settles", () => {
		const f = fixture(); f.owner.onResultScroll(); f.setActive(true); f.frames.shift()?.();
		expect(f.advance).not.toHaveBeenCalled(); expect(f.owner.scrollLoadRaf).toBeNull();
		f.setActive(false); f.owner.onResultScroll(); f.frames.shift()?.();
		expect(f.advance).toHaveBeenCalledTimes(1); expect(f.rendered).toHaveBeenCalledTimes(1);
	});

	it("keeps a closed result view idle after a late motion-end notification", () => {
		const f = fixture(); f.owner.closed = true; f.owner.onResultScroll();
		expect(f.frames).toHaveLength(0); expect(f.advance).not.toHaveBeenCalled();
	});
});
