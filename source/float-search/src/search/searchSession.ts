export const SEARCH_STAGES = [
	"file",
	"heading",
	"content",
	"rag",
	"typo",
] as const;

export type SearchStage = (typeof SEARCH_STAGES)[number];

/**
 * A monotonically increasing generation separates searches that happen to
 * have the same query text. The query is retained for diagnostics and guards
 * against accidentally reusing a generation for different input.
 */
export interface SearchIdentity {
	readonly generation: number;
	readonly query: string;
}

/**
 * This intentionally uses the structural part of AbortSignal so the module
 * stays independent from browser and Obsidian runtime classes.
 */
export interface SearchAbortState {
	readonly aborted: boolean;
}

export interface SearchSession {
	readonly identity: SearchIdentity;
	readonly signal: SearchAbortState;
}

export const isSameSearchIdentity = (
	left: SearchIdentity | null | undefined,
	right: SearchIdentity | null | undefined
) =>
	!!left &&
	!!right &&
	left.generation === right.generation &&
	left.query === right.query;

/**
 * Returns true only while the candidate still belongs to the active,
 * non-aborted search generation.
 */
export const isCurrentSearchSession = (
	current: SearchSession | null | undefined,
	candidate: SearchSession | null | undefined
) =>
	!!current &&
	!!candidate &&
	!current.signal.aborted &&
	!candidate.signal.aborted &&
	isSameSearchIdentity(current.identity, candidate.identity);
