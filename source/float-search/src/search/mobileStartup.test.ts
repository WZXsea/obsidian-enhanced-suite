import {buildSync} from "esbuild";
import {readFileSync} from "fs";
import {fileURLToPath} from "url";
import {runInNewContext} from "vm";
import {describe, expect, it} from "vitest";

interface BootPlugin {
	settings: {cmdkRagEnabled: boolean};
	searchCatalog: {isReady(): boolean};
	onload(): Promise<void>;
	onunload(): void;
	openCmdkModal(query?: string): void;
}

interface TestCommand {id: string; callback?: () => void;}
type PluginConstructor = new (app: object) => BootPlugin;

const buildSource = () => buildSync({
	entryPoints: [fileURLToPath(new URL("../floatSearchIndex.ts", import.meta.url))],
	bundle: true,
	platform: "node",
	format: "cjs",
	target: "es2018",
	external: ["obsidian", "child_process", "fs", "path"],
	write: false,
}).outputFiles[0].text;

/** Missing exports stay undefined; the desktop emulator's export surface is broader. */
const bootPortableBundle = async (bundle: string) => {
	const modules: string[] = [];
	const commands: string[] = [];
	const registered = new Map<string, TestCommand>();
	const readyCallbacks: Array<() => void> = [];
	class Component {}
	class Plugin extends Component {
		constructor(public app: object) {super();}
		async loadData() {return {cmdkRagEnabled: true, defaultViewType: "window"};}
		register() {}
		registerEvent() {}
		registerDomEvent() {}
		addCommand(command: TestCommand) {commands.push(command.id); registered.set(command.id, command);}
		addRibbonIcon() {}
		addSettingTab() {}
		registerObsidianProtocolHandler() {}
	}
	class Modal {}
	class SuggestModal extends Modal {}
	class PluginSettingTab {}
	class TFile {}
	class TFolder {}
	class Notice {}
	const obsidian = {
		Plugin, Component, Modal, SuggestModal, PluginSettingTab, TFile, TFolder, Notice,
		Platform: {isMobile: true, isMobileApp: true, isAndroidApp: true, isDesktop: false},
		debounce: <T>(fn: T) => fn,
		addIcon() {},
		getAllTags: () => [],
		parseFrontMatterAliases: () => [],
	};
	const app = {
		workspace: {onLayoutReady: (fn: () => void) => readyCallbacks.push(fn), on: () => ({}), getLeavesOfType: () => []},
		vault: {getFiles: () => [], on: () => ({}), getAbstractFileByPath: () => null},
		metadataCache: {on: () => ({})},
	};
	const module: {exports: {default?: PluginConstructor}} = {exports: {}};
	runInNewContext(bundle, {
		module, exports: module.exports,
		require: (id: string) => {
			modules.push(id);
			if (id !== "obsidian") throw Error(`Mobile startup requested desktop module: ${id}`);
			return obsidian;
		},
		console, performance, setTimeout, clearTimeout, AbortController,
		document: {body: {toggleClass() {}}}, window: {},
	});
	const PluginClass = module.exports.default;
	expect(typeof PluginClass).toBe("function");
	if (!PluginClass) throw Error("Plugin constructor missing");
	const plugin = new PluginClass(app);
	await plugin.onload();
	// The entry points must work before layout-ready, and each common mobile
	// entry must address the same floating page rather than the native sidebar.
	const opened: Array<string | undefined> = [];
	const open = plugin.openCmdkModal;
	plugin.openCmdkModal = query => {opened.push(query);};
	registered.get("search-obsidian-globally")?.callback?.();
	registered.get("search-obsidian-globally-state")?.callback?.();
	registered.get("open-cmdk-search")?.callback?.();
	registered.get("open-mobile-search")?.callback?.();
	expect(opened).toEqual(["", "", undefined, undefined]);
	plugin.openCmdkModal = open;
	for (const callback of readyCallbacks) callback();
	await Promise.resolve();
	expect(plugin.searchCatalog.isReady()).toBe(true);
	expect(plugin.settings.cmdkRagEnabled).toBe(true);
	expect(commands).toContain("open-cmdk-search");
	expect(commands).not.toContain("open-search-view-window");
	expect(commands).not.toContain("open-search-view-split");
	expect(new Set(modules)).toEqual(new Set(["obsidian"]));
	plugin.onunload();
};

describe("strict Android startup without desktop/private API exports", () => {
	it("evaluates current source and boots with HoverPopover and desktop Workspace classes absent", async () => {
		await bootPortableBundle(buildSource());
	});

	it("evaluates the actual published main.js and boots with the same restricted API surface", async () => {
		const bundle = readFileSync(fileURLToPath(new URL("../../main.js", import.meta.url)), "utf8");
		await bootPortableBundle(bundle);
	});
});
