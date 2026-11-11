import type { TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import {
	SearchCatalog,
	type CatalogMetadata,
} from "./searchCatalog";

const file = (
	path: string,
	mtime = 100,
	size = 200
): TFile => {
	const name = path.split("/").pop() ?? path;
	const extension = name.includes(".") ? name.split(".").pop() ?? "" : "";
	const basename = extension
		? name.slice(0, -(extension.length + 1))
		: name;
	return {
		basename,
		extension,
		name,
		path,
		stat: { ctime: 0, mtime, size },
	} as TFile;
};

const metadata = (
	tags: string[],
	headings: CatalogMetadata["headings"] = [],
	aliases?: unknown
): CatalogMetadata => ({ aliases, headings, tags });

describe("SearchCatalog", () => {
	it("upserts and removes normalized file entries", () => {
		const catalog = new SearchCatalog();
		const note = file("Folder/My Note.MD");

		const inserted = catalog.upsert(
			note,
			metadata(["#Course", "course", " Topic "], [
				{ heading: "Overview", level: 1, line: 2 },
			])
		);

		expect(inserted).toMatchObject({
			extension: "md",
			file: note,
			lowerName: "my note",
			lowerPath: "folder/my note.md",
			mtime: 100,
			size: 200,
		});
		expect([...inserted.tags]).toEqual(["course", "topic"]);
		expect(catalog.snapshot()).toHaveLength(1);
		expect(catalog.remove(note.path)).toBe(true);
		expect(catalog.remove(note.path)).toBe(false);
		expect(catalog.snapshot()).toEqual([]);
	});

	it("renames an entry while preserving metadata and refreshing file fields", () => {
		const catalog = new SearchCatalog();
		const original = file("Old/Note.md", 100, 200);
		catalog.upsert(
			original,
			metadata(["#tag"], [
				{ heading: "Heading", level: 2, line: 4 },
			], ["Original alias"])
		);

		const renamed = file("New/Renamed.PDF", 300, 400);
		const entry = catalog.rename(renamed, original.path);

		expect(catalog.snapshot()).toHaveLength(1);
		expect(entry).toMatchObject({
			extension: "pdf",
			file: renamed,
			lowerName: "renamed",
			lowerPath: "new/renamed.pdf",
			mtime: 300,
			size: 400,
		});
		expect([...entry.tags]).toEqual(["tag"]);
		expect(entry.aliases).toEqual(["Original alias"]);
		expect(entry.headings).toEqual([
			{ heading: "Heading", level: 2, line: 4 },
		]);
	});

	it("replaces metadata and removes exact duplicates", () => {
		const catalog = new SearchCatalog();
		const note = file("Note.md");
		catalog.upsert(note);

		expect(
			catalog.updateMetadata(
				note.path,
				metadata(["#Alpha", "alpha", "#BETA"], [
					{ heading: " Same ", level: 2, line: 3 },
					{ heading: "Same", level: 2, line: 3 },
					{ heading: "Same", level: 2, line: 8 },
					{ heading: "   ", level: 1, line: 9 },
				])
			)
		).toBe(true);

		const [entry] = catalog.snapshot();
		expect([...entry.tags]).toEqual(["alpha", "beta"]);
		expect(entry.headings).toEqual([
			{ heading: "Same", level: 2, line: 3 },
			{ heading: "Same", level: 2, line: 8 },
		]);
		expect(
			catalog.updateMetadata("missing.md", metadata([], []))
		).toBe(false);
	});

	it("returns snapshots isolated from catalog collection state", () => {
		const catalog = new SearchCatalog();
		const note = file("Note.md");
		catalog.upsert(
			note,
			metadata(["stable"], [
				{ heading: "Stable", level: 1, line: 0 },
			], ["Stable alias"])
		);

		const first = catalog.snapshot();
		first[0].tags.add("mutated");
		first[0].aliases[0] = "Mutated alias";
		first[0].headings[0].heading = "Mutated";
		first.push(first[0]);

		const second = catalog.snapshot();
		expect(second).toHaveLength(1);
		expect([...second[0].tags]).toEqual(["stable"]);
		expect(second[0].aliases).toEqual(["Stable alias"]);
		expect(second[0].headings[0].heading).toBe("Stable");
	});

	it("normalizes aliases while preserving display text and string values", () => {
		const catalog = new SearchCatalog();
		const note = file("Note.md");
		const entry = catalog.upsert(note, metadata([], [], [
			"  Spatial Transcriptomics  ",
			"spatial transcriptomics",
			"空间转录组",
			" ",
			null,
			42,
			{ alias: "ignored" },
		]));
		expect(entry.aliases).toEqual(["Spatial Transcriptomics", "空间转录组"]);

		const single = catalog.upsert(note, metadata([], [], "  A, B  "));
		expect(single.aliases).toEqual(["A, B"]);
		expect(catalog.upsert(note, metadata([], [], { alias: "invalid" })).aliases)
			.toEqual([]);
	});

	it("preserves aliases across file updates and replaces them on metadata changes", () => {
		const catalog = new SearchCatalog();
		const note = file("Note.md");
		const input = ["Original alias"];
		const inserted = catalog.upsert(note, metadata([], [], input));
		input.push("External mutation");
		inserted.aliases.push("Returned entry mutation");

		const updated = catalog.upsert(file(note.path, 300, 400));
		expect(updated.aliases).toEqual(["Original alias"]);
		updated.aliases.push("Updated entry mutation");

		expect(catalog.updateMetadata(note.path, metadata([], [], ["Replacement"])))
			.toBe(true);
		expect(catalog.snapshot()[0].aliases).toEqual(["Replacement"]);
		catalog.updateMetadata(note.path, metadata([]));
		expect(catalog.snapshot()[0].aliases).toEqual([]);
	});

	it("tracks readiness explicitly", () => {
		const catalog = new SearchCatalog();
		expect(catalog.isReady()).toBe(false);
		catalog.markReady();
		expect(catalog.isReady()).toBe(true);
		expect(catalog.clear()).toBe(false);
		expect(catalog.isReady()).toBe(false);

		catalog.upsert(file("Note.md"));
		catalog.markReady();
		expect(catalog.clear()).toBe(true);
		expect(catalog.snapshot()).toEqual([]);
		expect(catalog.isReady()).toBe(false);
	});
});
