import type { CmdkSearchField, CmdkSearchType } from "./resultTypes";

export interface ParsedCmdkQuery {
	query: string;
	types: Set<CmdkSearchType> | null;
	fields: Set<CmdkSearchField> | null;
	pathIncludes: string[];
	tags: string[];
	extensions: Set<string> | null;
}

export const isHiddenPath = (path: string) =>
	path.split("/").some((part) => part.startsWith("."));

const stripQuotes = (value: string) => value.replace(/^['"]|['"]$/g, "");

const parseFilterValues = (rawValue: string, splitQuoted = true) => {
	const quoted =
		(rawValue.startsWith('"') && rawValue.endsWith('"')) ||
		(rawValue.startsWith("'") && rawValue.endsWith("'"));
	const value = stripQuotes(rawValue);
	const items = quoted && !splitQuoted ? [value] : value.split(/[|,]/);

	return items.map((item) => item.trim().toLowerCase()).filter(Boolean);
};

export const parseCmdkQuery = (rawQuery: string): ParsedCmdkQuery => {
	let query = rawQuery;
	const types = new Set<CmdkSearchType>();
	const fields = new Set<CmdkSearchField>();
	const extensions = new Set<string>();
	const pathIncludes: string[] = [];
	const tags: string[] = [];

	query = query.replace(
		/(^|\s)(type|in|path|ext|tag|head|heading|file|content):("[^"]+"|'[^']+'|\S+)/gi,
		(_match, prefix: string, key: string, rawValue: string) => {
			const keyLower = key.toLowerCase();
			const values = parseFilterValues(rawValue, keyLower !== "path");

			if (keyLower === "type") {
				for (const item of values) {
					if (item === "file" || item === "files") types.add("file");
					else if (item === "heading" || item === "headings")
						types.add("heading");
					else if (item === "content" || item === "body")
						types.add("content");
				}
			} else if (keyLower === "in") {
				for (const item of values) {
					if (item === "name" || item === "file" || item === "title")
						fields.add("name");
					else if (item === "path") fields.add("path");
					else if (item === "heading" || item === "headings")
						fields.add("heading");
					else if (item === "content" || item === "body")
						fields.add("content");
				}
			} else if (keyLower === "path") {
				pathIncludes.push(...values);
			} else if (keyLower === "ext") {
				for (const item of values) {
					const extension = item.replace(/^\./, "");
					if (extension) extensions.add(extension);
				}
			} else if (keyLower === "tag") {
				tags.push(
					...values
						.map((item) => item.replace(/^#/, ""))
						.filter(Boolean)
				);
			} else if (keyLower === "head" || keyLower === "heading") {
				types.add("heading");
				fields.add("heading");
				return `${prefix}${values.join(" ")}`;
			} else if (keyLower === "file") {
				types.add("file");
				fields.add("name");
				return `${prefix}${values.join(" ")}`;
			} else if (keyLower === "content") {
				types.add("content");
				fields.add("content");
				return `${prefix}${values.join(" ")}`;
			}

			return prefix;
		}
	);

	return {
		query: query.replace(/\s+/g, " ").trim(),
		types: types.size ? types : null,
		fields: fields.size ? fields : null,
		pathIncludes,
		tags,
		extensions: extensions.size ? extensions : null,
	};
};
