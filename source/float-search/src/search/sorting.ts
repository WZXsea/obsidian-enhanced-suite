export const CMDK_SORT_ORDERS = [
	"relevance",
	"name-asc",
	"name-desc",
	"modified-desc",
	"modified-asc",
	"created-desc",
	"created-asc",
] as const;

export type CmdkSortOrder = (typeof CMDK_SORT_ORDERS)[number];

export interface CmdkSortableItem {
	file: {
		path: string;
		basename: string;
		stat: {
			mtime: number;
			ctime: number;
		};
	};
	score?: number;
}

const compareNaturalText = (a: string, b: string) =>
	a.localeCompare(b, undefined, {
		numeric: true,
		sensitivity: "base",
	});

const comparePath = (a: CmdkSortableItem, b: CmdkSortableItem) =>
	a.file.path.localeCompare(b.file.path);

const compareFiniteNumbers = (
	a: number | undefined,
	b: number | undefined,
	direction: "asc" | "desc"
) => {
	const validA = typeof a === "number" && Number.isFinite(a);
	const validB = typeof b === "number" && Number.isFinite(b);

	if (validA !== validB) return validA ? -1 : 1;
	if (!validA || !validB || a === b) return 0;

	return direction === "asc" ? a - b : b - a;
};

export const isCmdkSortOrder = (value: unknown): value is CmdkSortOrder =>
	typeof value === "string" &&
	CMDK_SORT_ORDERS.some((sortOrder) => sortOrder === value);

export const normalizeCmdkSortOrder = (
	value: unknown,
	fallback: CmdkSortOrder = "relevance"
): CmdkSortOrder => (isCmdkSortOrder(value) ? value : fallback);

export const compareCmdkSortableItems = <T extends CmdkSortableItem>(
	a: T,
	b: T,
	sortOrder: CmdkSortOrder
) => {
	let comparison = 0;

	switch (sortOrder) {
		case "relevance":
			comparison = compareFiniteNumbers(a.score, b.score, "desc");
			break;
		case "name-asc":
			comparison = compareNaturalText(a.file.basename, b.file.basename);
			break;
		case "name-desc":
			comparison = compareNaturalText(b.file.basename, a.file.basename);
			break;
		case "modified-desc":
			comparison = compareFiniteNumbers(
				a.file.stat.mtime,
				b.file.stat.mtime,
				"desc"
			);
			break;
		case "modified-asc":
			comparison = compareFiniteNumbers(
				a.file.stat.mtime,
				b.file.stat.mtime,
				"asc"
			);
			break;
		case "created-desc":
			comparison = compareFiniteNumbers(
				a.file.stat.ctime,
				b.file.stat.ctime,
				"desc"
			);
			break;
		case "created-asc":
			comparison = compareFiniteNumbers(
				a.file.stat.ctime,
				b.file.stat.ctime,
				"asc"
			);
			break;
	}

	if (comparison !== 0) return comparison;

	if (sortOrder !== "relevance") {
		const relevanceComparison = compareFiniteNumbers(
			a.score,
			b.score,
			"desc"
		);
		if (relevanceComparison !== 0) return relevanceComparison;
	}

	return comparePath(a, b);
};

export const createCmdkSortComparator = <T extends CmdkSortableItem>(
	sortOrder: CmdkSortOrder
) => (a: T, b: T) => compareCmdkSortableItems(a, b, sortOrder);
