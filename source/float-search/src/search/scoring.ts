import type { SearchableCmdkResult } from "./resultTypes";

const escapeRegExp = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const scoreCmdkText = (
	query: string,
	text: string,
	fuzzyScore?: number | null
) => {
	const normalizedQuery = query.trim().toLowerCase();
	const normalizedText = text.trim().toLowerCase();
	if (!normalizedQuery || !normalizedText) return -Infinity;

	const hasFuzzyScore =
		typeof fuzzyScore === "number" && Number.isFinite(fuzzyScore);
	let score = hasFuzzyScore ? fuzzyScore : 0;
	const index = normalizedText.indexOf(normalizedQuery);
	if (index < 0 && !hasFuzzyScore) return -Infinity;

	if (normalizedText === normalizedQuery) score += 1000;
	else if (normalizedText.startsWith(normalizedQuery)) score += 850;
	else if (index >= 0) score += 650 - Math.min(index, 200);

	const wordIndex = normalizedText.search(
		new RegExp(`(^|[\\s/_\\-.])${escapeRegExp(normalizedQuery)}`)
	);
	if (wordIndex >= 0) score += 120;

	// Prefer concise matches over very long paths or content lines.
	score -=
		Math.min(
			Math.max(normalizedText.length - normalizedQuery.length, 0),
			300
		) * 0.2;
	return score;
};

export const compareCmdkResults = (
	a: SearchableCmdkResult,
	b: SearchableCmdkResult
) => {
	const scoreA =
		typeof a.score === "number" && Number.isFinite(a.score)
			? a.score
			: -Infinity;
	const scoreB =
		typeof b.score === "number" && Number.isFinite(b.score)
			? b.score
			: -Infinity;
	if (scoreA !== scoreB) return scoreB - scoreA;
	return a.file.path.localeCompare(b.file.path);
};
