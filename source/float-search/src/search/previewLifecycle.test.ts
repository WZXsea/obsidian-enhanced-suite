import {buildSync} from "esbuild";
import {fileURLToPath} from "url";
import {runInNewContext} from "vm";
import {describe, expect, it, vi} from "vitest";
import {PreviewLifecycle} from "./previewLifecycle";

function deferred() {
	let resolve!: () => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<void>((yes, no) => {resolve = yes; reject = no;});
	return {promise, resolve, reject};
}

describe("native preview close lifecycle", () => {
	it("serializes native opens and cancels queued work when closing begins", async () => {
		const lifecycle = new PreviewLifecycle(), gate = deferred(), calls: string[] = [];
		const first = lifecycle.run(async () => {calls.push("open-a"); await gate.promise; calls.push("ready-a");});
		const second = lifecycle.run(async () => {calls.push("open-b");});
		await Promise.resolve(); expect(calls).toEqual(["open-a"]);
		lifecycle.close(() => calls.push("detach"));
		expect(lifecycle.opening).toBe(true); expect(calls).not.toContain("detach");
		gate.resolve(); await Promise.all([first, second]);
		expect(calls).toEqual(["open-a", "ready-a", "detach"]);
		expect(lifecycle.opening).toBe(false);
	});

	it("runs every open serially while the preview remains open", async () => {
		const lifecycle = new PreviewLifecycle(), gate = deferred(), calls: string[] = [];
		const first = lifecycle.run(async () => {calls.push("start-a"); await gate.promise; calls.push("end-a");});
		const second = lifecycle.run(async () => {calls.push("start-b"); return "b";});
		await Promise.resolve(); expect(calls).toEqual(["start-a"]);
		gate.resolve(); await first; expect(await second).toBe("b");
		expect(calls).toEqual(["start-a", "end-a", "start-b"]);
	});

	it("makes repeated and reentrant closes idempotent", () => {
		const lifecycle = new PreviewLifecycle(), cleanup = vi.fn(() => lifecycle.close(() => {throw Error("reentrant cleanup");}));
		lifecycle.close(cleanup); lifecycle.close(cleanup);
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("closes after a failed native load while propagating the original error", async () => {
		const lifecycle = new PreviewLifecycle(), gate = deferred(), cleanup = vi.fn();
		const work = lifecycle.run(() => gate.promise);
		const result = work.catch(error => error);
		await Promise.resolve(); lifecycle.close(cleanup);
		const failure = new Error("native load failed"); gate.reject(failure);
		expect(await result).toBe(failure); expect(cleanup).toHaveBeenCalledTimes(1);
		expect(lifecycle.opening).toBe(false);
	});

	it("ignores new native work once the close transaction has started", async () => {
		const lifecycle = new PreviewLifecycle(), open = vi.fn(async () => "new");
		lifecycle.close(() => {});
		expect(await lifecycle.run(open)).toBeUndefined(); expect(open).not.toHaveBeenCalled();
	});
});

interface PreviewOwner {
	lifecycle: PreviewLifecycle;
	finalized: boolean;
	detaching: boolean;
	opening: boolean;
	onTarget: boolean;
	timer: number;
	parent: null;
	abortController?: {unload(): void};
	hoverEl: {hide(): void; detach(): void};
	targetEl: {matchParent(): null};
	plugin: {app: {workspace: {setActiveLeaf: ReturnType<typeof vi.fn>}}};
	leaves(): TestLeaf[];
	nativeHide(): void;
	onHide(): void;
	unload(): void;
	hide(): void;
	runWhileOpen<T>(operation: () => Promise<T>): Promise<T | undefined>;
	openFile(file: object, state: {active: boolean}, leaf: TestLeaf): Promise<unknown>;
}
interface TestLeaf {openFile(): Promise<void>; detach(): void;}

function ownerFixture() {
	const code = buildSync({entryPoints: [fileURLToPath(new URL("../leafView.ts", import.meta.url))],
		bundle: true, platform: "node", format: "cjs", external: ["obsidian"], write: false}).outputFiles[0].text;
	const module: {exports: {EmbeddedView?: {prototype: object}}} = {exports: {}};
	const scheduled: Array<() => void> = [];
	class Component {}
	runInNewContext(code, {module, exports: module.exports,
		require: () => ({Component, PopoverState: {Hidden: 0}}),
		window: {setTimeout: (fn: () => void) => {scheduled.push(fn); return scheduled.length;}, clearTimeout() {}}, console});
	const adapter = module.exports.EmbeddedView;
	if (!adapter) throw Error("EmbeddedView export missing");
	const owner = Object.create(adapter.prototype) as PreviewOwner;
	Object.assign(owner, {lifecycle: new PreviewLifecycle(), finalized: false, detaching: false,
		onTarget: true, timer: 0, parent: null, hoverEl: {hide: vi.fn(), detach: vi.fn()},
		targetEl: {matchParent: () => null}, unload: vi.fn(),
		plugin: {app: {workspace: {setActiveLeaf: vi.fn()}}}});
	return {owner, scheduled};
}

describe("actual EmbeddedView owner lifecycle", () => {
	it("waits for native editor state before detach and tolerates layout-change reentrancy", async () => {
		const {owner, scheduled} = ownerFixture(), gate = deferred();
		let loaded = false, live = true, detached = 0;
		const leaf: TestLeaf = {openFile: async () => {await gate.promise; loaded = true;}, detach: () => {
			if (!loaded) throw Error("Field is not present in this state");
			detached++; live = false; owner.hide();
		}};
		owner.leaves = () => live ? [leaf] : [];
		const open = owner.openFile({}, {active: true}, leaf); await Promise.resolve();
		owner.hide(); owner.hide();
		expect(detached).toBe(0); expect(owner.opening).toBe(true);
		gate.resolve(); expect(await open).toBeUndefined();
		expect(detached).toBe(1); expect(owner.plugin.app.workspace.setActiveLeaf).not.toHaveBeenCalled();
		for (const fn of scheduled.splice(0)) fn();
		owner.hide(); owner.nativeHide();
		expect(owner.unload).toHaveBeenCalledTimes(1);
	});

	it("tracks non-file view initialization before closing a classic search owner", async () => {
		const {owner, scheduled} = ownerFixture(), gate = deferred(), detach = vi.fn();
		owner.leaves = () => [{openFile: async () => {}, detach}];
		const state = owner.runWhileOpen(() => gate.promise);
		await Promise.resolve(); owner.hide(); expect(detach).not.toHaveBeenCalled();
		gate.resolve(); await state; expect(detach).toHaveBeenCalledTimes(1);
		for (const fn of scheduled.splice(0)) fn();
		expect(owner.unload).toHaveBeenCalledTimes(1);
	});
});
