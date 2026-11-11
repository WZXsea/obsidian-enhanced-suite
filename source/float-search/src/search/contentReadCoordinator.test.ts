import { describe, expect, it, vi } from "vitest";
import { ContentReadCoordinator } from "./contentReadCoordinator";

const version = (path = "Note.md", mtime = 1, size = 10) => ({
	mtime,
	path,
	size,
});

const deferred = <T>() => {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, reject, resolve };
};

describe("ContentReadCoordinator", () => {
	it("deduplicates concurrent reads for the same path version", async () => {
		const coordinator = new ContentReadCoordinator();
		const pending = deferred<string>();
		const loader = vi.fn(() => pending.promise);

		const first = coordinator.read(version(), loader);
		const second = coordinator.read(version(), loader);

		expect(second).toBe(first);
		expect(loader).toHaveBeenCalledTimes(1);
		pending.resolve("content");
		await expect(first).resolves.toBe("content");
		await expect(second).resolves.toBe("content");
	});

	it("does not merge different versions of the same path", async () => {
		const coordinator = new ContentReadCoordinator();
		const oldRead = deferred<string>();
		const newRead = deferred<string>();
		const oldLoader = vi.fn(() => oldRead.promise);
		const newLoader = vi.fn(() => newRead.promise);

		const first = coordinator.read(version("Note.md", 1, 10), oldLoader);
		const second = coordinator.read(
			version("Note.md", 2, 10),
			newLoader
		);

		expect(second).not.toBe(first);
		expect(oldLoader).toHaveBeenCalledTimes(1);
		expect(newLoader).toHaveBeenCalledTimes(1);
		oldRead.resolve("old");
		newRead.resolve("new");
		await expect(first).resolves.toBe("old");
		await expect(second).resolves.toBe("new");
	});

	it("removes resolved and rejected reads from the in-flight set", async () => {
		const coordinator = new ContentReadCoordinator();
		const resolvedLoader = vi.fn(async () => "first");

		await expect(
			coordinator.read(version(), resolvedLoader)
		).resolves.toBe("first");
		await expect(
			coordinator.read(version(), resolvedLoader)
		).resolves.toBe("first");
		expect(resolvedLoader).toHaveBeenCalledTimes(2);

		const rejectedLoader = vi.fn(async () => {
			throw new Error("failed");
		});
		await expect(
			coordinator.read(version("Other.md"), rejectedLoader)
		).rejects.toThrow("failed");
		await expect(
			coordinator.read(version("Other.md"), rejectedLoader)
		).rejects.toThrow("failed");
		expect(rejectedLoader).toHaveBeenCalledTimes(2);
	});

	it("invalidates a path without cancelling its existing callers", async () => {
		const coordinator = new ContentReadCoordinator();
		const staleRead = deferred<string>();
		const staleLoader = vi.fn(() => staleRead.promise);
		const freshLoader = vi.fn(async () => "fresh");

		const stale = coordinator.read(version(), staleLoader);
		expect(coordinator.invalidate("Note.md")).toBe(true);
		const fresh = coordinator.read(version(), freshLoader);

		staleRead.resolve("stale");
		await expect(stale).resolves.toBe("stale");
		await expect(fresh).resolves.toBe("fresh");
		expect(staleLoader).toHaveBeenCalledTimes(1);
		expect(freshLoader).toHaveBeenCalledTimes(1);
		expect(coordinator.invalidate("missing.md")).toBe(false);
	});

	it("invalidates both path identities on rename", async () => {
		const coordinator = new ContentReadCoordinator();
		const oldRead = deferred<string>();
		const destinationRead = deferred<string>();
		const oldLoader = vi.fn(() => oldRead.promise);
		const destinationLoader = vi.fn(() => destinationRead.promise);

		const oldPromise = coordinator.read(version("Old.md"), oldLoader);
		const destinationPromise = coordinator.read(
			version("New.md"),
			destinationLoader
		);
		expect(coordinator.rename("Old.md", "New.md")).toBe(true);

		const renamedLoader = vi.fn(async () => "renamed");
		const renamedPromise = coordinator.read(
			version("New.md"),
			renamedLoader
		);
		oldRead.resolve("old");
		destinationRead.resolve("destination");

		await expect(oldPromise).resolves.toBe("old");
		await expect(destinationPromise).resolves.toBe("destination");
		await expect(renamedPromise).resolves.toBe("renamed");
		expect(renamedLoader).toHaveBeenCalledTimes(1);
		expect(coordinator.rename("missing.md", "also-missing.md")).toBe(false);
	});

	it("clears tracked reads without cancelling existing callers", async () => {
		const coordinator = new ContentReadCoordinator();
		const staleRead = deferred<string>();
		const staleLoader = vi.fn(() => staleRead.promise);
		const freshLoader = vi.fn(async () => "fresh");

		const stale = coordinator.read(version(), staleLoader);
		expect(coordinator.clear()).toBe(true);
		expect(coordinator.clear()).toBe(false);
		const fresh = coordinator.read(version(), freshLoader);

		staleRead.resolve("stale");
		await expect(stale).resolves.toBe("stale");
		await expect(fresh).resolves.toBe("fresh");
		expect(staleLoader).toHaveBeenCalledTimes(1);
		expect(freshLoader).toHaveBeenCalledTimes(1);
	});
});
