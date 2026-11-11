import {transformSync} from "esbuild";
import {readFileSync} from "fs";
import {fileURLToPath} from "url";
import {runInNewContext} from "vm";
import * as ts from "typescript";
import type {TFile, SearchResult} from "obsidian";
import {describe, expect, it, vi} from "vitest";
import {parseCmdkQuery, type ParsedCmdkQuery} from "./queryParser";
import {scoreCmdkText} from "./scoring";
import {compareCmdkSortableItems} from "./sorting";
import {prepareTypoMatcher, typoMatch} from "./typoSearch";
import {SearchCatalog, type CatalogEntry, type CatalogHeading} from "./searchCatalog";
import type {CmdkResult, SearchableCmdkResult, CmdkHeadingResult, CmdkSearchFilters} from "./resultTypes";

type Title = CatalogHeading & {isAlias?: boolean};
interface Cache {frontmatter?: {aliases?: string | string[]}; headings?: {heading: string; level: number; position: {start: {line: number}}}[];}
interface Session {query: string; parsed: ParsedCmdkQuery; files: TFile[]; catalogEntries: Map<string, CatalogEntry>; preparedTypo: ReturnType<typeof prepareTypoMatcher>;}
interface Pinned {type: string; filePath: string; isAlias?: boolean; heading?: string; line?: number;}
interface Preview {file: TFile; heading?: string; line?: number; content?: string;}
interface Owner {
	filters: CmdkSearchFilters;
	getSearchTitles(file: TFile, entry?: CatalogEntry, aliasesOnly?: boolean): Title[];
	runHeadingStage(session: Session, aliasesOnly?: boolean): Promise<void>;
	runFileStage(session: Session): Promise<void>;
	getTopPreviewResultForQuery(query: string): Promise<SearchableCmdkResult | null>;
	getResultEphemeralState(result: SearchableCmdkResult): Record<string, unknown>;
	getContentPreviewTarget(result: SearchableCmdkResult): Preview;
	getSearchableResultKey(result: SearchableCmdkResult): string;
	getPinnedItemKey(item: Pinned): string;
	resultToPinnedItem(result: SearchableCmdkResult): Pinned;
	pinnedItemToResult(item: Pinned): SearchableCmdkResult | null;
	pinnedItemMatchesResult(item: Pinned, result: SearchableCmdkResult): boolean;
	resultMatchesCurrentQuery(result: SearchableCmdkResult, parsed: ParsedCmdkQuery, query: string): boolean;
}

class RuntimeFile {
	readonly extension = "md";
	readonly stat = {mtime: 1, ctime: 1, size: 10};
	readonly name: string;
	readonly basename: string;
	constructor(readonly path: string) {
		this.name = path.split("/").pop() ?? path;
		this.basename = this.name.replace(/\.md$/, "");
	}
}
const file = (path = "Folder/Unrelated.md") => new RuntimeFile(path) as unknown as TFile;

// Keep the Obsidian boundary deterministic while executing the actual main methods.
const prepareFuzzySearch = (query: string) => (text: string): SearchResult | null => {
	const index = text.toLowerCase().indexOf(query.toLowerCase());
	return index < 0 ? null : {score: 20, matches: [[index, index + query.length]]};
};
function fixture(now = () => performance.now()) {
	const source = readFileSync(fileURLToPath(new URL("../floatSearchIndex.ts", import.meta.url)), "utf8");
	const parsed = ts.createSourceFile("floatSearchIndex.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const names = new Set(["getSearchTitles", "runHeadingStage", "runFileStage", "getTopPreviewResultForQuery", "sortFilesForPreview",
		"getResultTarget", "getResultEphemeralState", "getContentPreviewTarget", "getSearchableResultKey", "getPinnedItemKey",
		"resultToPinnedItem", "pinnedItemToResult", "pinnedItemMatchesResult", "resultMatchesCurrentQuery", "fileMatchesFilters",
		"isTypeEnabled", "isFieldEnabled", "getTypoMatch", "isTypoEnabled"]);
	const methods: string[] = [];
	const collect = (node: ts.Node) => {
		if (ts.isMethodDeclaration(node) && names.has(node.name.getText(parsed))) {
			methods.push(node.getText(parsed)); names.delete(node.name.getText(parsed));
		}
		ts.forEachChild(node, collect);
	};
	collect(parsed);
	if (names.size) throw Error(`Alias integration methods missing: ${[...names].join(", ")}`);
	const code = transformSync(`class Harness {${methods.join("\n")}}; exports.Harness = Harness;`, {loader: "ts", format: "cjs"}).code;
	const exports: {Harness?: new () => Owner} = {};
	const parseFrontMatterAliases = (frontmatter?: Cache["frontmatter"]) => {
		const aliases = frontmatter?.aliases;
		return typeof aliases === "string" ? [aliases] : aliases ?? [];
	};
	runInNewContext(code, {exports, TFile: RuntimeFile, parseFrontMatterAliases, prepareFuzzySearch, parseCmdkQuery,
		scoreCmdkText, compareCmdkSortableItems, typoMatch, performance: {now}, console, getAllTags: () => []});
	if (!exports.Harness) throw Error("Alias integration harness missing");
	const owner = new exports.Harness(), caches = new Map<string, Cache>(), files: TFile[] = [], results: CmdkResult[] = [];
	const catalog = new SearchCatalog(), categories = new Map<string, CmdkResult[]>(), completed: string[] = [];
	const settings = {cmdkSortOrder: "relevance", cmdkTypoTolerance: false, cmdkQuickCreate: true};
	Object.assign(owner, {
		closed: false, filters: {file: true, heading: true, content: false},
		plugin: {settings}, app: {metadataCache: {getFileCache: (note: TFile) => caches.get(note.path)},
			vault: {getAbstractFileByPath: (path: string) => files.find(note => note.path === path)}},
		getRawQuery: () => "  RCC  ", getCandidateFiles: () => files,
		isCurrentSearchSession: () => true, upsertSearchResults: (_session: Session, batch: CmdkResult[]) => {results.push(...batch);},
		replaceSearchResults: (_session: Session, category: string, items: CmdkResult[]) => {categories.set(category, items);},
		completeSearchStage: (_session: Session, stage: string) => {completed.push(stage);}, yieldSearchWork: vi.fn(async () => {}),
	});
	const add = (note: TFile, aliases: string | string[] = [], headings: Cache["headings"] = []) => {
		files.push(note); caches.set(note.path, {frontmatter: {aliases}, headings});
		return catalog.upsert(note, {aliases, headings: headings.map(item => ({heading: item.heading, level: item.level, line: item.position.start.line})), tags: []});
	};
	const session = (query: string): Session => ({query, parsed: parseCmdkQuery(query), files,
		catalogEntries: new Map(catalog.snapshot().map(entry => [entry.file.path, entry])), preparedTypo: prepareTypoMatcher(query)});
	return {owner, caches, files, results, catalog, categories, completed, settings, add, session};
}
const headingResult = (note: TFile, alias = true): CmdkHeadingResult => ({file: note, type: "heading", isAlias: alias,
	heading: "RCC", headingMatch: null, nameMatch: null, pathMatch: null, line: alias ? undefined : 8, level: alias ? 0 : 2});

describe("aliases integrated title search", () => {
	it("uses catalog aliases without metadata reads and normalizes metadata fallback", () => {
		const f = fixture(), note = file();
		const entry = f.add(note, [" RCC ", "rcc", "", "肾癌"], [{heading: "RCC", level: 2, position: {start: {line: 8}}}]);
		f.caches.delete(note.path);
		expect(f.owner.getSearchTitles(note, entry)).toEqual([
			{heading: "RCC", level: 0, isAlias: true}, {heading: "肾癌", level: 0, isAlias: true}, {heading: "RCC", level: 2, line: 8},
		]);
		f.caches.set(note.path, {frontmatter: {aliases: [" RCC ", "rcc", "", "肾癌"]}});
		expect(f.owner.getSearchTitles(note)).toEqual([{heading: "RCC", level: 0, isAlias: true}, {heading: "肾癌", level: 0, isAlias: true}]);
	});

	it("finds alias-only notes with title highlight and relevance scoring", async () => {
		const f = fixture(), note = file(); f.add(note, ["RCC", "肾癌"]);
		await f.owner.runHeadingStage(f.session("RCC"));
		expect(f.results).toHaveLength(1);
		expect(f.results[0]).toMatchObject({file: note, type: "heading", heading: "RCC", isAlias: true,
			headingMatch: {matches: [[0, 3]]}, score: scoreCmdkText("RCC", "RCC", 20) + 120});
		expect(f.completed).toEqual(["heading"]);
	});

	it("keeps alias lookup independent of the Markdown heading collection", async () => {
		const f = fixture(), note = file(); f.add(note, ["RCC"]);
		const session = f.session("RCC"), entry = session.catalogEntries.get(note.path);
		if (!entry) throw Error("Catalog entry missing");
		Object.defineProperty(entry, "headings", {get() {throw Error("Large heading collection accessed");}});
		expect(f.owner.getSearchTitles(note, entry, true)).toEqual([{heading: "RCC", level: 0, isAlias: true}]);
		await f.owner.runFileStage(session);
		expect(f.categories.has("create")).toBe(false);
	});

	it("yields during a long alias scan even when every file has an empty alias list", async () => {
		let clock = 0;
		const f = fixture(() => clock += 9);
		for (let index = 0; index < 64; index++) f.add(file(`Folder/Note-${index}.md`));
		await f.owner.runHeadingStage(f.session("肾"), true);
		expect(f.results).toEqual([]);
		expect(f.completed).toEqual(["heading"]);
		expect(clock).toBeGreaterThanOrEqual(45);
	});

	it("uses the actual typo matcher for aliases and honors the tolerance setting", async () => {
		const f = fixture(); f.add(file(), ["气管切开"]);
		await f.owner.runHeadingStage(f.session("气官切开")); expect(f.results).toEqual([]);
		f.settings.cmdkTypoTolerance = true;
		await f.owner.runHeadingStage(f.session("气官切开"));
		expect(f.results).toHaveLength(1);
		expect(f.results[0]).toMatchObject({heading: "气管切开", isAlias: true, headingMatch: null,
			score: (typoMatch("气官切开", "气管切开")?.score ?? 0) + 40});
	});

	it("retains a real heading with the same text using separate result and pin keys", async () => {
		const f = fixture(), note = file(); f.add(note, ["RCC"], [{heading: "RCC", level: 2, position: {start: {line: 8}}}]);
		await f.owner.runHeadingStage(f.session("RCC"));
		expect(f.results).toHaveLength(2);
		const alias = headingResult(note), heading = headingResult(note, false);
		expect(f.owner.getSearchableResultKey(alias)).not.toBe(f.owner.getSearchableResultKey(heading));
		expect(f.owner.getPinnedItemKey(f.owner.resultToPinnedItem(alias))).toBe(f.owner.getSearchableResultKey(alias));
		expect(f.owner.pinnedItemMatchesResult(f.owner.resultToPinnedItem(alias), heading)).toBe(false);
	});

	it("searches a one-character alias while aliasesOnly skips real headings", async () => {
		const f = fixture(), note = file(); f.add(note, ["肾"], [{heading: "肾", level: 1, position: {start: {line: 3}}}]);
		await f.owner.runHeadingStage(f.session("肾"), true);
		expect(f.results).toHaveLength(1); expect(f.results[0]).toMatchObject({isAlias: true, heading: "肾"});
	});

	it.each(["RCC", "rcc"])("suppresses quick-create for exact alias %s and preserves filename checks", async query => {
		const f = fixture(); f.add(file(), ["RCC"]);
		await f.owner.runFileStage(f.session(query)); expect(f.categories.has("create")).toBe(false);
		const name = fixture(); name.add(file("Folder/RCC.md"));
		await name.owner.runFileStage(name.session(query)); expect(name.categories.has("create")).toBe(false);
		const fresh = fixture(); fresh.add(file()); await fresh.owner.runFileStage(fresh.session(query));
		expect(fresh.categories.get("create")).toMatchObject([{type: "create", createQuery: query}]);
	});

	it("finds the alias in heading-only preview and respects heading field filters", async () => {
		const f = fixture(), note = file(); f.add(note, "RCC");
		expect(await f.owner.getTopPreviewResultForQuery("type:heading RCC")).toMatchObject({file: note, type: "heading", isAlias: true, heading: "RCC"});
		expect(await f.owner.getTopPreviewResultForQuery("type:heading in:content RCC")).toBeNull();
		const alias = headingResult(note);
		expect(f.owner.resultMatchesCurrentQuery(alias, parseCmdkQuery("in:heading RCC"), "RCC")).toBe(true);
		expect(f.owner.resultMatchesCurrentQuery(alias, parseCmdkQuery("in:content RCC"), "RCC")).toBe(false);
	});

	it("opens aliases as files and preserves real heading navigation in preview targets", () => {
		const f = fixture(), note = file(), alias = headingResult(note), heading = headingResult(note, false);
		expect(f.owner.getResultEphemeralState(alias)).toEqual({});
		expect(f.owner.getResultEphemeralState(heading)).toEqual({line: 8});
		expect(f.owner.getContentPreviewTarget(alias)).toMatchObject({file: note, heading: undefined, line: undefined});
		expect(f.owner.getContentPreviewTarget(heading)).toMatchObject({file: note, heading: "RCC", line: 8});
		const parent = {file: note, type: "file" as const, nameMatch: null, pathMatch: null, previewResult: alias};
		expect(f.owner.getContentPreviewTarget(parent)).toMatchObject({file: note, heading: undefined, line: undefined});
	});

	it("round-trips pinned alias identity and drops a removed alias", () => {
		const f = fixture(), note = file(); f.add(note, ["RCC"]);
		const pin = f.owner.resultToPinnedItem(headingResult(note));
		expect(pin).toMatchObject({isAlias: true, heading: "RCC", filePath: note.path});
		const restored = f.owner.pinnedItemToResult(pin);
		expect(restored).toMatchObject({type: "heading", isAlias: true, heading: "RCC", pinned: true});
		if (restored) expect(f.owner.getResultEphemeralState(restored)).toEqual({});
		f.caches.set(note.path, {frontmatter: {aliases: []}});
		expect(f.owner.pinnedItemToResult(pin)).toBeNull();
	});
});
