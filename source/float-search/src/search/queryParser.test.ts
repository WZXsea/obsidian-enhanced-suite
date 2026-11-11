import { describe, expect, it } from "vitest";
import { isHiddenPath, parseCmdkQuery } from "./queryParser";

const setValues = <T>(set: Set<T> | null) => (set ? [...set] : []);

describe("parseCmdkQuery", () => {
	it("extracts type, field, path, and extension filters", () => {
		const parsed = parseCmdkQuery(
			'type:heading,content in:heading path:"course wiki" ext:md,pdf brain'
		);

		expect(parsed.query).toBe("brain");
		expect(setValues(parsed.types)).toEqual(["heading", "content"]);
		expect(setValues(parsed.fields)).toEqual(["heading"]);
		expect(parsed.pathIncludes).toEqual(["course wiki"]);
		expect(setValues(parsed.extensions)).toEqual(["md", "pdf"]);
	});

	it("normalizes aliases and strips dot-prefixed extensions", () => {
		const parsed = parseCmdkQuery("type:files in:title ext:.canvas query");

		expect(parsed.query).toBe("query");
		expect(setValues(parsed.types)).toEqual(["file"]);
		expect(setValues(parsed.fields)).toEqual(["name"]);
		expect(setValues(parsed.extensions)).toEqual(["canvas"]);
	});

	it("merges repeated filters without dropping plain query text", () => {
		const parsed = parseCmdkQuery(
			"alpha type:file type:heading in:name in:path beta"
		);

		expect(parsed.query).toBe("alpha beta");
		expect(setValues(parsed.types)).toEqual(["file", "heading"]);
		expect(setValues(parsed.fields)).toEqual(["name", "path"]);
	});

	it("ignores empty extensions after dot normalization", () => {
		const parsed = parseCmdkQuery("ext:.,md query");

		expect(parsed.query).toBe("query");
		expect(setValues(parsed.extensions)).toEqual(["md"]);
	});

	it("keeps quoted path filters with punctuation as one path include", () => {
		const parsed = parseCmdkQuery('path:"Course Wiki, 2026" q');

		expect(parsed.query).toBe("q");
		expect(parsed.pathIncludes).toEqual(["course wiki, 2026"]);
	});

	it("extracts native-style tag filters", () => {
		const parsed = parseCmdkQuery("tag:#oncology tag:course q");

		expect(parsed.query).toBe("q");
		expect(parsed.tags).toEqual(["oncology", "course"]);
	});

	it("maps head/file/content operators to field-scoped query text", () => {
		const heading = parseCmdkQuery("head:diagnosis");
		const file = parseCmdkQuery("file:atlas");
		const content = parseCmdkQuery("content:therapy");

		expect(heading.query).toBe("diagnosis");
		expect(setValues(heading.types)).toEqual(["heading"]);
		expect(setValues(heading.fields)).toEqual(["heading"]);
		expect(file.query).toBe("atlas");
		expect(setValues(file.types)).toEqual(["file"]);
		expect(setValues(file.fields)).toEqual(["name"]);
		expect(content.query).toBe("therapy");
		expect(setValues(content.types)).toEqual(["content"]);
		expect(setValues(content.fields)).toEqual(["content"]);
	});

	it("keeps type:content result-scoped while content: is field-scoped", () => {
		const typeFilter = parseCmdkQuery("type:content therapy");
		const contentOperator = parseCmdkQuery("content:therapy");

		expect(typeFilter.query).toBe("therapy");
		expect(setValues(typeFilter.types)).toEqual(["content"]);
		expect(typeFilter.fields).toBeNull();
		expect(contentOperator.query).toBe("therapy");
		expect(setValues(contentOperator.types)).toEqual(["content"]);
		expect(setValues(contentOperator.fields)).toEqual(["content"]);
	});

	it("does not parse filter-like text that is not a standalone operator", () => {
		const parsed = parseCmdkQuery("notetype:file type: file q");

		expect(parsed.query).toBe("notetype:file type: file q");
		expect(parsed.types).toBeNull();
	});

	it("returns null filter sets when filters have no recognized values", () => {
		const parsed = parseCmdkQuery("type:unknown in:unknown query");

		expect(parsed.query).toBe("query");
		expect(parsed.types).toBeNull();
		expect(parsed.fields).toBeNull();
	});
});

describe("isHiddenPath", () => {
	it("detects hidden path segments", () => {
		expect(isHiddenPath(".obsidian/app.json")).toBe(true);
		expect(isHiddenPath("notes/.archive/item.md")).toBe(true);
		expect(isHiddenPath("notes/archive/item.md")).toBe(false);
	});
});
