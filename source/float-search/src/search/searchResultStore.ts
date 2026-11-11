export const SEARCH_RESULT_BUCKETS = [
	"pinned",
	"lexical",
	"rag",
	"history",
	"create",
] as const;

export type SearchResultBucket = (typeof SEARCH_RESULT_BUCKETS)[number];

export type SearchResultKey<T> = (result: T) => string;

export interface SearchResultStoreOptions<T> {
	getKey: SearchResultKey<T>;
	outputOrder?: readonly SearchResultBucket[];
}

const normalizeOutputOrder = (
	requested: readonly SearchResultBucket[] | undefined
) => {
	const seen = new Set<SearchResultBucket>();
	const normalized: SearchResultBucket[] = [];
	const append = (bucket: SearchResultBucket) => {
		if (seen.has(bucket)) return;
		seen.add(bucket);
		normalized.push(bucket);
	};

	// Pinned results are always the first output category.
	append("pinned");
	for (const bucket of requested ?? SEARCH_RESULT_BUCKETS) {
		append(bucket);
	}
	for (const bucket of SEARCH_RESULT_BUCKETS) {
		append(bucket);
	}
	return normalized;
};

const mapsEqual = <T>(
	left: ReadonlyMap<string, T>,
	right: ReadonlyMap<string, T>
) => {
	if (left.size !== right.size) return false;
	const rightEntries = right.entries();
	for (const leftEntry of left.entries()) {
		const rightEntry = rightEntries.next();
		if (rightEntry.done) return false;
		if (
			leftEntry[0] !== rightEntry.value[0] ||
			leftEntry[1] !== rightEntry.value[1]
		) {
			return false;
		}
	}
	return rightEntries.next().done === true;
};

/**
 * Stores search-domain results only. It neither clones results nor adds
 * rendering fields such as section, childOf, expanded, or matchCount.
 */
export class SearchResultStore<T> {
	private readonly buckets: Record<SearchResultBucket, Map<string, T>> = {
		pinned: new Map(),
		lexical: new Map(),
		rag: new Map(),
		history: new Map(),
		create: new Map(),
	};
	private readonly getKey: SearchResultKey<T>;
	private readonly outputOrder: readonly SearchResultBucket[];

	constructor(options: SearchResultStoreOptions<T>) {
		this.getKey = options.getKey;
		this.outputOrder = normalizeOutputOrder(options.outputOrder);
	}

	/**
	 * Incrementally adds or updates lexical results. Updating an existing key
	 * retains its original insertion position.
	 */
	upsertLexical(results: Iterable<T>): boolean {
		const lexical = this.buckets.lexical;
		let changed = false;
		for (const result of results) {
			const key = this.getKey(result);
			if (!lexical.has(key) || lexical.get(key) !== result) {
				lexical.set(key, result);
				changed = true;
			}
		}
		return changed;
	}

	/**
	 * Atomically replaces one category. Duplicate keys use the last value while
	 * keeping the position at which that key first appeared.
	 */
	replaceCategory(
		bucket: SearchResultBucket,
		results: Iterable<T>
	): boolean {
		const replacement = new Map<string, T>();
		for (const result of results) {
			replacement.set(this.getKey(result), result);
		}
		if (mapsEqual(this.buckets[bucket], replacement)) return false;
		this.buckets[bucket] = replacement;
		return true;
	}

	clearCategory(bucket: SearchResultBucket): boolean {
		if (this.buckets[bucket].size === 0) return false;
		this.buckets[bucket] = new Map();
		return true;
	}

	clear(): boolean {
		let changed = false;
		for (const bucket of SEARCH_RESULT_BUCKETS) {
			changed = this.clearCategory(bucket) || changed;
		}
		return changed;
	}

	getCategory(bucket: SearchResultBucket): T[] {
		return [...this.buckets[bucket].values()];
	}

	getResults(): T[] {
		const results: T[] = [];
		for (const bucket of this.outputOrder) {
			results.push(...this.buckets[bucket].values());
		}
		return results;
	}

	get size() {
		let size = 0;
		for (const bucket of SEARCH_RESULT_BUCKETS) {
			size += this.buckets[bucket].size;
		}
		return size;
	}
}
