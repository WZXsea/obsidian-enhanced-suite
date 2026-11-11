import { buildSync } from "esbuild";
import * as fs from "fs";
import { createRequire } from "module";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";
import { runInNewContext } from "vm";
import { describe, expect, it } from "vitest";

type RagBridge = typeof import("./ragBridge");

const bundledBridge = buildSync({
	entryPoints: [fileURLToPath(new URL("./ragBridge.ts", import.meta.url))],
	bundle: true,
	platform: "node",
	format: "cjs",
	target: "es2018",
	external: ["child_process", "fs", "path"],
	write: false,
}).outputFiles[0].text;

const nodeRequire = createRequire(import.meta.url);

const isolatedBridge = (allowDesktopModules = false) => {
	const loads: string[] = [];
	const module = { exports: {} };
	runInNewContext(bundledBridge, {
		module,
		exports: module.exports,
		require: (id: string) => {
			loads.push(id);
			if (!allowDesktopModules) throw new Error(`Android module requested ${id}`);
			return nodeRequire(id);
		},
	});
	return { bridge: module.exports as RagBridge, loads };
};

const vault = {
	commandPath: "/desktop/.venv/bin/wiki-note",
	enabled: true,
	id: "research",
	label: "Research",
	obsidianPrefix: "research-wiki",
	wikiRoot: "/desktop/research-wiki",
};

const options = { fast: true, k: 10, scope: "both" as const, timeoutMs: 1000 };

describe("mobile RAG runtime isolation", () => {
	it("evaluates the emitted module with every Node dependency unavailable", () => {
		const { bridge, loads } = isolatedBridge();
		expect(typeof bridge.discoverRagVaults).toBe("function");
		expect(loads).toEqual([]);
	});

	it("defaults discovery, normalization and queries to portable search-only behavior", async () => {
		const { bridge, loads } = isolatedBridge();
		expect(bridge.discoverRagVaults(vault.wikiRoot)).toEqual([]);
		expect(bridge.resolveRagHitPath(vault, "wiki/test.md")).toBeNull();
		expect(bridge.normalizeRagPayload({ results: [{ metadata: { rel_path: "wiki/test.md" } }] }, vault)).toEqual([]);
		expect(await bridge.queryRagVault(vault, "test", options)).toEqual({
			hits: [], vaultId: vault.id, vaultLabel: vault.label,
		});
		expect(await bridge.queryRagVaults([vault], "test", options)).toEqual([]);
		expect(loads).toEqual([]);
	});

	it("keeps pure snippet matching and Obsidian path mapping available on mobile", () => {
		const { bridge, loads } = isolatedBridge();
		bridge.configureRagRuntime(false);
		expect(bridge.toObsidianPath(vault, "wiki/研究记录.md")).toBe("research-wiki/wiki/研究记录.md");
		expect(bridge.findRagTextMatch("# 标题\n移动端检索文本定位。", ["移动端检索文本定位。"])?.line).toBe(1);
		expect(loads).toEqual([]);
	});

	it("changes capability without eagerly importing desktop modules", () => {
		const { bridge, loads } = isolatedBridge();
		bridge.configureRagRuntime(true);
		bridge.configureRagRuntime(false);
		expect(bridge.discoverRagVaults(vault.wikiRoot)).toEqual([]);
		expect(loads).toEqual([]);
	});

	it("keeps individually disabled vaults free of desktop module loading", async () => {
		const { bridge, loads } = isolatedBridge();
		bridge.configureRagRuntime(true);
		expect((await bridge.queryRagVault({ ...vault, enabled: false }, "test", options)).hits).toEqual([]);
		expect(loads).toEqual([]);
	});

	it("loads desktop dependencies only for real RAG work and preserves command execution", async () => {
		const { bridge, loads } = isolatedBridge(true);
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "float-rag-runtime-"));
		try {
			const bin = path.join(root, ".venv", "bin");
			fs.mkdirSync(bin, { recursive: true });
			const command = path.join(bin, "wiki-note");
			fs.writeFileSync(command, '#!/bin/sh\nprintf \'%s\\n\' \'{"results":[{"metadata":{"rel_path":"wiki/test.md","title":"Desktop result"},"source":"wiki","text":"desktop fixture"}]}\'\n');
			fs.chmodSync(command, 0o755);
			bridge.configureRagRuntime(true);
			expect(loads).toEqual([]);
			const discovered = bridge.discoverRagVaults(root);
			expect(discovered).toHaveLength(1);
			expect(loads).toEqual(["child_process", "fs", "path"]);
			const response = await bridge.queryRagVault(discovered[0], "test", options);
			expect(response.error).toBeUndefined();
			expect(response.hits[0]).toMatchObject({ title: "Desktop result", obsidianPath: "wiki/test.md" });
			bridge.configureRagRuntime(false);
			expect(bridge.discoverRagVaults(root)).toEqual([]);
			expect(await bridge.queryRagVaults(discovered, "test", options)).toEqual([]);
			expect(loads).toHaveLength(3);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
});
