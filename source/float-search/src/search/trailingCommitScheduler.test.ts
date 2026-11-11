import { describe, expect, it } from "vitest";
import {
	DEFAULT_COMMIT_DELAY_MS,
	TrailingCommitScheduler,
	type CommitTimerApi,
} from "./trailingCommitScheduler";

interface FakeTimer {
	callback: () => void;
	dueAt: number;
}

class FakeTimerApi implements CommitTimerApi {
	private now = 0;
	private nextHandle = 0;
	private readonly timers = new Map<number, FakeTimer>();
	readonly clearedHandles: number[] = [];

	setTimeout(callback: () => void, delayMs: number): unknown {
		const handle = this.nextHandle++;
		this.timers.set(handle, {
			callback,
			dueAt: this.now + delayMs,
		});
		return handle;
	}

	clearTimeout(handle: unknown) {
		const numericHandle = handle as number;
		this.clearedHandles.push(numericHandle);
		this.timers.delete(numericHandle);
	}

	advanceBy(durationMs: number) {
		const target = this.now + durationMs;
		let due = this.getNextDueTimer(target);
		while (due) {
			const [handle, timer] = due;
			this.timers.delete(handle);
			this.now = timer.dueAt;
			timer.callback();
			due = this.getNextDueTimer(target);
		}
		this.now = target;
	}

	private getNextDueTimer(target: number) {
		return [...this.timers.entries()]
				.filter(([, timer]) => timer.dueAt <= target)
				.sort(
					([leftHandle, left], [rightHandle, right]) =>
						left.dueAt - right.dueAt || leftHandle - rightHandle
				)[0];
	}

	get pendingCount() {
		return this.timers.size;
	}
}

describe("TrailingCommitScheduler", () => {
	it("commits the first schedule immediately without a duplicate timer", () => {
		const timerApi = new FakeTimerApi();
		let commits = 0;
		const scheduler = new TrailingCommitScheduler(() => commits++, {
			timerApi,
		});

		scheduler.schedule();

		expect(commits).toBe(1);
		expect(scheduler.pending).toBe(false);
		expect(timerApi.pendingCount).toBe(0);
		timerApi.advanceBy(DEFAULT_COMMIT_DELAY_MS);
		expect(commits).toBe(1);
	});

	it("uses a 100ms trailing throttle without postponing a pending commit", () => {
		const timerApi = new FakeTimerApi();
		let commits = 0;
		const scheduler = new TrailingCommitScheduler(() => commits++, {
			timerApi,
		});

		scheduler.schedule();
		scheduler.schedule();
		timerApi.advanceBy(75);
		scheduler.schedule();
		timerApi.advanceBy(24);
		expect(commits).toBe(1);
		expect(scheduler.pending).toBe(true);

		timerApi.advanceBy(1);
		expect(commits).toBe(2);
		expect(scheduler.pending).toBe(false);
		expect(timerApi.clearedHandles).toEqual([]);
	});

	it("flushes a pending trailing commit exactly once", () => {
		const timerApi = new FakeTimerApi();
		let commits = 0;
		const scheduler = new TrailingCommitScheduler(() => commits++, {
			timerApi,
		});

		scheduler.schedule();
		scheduler.schedule();

		expect(scheduler.flush()).toBe(true);
		expect(scheduler.flush()).toBe(false);
		expect(commits).toBe(2);
		expect(scheduler.pending).toBe(false);
		timerApi.advanceBy(DEFAULT_COMMIT_DELAY_MS);
		expect(commits).toBe(2);
	});

	it("can force an empty or final commit without a pending timer", () => {
		const timerApi = new FakeTimerApi();
		let commits = 0;
		const scheduler = new TrailingCommitScheduler(() => commits++, {
			timerApi,
		});

		scheduler.commitNow();
		expect(commits).toBe(1);
		scheduler.schedule();
		expect(commits).toBe(1);
		timerApi.advanceBy(DEFAULT_COMMIT_DELAY_MS);
		expect(commits).toBe(2);
	});

	it("cancels a pending commit and starts a new immediate cycle", () => {
		const timerApi = new FakeTimerApi();
		let commits = 0;
		const scheduler = new TrailingCommitScheduler(() => commits++, {
			timerApi,
		});

		scheduler.schedule();
		scheduler.schedule();
		expect(scheduler.cancel()).toBe(true);
		expect(scheduler.cancel()).toBe(false);
		timerApi.advanceBy(DEFAULT_COMMIT_DELAY_MS);
		expect(commits).toBe(1);

		scheduler.schedule();
		expect(commits).toBe(2);
		timerApi.advanceBy(DEFAULT_COMMIT_DELAY_MS);
		expect(commits).toBe(2);
	});

	it("preserves first-immediate behavior when cancelled before scheduling", () => {
		const timerApi = new FakeTimerApi();
		let commits = 0;
		const scheduler = new TrailingCommitScheduler(() => commits++, {
			timerApi,
		});

		expect(scheduler.cancel()).toBe(false);
		scheduler.schedule();

		expect(commits).toBe(1);
	});

	it("supports an injected delay and rejects invalid delays", () => {
		const timerApi = new FakeTimerApi();
		let commits = 0;
		const scheduler = new TrailingCommitScheduler(() => commits++, {
			delayMs: 25,
			timerApi,
		});

		scheduler.schedule();
		scheduler.schedule();
		timerApi.advanceBy(24);
		expect(commits).toBe(1);
		timerApi.advanceBy(1);
		expect(commits).toBe(2);

		expect(
			() =>
				new TrailingCommitScheduler(() => undefined, {
					delayMs: -1,
					timerApi,
				})
		).toThrow(RangeError);
	});
});
