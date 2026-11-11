export const DEFAULT_COMMIT_DELAY_MS = 100;

export interface CommitTimerApi {
	setTimeout(callback: () => void, delayMs: number): unknown;
	clearTimeout(handle: unknown): void;
}

export interface TrailingCommitSchedulerOptions {
	delayMs?: number;
	timerApi?: CommitTimerApi;
}

const DEFAULT_TIMER_API: CommitTimerApi = {
	setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
	clearTimeout: (handle) =>
		clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Commits the first scheduled update immediately, then coalesces later
 * updates into at most one trailing commit per configured interval.
 */
export class TrailingCommitScheduler {
	private readonly commit: () => void;
	private readonly delayMs: number;
	private readonly timerApi: CommitTimerApi;
	private hasCommitted = false;
	private timerHandle: unknown | null = null;

	constructor(
		commit: () => void,
		options: TrailingCommitSchedulerOptions = {}
	) {
		const delayMs = options.delayMs ?? DEFAULT_COMMIT_DELAY_MS;
		if (!Number.isFinite(delayMs) || delayMs < 0) {
			throw new RangeError("Commit delay must be a finite non-negative number");
		}
		this.commit = commit;
		this.delayMs = delayMs;
		this.timerApi = options.timerApi ?? DEFAULT_TIMER_API;
	}

	schedule() {
		if (!this.hasCommitted) {
			this.hasCommitted = true;
			this.commit();
			return;
		}

		if (this.timerHandle !== null) return;
		this.timerHandle = this.timerApi.setTimeout(() => {
			this.timerHandle = null;
			this.commit();
		}, this.delayMs);
	}

	flush(): boolean {
		if (this.timerHandle === null) return false;
		this.clearPendingTimer();
		this.commit();
		return true;
	}

	commitNow() {
		this.clearPendingTimer();
		this.hasCommitted = true;
		this.commit();
	}

	cancel(): boolean {
		const hadPendingCommit = this.timerHandle !== null;
		this.clearPendingTimer();
		// A cancelled search starts a new first-immediate commit cycle.
		this.hasCommitted = false;
		return hadPendingCommit;
	}

	get pending() {
		return this.timerHandle !== null;
	}

	private clearPendingTimer() {
		if (this.timerHandle === null) return;
		this.timerApi.clearTimeout(this.timerHandle);
		this.timerHandle = null;
	}
}
