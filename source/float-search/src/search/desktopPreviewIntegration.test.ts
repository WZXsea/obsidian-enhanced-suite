import {transformSync} from "esbuild";
import {readFileSync} from "fs";
import {fileURLToPath} from "url";
import {runInNewContext} from "vm";
import {afterEach, describe, expect, it, vi} from "vitest";
import {LatestPreviewQueue} from "./latestPreviewQueue";

interface File {path: string; extension: string; stat: {mtime: number; size: number};}
interface Target {file: File; line: number;}
interface Leaf {view: {file?: File};}
interface Owner {
	closed: boolean;
	previewRequestId: number;
	nativePreviewQueue: LatestPreviewQueue<Leaf | undefined>;
	showPreview(target: Target): Promise<void>;
	onClose(): void;
	invalidatePreviewRequest(): void;
	hidePreview(): void;
}

interface FocusOwner {
	closed: boolean;
	isComposing: boolean;
	isSortSelectActive: boolean;
	previewRequestId: number;
	previewInteractionGeneration: number;
	restoreCmdkInputFocus(requestId: number, interactionGeneration: number): void;
}

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>(yes => {resolve = yes;});
	return {promise, resolve};
}
async function flush() {for (let index = 0; index < 15; index++) await Promise.resolve();}
const target = (name: string, line = 0): Target => ({file: {path: `${name}.md`, extension: "md", stat: {mtime: 1, size: 10}}, line});

/** Compile the actual main methods so tests exercise the integrated scheduling guards. */
function fixture() {
	const source = readFileSync(fileURLToPath(new URL("../floatSearchIndex.ts", import.meta.url)), "utf8");
	const showStart = source.search(/\t(?:async )?showPreview\(result: SearchableCmdkResult\)/);
	const closeStart = source.indexOf("\n\tonClose()", showStart);
	const invalidationStart = source.indexOf("\tprivate invalidatePreviewRequest()");
	const focusStart = source.indexOf("\tprivate restoreCmdkInputFocus(", invalidationStart);
	if ([showStart, closeStart, invalidationStart, focusStart].some(index => index < 0)) throw Error("Preview integration methods missing");
	const methods = source.slice(invalidationStart, focusStart) + source.slice(showStart, closeStart) + source.slice(closeStart, source.lastIndexOf("\n}"));
	const code = transformSync(`class Harness extends class {onClose(){}} {${methods}}; exports.Harness=Harness;`, {loader: "ts", format: "cjs"}).code;
	const exports: {Harness?: new () => Owner} = {}, animate = vi.fn(), cancelMotion = vi.fn();
	runInNewContext(code, {exports, Platform: {isMobile: false}, window: {matchMedia: () => ({matches: false})},
		console, animateNavigation: animate, cancelSearchMotion: cancelMotion, RESULT_MOTION_END_EVENT: "fs-result-motion-end"});
	if (!exports.Harness) throw Error("Preview integration harness missing");
	const owner = new exports.Harness(), calls: string[] = [], fastGates = new Map<string, ReturnType<typeof deferred>>(), nativeGates = new Map<string, ReturnType<typeof deferred>>();
	const leaf: Leaf = {view: {}}, states: number[] = [], restore = vi.fn(), cancelPaint = vi.fn();
	let visible = false, detaching = false, scroll = 0, focus = "query", paintGate: ReturnType<typeof deferred> | undefined;
	const input = {value: "matching", removeEventListener() {}};
	const paint = vi.fn(async () => {await paintGate?.promise;});
	const fast = {show: vi.fn(async (result: Target) => {visible = true; await fastGates.get(result.file.path)?.promise;}), hide: vi.fn(() => {visible = false;}), destroy: vi.fn(() => {visible = false;})};
	const embedded = {opening: false, async openFile(file: File) {
		calls.push(file.path); this.opening = true; await nativeGates.get(file.path)?.promise;
		leaf.view.file = file; this.opening = false; return detaching ? undefined : leaf;
	}, hide: vi.fn(() => {detaching = true;})};
	Object.assign(owner, {closed: false, previewRequestId: 0, previewInteractionGeneration: 0, app: {workspace: {activeLeaf: {}}},
		previewEl: {show() {}, hide() {}, removeEventListener() {}}, bodyEl: {addClass() {}, removeClass() {}},
		previewResizeHandleEl: {show() {}, hide() {}}, fileLeaf: leaf, fileEmbeddedView: embedded,
		nativePreviewVersion: "", nativePreviewQueue: new LatestPreviewQueue<Leaf | undefined>(), desktopPreview: fast,
		desktopNativeHost: {}, getResultTarget: (result: Target) => result, getContentPreviewTarget: (result: Target) => result,
		ensurePreviewPane() {}, getRawQuery: () => input.value, getResultEphemeralState: (result: Target) => ({line: result.line}),
		waitForPreviewPaint: paint, cancelPreviewPaint: cancelPaint,
		ensurePreviewTargetState: (_leaf: Leaf, state: {line: number}) => {states.push(state.line); scroll = 0;}, restoreCmdkInputFocus: restore,
		activePreviewResizePointerId: null, scrollLoadRaf: null, cancelActiveSearch() {}, removePreviewResizeListeners() {},
		getCmdkResultContainer: () => ({removeEventListener() {}}), inputEl: input, closeFilterCompletions() {},
	});
	restore.mockImplementation(() => {focus = "query";});
	return {owner, calls, fastGates, nativeGates, states, restore, animate, fast, embedded, cancelPaint, paint, visible: () => visible,
		setQuery: (value: string) => {input.value = value;}, setPaintGate: (value: ReturnType<typeof deferred>) => {paintGate = value;},
		setScroll: (value: number) => {scroll = value;}, scroll: () => scroll, setFocus: (value: string) => {focus = value;}, focus: () => focus};
}

describe("desktop main preview scheduling", () => {
	it("drops an intermediate pending native load as soon as a newer slow first paint starts", async () => {
		const f = fixture(), a = deferred(), c = deferred();
		f.nativeGates.set("A.md", a); f.fastGates.set("C.md", c);
		const first = f.owner.showPreview(target("A")); await flush();
		const skipped = f.owner.showPreview(target("B")); await flush();
		const latest = f.owner.showPreview(target("C")); await flush(); a.resolve(); await first; await flush();
		expect(f.calls).toEqual(["A.md"]);
		c.resolve(); await Promise.all([skipped, latest]); expect(f.calls).toEqual(["A.md", "C.md"]);
	});

	it("reuses native work that becomes ready while the same file first paint is pending", async () => {
		const f = fixture(), native = deferred(), fast = deferred(); f.nativeGates.set("A.md", native);
		const first = f.owner.showPreview(target("A", 1)); await flush();
		f.fastGates.set("A.md", fast); const latest = f.owner.showPreview(target("A", 12)); await flush();
		native.resolve(); await first; fast.resolve(); await latest;
		expect(f.calls).toEqual(["A.md"]); expect(f.states).toEqual([12]); expect(f.visible()).toBe(false);
	});

	it("keeps the latest fast preview visible when an older native load finishes", async () => {
		const f = fixture(), nativeA = deferred(), nativeB = deferred(), fastB = deferred();
		f.nativeGates.set("A.md", nativeA); f.nativeGates.set("B.md", nativeB); f.fastGates.set("B.md", fastB);
		const first = f.owner.showPreview(target("A", 1)); await flush();
		const latest = f.owner.showPreview(target("B", 20)); await flush(); nativeA.resolve(); await first;
		expect(f.visible()).toBe(true); expect(f.states).toEqual([]); expect(f.fast.hide).not.toHaveBeenCalled();
		fastB.resolve(); await flush(); expect(f.visible()).toBe(true);
		nativeB.resolve(); await latest; expect(f.states).toEqual([20]); expect(f.fast.hide).toHaveBeenCalledTimes(1);
	});

	it("closes an active load without starting pending work or handing off late content", async () => {
		const f = fixture(), native = deferred(); f.nativeGates.set("A.md", native);
		const active = f.owner.showPreview(target("A")); await flush();
		const pending = f.owner.showPreview(target("B")); await flush(); f.owner.onClose();
		expect(f.owner.closed).toBe(true); expect(f.owner.nativePreviewQueue.open).toBe(true);
		expect(f.fast.destroy).toHaveBeenCalledTimes(1); expect(f.embedded.hide).toHaveBeenCalledTimes(1);
		native.resolve(); await Promise.all([active, pending]);
		expect(f.calls).toEqual(["A.md"]); expect(f.owner.nativePreviewQueue.open).toBe(false);
		expect(f.states).toEqual([]); expect(f.restore).not.toHaveBeenCalled(); expect(f.animate).not.toHaveBeenCalled();
	});

	it("closes while the first fragment is loading and keeps native work idle", async () => {
		const f = fixture(), fast = deferred(); f.fastGates.set("A.md", fast);
		const loading = f.owner.showPreview(target("A")); await flush(); f.owner.onClose(); fast.resolve(); await loading;
		expect(f.calls).toEqual([]); expect(f.owner.nativePreviewQueue.open).toBe(false); expect(f.visible()).toBe(false);
		expect(f.states).toEqual([]); expect(f.restore).not.toHaveBeenCalled();
	});

	it("invalidates pending native work and the fast overlay when a header control takes focus", async () => {
		const f = fixture(), native = deferred(); f.nativeGates.set("A.md", native);
		const active = f.owner.showPreview(target("A")); await flush();
		const pending = f.owner.showPreview(target("B")); await flush(); const before = f.owner.previewRequestId;
		f.owner.invalidatePreviewRequest(); expect(f.owner.previewRequestId).toBe(before + 1); expect(f.visible()).toBe(false);
		native.resolve(); await Promise.all([active, pending]);
		expect(f.calls).toEqual(["A.md"]); expect(f.states).toEqual([]); expect(f.restore).not.toHaveBeenCalled(); expect(f.cancelPaint).toHaveBeenCalled();
	});
});

describe("desktop semantic preview idempotence", () => {
	it("keeps native loading, location, motion, scrolling and focus stable across same-row hover repeats", async () => {
		const f = fixture(); await f.owner.showPreview(target("A", 12));
		f.setScroll(320); f.setFocus("native-editor"); const request = f.owner.previewRequestId;
		for (let index = 0; index < 30; index++) await f.owner.showPreview(target("A", 12));
		expect(f.calls).toEqual(["A.md"]); expect(f.states).toEqual([12]); expect(f.animate).toHaveBeenCalledTimes(1);
		expect(f.restore).toHaveBeenCalledTimes(1); expect(f.scroll()).toBe(320); expect(f.focus()).toBe("native-editor");
		expect(f.owner.previewRequestId).toBe(request);
	});

	it("reuses a same-target request during read and paint without restarting either stage", async () => {
		const f = fixture(), read = deferred(), paint = deferred(); f.fastGates.set("A.md", read); f.setPaintGate(paint);
		const requests = [f.owner.showPreview(target("A", 4))]; await flush(); const cancellationCount = f.cancelPaint.mock.calls.length;
		for (let index = 0; index < 15; index++) requests.push(f.owner.showPreview(target("A", 4)));
		await flush(); expect(f.fast.show).toHaveBeenCalledTimes(1); expect(f.paint).toHaveBeenCalledTimes(0);
		expect(f.cancelPaint).toHaveBeenCalledTimes(cancellationCount);
		read.resolve(); await flush(); expect(f.paint).toHaveBeenCalledTimes(1);
		for (let index = 0; index < 15; index++) requests.push(f.owner.showPreview(target("A", 4)));
		await flush(); expect(f.fast.show).toHaveBeenCalledTimes(1); expect(f.paint).toHaveBeenCalledTimes(1);
		expect(f.cancelPaint).toHaveBeenCalledTimes(cancellationCount);
		paint.resolve(); await Promise.all(requests);
		expect(f.calls).toEqual(["A.md"]); expect(f.states).toEqual([4]); expect(f.animate).toHaveBeenCalledTimes(1);
	});

	it("repositions changed lines and queries and refreshes changed versions or files", async () => {
		const f = fixture(); await f.owner.showPreview(target("A", 1)); await f.owner.showPreview(target("A", 2));
		const changed = target("A", 2); changed.file.stat.mtime = 2; await f.owner.showPreview(changed);
		f.setQuery("another query"); await f.owner.showPreview(changed); await f.owner.showPreview(target("B", 8));
		expect(f.calls).toEqual(["A.md", "A.md", "B.md"]); expect(f.states).toEqual([1, 2, 2, 2, 8]);
		expect(f.animate).toHaveBeenCalledTimes(5);
	});

	it("allows the same target to be reopened after hide or header invalidation", async () => {
		for (const action of ["hidePreview", "invalidatePreviewRequest"] as const) {
			const f = fixture(); await f.owner.showPreview(target("A", 1)); f.owner[action](); await f.owner.showPreview(target("A", 1));
			expect(f.calls).toEqual(["A.md"]); expect(f.states).toEqual([1, 1]); expect(f.animate).toHaveBeenCalledTimes(2);
		}
	});

	it("retries a target after a failed native load", async () => {
		const f = fixture(), native = vi.spyOn(f.embedded, "openFile").mockRejectedValueOnce(Error("native fixture failed"));
		const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			await f.owner.showPreview(target("A", 1)); await f.owner.showPreview(target("A", 1));
			expect(native).toHaveBeenCalledTimes(2); expect(f.states).toEqual([1]); expect(f.animate).toHaveBeenCalledTimes(1);
		} finally {warning.mockRestore();}
	});
});

function focusFixture() {
	const source = readFileSync(fileURLToPath(new URL("../floatSearchIndex.ts", import.meta.url)), "utf8");
	const start = source.indexOf("\tprivate restoreCmdkInputFocus("), end = source.indexOf("\n\tprivate ensurePreviewTargetState(", start);
	if (start < 0 || end < 0) throw Error("Preview focus method missing");
	const code = transformSync(`class Harness {${source.slice(start, end)}}; exports.Harness=Harness;`, {loader: "ts", format: "cjs"}).code;
	const exports: {Harness?: new () => FocusOwner} = {};
	runInNewContext(code, {exports, Platform: {isMobile: false}, window: {
		setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
		requestAnimationFrame: (callback: () => void) => setTimeout(callback, 16),
	}});
	if (!exports.Harness) throw Error("Preview focus harness missing");
	const owner = new exports.Harness(); let active = "native";
	const focus = vi.fn(() => {active = "query";});
	Object.assign(owner, {closed: false, isComposing: false, isSortSelectActive: false, previewRequestId: 1,
		previewInteractionGeneration: 0, focusSearchInputAfterAction: focus});
	return {owner, focus, active: () => active, select: (value: string) => {active = value;}};
}

describe("actual desktop delayed focus restoration", () => {
	afterEach(() => vi.useRealTimers());

	it("restores query focus while the request and user interaction generation stay current", async () => {
		vi.useFakeTimers(); const f = focusFixture();
		f.owner.restoreCmdkInputFocus(1, 0); await vi.advanceTimersByTimeAsync(140);
		expect(f.active()).toBe("query"); expect(f.focus).toHaveBeenCalledTimes(4);
	});

	it("preserves an editing choice made at 70ms when the 120ms callback runs", async () => {
		vi.useFakeTimers(); const f = focusFixture(); f.owner.restoreCmdkInputFocus(1, 0);
		await vi.advanceTimersByTimeAsync(70); const calls = f.focus.mock.calls.length;
		f.select("native-editor"); f.owner.previewInteractionGeneration++;
		await vi.advanceTimersByTimeAsync(80);
		expect(f.active()).toBe("native-editor"); expect(f.focus).toHaveBeenCalledTimes(calls);
	});

	it("retains sort and composition guards throughout all delayed callbacks", async () => {
		vi.useFakeTimers();
		for (const guard of ["isSortSelectActive", "isComposing"] as const) {
			const f = focusFixture(); f.owner[guard] = true; f.select(guard);
			f.owner.restoreCmdkInputFocus(1, 0); await vi.advanceTimersByTimeAsync(140);
			expect(f.active()).toBe(guard); expect(f.focus).not.toHaveBeenCalled();
		}
	});
});
