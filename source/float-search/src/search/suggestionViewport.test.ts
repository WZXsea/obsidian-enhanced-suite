import { describe, expect, it } from "vitest";
import {
	captureSuggestionViewport,
	resolveSuggestionScrollTop,
	resolveSuggestionViewportIndexes,
} from "./suggestionViewport";

describe("suggestion viewport preservation", () => {
	it("keeps the selected result without anchoring a viewport at the top", () => {
		expect(
			captureSuggestionViewport({
				anchorKey: "a",
				anchorTop: 132,
				containerTop: 100,
				scrollTop: 0,
				selectedKey: "c",
			})
		).toEqual({
			anchorFallbackKey: undefined,
			anchorKey: undefined,
			anchorOffset: 0,
			fallbackScrollTop: 0,
			selectedFallbackKey: undefined,
			selectedKey: "c",
		});
	});

	it("captures a visible result relative to the scroll container", () => {
		const snapshot = captureSuggestionViewport({
			anchorKey: "b",
			anchorTop: 120,
			containerTop: 100,
			scrollTop: 60,
			selectedKey: "c",
		});

		expect(snapshot).toMatchObject({
			anchorKey: "b",
			anchorOffset: 20,
			fallbackScrollTop: 60,
			selectedKey: "c",
		});
	});

	it("resolves stable anchor and selected keys after results are reordered", () => {
		const indexes = resolveSuggestionViewportIndexes(
			{
				anchorKey: "b",
				anchorOffset: 20,
				fallbackScrollTop: 60,
				selectedKey: "c",
			},
			["new", "a", "b", "c"]
		);

		expect(indexes).toEqual({
			anchorIndex: 2,
			selectedIndex: 3,
		});
	});

	it("uses the parent result when a selected child disappears", () => {
		const indexes = resolveSuggestionViewportIndexes(
			{
				anchorOffset: 0,
				fallbackScrollTop: 0,
				selectedFallbackKey: "file:note.md",
				selectedKey: "content:note.md:3:text",
			},
			["file:note.md", "file:other.md"]
		);

		expect(indexes.selectedIndex).toBe(0);
	});

	it("uses the parent result when a viewport child anchor disappears", () => {
		const indexes = resolveSuggestionViewportIndexes(
			{
				anchorFallbackKey: "file:note.md",
				anchorKey: "content:note.md:3:text",
				anchorOffset: 15,
				fallbackScrollTop: 120,
			},
			["file:note.md", "file:other.md"]
		);

		expect(indexes.anchorIndex).toBe(0);
	});

	it("restores an anchor after new results are inserted before it", () => {
		expect(
			resolveSuggestionScrollTop(
				{
					anchorKey: "b",
					anchorOffset: 20,
					fallbackScrollTop: 60,
				},
				100,
				0,
				212
			)
		).toBe(92);
	});

	it("falls back to the previous scroll position when the anchor disappears", () => {
		expect(
			resolveSuggestionScrollTop(
				{
					anchorKey: "missing",
					anchorOffset: 20,
					fallbackScrollTop: 85,
				},
				100,
				0
			)
		).toBe(85);
	});
});
