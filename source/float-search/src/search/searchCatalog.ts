import type { TFile } from "obsidian";

export interface CatalogHeading {
	heading: string;
	level: number;
	line?: number;
}

export interface CatalogMetadata {
	aliases?: unknown;
	headings: readonly CatalogHeading[];
	tags: Iterable<string>;
}

export interface CatalogEntry {
	aliases: string[];
	extension: string;
	file: TFile;
	headings: CatalogHeading[];
	lowerName: string;
	lowerPath: string;
	mtime: number;
	size: number;
	tags: Set<string>;
}

const normalizeTag = (tag: string) =>
	tag.trim().replace(/^#/, "").toLowerCase();

const normalizeAliases = (aliases: unknown): string[] => {
	const values = typeof aliases === "string" ? [aliases] : aliases;
	if (!Array.isArray(values)) return [];

	const normalized: string[] = [];
	const seen = new Set<string>();
	for (const alias of values) {
		if (typeof alias !== "string") continue;
		const value = alias.trim();
		const key = value.toLowerCase();
		if (!value || seen.has(key)) continue;
		seen.add(key);
		normalized.push(value);
	}
	return normalized;
};

const cloneHeadings = (headings: readonly CatalogHeading[]) =>
	headings.map((heading) => ({ ...heading }));

const normalizeHeadings = (headings: readonly CatalogHeading[]) => {
	const seen = new Set<string>();
	const normalized: CatalogHeading[] = [];

	for (const heading of headings) {
		const value = heading.heading.trim();
		if (!value) continue;

		const item: CatalogHeading = {
			heading: value,
			level: heading.level,
			line: heading.line,
		};
		const key = JSON.stringify([
			item.line ?? null,
			item.level,
			item.heading,
		]);
		if (seen.has(key)) continue;
		seen.add(key);
		normalized.push(item);
	}

	return normalized;
};

const normalizeTags = (tags: Iterable<string>) => {
	const normalized = new Set<string>();
	for (const tag of tags) {
		const value = normalizeTag(tag);
		if (value) normalized.add(value);
	}
	return normalized;
};

const createEntry = (
	file: TFile,
	metadata?: CatalogMetadata,
	previous?: CatalogEntry
): CatalogEntry => ({
	aliases: metadata
		? normalizeAliases(metadata.aliases)
		: [...(previous?.aliases ?? [])],
	extension: file.extension.toLowerCase(),
	file,
	headings: metadata
		? normalizeHeadings(metadata.headings)
		: cloneHeadings(previous?.headings ?? []),
	lowerName: file.basename.toLowerCase(),
	lowerPath: file.path.toLowerCase(),
	mtime: file.stat.mtime,
	size: file.stat.size,
	tags: metadata
		? normalizeTags(metadata.tags)
		: new Set(previous?.tags ?? []),
});

const cloneEntry = (entry: CatalogEntry): CatalogEntry => ({
	...entry,
	aliases: [...entry.aliases],
	headings: cloneHeadings(entry.headings),
	tags: new Set(entry.tags),
});

export class SearchCatalog {
	private readonly entries = new Map<string, CatalogEntry>();
	private ready = false;

	isReady() {
		return this.ready;
	}

	markReady() {
		this.ready = true;
	}

	clear() {
		const hadEntries = this.entries.size > 0;
		this.entries.clear();
		this.ready = false;
		return hadEntries;
	}

	remove(path: string) {
		return this.entries.delete(path);
	}

	rename(file: TFile, oldPath: string) {
		const previous = this.entries.get(oldPath);
		this.entries.delete(oldPath);
		const entry = createEntry(file, undefined, previous);
		this.entries.set(file.path, entry);
		return cloneEntry(entry);
	}

	snapshot() {
		return [...this.entries.values()].map(cloneEntry);
	}

	updateMetadata(path: string, metadata: CatalogMetadata) {
		const previous = this.entries.get(path);
		if (!previous) return false;

		this.entries.set(path, {
			...previous,
			aliases: normalizeAliases(metadata.aliases),
			headings: normalizeHeadings(metadata.headings),
			tags: normalizeTags(metadata.tags),
		});
		return true;
	}

	upsert(file: TFile, metadata?: CatalogMetadata) {
		const entry = createEntry(
			file,
			metadata,
			this.entries.get(file.path)
		);
		this.entries.set(file.path, entry);
		return cloneEntry(entry);
	}
}
