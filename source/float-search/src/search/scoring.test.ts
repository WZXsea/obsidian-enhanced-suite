import { describe, expect, it } from "vitest";
import { compareCmdkResults, scoreCmdkText } from "./scoring";
import type { CmdkFileResult } from "./resultTypes";
import type { TFile } from "obsidian";

const makeFileResult = (path: string, score?: number): CmdkFileResult => ({
	file: {
		path,
		basename: path.replace(/\.md$/, ""),
		extension: "md",
	} as TFile,
	nameMatch: null,
	pathMatch: null,
	score,
	type: "file",
});

describe("scoreCmdkText", () => {
	it("rejects empty query or text", () => {
		expect(scoreCmdkText("", "alpha")).toBe(-Infinity);
		expect(scoreCmdkText("alpha", "")).toBe(-Infinity);
		expect(scoreCmdkText("  ", "alpha")).toBe(-Infinity);
	});

	it("orders exact, prefix, and contained matches", () => {
		const exact = scoreCmdkText("brain", "brain");
		const prefix = scoreCmdkText("brain", "brain map");
		const contained = scoreCmdkText("brain", "clinical brain map");

		expect(exact).toBeGreaterThan(prefix);
		expect(prefix).toBeGreaterThan(contained);
	});

	it("escapes regular expression characters in the query", () => {
		expect(scoreCmdkText("[tag]", "notes/[tag]")).toBeGreaterThan(
			-Infinity
		);
		expect(scoreCmdkText("a+b", "math/a+b")).toBeGreaterThan(-Infinity);
	});

	it("prefers shorter text for the same match", () => {
		const shortText = scoreCmdkText("brain", "brain");
		const longText = scoreCmdkText("brain", "brain ".repeat(20));

		expect(shortText).toBeGreaterThan(longText);
	});

	it("keeps fuzzy score influence", () => {
		const higher = scoreCmdkText("bn", "brain note", 10);
		const lower = scoreCmdkText("bn", "brain note", 0);

		expect(higher - lower).toBe(10);
	});

	it("rejects non-matching text when no fuzzy score is available", () => {
		expect(scoreCmdkText("abc", "xyz")).toBe(-Infinity);
	});
});

describe("compareCmdkResults", () => {
	it("sorts higher scores first", () => {
		const results = [
			makeFileResult("low.md", 10),
			makeFileResult("high.md", 20),
		].sort(compareCmdkResults);

		expect(results.map((result) => result.file.path)).toEqual([
			"high.md",
			"low.md",
		]);
	});

	it("uses file path as a stable tie breaker", () => {
		const results = [
			makeFileResult("B.md", 10),
			makeFileResult("A.md", 10),
		].sort(compareCmdkResults);

		expect(results.map((result) => result.file.path)).toEqual([
			"A.md",
			"B.md",
		]);
	});

	it("sorts missing scores by path instead of returning NaN", () => {
		const results = [
			makeFileResult("B.md"),
			makeFileResult("A.md"),
		].sort(compareCmdkResults);

		expect(results.map((result) => result.file.path)).toEqual([
			"A.md",
			"B.md",
		]);
	});

	it("keeps finite scores ahead of missing scores", () => {
		const results = [
			makeFileResult("missing.md"),
			makeFileResult("scored.md", -1),
		].sort(compareCmdkResults);

		expect(results.map((result) => result.file.path)).toEqual([
			"scored.md",
			"missing.md",
		]);
	});

	it("treats NaN as a missing score", () => {
		const results = [
			makeFileResult("nan.md", Number.NaN),
			makeFileResult("scored.md", 1),
		].sort(compareCmdkResults);

		expect(results.map((result) => result.file.path)).toEqual([
			"scored.md",
			"nan.md",
		]);
	});
});
