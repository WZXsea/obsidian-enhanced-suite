import {describe, expect, it, vi} from "vitest";
import {LatestPreviewQueue} from "./latestPreviewQueue";

function deferred<T>() {
	let resolve!: (value: T) => void, reject!: (error: unknown) => void;
	const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no;});
	return {promise, resolve, reject};
}

describe("latest native preview queue", () => {
	it("executes one active load and replaces intermediate waiting targets", async () => {
		const queue = new LatestPreviewQueue<string>(), a = deferred<string>(), c = deferred<string>(), calls: string[] = [];
		const first = queue.run("a", () => {calls.push("a"); return a.promise;});
		const skipped = queue.run("b", async () => {calls.push("b"); return "b";});
		const latest = queue.run("c", () => {calls.push("c"); return c.promise;});
		expect(queue.open).toBe(true); expect(await skipped).toBeUndefined(); expect(calls).toEqual(["a"]);
		a.resolve("a"); expect(await first).toBe("a"); await Promise.resolve();
		expect(calls).toEqual(["a", "c"]); expect(queue.open).toBe(true);
		c.resolve("c"); expect(await latest).toBe("c"); expect(queue.open).toBe(false);
	});

	it("reuses the exact active promise and discards a waiting target when active is selected again", async () => {
		const queue = new LatestPreviewQueue<string>(), gate = deferred<string>(), duplicate = vi.fn(async () => "duplicate"), waiting = vi.fn(async () => "b");
		const first = queue.run("a", () => gate.promise), pending = queue.run("b", waiting);
		expect(queue.run("a", duplicate)).toBe(first); expect(await pending).toBeUndefined();
		gate.resolve("a"); expect(await first).toBe("a");
		expect(duplicate).not.toHaveBeenCalled(); expect(waiting).not.toHaveBeenCalled(); expect(queue.open).toBe(false);
	});

	it("keeps the pending promise while refreshing its operation", async () => {
		const queue = new LatestPreviewQueue<string>(), gate = deferred<string>(), old = vi.fn(async () => "old"), updated = vi.fn(async () => "updated");
		const first = queue.run("a", () => gate.promise), pending = queue.run("b", old);
		expect(queue.run("b", updated)).toBe(pending);
		gate.resolve("a"); await first; expect(await pending).toBe("updated");
		expect(old).not.toHaveBeenCalled(); expect(updated).toHaveBeenCalledTimes(1);
	});

	it("cancels pending work for hide while retaining active work and later requests", async () => {
		const queue = new LatestPreviewQueue<string>(), gate = deferred<string>(), canceled = vi.fn(async () => "b");
		const first = queue.run("a", () => gate.promise), pending = queue.run("b", canceled);
		queue.cancelPending(); queue.cancelPending(); expect(await pending).toBeUndefined(); expect(queue.open).toBe(true);
		const next = queue.run("c", async () => "c"); gate.resolve("a");
		expect(await first).toBe("a"); expect(await next).toBe("c"); expect(canceled).not.toHaveBeenCalled();
	});

	it("closes by dropping pending work and waiting for the active load to settle", async () => {
		const queue = new LatestPreviewQueue<string>(), gate = deferred<string>(), pendingOperation = vi.fn(async () => "b"), newOperation = vi.fn(async () => "c");
		const active = queue.run("a", () => gate.promise), pending = queue.run("b", pendingOperation);
		queue.close(); queue.close();
		expect(await pending).toBeUndefined(); expect(await queue.run("c", newOperation)).toBeUndefined(); expect(queue.open).toBe(true);
		let settled = false; void active.then(() => {settled = true;}); await Promise.resolve(); expect(settled).toBe(false);
		gate.resolve("a"); expect(await active).toBeUndefined(); expect(queue.open).toBe(false);
		expect(pendingOperation).not.toHaveBeenCalled(); expect(newOperation).not.toHaveBeenCalled();
	});

	it("propagates active failures and continues with the latest waiting load", async () => {
		const queue = new LatestPreviewQueue<string>(), gate = deferred<string>(), failure = Error("native failed");
		const active = queue.run("a", () => gate.promise), rejection = expect(active).rejects.toBe(failure);
		const next = queue.run("b", async () => "b"); gate.reject(failure);
		await rejection; expect(await next).toBe("b"); expect(queue.open).toBe(false);
	});

	it("settles a rejected active load as undefined after close", async () => {
		const queue = new LatestPreviewQueue<string>(), gate = deferred<string>();
		const active = queue.run("a", () => gate.promise); queue.close(); gate.reject(Error("closed native load"));
		expect(await active).toBeUndefined(); expect(queue.open).toBe(false);
	});

	it("converts synchronous operation failures to promise rejections and remains reusable", async () => {
		const queue = new LatestPreviewQueue<string>(), failure = Error("synchronous native failure");
		expect(queue.open).toBe(false);
		const active = queue.run("a", () => {throw failure;});
		await expect(active).rejects.toBe(failure); expect(queue.open).toBe(false);
		expect(await queue.run("b", async () => "b")).toBe("b"); expect(queue.open).toBe(false);
	});
});
