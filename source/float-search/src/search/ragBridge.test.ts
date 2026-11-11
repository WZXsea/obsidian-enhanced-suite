import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	configureRagRuntime,
	discoverRagVaults,
	findRagTextMatch,
	normalizeRagPayload,
	toObsidianPath,
} from "./ragBridge";

const makeWikiNoteCommand = (root: string) => {
	const binDir = path.join(root, ".venv", "bin");
	fs.mkdirSync(binDir, { recursive: true });
	const commandPath = path.join(binDir, "wiki-note");
	fs.writeFileSync(commandPath, "#!/bin/sh\n");
	fs.chmodSync(commandPath, 0o755);
};

describe("RAG bridge", () => {
	beforeEach(() => configureRagRuntime(true));
	afterEach(() => configureRagRuntime(false));
	it("discovers vault-local wiki-note commands under the Obsidian root", () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "float-rag-"));
		try {
			makeWikiNoteCommand(path.join(root, "research-wiki"));
			makeWikiNoteCommand(path.join(root, "course-wiki"));
			fs.mkdirSync(path.join(root, ".obsidian"));

			const vaults = discoverRagVaults(root);

			expect(vaults.map((vault) => vault.id)).toEqual([
				"course",
				"research",
			]);
			expect(vaults.map((vault) => vault.obsidianPrefix)).toEqual([
				"course-wiki",
				"research-wiki",
			]);
		} finally {
			fs.rmSync(root, { force: true, recursive: true });
		}
	});

	it("maps wiki-note rel_path values into Obsidian paths", () => {
		const vault = {
			enabled: true,
			id: "course",
			label: "Course",
			obsidianPrefix: "course-wiki",
			wikiRoot: "/tmp/course-wiki",
		};

		expect(toObsidianPath(vault, "wiki/entities/眼科学/玻璃体疾病.md")).toBe(
			"course-wiki/wiki/entities/眼科学/玻璃体疾病.md"
		);
		expect(toObsidianPath(vault, "raw/课程/眼科.md")).toBe(
			"course-wiki/raw/课程/眼科.md"
		);

		const hits = normalizeRagPayload(
			{
				note: "",
				results: [
					{
						bm25_score: "16.2",
						metadata: {
							chunk_index: 4,
							doc_id: "wiki:wiki/entities/眼科学/玻璃体疾病.md#c004",
							rel_path: "wiki/entities/眼科学/玻璃体疾病.md",
							source: "wiki",
							text_snippet: "玻璃体积血治疗",
							title: "玻璃体疾病",
							total_chunks: 10,
						},
						rerank_score: "0.03",
						similarity: "0.65",
						source: "wiki",
						text: "fallback text",
					},
					{
						metadata: {
							rel_path: "../outside.md",
							title: "Unsafe",
						},
						source: "wiki",
						text: "unsafe",
					},
				],
				source: "both",
			},
			vault
		);

		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({
			bm25Score: 16.2,
			chunkIndex: 4,
			obsidianPath: "course-wiki/wiki/entities/眼科学/玻璃体疾病.md",
			rerankScore: 0.03,
			similarity: 0.65,
			source: "wiki",
			text: "fallback text",
			textSnippet: "玻璃体积血治疗",
			title: "玻璃体疾病",
			totalChunks: 10,
		});
	});

	it("locates exact RAG snippets at the matching markdown line", () => {
		const markdown = [
			"# 玻璃体疾病",
			"",
			"## 三、玻璃体积血（Vitreous Hemorrhage）",
			"",
			"**玻璃体积血** 是血液进入玻璃体腔所致。",
		].join("\n");

		const match = findRagTextMatch(markdown, [
			"**玻璃体积血** 是血液进入玻璃体腔所致。",
		]);

		expect(match).toMatchObject({
			line: 4,
			lineText: "**玻璃体积血** 是血液进入玻璃体腔所致。",
		});
	});

	it("locates RAG chunks when whitespace differs from markdown", () => {
		const markdown = [
			"| 治疗方式 | 适应证与方法 |",
			"|:--------|:-----------|",
			"| **玻璃体切除术（PPV）** | 大量积血 **3~6 个月** 仍不吸收 |",
		].join("\n");

		const match = findRagTextMatch(markdown, [
			"**玻璃体切除术（PPV）** | 大量积血 **3~6 个月** 仍不吸收",
		]);

		expect(match).toMatchObject({
			line: 2,
			lineText:
				"| **玻璃体切除术（PPV）** | 大量积血 **3~6 个月** 仍不吸收 |",
		});
	});

	it("locates plain table-cell snippets at the matching markdown table row", () => {
		const markdown = [
			"| 疾病 | 治疗 |",
			"| --- | --- |",
			"| 玻璃体积血 | 玻璃体切除 |",
		].join("\n");

		const match = findRagTextMatch(markdown, [
			"玻璃体积血 玻璃体切除",
		]);

		expect(match).toMatchObject({
			line: 2,
			lineText: "| 玻璃体积血 | 玻璃体切除 |",
		});
	});

	it("locates long anchors when snippets are truncated", () => {
		const markdown = [
			"# 肺癌治疗",
			"一线治疗中，化疗联合免疫治疗可改善无进展生存。",
		].join("\n");

		const match = findRagTextMatch(markdown, [
			"…化疗联合免疫治疗可改善无进展生存",
		]);

		expect(match).toMatchObject({
			line: 1,
			lineText: "一线治疗中，化疗联合免疫治疗可改善无进展生存。",
		});
	});

	it("returns null when no RAG text can be mapped back to the file", () => {
		expect(findRagTextMatch("alpha\nbeta", ["gamma"])).toBeNull();
	});
});
