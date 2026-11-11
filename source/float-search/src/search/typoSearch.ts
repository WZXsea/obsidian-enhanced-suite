export interface TypoMatch {
	distance: number;
	end: number;
	matchedText: string;
	score: number;
	start: number;
}

export interface TypoMatchOptions {
	maxDistance?: number;
	maxTextLength?: number;
	maxQueryLength?: number;
	minMixedQueryLength?: number;
	minQueryLength?: number;
	requireFirstCharForShortCjk?: boolean;
}

export interface PreparedTypoMatcher {
	isEligible: boolean;
	match(text: string, options?: TypoMatchOptions): TypoMatch | null;
}

const DEFAULT_MAX_DISTANCE = 1;
const DEFAULT_MAX_TEXT_LENGTH = 360;
const DEFAULT_MAX_QUERY_LENGTH = 32;
const DEFAULT_MIN_MIXED_QUERY_LENGTH = 4;
const DEFAULT_MIN_QUERY_LENGTH = 3;

const LATIN_OR_DIGIT_RE = /[a-z0-9]/iu;

const toCodePointEntries = (text: string, maxLength: number) => {
	const entries: Array<{
		char: string;
		end: number;
		start: number;
	}> = [];
	let offset = 0;

	for (const char of text) {
		if (entries.length >= maxLength) break;
		const start = offset;
		offset += char.length;
		entries.push({
			char: char.toLowerCase(),
			end: offset,
			start,
		});
	}

	return entries;
};

const boundedEditDistance = (
	source: string[],
	target: string[],
	maxDistance: number
) => {
	if (Math.abs(source.length - target.length) > maxDistance) {
		return maxDistance + 1;
	}

	let sourceIndex = 0;
	let targetIndex = 0;
	let edits = 0;

	while (sourceIndex < source.length && targetIndex < target.length) {
		if (source[sourceIndex] === target[targetIndex]) {
			sourceIndex++;
			targetIndex++;
			continue;
		}

		edits++;
		if (edits > maxDistance) return edits;

		if (source.length === target.length) {
			sourceIndex++;
			targetIndex++;
		} else if (source.length < target.length) {
			targetIndex++;
		} else {
			sourceIndex++;
		}
	}

	return edits + source.length - sourceIndex + target.length - targetIndex;
};

export const scoreTypoMatch = (
	query: string,
	text: string,
	match: Pick<TypoMatch, "distance" | "start">
) => {
	const queryLength = Array.from(query.trim()).length;
	const textLength = Array.from(text.trim()).length;
	const base = match.distance === 0 ? 620 : 520;
	const distancePenalty = match.distance * 160;
	const positionPenalty = Math.min(match.start, 200) * 0.35;
	const lengthPenalty =
		Math.min(Math.max(textLength - queryLength, 0), 300) * 0.12;

	return base - distancePenalty - positionPenalty - lengthPenalty;
};

export const prepareTypoMatcher = (
	query: string,
	baseOptions: TypoMatchOptions = {}
): PreparedTypoMatcher => {
	const normalizedQuery = query.trim().normalize("NFKC").toLowerCase();
	const queryChars = Array.from(normalizedQuery);
	const minQueryLength =
		baseOptions.minQueryLength ?? DEFAULT_MIN_QUERY_LENGTH;
	const maxQueryLength =
		baseOptions.maxQueryLength ?? DEFAULT_MAX_QUERY_LENGTH;
	const hasLatinOrDigit = LATIN_OR_DIGIT_RE.test(normalizedQuery);
	const minMixedQueryLength =
		baseOptions.minMixedQueryLength ?? DEFAULT_MIN_MIXED_QUERY_LENGTH;
	const isEligible =
		!!normalizedQuery &&
		queryChars.length >= minQueryLength &&
		queryChars.length <= maxQueryLength &&
		(!hasLatinOrDigit || queryChars.length >= minMixedQueryLength);
	const windowLengths = [
		queryChars.length - 1,
		queryChars.length,
		queryChars.length + 1,
	].filter((length, index, all) => length > 0 && all.indexOf(length) === index);

	return {
		isEligible,
		match(text: string, options: TypoMatchOptions = {}) {
			if (!isEligible) return null;
			const normalizedText = text.trim().normalize("NFKC");
			if (!normalizedText) return null;

			const mergedOptions = { ...baseOptions, ...options };
			const maxDistance =
				mergedOptions.maxDistance ?? DEFAULT_MAX_DISTANCE;
			const maxTextLength =
				mergedOptions.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;
			const textEntries = toCodePointEntries(
				normalizedText,
				maxTextLength
			);
			if (!textEntries.length) return null;

			let best: TypoMatch | null = null;
			for (
				let startIndex = 0;
				startIndex < textEntries.length;
				startIndex++
			) {
				for (const windowLength of windowLengths) {
					const endIndex = startIndex + windowLength;
					if (endIndex > textEntries.length) continue;
					if (
						mergedOptions.requireFirstCharForShortCjk &&
						queryChars[0] !== textEntries[startIndex].char
					) {
						continue;
					}

					const windowChars = textEntries
						.slice(startIndex, endIndex)
						.map((entry) => entry.char);
					const distance = boundedEditDistance(
						queryChars,
						windowChars,
						maxDistance
					);
					if (distance > maxDistance) continue;

					const start = textEntries[startIndex].start;
					const end = textEntries[endIndex - 1].end;
					const match: TypoMatch = {
						distance,
						end,
						matchedText: normalizedText.slice(start, end),
						score: scoreTypoMatch(
							normalizedQuery,
							normalizedText,
							{ distance, start }
						),
						start,
					};

					if (
						!best ||
						match.score > best.score ||
						(match.score === best.score &&
							match.start < best.start)
					) {
						best = match;
					}
				}
			}

			return best;
		},
	};
};

export const typoMatch = (
	query: string,
	text: string,
	options: TypoMatchOptions = {}
): TypoMatch | null => prepareTypoMatcher(query, options).match(text);
