import { describe, expect, it } from "vitest";
import {
	COLLAPSED_CHILD_LIMIT,
	INITIAL_EXPANDED_CHILD_LIMIT,
	INITIAL_FILE_GROUP_LIMIT,
	INITIAL_RAG_LIMIT,
	MAX_AUTO_FILE_GROUP_LIMIT,
	ResultWindow,
} from "./resultWindow";

describe("ResultWindow file groups", () => {
	it("starts at 100 file groups", () => {
		const window = new ResultWindow("query");

		expect(window.getFileGroupLimit()).toBe(INITIAL_FILE_GROUP_LIMIT);
	});

	it("automatically advances by 50 and stops at 300", () => {
		const window = new ResultWindow();

		expect(window.autoLoadMoreFileGroups()).toBe(150);
		expect(window.autoLoadMoreFileGroups()).toBe(200);
		expect(window.autoLoadMoreFileGroups()).toBe(250);
		expect(window.autoLoadMoreFileGroups()).toBe(MAX_AUTO_FILE_GROUP_LIMIT);
		expect(window.autoLoadMoreFileGroups()).toBe(MAX_AUTO_FILE_GROUP_LIMIT);
		expect(window.autoLoadMoreFileGroups()).toBe(MAX_AUTO_FILE_GROUP_LIMIT);
	});

	it("allows explicit continuation beyond the automatic ceiling", () => {
		const window = new ResultWindow();
		for (let i = 0; i < 4; i++) window.autoLoadMoreFileGroups();

		expect(window.loadMoreFileGroups()).toBe(350);
		expect(window.loadMoreFileGroups()).toBe(400);
	});

	it("protects an anchor and never shrinks the session limit", () => {
		const window = new ResultWindow();

		expect(window.getFileGroupLimit(249)).toBe(250);
		expect(window.getFileGroupLimit(20)).toBe(250);
		expect(window.getFileGroupLimit(450)).toBe(451);
		expect(window.autoLoadMoreFileGroups()).toBe(451);
		expect(window.getFileGroupLimit()).toBe(451);
	});

	it("normalizes finite fractional anchors and ignores invalid anchors", () => {
		const window = new ResultWindow();

		expect(window.getFileGroupLimit(149.9)).toBe(150);
		expect(window.getFileGroupLimit(-1)).toBe(150);
		expect(window.getFileGroupLimit(Number.NaN)).toBe(150);
		expect(window.getFileGroupLimit(Number.POSITIVE_INFINITY)).toBe(150);
	});

	it("applies anchor protection before explicit continuation", () => {
		const window = new ResultWindow();

		expect(window.loadMoreFileGroups(399)).toBe(450);
		expect(window.getFileGroupLimit()).toBe(450);
	});
});

describe("ResultWindow child groups", () => {
	it("shows 3 children by default and 50 on first expansion", () => {
		const window = new ResultWindow();

		expect(window.getChildLimit("note.md")).toBe(COLLAPSED_CHILD_LIMIT);
		expect(window.expandChildGroup("note.md")).toBe(
			INITIAL_EXPANDED_CHILD_LIMIT
		);
		expect(window.getChildLimit("note.md")).toBe(
			INITIAL_EXPANDED_CHILD_LIMIT
		);
	});

	it("keeps repeated expansion idempotent and continues by 50", () => {
		const window = new ResultWindow();

		expect(window.expandChildGroup("note.md")).toBe(50);
		expect(window.expandChildGroup("note.md")).toBe(50);
		expect(window.loadMoreChildren("note.md")).toBe(100);
		expect(window.expandChildGroup("note.md")).toBe(100);
		expect(window.loadMoreChildren("note.md")).toBe(150);
	});

	it("treats continuation before expansion as the initial expansion", () => {
		const window = new ResultWindow();

		expect(window.loadMoreChildren("note.md")).toBe(50);
		expect(window.loadMoreChildren("note.md")).toBe(100);
	});

	it("tracks groups independently and collapse returns a group to 3", () => {
		const window = new ResultWindow();
		window.expandChildGroup("a.md");
		window.loadMoreChildren("a.md");
		window.expandChildGroup("b.md");

		expect(window.getChildLimit("a.md")).toBe(100);
		expect(window.getChildLimit("b.md")).toBe(50);
		expect(window.collapseChildGroup("a.md")).toBe(COLLAPSED_CHILD_LIMIT);
		expect(window.getChildLimit("a.md")).toBe(COLLAPSED_CHILD_LIMIT);
		expect(window.getChildLimit("b.md")).toBe(50);
	});

	it("keeps a visible child anchor inside the effective window", () => {
		const window = new ResultWindow();

		expect(window.getChildLimit("note.md", 24)).toBe(25);
		expect(window.getChildLimit("note.md", 2)).toBe(25);
		expect(window.getChildLimit("note.md", 79)).toBe(80);
		expect(window.getChildLimit("note.md")).toBe(80);
	});
});

describe("ResultWindow RAG and query sessions", () => {
	it("starts RAG at 50 and continues by 50", () => {
		const window = new ResultWindow();

		expect(window.getRagLimit()).toBe(INITIAL_RAG_LIMIT);
		expect(window.loadMoreRag()).toBe(100);
		expect(window.loadMoreRag()).toBe(150);
	});

	it("preserves windows for repeated notifications from the same query", () => {
		const window = new ResultWindow("same");
		window.autoLoadMoreFileGroups();
		window.expandChildGroup("note.md");
		window.loadMoreRag();

		expect(window.beginQuery("same")).toBe(false);
		expect(window.snapshot()).toEqual({
			childLimits: { "note.md": 50 },
			fileGroupLimit: 150,
			queryKey: "same",
			ragLimit: 100,
		});
	});

	it("resets every window when a new query begins", () => {
		const window = new ResultWindow("old");
		window.loadMoreFileGroups();
		window.expandChildGroup("note.md");
		window.loadMoreChildren("note.md");
		window.loadMoreRag();

		expect(window.beginQuery("new")).toBe(true);
		expect(window.snapshot()).toEqual({
			childLimits: {},
			fileGroupLimit: INITIAL_FILE_GROUP_LIMIT,
			queryKey: "new",
			ragLimit: INITIAL_RAG_LIMIT,
		});
	});

	it("supports an explicit reset of the current query session", () => {
		const window = new ResultWindow("query");
		window.loadMoreFileGroups();
		window.expandChildGroup("note.md");
		window.loadMoreRag();

		window.reset();

		expect(window.snapshot()).toEqual({
			childLimits: {},
			fileGroupLimit: INITIAL_FILE_GROUP_LIMIT,
			queryKey: "query",
			ragLimit: INITIAL_RAG_LIMIT,
		});
	});
});

describe("ResultWindow full mobile collapse", () => {
	const mobile = (query = "mobile") => new ResultWindow(query, {collapsedChildLimit: 0});

	it("defaults to zero children and ignores anchors until the group is explicitly expanded", () => {
		const window = mobile();
		expect(window.collapsedChildLimit).toBe(0);
		expect(window.getChildLimit("note.md")).toBe(0);
		expect(window.getChildLimit("note.md", 0)).toBe(0);
		expect(window.getChildLimit("note.md", 79)).toBe(0);
	});

	it("allows one, two and three-match groups to expand and collapse completely", () => {
		const window = mobile();
		for (const count of [1, 2, 3]) {
			const key = `${count}.md`;
			expect(window.getChildLimit(key)).toBe(0);
			expect(window.expandChildGroup(key)).toBe(50);
			expect(window.collapseChildGroup(key)).toBe(0);
			expect(window.getChildLimit(key, count - 1)).toBe(0);
		}
	});

	it("keeps explicit collapse stable across stale selected children and later batches", () => {
		const window = mobile(); window.expandChildGroup("note.md");
		expect(window.getChildLimit("note.md", 79)).toBe(80);
		window.collapseChildGroup("note.md");
		for (const oldAnchor of [79, 14, 0, 100]) expect(window.getChildLimit("note.md", oldAnchor)).toBe(0);
		expect(window.beginQuery("mobile")).toBe(false);
		expect(window.getChildLimit("note.md", 79)).toBe(0);
	});

	it("protects anchors in expanded groups and restarts continuation after a new expansion", () => {
		const window = mobile(); window.expandChildGroup("note.md");
		expect(window.loadMoreChildren("note.md")).toBe(100);
		expect(window.getChildLimit("note.md", 129)).toBe(130);
		window.collapseChildGroup("note.md");
		expect(window.expandChildGroup("note.md")).toBe(50);
		expect(window.loadMoreChildren("note.md")).toBe(100);
	});

	it("resets expanded and collapsed groups on a new query without reviving old anchors", () => {
		const window = mobile("first"); window.expandChildGroup("a.md"); window.expandChildGroup("b.md");
		window.collapseChildGroup("b.md"); window.beginQuery("second");
		expect(window.getChildLimit("a.md", 49)).toBe(0);
		expect(window.getChildLimit("b.md", 49)).toBe(0);
		expect(window.loadMoreChildren("a.md")).toBe(50);
		expect(window.getChildLimit("b.md")).toBe(0);
	});

	it("normalizes options and preserves the desktop default", () => {
		for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
			expect(new ResultWindow(undefined, {collapsedChildLimit: value}).collapsedChildLimit).toBe(3);
		}
		expect(new ResultWindow(undefined, {collapsedChildLimit: 2.9}).collapsedChildLimit).toBe(2);
		expect(new ResultWindow().getChildLimit("desktop.md")).toBe(3);
		expect(new ResultWindow().getChildLimit("desktop.md", 8)).toBe(9);
	});
});
