import { describe, expect, it } from "vitest";
import {
	SEARCH_STAGES,
	isCurrentSearchSession,
	isSameSearchIdentity,
	type SearchSession,
	type SearchStage,
} from "./searchSession";

const session = (
	generation: number,
	query: string,
	aborted = false
): SearchSession => ({
	identity: { generation, query },
	signal: { aborted },
});

describe("search session identity", () => {
	it("defines the stages used by the search pipeline", () => {
		const stages: SearchStage[] = [...SEARCH_STAGES];

		expect(stages).toEqual([
			"file",
			"heading",
			"content",
			"rag",
			"typo",
		]);
	});

	it("matches identities by generation and query", () => {
		expect(
			isSameSearchIdentity(
				{ generation: 3, query: "alpha" },
				{ generation: 3, query: "alpha" }
			)
		).toBe(true);
		expect(
			isSameSearchIdentity(
				{ generation: 3, query: "alpha" },
				{ generation: 4, query: "alpha" }
			)
		).toBe(false);
		expect(
			isSameSearchIdentity(
				{ generation: 3, query: "alpha" },
				{ generation: 3, query: "beta" }
			)
		).toBe(false);
	});

	it("accepts a non-aborted candidate from the active generation", () => {
		expect(
			isCurrentSearchSession(
				session(7, "same query"),
				session(7, "same query")
			)
		).toBe(true);
	});

	it("rejects stale, aborted, and absent sessions", () => {
		const current = session(8, "query");

		expect(isCurrentSearchSession(current, session(7, "query"))).toBe(false);
		expect(isCurrentSearchSession(current, session(8, "query", true))).toBe(
			false
		);
		expect(
			isCurrentSearchSession(session(8, "query", true), current)
		).toBe(false);
		expect(isCurrentSearchSession(null, current)).toBe(false);
		expect(isCurrentSearchSession(current, undefined)).toBe(false);
	});
});
