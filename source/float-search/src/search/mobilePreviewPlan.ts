export const PREVIEW_FRAGMENT_CHARS = 4800;
const PREVIEW_FRAGMENT_LINES = 90;

export interface PreviewFragment {
	text: string;
	start: number;
	end: number;
	startLine: number;
	endLine: number;
	plain: boolean;
}

export interface PreviewDocumentPlan {
	source: string;
	lines: string[];
	lineStarts: number[];
	contentStart: number;
	fragments: PreviewFragment[];
}

const fence = (line: string) => line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
const tableDivider = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

/** Keep ordinary Markdown blocks intact; oversized blocks use contiguous raw pages. */
export function planMobilePreview(input: string): PreviewDocumentPlan {
	const source = input.replace(/\r\n/g, "\n");
	const lines = source.split("\n"), lineStarts = [0];
	for (let index = 1; index < lines.length; index++) lineStarts.push(lineStarts[index - 1] + lines[index - 1].length + 1);
	let contentStart = 0;
	if (lines[0]?.replace(/^\uFEFF/, "").trim() === "---") {
		const close = lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)\s*$/.test(line));
		if (close > 0) contentStart = close + 1;
	}
	const offset = (line: number) => lineStarts[line] ?? source.length;
	const lineOf = (position: number) => {
		let low = 0, high = lineStarts.length;
		while (low < high) {const mid = (low + high) >>> 1; if (lineStarts[mid] <= position) low = mid + 1; else high = mid;}
		return Math.max(0, low - 1);
	};
	const fragments: PreviewFragment[] = [];
	let bufferedStart = offset(contentStart), bufferedEnd = bufferedStart;
	const append = (start: number, end: number, plain: boolean) => {
		if (end <= start) return;
		fragments.push({text: source.slice(start, end), start, end,
			startLine: lineOf(start), endLine: lineOf(Math.max(start, end - 1)), plain});
	};
	const flush = () => {append(bufferedStart, bufferedEnd, false); bufferedStart = bufferedEnd;};
	let line = contentStart;
	while (line < lines.length) {
		const blockStart = line;
		while (line < lines.length && !lines[line].trim()) line++;
		if (line < lines.length) {
			const opening = fence(lines[line]);
			if (opening) {
				const marker = opening[1][0], length = opening[1].length;
				line++;
				while (line < lines.length) {
					const end = lines[line].match(/^ {0,3}(`+|~+)\s*$/);
					line++; if (end && end[1][0] === marker && end[1].length >= length) break;
				}
			} else if (/^\s*\$\$\s*$/.test(lines[line])) {
				line++; while (line < lines.length && !/^\s*\$\$\s*$/.test(lines[line])) line++;
				if (line < lines.length) line++;
			} else if (line + 1 < lines.length && lines[line].includes("|") && tableDivider(lines[line + 1])) {
				line += 2; while (line < lines.length && lines[line].trim() && lines[line].includes("|")) line++;
			} else if (/^ {0,3}#{1,6}\s/.test(lines[line])) line++;
			else {
				line++;
				while (line < lines.length && lines[line].trim() && !fence(lines[line]) &&
					!/^ {0,3}#{1,6}\s/.test(lines[line]) && !/^\s*\$\$\s*$/.test(lines[line])) line++;
			}
		}
		const start = offset(blockStart), end = offset(line), length = end - start;
		if (length > PREVIEW_FRAGMENT_CHARS) {
			flush();
			for (let cursor = start; cursor < end;) {
				let boundary = Math.min(end, cursor + PREVIEW_FRAGMENT_CHARS);
				const newline = source.lastIndexOf("\n", boundary - 1);
				if (newline > cursor + PREVIEW_FRAGMENT_CHARS / 2) boundary = newline + 1;
				if (boundary < end && /[\uD800-\uDBFF]/.test(source[boundary - 1])) boundary--;
				append(cursor, boundary, true); cursor = boundary;
			}
			bufferedStart = bufferedEnd = end;
		} else {
			if (bufferedEnd > bufferedStart && (end - bufferedStart > PREVIEW_FRAGMENT_CHARS || lineOf(end) - lineOf(bufferedStart) > PREVIEW_FRAGMENT_LINES)) flush();
			bufferedStart = Math.min(bufferedStart, start); bufferedEnd = end;
		}
	}
	flush();
	if (!fragments.length) fragments.push({text: "", start: offset(contentStart), end: source.length,
		startLine: contentStart, endLine: contentStart, plain: false});
	return {source, lines, lineStarts, contentStart, fragments};
}

export function previewTargetOffset(plan: PreviewDocumentPlan, target: {
	line?: number; heading?: string; content?: string; matchOffset?: number; matchText?: string;
}) {
	const line = Math.max(plan.contentStart, Math.min(plan.lines.length - 1, Math.trunc(target.line ?? plan.contentStart)));
	const raw = plan.lines[line] ?? "";
	let within = Math.max(0, Math.trunc(target.matchOffset ?? 0)) + (raw.length - raw.trimStart().length);
	const match = target.matchText?.trim() || target.heading?.trim();
	if (match) {
		const foldedMatch = match.toLowerCase();
		const found = raw.toLowerCase().indexOf(foldedMatch);
		if (found >= 0) within = found;
		else if (target.line == null) {
			const anywhere = plan.source.toLowerCase().indexOf(foldedMatch, plan.lineStarts[plan.contentStart] ?? 0);
			if (anywhere >= 0) return anywhere;
		}
	}
	return Math.min(plan.source.length, (plan.lineStarts[line] ?? plan.source.length) + Math.min(raw.length, within));
}

export function previewTargetFragment(plan: PreviewDocumentPlan, target: Parameters<typeof previewTargetOffset>[1]) {
	return previewFragmentAtOffset(plan, previewTargetOffset(plan, target));
}

export function previewFragmentAtOffset(plan: PreviewDocumentPlan, position: number) {
	const index = plan.fragments.findIndex(fragment => fragment.start <= position && position < fragment.end);
	return index >= 0 ? index : plan.fragments.length - 1;
}
