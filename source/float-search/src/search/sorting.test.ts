import { describe, expect, it } from "vitest";
import {
	CMDK_SORT_ORDERS,
	compareCmdkSortableItems,
	createCmdkSortComparator,
	isCmdkSortOrder,
	normalizeCmdkSortOrder,
} from "./sorting";
import type { CmdkSortableItem, CmdkSortOrder } from "./sorting";

interface TestItem extends CmdkSortableItem {
	id: string;
}

const makeItem = (
	id: string,
	basename: string,
	options: {
		path?: string;
		score?: number;
		mtime?: number;
		ctime?: number;
	} = {}
): TestItem => ({
	id,
	file: {
		path: options.path ?? `${basename}.md`,
		basename,
		stat: {
			mtime: options.mtime ?? 0,
			ctime: options.ctime ?? 0,
		},
	},
	score: options.score,
});

const sortIds = (items: TestItem[], sortOrder: CmdkSortOrder) =>
	[...items].sort(createCmdkSortComparator(sortOrder)).map((item) => item.id);

describe("CmdkSortOrder validation", () => {
	it("recognizes every supported sort order", () => {
		expect(CMDK_SORT_ORDERS.every(isCmdkSortOrder)).toBe(true);
	});

	it("rejects invalid or non-string values", () => {
		expect(isCmdkSortOrder("modified-newest")).toBe(false);
		expect(isCmdkSortOrder(1)).toBe(false);
		expect(isCmdkSortOrder(null)).toBe(false);
	});

	it("normalizes invalid persisted settings to the requested fallback", () => {
		expect(normalizeCmdkSortOrder("name-asc")).toBe("name-asc");
		expect(normalizeCmdkSortOrder("unknown")).toBe("relevance");
		expect(normalizeCmdkSortOrder(undefined, "modified-desc")).toBe(
			"modified-desc"
		);
	});
});

describe("CMDK sort comparator", () => {
	const older = makeItem("older", "Note 10", {
		path: "folder/z-note-10.md",
		score: 10,
		mtime: 100,
		ctime: 200,
	});
	const newer = makeItem("newer", "Note 2", {
		path: "folder/a-note-2.md",
		score: 20,
		mtime: 300,
		ctime: 400,
	});

	it("sorts relevance by finite score descending", () => {
		expect(sortIds([older, newer], "relevance")).toEqual([
			"newer",
			"older",
		]);
	});

	it("sorts names naturally in both directions", () => {
		expect(sortIds([older, newer], "name-asc")).toEqual([
			"newer",
			"older",
		]);
		expect(sortIds([older, newer], "name-desc")).toEqual([
			"older",
			"newer",
		]);
	});

	it("sorts modification time in both directions", () => {
		expect(sortIds([older, newer], "modified-desc")).toEqual([
			"newer",
			"older",
		]);
		expect(sortIds([older, newer], "modified-asc")).toEqual([
			"older",
			"newer",
		]);
	});

	it("sorts creation time in both directions", () => {
		expect(sortIds([older, newer], "created-desc")).toEqual([
			"newer",
			"older",
		]);
		expect(sortIds([older, newer], "created-asc")).toEqual([
			"older",
			"newer",
		]);
	});

	it("uses ascending path order as the deterministic fallback in every mode", () => {
		const pathB = makeItem("path-b", "same", {
			path: "B/same.md",
			score: 5,
			mtime: 50,
			ctime: 50,
		});
		const pathA = makeItem("path-a", "same", {
			path: "A/same.md",
			score: 5,
			mtime: 50,
			ctime: 50,
		});

		for (const sortOrder of CMDK_SORT_ORDERS) {
			expect(sortIds([pathB, pathA], sortOrder)).toEqual([
				"path-a",
				"path-b",
			]);
		}
	});

	it("uses relevance before path when the selected field ties", () => {
		const lowerScore = makeItem("lower", "same", {
			path: "A/same.md",
			score: 10,
			mtime: 50,
			ctime: 50,
		});
		const higherScore = makeItem("higher", "same", {
			path: "B/same.md",
			score: 20,
			mtime: 50,
			ctime: 50,
		});

		for (const sortOrder of CMDK_SORT_ORDERS.filter(
			(sortOrder) => sortOrder !== "relevance"
		)) {
			expect(sortIds([lowerScore, higherScore], sortOrder)).toEqual([
				"higher",
				"lower",
			]);
		}
	});

	it("keeps invalid scores after finite relevance scores", () => {
		const missing = makeItem("missing", "Missing", { path: "A.md" });
		const nan = makeItem("nan", "NaN", {
			path: "B.md",
			score: Number.NaN,
		});
		const finite = makeItem("finite", "Finite", {
			path: "C.md",
			score: -1,
		});

		expect(sortIds([missing, nan, finite], "relevance")).toEqual([
			"finite",
			"missing",
			"nan",
		]);
	});

	it("supports direct comparison for sortable file groups", () => {
		expect(
			compareCmdkSortableItems(older, newer, "modified-desc")
		).toBeGreaterThan(0);
	});
});
