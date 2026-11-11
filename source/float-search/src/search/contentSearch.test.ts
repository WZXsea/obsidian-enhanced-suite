import type { SearchResult } from "obsidian";
import { describe, expect, it } from "vitest";
import { prepareTypoMatcher } from "./typoSearch";
import {
	buildHeadingLineIndex,
	findAllNonHeadingLineMatches,
	findFirstNonHeadingExactMatch,
	findFirstNonHeadingLineMatch,
	getContentLines,
} from "./contentSearch";

const exactSearch =
	(query: string) =>
		(text: string): SearchResult | null => {
			const start = text.indexOf(query);
			if (start < 0) return null;
			return {
				matches: [[start, start + query.length]],
				score: 1,
			};
		};

const headingLines = buildHeadingLineIndex([
	{
		headings: [{ line: 0 }],
		path: "notes/router.md",
	},
]);

describe("content search heading exclusion", () => {
	it("does not return a content result when the only match is a heading", () => {
		const result = findFirstNonHeadingExactMatch(
			"### 7.1 路由器测试",
			"notes/router.md",
			headingLines,
			exactSearch("路由器测试")
		);

		expect(result).toBeNull();
	});

	it("continues after a matching heading to the next body match", () => {
		const result = findFirstNonHeadingExactMatch(
			"### 7.1 路由器测试\n说明\n正文再次提到路由器测试",
			"notes/router.md",
			headingLines,
			exactSearch("路由器测试")
		);

		expect(result).toMatchObject({
			line: 2,
			lineText: "正文再次提到路由器测试",
		});
	});

	it("keeps identical text on a different body line", () => {
		const result = findFirstNonHeadingExactMatch(
			"### 路由器测试\n\n路由器测试",
			"notes/router.md",
			headingLines,
			exactSearch("路由器测试")
		);

		expect(result).toMatchObject({
			line: 2,
			lineText: "路由器测试",
		});
	});

	it("uses both source path and line when identifying headings", () => {
		const result = findFirstNonHeadingExactMatch(
			"### 路由器测试",
			"notes/another.md",
			headingLines,
			exactSearch("路由器测试")
		);

		expect(result).toMatchObject({
			line: 0,
			lineText: "### 路由器测试",
		});
	});

	it("continues typo matching after a matching heading", () => {
		const matcher = prepareTypoMatcher("路由气测试");
		const result = findFirstNonHeadingLineMatch(
			getContentLines(
				"### 路由器测试\n正文没有命中\n正文再次提到路由器测试"
			),
			"notes/router.md",
			headingLines,
			(line) => matcher.match(line, { maxTextLength: 220 })
		);

		expect(result).toMatchObject({
			line: 2,
			lineText: "正文再次提到路由器测试",
			match: {
				distance: 1,
			},
		});
	});

	it("returns every matching body line from the same document", () => {
		const results = findAllNonHeadingLineMatches(
			getContentLines(
				"### 路由器测试\n正文中的路由器测试\n无关内容\n正文中的路由器测试"
			),
			"notes/router.md",
			headingLines,
			exactSearch("路由器测试")
		);

		expect(results).toMatchObject([
			{
				line: 1,
				lineText: "正文中的路由器测试",
			},
			{
				line: 3,
				lineText: "正文中的路由器测试",
			},
		]);
	});
});
