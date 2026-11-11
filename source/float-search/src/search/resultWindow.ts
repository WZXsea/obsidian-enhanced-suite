export const INITIAL_FILE_GROUP_LIMIT = 100;
export const FILE_GROUP_STEP = 50;
export const MAX_AUTO_FILE_GROUP_LIMIT = 300;

export const COLLAPSED_CHILD_LIMIT = 3;
export const INITIAL_EXPANDED_CHILD_LIMIT = 50;
export const CHILD_STEP = 50;

export const INITIAL_RAG_LIMIT = 50;
export const RAG_STEP = 50;

export interface ResultWindowSnapshot {
	childLimits: Readonly<Record<string, number>>;
	fileGroupLimit: number;
	queryKey: string | null;
	ragLimit: number;
}

export interface ResultWindowOptions {
	collapsedChildLimit?: number;
}

const toAnchorLimit = (anchorGroupIndex?: number) => {
	if (
		typeof anchorGroupIndex !== "number" ||
		!Number.isFinite(anchorGroupIndex) ||
		anchorGroupIndex < 0
	) {
		return 0;
	}
	return Math.floor(anchorGroupIndex) + 1;
};

/**
 * Keeps the visible result window for one search session.
 *
 * Limits are intentionally allowed to exceed the current result count. The
 * caller can safely pass them to `slice`; retaining the larger value prevents a
 * later refresh from hiding a viewport anchor when more results arrive.
 */
export class ResultWindow {
	readonly collapsedChildLimit: number;
	private childLimits = new Map<string, number>();
	private fileGroupLimit = INITIAL_FILE_GROUP_LIMIT;
	private queryKey: string | null = null;
	private ragLimit = INITIAL_RAG_LIMIT;

	constructor(queryKey?: string, options: ResultWindowOptions = {}) {
		const limit = options.collapsedChildLimit;
		this.collapsedChildLimit = typeof limit === "number" && Number.isFinite(limit) && limit >= 0
			? Math.floor(limit) : COLLAPSED_CHILD_LIMIT;
		if (queryKey !== undefined) this.queryKey = queryKey;
	}

	/**
	 * Starts a new query session. Repeating the current key is a no-op so that
	 * progressive refreshes cannot collapse windows the user already expanded.
	 */
	beginQuery(queryKey: string) {
		if (this.queryKey === queryKey) return false;
		this.reset(queryKey);
		return true;
	}

	/**
	 * Resets all windows. Callers may use an explicit session key that also
	 * includes filter state when equal query text can represent different runs.
	 */
	reset(queryKey: string | null = this.queryKey) {
		this.queryKey = queryKey;
		this.fileGroupLimit = INITIAL_FILE_GROUP_LIMIT;
		this.childLimits.clear();
		this.ragLimit = INITIAL_RAG_LIMIT;
	}

	/**
	 * Returns the effective file-group limit and protects an optional anchor.
	 * The stored limit is monotonic until reset.
	 */
	getFileGroupLimit(anchorGroupIndex?: number) {
		this.fileGroupLimit = Math.max(
			this.fileGroupLimit,
			toAnchorLimit(anchorGroupIndex)
		);
		return this.fileGroupLimit;
	}

	/**
	 * Advances the automatic window by one step without crossing its automatic
	 * ceiling. A limit raised above that ceiling by an anchor is never reduced.
	 */
	autoLoadMoreFileGroups(anchorGroupIndex?: number) {
		const current = this.getFileGroupLimit(anchorGroupIndex);
		this.fileGroupLimit = Math.max(
			current,
			Math.min(current + FILE_GROUP_STEP, MAX_AUTO_FILE_GROUP_LIMIT)
		);
		return this.fileGroupLimit;
	}

	/**
	 * Explicit user continuation has no automatic ceiling.
	 */
	loadMoreFileGroups(anchorGroupIndex?: number) {
		this.fileGroupLimit =
			this.getFileGroupLimit(anchorGroupIndex) + FILE_GROUP_STEP;
		return this.fileGroupLimit;
	}

	getChildLimit(groupKey: string, anchorChildIndex?: number) {
		const current =
			this.childLimits.get(groupKey) ?? this.collapsedChildLimit;
		// Full-collapse windows accept child anchors only after a user expands
		// that group. A stale selected child from a progressive refresh must not
		// override an explicit collapse or reopen a group in the next query.
		if (current === 0 && !this.childLimits.has(groupKey)) return 0;
		const effective = Math.max(current, toAnchorLimit(anchorChildIndex));
		if (effective > this.collapsedChildLimit) {
			this.childLimits.set(groupKey, effective);
		}
		return effective;
	}

	/**
	 * First expansion shows 50 children. Repeated expansion notifications are
	 * idempotent and cannot shrink a group that was already continued.
	 */
	expandChildGroup(groupKey: string) {
		const limit = Math.max(
			this.childLimits.get(groupKey) ?? 0,
			INITIAL_EXPANDED_CHILD_LIMIT,
			this.collapsedChildLimit + 1
		);
		this.childLimits.set(groupKey, limit);
		return limit;
	}

	/**
	 * Continues an expanded group by 50. If called before the group is expanded,
	 * it performs the initial expansion instead.
	 */
	loadMoreChildren(groupKey: string) {
		const current = this.childLimits.get(groupKey);
		if (current === undefined) return this.expandChildGroup(groupKey);
		const limit = current + CHILD_STEP;
		this.childLimits.set(groupKey, limit);
		return limit;
	}

	collapseChildGroup(groupKey: string) {
		this.childLimits.delete(groupKey);
		return this.collapsedChildLimit;
	}

	getRagLimit() {
		return this.ragLimit;
	}

	loadMoreRag() {
		this.ragLimit += RAG_STEP;
		return this.ragLimit;
	}

	snapshot(): ResultWindowSnapshot {
		return {
			childLimits: Object.fromEntries(this.childLimits),
			fileGroupLimit: this.fileGroupLimit,
			queryKey: this.queryKey,
			ragLimit: this.ragLimit,
		};
	}
}
