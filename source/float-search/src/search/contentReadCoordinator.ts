export interface ContentFileVersion {
	mtime: number;
	path: string;
	size: number;
}

interface InFlightRead {
	mtime: number;
	promise: Promise<string>;
	size: number;
}

const isSameVersion = (
	current: InFlightRead,
	version: ContentFileVersion
) => current.mtime === version.mtime && current.size === version.size;

export class ContentReadCoordinator {
	private readonly inFlight = new Map<string, InFlightRead>();

	clear() {
		const hadReads = this.inFlight.size > 0;
		this.inFlight.clear();
		return hadReads;
	}

	invalidate(path: string) {
		return this.inFlight.delete(path);
	}

	read(
		version: ContentFileVersion,
		loader: () => Promise<string>
	): Promise<string> {
		const current = this.inFlight.get(version.path);
		if (current && isSameVersion(current, version)) {
			return current.promise;
		}

		let loaded: Promise<string>;
		try {
			loaded = loader();
		} catch (error) {
			loaded = Promise.reject(error);
		}
		const clear = (promise: Promise<string>) => {
			if (this.inFlight.get(version.path)?.promise === promise) {
				this.inFlight.delete(version.path);
			}
		};
		const tracked = loaded.then(
			(value) => {
				clear(tracked);
				return value;
			},
			(error) => {
				clear(tracked);
				throw error;
			}
		);
		this.inFlight.set(version.path, {
			mtime: version.mtime,
			promise: tracked,
			size: version.size,
		});
		return tracked;
	}

	/**
	 * In-flight reads are path-version scoped and cannot be transferred safely.
	 * Renaming invalidates both names; existing callers may still observe their
	 * original promise settling, while subsequent callers start a fresh read.
	 */
	rename(oldPath: string, newPath: string) {
		const oldInvalidated = this.inFlight.delete(oldPath);
		const newInvalidated = this.inFlight.delete(newPath);
		return oldInvalidated || newInvalidated;
	}
}
