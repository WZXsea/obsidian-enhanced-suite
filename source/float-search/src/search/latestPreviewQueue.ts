interface PreviewRequest<T> {
	key: string;
	operation: () => Promise<T>;
	promise: Promise<T | undefined>;
	resolve(value: T | undefined): void;
	reject(error: unknown): void;
}

/** Preserve the active native load and retain only the latest waiting target. */
export class LatestPreviewQueue<T> {
	private active: PreviewRequest<T> | null = null;
	private pending: PreviewRequest<T> | null = null;
	private closed = false;

	get open() {return this.active !== null;}

	run(key: string, operation: () => Promise<T>): Promise<T | undefined> {
		if (this.closed) return Promise.resolve(undefined);
		if (this.active?.key === key) {
			this.cancelPending();
			return this.active.promise;
		}
		if (this.pending?.key === key) {
			this.pending.operation = operation;
			return this.pending.promise;
		}
		let resolve!: PreviewRequest<T>["resolve"], reject!: PreviewRequest<T>["reject"];
		const promise = new Promise<T | undefined>((yes, no) => {resolve = yes; reject = no;});
		const request = {key, operation, promise, resolve, reject};
		if (this.active) {this.cancelPending(); this.pending = request;}
		else this.start(request);
		return promise;
	}

	cancelPending(): void {
		const pending = this.pending; this.pending = null;
		pending?.resolve(undefined);
	}

	/** Let native initialization settle; the existing preview owner handles teardown. */
	close(): void {this.closed = true; this.cancelPending();}

	private start(request: PreviewRequest<T>): void {
		this.active = request;
		void Promise.resolve().then(request.operation).then(
			value => this.finish(request, () => request.resolve(value)),
			error => this.finish(request, () => request.reject(error)),
		);
	}

	private finish(request: PreviewRequest<T>, settle: () => void): void {
		this.active = null;
		if (this.closed) request.resolve(undefined); else settle();
		const pending = this.pending; this.pending = null;
		if (pending) this.start(pending);
	}
}
