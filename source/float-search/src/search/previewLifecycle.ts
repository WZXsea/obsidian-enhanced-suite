/** Serialize native view loading and close only after every in-flight load settles. */
export class PreviewLifecycle {
	private pending = 0;
	private closing = false;
	private finished = false;
	private tail: Promise<unknown> = Promise.resolve();
	private cleanup: (() => void) | null = null;

	get opening() {return this.pending > 0;}
	get isClosing() {return this.closing;}

	async run<T>(operation: () => Promise<T>): Promise<T | undefined> {
		if (this.closing) return undefined;
		this.pending++;
		const work = this.tail.then(() => this.closing ? undefined : operation());
		// A rejected native load propagates to its caller while later work can settle.
		this.tail = work.then(() => undefined, () => undefined);
		try {return await work;}
		finally {this.pending--; this.finishClose();}
	}

	close(cleanup: () => void): void {
		if (!this.closing) {this.closing = true; this.cleanup = cleanup;}
		this.finishClose();
	}

	private finishClose(): void {
		if (!this.closing || this.finished || this.pending > 0) return;
		this.finished = true;
		const cleanup = this.cleanup; this.cleanup = null;
		cleanup?.();
	}
}
