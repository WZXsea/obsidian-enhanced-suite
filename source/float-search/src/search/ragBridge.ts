interface DesktopRagRuntime {
	execFile: typeof import("child_process").execFile;
	fs: typeof import("fs");
	path: typeof import("path");
}

// Capability is explicit and defaults to the portable search-only runtime.
// Loading this module remains safe in Android before plugin onload executes.
let desktopEnabled = false;
let desktopRuntime: DesktopRagRuntime | null = null;

export const configureRagRuntime = (enabled: boolean): void => {
	desktopEnabled = enabled;
};

const getDesktopRuntime = (): DesktopRagRuntime | null => {
	if (!desktopEnabled) return null;
	if (!desktopRuntime) {
		desktopRuntime = {
			// eslint-disable-next-line @typescript-eslint/no-var-requires -- Capability-gated lazy load keeps Android module evaluation portable.
			execFile: require("child_process").execFile,
			fs: require("fs"),
			path: require("path"),
		};
	}
	return desktopRuntime;
};

export type CmdkRagScope = "wiki" | "raw" | "both";
export type CmdkRagSource = "wiki" | "raw" | "web" | "unknown";

export interface CmdkRagVaultConfig {
	commandPath?: string;
	enabled: boolean;
	id: string;
	label: string;
	obsidianPrefix: string;
	wikiRoot: string;
}

export interface CmdkRagSearchOptions {
	fast: boolean;
	k: number;
	scope: CmdkRagScope;
	timeoutMs: number;
}

interface RawRagHit {
	bm25_score?: number | string | null;
	metadata?: Record<string, unknown>;
	rerank_score?: number | string | null;
	similarity?: number | string | null;
	source?: string;
	text?: string;
}

interface RawRagPayload {
	note?: string;
	raw?: RawRagHit[];
	results?: RawRagHit[];
	source?: string;
	web?: RawRagHit[];
	wiki?: RawRagHit[];
}

export interface CmdkRagHit {
	bm25Score?: number;
	chunkIndex?: number;
	docId?: string;
	filePath: string;
	note?: string;
	obsidianPath: string;
	rerankScore?: number;
	similarity?: number;
	snippet: string;
	source: CmdkRagSource;
	text?: string;
	textSnippet?: string;
	title: string;
	totalChunks?: number;
	vaultId: string;
	vaultLabel: string;
}

export interface CmdkRagVaultResponse {
	error?: string;
	hits: CmdkRagHit[];
	note?: string;
	stderr?: string;
	vaultId: string;
	vaultLabel: string;
}

const PREFERRED_VAULT_LABELS: Record<string, string> = {
	"course-wiki": "Course",
	"interest-wiki": "Interest",
	"research-wiki": "Research",
};

const getWikiNoteCommandPath = (wikiRoot: string) => {
	const runtime = getDesktopRuntime();
	if (!runtime) return null;
	const { fs, path } = runtime;
	const unixPath = path.join(wikiRoot, ".venv", "bin", "wiki-note");
	if (fs.existsSync(unixPath)) return unixPath;

	const windowsPath = path.join(
		wikiRoot,
		".venv",
		"Scripts",
		"wiki-note.exe"
	);
	if (fs.existsSync(windowsPath)) return windowsPath;

	return null;
};

const toVaultId = (name: string) =>
	name
		.replace(/-wiki$/i, "")
		.replace(/[^a-z0-9_-]+/gi, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase() || "wiki";

const toVaultLabel = (name: string) =>
	PREFERRED_VAULT_LABELS[name] ??
	name
		.replace(/-wiki$/i, "")
		.replace(/[-_]+/g, " ")
		.replace(/\b\w/g, (char) => char.toUpperCase());

export const discoverRagVaults = (
	obsidianVaultRoot: string
): CmdkRagVaultConfig[] => {
	const runtime = getDesktopRuntime();
	if (!runtime) return [];
	const { fs, path } = runtime;
	const root = path.resolve(obsidianVaultRoot);
	const candidates: CmdkRagVaultConfig[] = [];

	const rootCommand = getWikiNoteCommandPath(root);
	if (rootCommand) {
		const name = path.basename(root);
		candidates.push({
			commandPath: rootCommand,
			enabled: true,
			id: toVaultId(name),
			label: toVaultLabel(name),
			obsidianPrefix: "",
			wikiRoot: root,
		});
	}

	let entries: import("fs").Dirent[] = [];
	try {
		entries = fs.readdirSync(root, { withFileTypes: true });
	} catch {
		return candidates;
	}

	for (const entry of entries) {
		if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
		const wikiRoot = path.join(root, entry.name);
		const commandPath = getWikiNoteCommandPath(wikiRoot);
		if (!commandPath) continue;

		candidates.push({
			commandPath,
			enabled: true,
			id: toVaultId(entry.name),
			label: toVaultLabel(entry.name),
			obsidianPrefix: entry.name,
			wikiRoot,
		});
	}

	const order = ["course-wiki", "research-wiki", "interest-wiki"];
	return candidates.sort((a, b) => {
		const orderA = order.indexOf(path.basename(a.wikiRoot));
		const orderB = order.indexOf(path.basename(b.wikiRoot));
		if (orderA !== orderB) {
			return (orderA < 0 ? Number.MAX_SAFE_INTEGER : orderA) -
				(orderB < 0 ? Number.MAX_SAFE_INTEGER : orderB);
		}
		return a.label.localeCompare(b.label);
	});
};

const toFiniteNumber = (value: unknown): number | undefined => {
	const numberValue =
		typeof value === "number" ? value : Number.parseFloat(String(value));
	return Number.isFinite(numberValue) ? numberValue : undefined;
};

const toStringValue = (value: unknown) =>
	typeof value === "string" ? value : "";

export interface CmdkRagTextMatch {
	line: number;
	lineText: string;
	offset: number;
}

const getLineContextAtOffset = (
	text: string,
	offset: number
): CmdkRagTextMatch => {
	let line = 0;
	let lineStart = 0;
	for (let i = 0; i < offset; i++) {
		if (text.charCodeAt(i) === 10) {
			line++;
			lineStart = i + 1;
		}
	}
	let lineEnd = text.indexOf("\n", lineStart);
	if (lineEnd === -1) lineEnd = text.length;

	let lineText = text.substring(lineStart, lineEnd).trim();
	if (!lineText) {
		const nextLineStart = lineEnd >= text.length ? -1 : lineEnd + 1;
		const nextLineEnd =
			nextLineStart >= 0 ? text.indexOf("\n", nextLineStart) : -1;
		if (nextLineStart >= 0) {
			lineText = text
				.substring(
					nextLineStart,
					nextLineEnd === -1 ? text.length : nextLineEnd
				)
				.trim();
		}
	}

	return { line, lineText, offset };
};

const normalizeWithMap = (value: string) => {
	const chars: string[] = [];
	const map: number[] = [];
	let inWhitespace = false;
	let offset = 0;

	for (const char of value) {
		const startOffset = offset;
		offset += char.length;
		if (/\s/u.test(char)) {
			if (!inWhitespace) {
				chars.push(" ");
				map.push(startOffset);
				inWhitespace = true;
			}
			continue;
		}
		for (const normalizedChar of char.normalize("NFKC").toLowerCase()) {
			chars.push(normalizedChar);
			map.push(startOffset);
		}
		inWhitespace = false;
	}

	let start = 0;
	let end = chars.length;
	while (start < end && chars[start] === " ") start++;
	while (end > start && chars[end - 1] === " ") end--;

	return {
		map: map.slice(start, end),
		text: chars.slice(start, end).join(""),
	};
};

const normalizeForMatch = (value: string) => normalizeWithMap(value).text;

const buildRagMatchNeedles = (candidates: string[]) => {
	const seen = new Set<string>();
	const needles: string[] = [];
	const addNeedle = (value: string) => {
		const needle = value
			.replace(/\r\n/g, "\n")
			.replace(/^[.…\s]+|[.…\s]+$/g, "")
			.trim();
		if (needle.length < 8 || seen.has(needle)) return;
		seen.add(needle);
		needles.push(needle);
	};

	for (const candidate of candidates) {
		const value = candidate.trim();
		if (!value) continue;
		addNeedle(value);
		addNeedle(value.slice(0, 800));
		addNeedle(value.slice(0, 360));
		addNeedle(value.slice(0, 180));

		const lines = value
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line.length >= 12);
		for (const line of lines.slice(0, 8)) addNeedle(line);
		for (const line of [...lines].sort((a, b) => b.length - a.length).slice(0, 4)) {
			addNeedle(line);
		}
	}

	return needles;
};

const getLineStarts = (text: string) => {
	const starts = [0];
	for (let i = 0; i < text.length; i++) {
		if (text.charCodeAt(i) === 10) starts.push(i + 1);
	}
	return starts;
};

const isMarkdownTableDelimiter = (line: string) =>
	/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);

const markdownTablePlainText = (line: string) => {
	const trimmed = line.trim();
	if (!trimmed.includes("|") || isMarkdownTableDelimiter(trimmed)) {
		return "";
	}
	const cells = trimmed
		.replace(/^\|/, "")
		.replace(/\|$/, "")
		.split("|")
		.map((cell) => cell.trim())
		.filter(Boolean);
	return cells.length > 1 ? cells.join(" ") : "";
};

export const findRagTextMatch = (
	markdownText: string,
	candidates: string[]
): CmdkRagTextMatch | null => {
	const needles = buildRagMatchNeedles(candidates);
	if (!markdownText || !needles.length) return null;

	for (const needle of needles) {
		const offset = markdownText.indexOf(needle);
		if (offset >= 0) return getLineContextAtOffset(markdownText, offset);
	}

	const normalizedDocument = normalizeWithMap(markdownText);
	for (const needle of needles) {
		const normalizedNeedle = normalizeForMatch(needle);
		if (normalizedNeedle.length < 8) continue;
		const normalizedOffset =
			normalizedDocument.text.indexOf(normalizedNeedle);
		if (normalizedOffset < 0) continue;
		const offset = normalizedDocument.map[normalizedOffset];
		if (offset == null) continue;
		return getLineContextAtOffset(markdownText, offset);
	}

	const lineStarts = getLineStarts(markdownText);
	const lines = markdownText.split(/\n/);
	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const plainTableText = markdownTablePlainText(lines[lineIndex]);
		if (!plainTableText) continue;
		const normalizedTableText = normalizeForMatch(plainTableText);
		for (const needle of needles) {
			const normalizedNeedle = normalizeForMatch(needle);
			if (normalizedNeedle.length < 8) continue;
			if (normalizedTableText.includes(normalizedNeedle)) {
				return getLineContextAtOffset(
					markdownText,
					lineStarts[lineIndex] ?? 0
				);
			}
		}
	}

	return null;
};

const normalizeRelPath = (value: string) =>
	value.replace(/\\/g, "/").replace(/^\/+/, "");

const isSafeRelPath = (value: string) => {
	const normalized = normalizeRelPath(value);
	return !!normalized && !normalized.split("/").includes("..");
};

export const toObsidianPath = (vault: CmdkRagVaultConfig, relPath: string) => {
	const normalizedPrefix = normalizeRelPath(vault.obsidianPrefix).replace(
		/\/+$/,
		""
	);
	const normalizedRelPath = normalizeRelPath(relPath);
	if (!normalizedPrefix) return normalizedRelPath;
	if (normalizedRelPath === normalizedPrefix) return normalizedRelPath;
	if (normalizedRelPath.startsWith(`${normalizedPrefix}/`)) {
		return normalizedRelPath;
	}
	return `${normalizedPrefix}/${normalizedRelPath}`;
};

export const resolveRagHitPath = (
	vault: CmdkRagVaultConfig,
	relPath: string
) => {
	if (!isSafeRelPath(relPath)) return null;
	const runtime = getDesktopRuntime();
	if (!runtime) return null;
	const { path } = runtime;
	const wikiRoot = path.resolve(vault.wikiRoot);
	const absolutePath = path.resolve(wikiRoot, normalizeRelPath(relPath));
	const relativePath = path.relative(wikiRoot, absolutePath);
	if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
		return null;
	}
	return absolutePath;
};

const normalizeSource = (value: string): CmdkRagSource => {
	if (value === "wiki" || value === "raw" || value === "web") return value;
	return "unknown";
};

const rawHitsFromPayload = (payload: RawRagPayload): RawRagHit[] => {
	if (Array.isArray(payload.results)) return payload.results;
	return [
		...(Array.isArray(payload.wiki) ? payload.wiki : []),
		...(Array.isArray(payload.raw) ? payload.raw : []),
		...(Array.isArray(payload.web) ? payload.web : []),
	];
};

export const normalizeRagPayload = (
	payload: RawRagPayload,
	vault: CmdkRagVaultConfig
): CmdkRagHit[] => {
	const runtime = getDesktopRuntime();
	if (!runtime) return [];
	const { path } = runtime;
	return rawHitsFromPayload(payload)
		.map((hit): CmdkRagHit | null => {
			const metadata = hit.metadata ?? {};
			const relPath = toStringValue(metadata.rel_path);
			if (!relPath || !resolveRagHitPath(vault, relPath)) return null;

			const source = normalizeSource(
				toStringValue(hit.source) || toStringValue(metadata.source)
			);
			if (source === "web") return null;

			const text = toStringValue(hit.text);
			const textSnippet = toStringValue(metadata.text_snippet);
			const snippet =
				textSnippet ||
				text.slice(0, 360);
			return {
				bm25Score: toFiniteNumber(hit.bm25_score),
				chunkIndex: toFiniteNumber(metadata.chunk_index),
				docId: toStringValue(metadata.doc_id),
				filePath: relPath,
				note: toStringValue(payload.note),
				obsidianPath: toObsidianPath(vault, relPath),
				rerankScore: toFiniteNumber(hit.rerank_score),
				similarity: toFiniteNumber(hit.similarity),
				snippet: snippet.replace(/\s+/g, " ").trim(),
				source,
				text,
				textSnippet,
				title:
					toStringValue(metadata.title) ||
					path.basename(relPath, path.extname(relPath)),
				totalChunks: toFiniteNumber(metadata.total_chunks),
				vaultId: vault.id,
				vaultLabel: vault.label,
			};
		})
		.filter((hit): hit is CmdkRagHit => !!hit);
};

export const queryRagVault = (
	vault: CmdkRagVaultConfig,
	query: string,
	options: CmdkRagSearchOptions,
	signal?: AbortSignal
): Promise<CmdkRagVaultResponse> => {
	if (!desktopEnabled || !vault.enabled) {
		return Promise.resolve({
			hits: [],
			vaultId: vault.id,
			vaultLabel: vault.label,
		});
	}

	const runtime = getDesktopRuntime();
	if (!runtime) return Promise.resolve({ hits: [], vaultId: vault.id, vaultLabel: vault.label });
	const { execFile } = runtime;
	const commandPath = vault.commandPath ?? getWikiNoteCommandPath(vault.wikiRoot);
	if (!commandPath) {
		return Promise.resolve({
			error: "wiki-note command not found",
			hits: [],
			vaultId: vault.id,
			vaultLabel: vault.label,
		});
	}

	const args = [
		"rag",
		"query",
		query,
		"-k",
		String(options.k),
		"--scope",
		options.scope,
		"--format",
		"json",
		"--wiki-root",
		vault.wikiRoot,
	];
	if (options.fast) args.push("--fast");

	return new Promise((resolve) => {
		const child = execFile(
			commandPath,
			args,
			{
				cwd: vault.wikiRoot,
				maxBuffer: 1024 * 1024 * 8,
				timeout: options.timeoutMs,
			},
			(error, stdout, stderr) => {
				if (signal?.aborted) {
					resolve({
						error: "aborted",
						hits: [],
						stderr,
						vaultId: vault.id,
						vaultLabel: vault.label,
					});
					return;
				}
				if (error) {
					resolve({
						error: error.message,
						hits: [],
						stderr,
						vaultId: vault.id,
						vaultLabel: vault.label,
					});
					return;
				}
				try {
					const payload = JSON.parse(stdout.trim()) as RawRagPayload;
					resolve({
						hits: normalizeRagPayload(payload, vault),
						note: toStringValue(payload.note),
						stderr,
						vaultId: vault.id,
						vaultLabel: vault.label,
					});
				} catch (parseError) {
					resolve({
						error:
							parseError instanceof Error
								? parseError.message
								: "Invalid RAG JSON output",
						hits: [],
						stderr,
						vaultId: vault.id,
						vaultLabel: vault.label,
					});
				}
			}
		);

		if (signal) {
			signal.addEventListener(
				"abort",
				() => {
					child.kill();
				},
				{ once: true }
			);
		}
	});
};

export const queryRagVaults = async (
	vaults: CmdkRagVaultConfig[],
	query: string,
	options: CmdkRagSearchOptions,
	signal?: AbortSignal
) => {
	if (!desktopEnabled) return [];
	const responses = await Promise.all(
		vaults
			.filter((vault) => vault.enabled)
			.map((vault) => queryRagVault(vault, query, options, signal))
	);
	return responses;
};
