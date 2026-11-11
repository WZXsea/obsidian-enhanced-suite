import type { SearchResult } from "obsidian";

export interface HeadingLineSource {
	headings: readonly { line?: number }[];
	path: string;
}

export type HeadingLineIndex = ReadonlyMap<string, ReadonlySet<number>>;

export interface ContentLine {
	line: number;
	lineText: string;
}

export interface ContentLineMatch<T> extends ContentLine {
	match: T;
}

export const buildHeadingLineIndex = (
	sources: Iterable<HeadingLineSource>
): HeadingLineIndex => {
	const index = new Map<string, Set<number>>();

	for (const source of sources) {
		const lines = new Set<number>();
		for (const heading of source.headings) {
			if (
				typeof heading.line === "number" &&
				Number.isInteger(heading.line) &&
				heading.line >= 0
			) {
				lines.add(heading.line);
			}
		}
		if (lines.size) index.set(source.path, lines);
	}

	return index;
};

export const isHeadingSourceLine = (
	index: HeadingLineIndex,
	path: string,
	line: number
) => index.get(path)?.has(line) ?? false;

const getLineAtOffset = (text: string, offset: number): ContentLine => {
	let line = 0;
	let lineStart = 0;
	for (let index = 0; index < offset; index++) {
		if (text.charCodeAt(index) === 10) {
			line++;
			lineStart = index + 1;
		}
	}

	let lineEnd = text.indexOf("\n", lineStart);
	if (lineEnd === -1) lineEnd = text.length;
	return {
		line,
		lineText: text.substring(lineStart, lineEnd).trim(),
	};
};

export const findFirstNonHeadingExactMatch = (
	text: string,
	path: string,
	headingLines: HeadingLineIndex,
	search: (text: string) => SearchResult | null
): ContentLine | null => {
	let searchStart = 0;

	while (searchStart <= text.length) {
		const match = search(text.slice(searchStart));
		const relativeOffset = match?.matches[0]?.[0];
		if (!match || typeof relativeOffset !== "number") return null;

		const offset = searchStart + relativeOffset;
		const lineMatch = getLineAtOffset(text, offset);
		if (!isHeadingSourceLine(headingLines, path, lineMatch.line)) {
			return lineMatch;
		}

		const lineEnd = text.indexOf("\n", offset);
		if (lineEnd === -1) return null;
		searchStart = lineEnd + 1;
	}

	return null;
};

export const getContentLines = (
	text: string,
	maxLines = Number.POSITIVE_INFINITY
): ContentLine[] => {
	const lines: ContentLine[] = [];
	let line = 0;
	let lineStart = 0;

	while (lineStart <= text.length && line < maxLines) {
		let lineEnd = text.indexOf("\n", lineStart);
		if (lineEnd === -1) lineEnd = text.length;
		lines.push({
			line,
			lineText: text.substring(lineStart, lineEnd).trim(),
		});

		if (lineEnd >= text.length) break;
		lineStart = lineEnd + 1;
		line++;
	}

	return lines;
};

export const findFirstNonHeadingLineMatch = <T>(
	lines: readonly ContentLine[],
	path: string,
	headingLines: HeadingLineIndex,
	matchLine: (lineText: string) => T | null,
	startIndex = 0,
	endIndex = lines.length
): ContentLineMatch<T> | null => {
	for (
		let index = Math.max(0, startIndex);
		index < Math.min(lines.length, endIndex);
		index++
	) {
		const line = lines[index];
		if (
			!line.lineText ||
			isHeadingSourceLine(headingLines, path, line.line)
		) {
			continue;
		}
		const match = matchLine(line.lineText);
		if (match) return { ...line, match };
	}

	return null;
};

export const findAllNonHeadingLineMatches = <T>(
	lines: readonly ContentLine[],
	path: string,
	headingLines: HeadingLineIndex,
	matchLine: (lineText: string) => T | null,
	startIndex = 0,
	endIndex = lines.length
): ContentLineMatch<T>[] => {
	const matches: ContentLineMatch<T>[] = [];
	for (
		let index = Math.max(0, startIndex);
		index < Math.min(lines.length, endIndex);
		index++
	) {
		const line = lines[index];
		if (
			!line.lineText ||
			isHeadingSourceLine(headingLines, path, line.line)
		) {
			continue;
		}
		const match = matchLine(line.lineText);
		if (match) matches.push({ ...line, match });
	}
	return matches;
};
