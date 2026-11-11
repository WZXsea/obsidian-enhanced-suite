import {
	addIcon,
	App,
	Editor,
	ExtraButtonComponent,
	getAllTags,
	Keymap,
	Menu,
	MenuItem,
	Modal,
	Notice,
	ObsidianProtocolData,
	OpenViewState,
	PaneType,
	Platform,
	Plugin,
	parseFrontMatterAliases,
	prepareFuzzySearch,
	prepareSimpleSearch,
	renderResults,
	SearchResult,
	requireApiVersion,
	SearchView,
	setIcon,
	PluginSettingTab,
	Setting,
	SuggestModal,
	TAbstractFile,
	TFile,
	TFolder,
	Workspace,
	WorkspaceContainer,
	WorkspaceItem,
	WorkspaceLeaf,
} from "obsidian";
import { EmbeddedView, isEmebeddedLeaf, spawnLeafView } from "./leafView";
import {
	buildHeadingLineIndex,
	findAllNonHeadingLineMatches,
	findFirstNonHeadingExactMatch,
	findFirstNonHeadingLineMatch,
	getContentLines,
	type HeadingLineIndex,
} from "./search/contentSearch";
import { isHiddenPath, parseCmdkQuery, ParsedCmdkQuery } from "./search/queryParser";
import {
	configureRagRuntime,
	discoverRagVaults,
	findRagTextMatch,
	queryRagVaults,
	type CmdkRagHit,
} from "./search/ragBridge";
import { scoreCmdkText } from "./search/scoring";
import {
	CmdkSortOrder,
	compareCmdkSortableItems,
	normalizeCmdkSortOrder,
} from "./search/sorting";
import {
	prepareTypoMatcher,
	typoMatch,
	type PreparedTypoMatcher,
	type TypoMatch,
} from "./search/typoSearch";
import {
	CmdkFileResult,
	CmdkHistoryResult,
	CmdkLoadMoreResult,
	CmdkRagResult,
	CmdkResult,
	CmdkSearchField,
	CmdkSearchFilters,
	CmdkSearchType,
	SearchableCmdkResult,
	isCreateCmdkResult,
	isSearchableCmdkResult,
} from "./search/resultTypes";
import { COLLAPSED_CHILD_LIMIT, ResultWindow } from "./search/resultWindow";
import { SearchResultStore } from "./search/searchResultStore";
import {
	isCurrentSearchSession,
	type SearchSession,
	type SearchStage,
} from "./search/searchSession";
import { TrailingCommitScheduler } from "./search/trailingCommitScheduler";
import { SearchCatalog, type CatalogEntry, type CatalogHeading } from "./search/searchCatalog";
import { ContentReadCoordinator } from "./search/contentReadCoordinator";
import {
	getTypoFallbackDelay,
	shouldRunTypoFallback,
} from "./search/typoFallback";
import {
	captureSuggestionViewport,
	resolveSuggestionScrollTop,
	resolveSuggestionViewportIndexes,
	SuggestionViewportSnapshot,
} from "./search/suggestionViewport";
import {
	acceptFilterAutocomplete,
	analyzeFilterAutocomplete,
	extractActivatedFilterTokens,
	type ActivatedFilterToken,
	type FilterAutocompleteState,
	type FilterAutocompleteSuggestion,
	type FilterAutocompleteTrigger,
} from "./search/filterAutocomplete";
import { around } from "monkey-around";
import { debounce } from "obsidian";
import { bindMobileSearchViewport } from "./search/mobileViewport";
import { MobileSearchModal } from "./search/mobileSearchModal";
import { MobileSearchPreview } from "./search/mobilePreview";
import { registerMobileSearchEntries } from "./search/mobileEntries";
import { DesktopSearchPreview } from "./search/desktopPreview";
import { LatestPreviewQueue } from "./search/latestPreviewQueue";
import {
	animateNavigation,
	animateResultChange,
	cancelSearchMotion,
	isResultMotionActive,
	RESULT_MOTION_END_EVENT,
} from "./search/searchMotion";

type sortOrder =
	| "alphabetical"
	| "alphabeticalReverse"
	| "byModifiedTime"
	| "byModifiedTimeReverse"
	| "byCreatedTime"
	| "byCreatedTimeReverse";

type searchType = "modal" | "sidebar" | PaneType;

interface viewType {
	type: searchType;
	icon: string;
}

interface searchState extends Record<string, unknown> {
	collapseAll?: boolean;
	explainSearch?: boolean;
	extraContext?: boolean;
	matchingCase?: boolean;
	query: string;
	sortOrder?: sortOrder;
	current?: boolean;
}

type CmdkTriggerKey = "Shift" | "Control" | "Alt" | "Meta" | "none";

interface CmdkPinnedItem {
	type: CmdkSearchType;
	filePath: string;
	isAlias?: boolean;
	heading?: string;
	headingLevel?: number;
	content?: string;
	line?: number;
	query?: string;
	pinnedAt: number;
}

interface CmdkFileGroup {
	children: SearchableCmdkResult[];
	file: TFile;
	fileResult?: CmdkFileResult;
	score: number;
}

interface CmdkChooser {
	renderSuggestions?: () => void;
	selectedItem?: number;
	setSuggestions(results: CmdkResult[]): void;
	suggestions?: HTMLElement[];
	values?: CmdkResult[];
}

interface CmdkActiveSearchSession extends SearchSession {
	catalogEntries: Map<string, CatalogEntry>;
	chooser: CmdkChooser;
	completedStages: Set<SearchStage>;
	controller: AbortController;
	exactContentPaths: Set<string>;
	files: TFile[];
	headingLinesByPath: HeadingLineIndex;
	parsed: ParsedCmdkQuery;
	preparedTypo: PreparedTypoMatcher;
	query: string;
	startedAt: number;
}

interface CmdkActiveFilterToken {
	id: number;
	token: ActivatedFilterToken;
}

interface CmdkFilterCompletionItem {
	description: string;
	disabled?: boolean;
	id: string;
	invalid?: boolean;
	label: string;
	suggestionId?: string;
}

interface FloatSearchSettings {
	searchViewState: searchState;
	showFilePath: boolean;
	showInstructions: boolean;
	defaultViewType: searchType;
	cmdkTriggerKey: CmdkTriggerKey;
	cmdkDoubleTapInterval: number;
	cmdkQuickCreate: boolean;
	cmdkQuickCreateFolder: string;
	cmdkQuickCreateTitleFormat: string;
	cmdkPinnedItems: CmdkPinnedItem[];
	cmdkRagEnabled: boolean;
	cmdkRagResultsPerVault: number;
	cmdkPreviewSplitRatio: number;
	cmdkSearchHistory: string[];
	cmdkSortOrder: CmdkSortOrder;
	cmdkTypoTolerance: boolean;
}

const DEFAULT_SETTINGS: FloatSearchSettings = {
	searchViewState: {
		collapseAll: false,
		explainSearch: false,
		extraContext: false,
		matchingCase: false,
		query: "",
		sortOrder: "alphabetical",
	},
	showFilePath: false,
	showInstructions: true,
	defaultViewType: "modal",
	cmdkTriggerKey: "Shift",
	cmdkDoubleTapInterval: 300,
	cmdkQuickCreate: false,
	cmdkQuickCreateFolder: "",
	cmdkQuickCreateTitleFormat: "YYYYMMDDHHmmss",
	cmdkPinnedItems: [],
	cmdkRagEnabled: false,
	cmdkRagResultsPerVault: 50,
	cmdkPreviewSplitRatio: 0.42,
	cmdkSearchHistory: [],
	cmdkSortOrder: "relevance",
	cmdkTypoTolerance: true,
};

const INVALID_FILE_NAME_CHARS = /[/\\?%*:|"<>]/g;
const MIN_CMDK_RAG_RESULTS_PER_VAULT = 4;
const MIN_CMDK_PREVIEW_SPLIT_RATIO = 0.25;
const MAX_CMDK_PREVIEW_SPLIT_RATIO = 0.75;
const MIN_CMDK_RESULTS_WIDTH = 260;
const MIN_CMDK_PREVIEW_WIDTH = 320;
const MAX_CMDK_RAG_RESULTS_PER_VAULT = 200;

const escapeRegExp = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sanitizePathSegment = (value: string) =>
	value.replace(INVALID_FILE_NAME_CHARS, "-").trim();

const clampNumber = (
	value: number,
	min: number,
	max: number,
	fallback = min
) => {
	const numericValue =
		typeof value === "number" && Number.isFinite(value) ? value : fallback;
	return Math.min(Math.max(numericValue, min), max);
};

const allViews: viewType[] = [
	{
		type: "modal",
		icon: "square-equal",
	},
	{
		type: "sidebar",
		icon: "panel-left-inactive",
	},
	{
		type: "split",
		icon: "split-square-horizontal",
	},
	{
		type: "tab",
		icon: "panel-top",
	},
	{
		type: "window",
		icon: "app-window",
	},
];

const initSearchViewWithLeaf = async (
	app: App,
	type: PaneType | "sidebar",
	state?: searchState
) => {
	if (Platform.isMobile && (type === "window" || type === "split")) {
		type = "sidebar";
	}
	const leaf =
		type === "sidebar"
			? app.workspace.getLeftLeaf(false)
			: app.workspace.getLeaf(type);
	leaf?.setPinned(type !== "sidebar");
	await leaf?.setViewState({
		type: "search",
		active: true,
		state: {
			...DEFAULT_SETTINGS.searchViewState,
			...state,
			triggerBySelf: true,
		},
	});
	if (Platform.isMobile && leaf) await app.workspace.revealLeaf(leaf);

	setTimeout(() => {
		const inputEl = leaf?.containerEl.getElementsByTagName("input")?.[0];
		inputEl?.focus();
	}, 0);
};

export default class FloatSearchPlugin extends Plugin {
	settings: FloatSearchSettings;
	readonly searchCatalog = new SearchCatalog();
	readonly contentReadCoordinator = new ContentReadCoordinator();
	private searchCatalogGeneration = 0;
	private disposed = false;
	private state: searchState;
	private modal: FloatSearchModal;
	private cmdkModal: FloatSearchCmdkModal;

	allLoaded: boolean = false;
	queryLoaded: boolean = false;

	patchedDomChildren = false;

	public applySettingsUpdate = debounce(async () => {
		if (!this.allLoaded) {
			this.allLoaded = true;
			return;
		}
		// Ensure all searchState properties are preserved
		this.settings.searchViewState = {
			...DEFAULT_SETTINGS.searchViewState,
			...this.settings.searchViewState,
			query: this.state?.query || "",
		};
		await this.saveSettings();
	}, 1000);

	private applyStateUpdate = debounce(() => {
		// Preserve all state properties when updating
		this.state = {
			...DEFAULT_SETTINGS.searchViewState,
			...this.state,
			query: "",
		};
	}, 30000);

	async onload() {
		this.disposed = false;
		configureRagRuntime(!Platform.isMobile);
		await this.loadSettings();
		this.initState();

		this.app.workspace.onLayoutReady(() => {
			if (this.disposed) return;
			this.registerIcons();
			void this.initializeSearchCatalog();
			this.registerSearchCatalogEvents();

			if (!Platform.isMobile) {
				this.patchWorkspace();
				this.patchWorkspaceLeaf();
				this.patchSearchView();
				this.patchVchildren();
				this.patchDragManager();
			}
			this.registerDoubleKeyHandler();
		});

		this.registerObsidianURIHandler();
		this.registerObsidianCommands();
		this.registerEditorMenuHandler();
		this.registerContextMenuHandler();
		if (Platform.isMobile) registerMobileSearchEntries(this, this.app, () => this.openCmdkModal());

		this.addRibbonIcon(
			"search",
			Platform.isMobile ? "打开快速搜索" : `Search obsidian in ${this.settings.defaultViewType} view`,
			() => {
				if (Platform.isMobile) {
					this.openCmdkModal();
				} else if (this.settings.defaultViewType === "modal") {
					this.initModal(this.state, true, true);
				} else {
					initSearchViewWithLeaf(
						this.app,
						this.settings.defaultViewType,
						{
							...this.state,
							query: "",
						}
					);
				}
			}
		);
		this.updateFilePathVisibility();
		this.addSettingTab(new FloatSearchSettingTab(this.app, this));
	}

	private getCatalogMetadata(file: TFile) {
		const cache = this.app.metadataCache.getFileCache(file);
		return {
			aliases: parseFrontMatterAliases(cache?.frontmatter) ?? [],
			headings: (cache?.headings ?? []).map((heading) => ({
				heading: heading.heading,
				level: heading.level,
				line: heading.position?.start.line,
			})),
			tags: cache ? getAllTags(cache) ?? [] : [],
		};
	}

	private shouldCatalogFile(file: TFile) {
		return (
			!isHiddenPath(file.path) &&
			(file.extension === "md" ||
				file.extension === "canvas" ||
				file.extension === "pdf")
		);
	}

	private upsertSearchCatalogFile(file: TFile) {
		if (this.disposed) return;
		if (!this.shouldCatalogFile(file)) {
			this.searchCatalog.remove(file.path);
			return;
		}
		this.searchCatalog.upsert(file, this.getCatalogMetadata(file));
	}

	private async initializeSearchCatalog() {
		const generation = ++this.searchCatalogGeneration;
		this.searchCatalog.clear();
		const files = this.app.vault.getFiles();
		let sliceStartedAt = performance.now();
		for (const file of files) {
			if (
				this.disposed ||
				generation !== this.searchCatalogGeneration
			) {
				return;
			}
			if (this.app.vault.getAbstractFileByPath(file.path) === file) {
				this.upsertSearchCatalogFile(file);
			}
			if (performance.now() - sliceStartedAt >= 8) {
				await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
				if (
					this.disposed ||
					generation !== this.searchCatalogGeneration
				) {
					return;
				}
				sliceStartedAt = performance.now();
			}
		}
		if (this.disposed || generation !== this.searchCatalogGeneration) return;
		this.searchCatalog.markReady();
	}

	private registerSearchCatalogEvents() {
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile) this.upsertSearchCatalogFile(file);
			})
		);
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (!(file instanceof TFile)) return;
				this.upsertSearchCatalogFile(file);
				this.contentReadCoordinator.invalidate(file.path);
			})
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				this.searchCatalog.remove(file.path);
				this.contentReadCoordinator.invalidate(file.path);
			})
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				this.searchCatalog.remove(oldPath);
				this.contentReadCoordinator.rename(oldPath, file.path);
				if (file instanceof TFile) this.upsertSearchCatalogFile(file);
			})
		);
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (this.shouldCatalogFile(file)) {
					this.searchCatalog.updateMetadata(
						file.path,
						this.getCatalogMetadata(file)
					);
				}
			})
		);
	}

	onunload() {
		this.disposed = true;
		this.searchCatalogGeneration++;
		// this.state = DEFAULT_SETTINGS.searchViewState;
		this.modal?.close();
		this.cmdkModal?.close();
		this.searchCatalog.clear();
		this.contentReadCoordinator.clear();
		document.body.toggleClass("show-file-path", false);
	}

	registerDoubleKeyHandler() {
		let lastKeyUp = 0;
		let keyOnly = true;
		const shouldSuppressCmdkTrigger = () => {
			if (
				document.querySelector(
					".modal-container, .menu, .suggestion-container"
				)
			) {
				return true;
			}
			const activeEl = document.activeElement;
			if (!activeEl) return false;
			return ["INPUT", "TEXTAREA", "SELECT"].includes(activeEl.tagName);
		};

		this.registerDomEvent(document, "keydown", (e: KeyboardEvent) => {
			const triggerKey = this.settings.cmdkTriggerKey;
			if (triggerKey === "none" || e.key !== triggerKey) {
				keyOnly = false;
			}
		});

		this.registerDomEvent(document, "keyup", (e: KeyboardEvent) => {
			const triggerKey = this.settings.cmdkTriggerKey;
			if (triggerKey === "none") return;
			if (e.key === triggerKey) {
				const now = Date.now();
				if (
					keyOnly &&
					now - lastKeyUp < this.settings.cmdkDoubleTapInterval &&
					!shouldSuppressCmdkTrigger() &&
					!document.querySelector(
						".float-search-cmdk-container"
					)
				) {
					lastKeyUp = 0;
					this.openCmdkModal();
				} else {
					lastKeyUp = now;
					keyOnly = true;
				}
			}
		});
	}

	openCmdkModal(query?: string) {
		if (this.cmdkModal) {
			this.cmdkModal.close();
		}
		try {
			this.cmdkModal = new FloatSearchCmdkModal(this);
			this.cmdkModal.open();
			if (query !== undefined) this.cmdkModal.setSearchQuery(query);
		} catch (error) {
			console.error("Floating Search: quick search opening failed", error);
			new Notice(`快速搜索打开异常：${error instanceof Error ? error.message : String(error)}`);
		}
	}

	updateFilePathVisibility() {
		const { showFilePath } = this.settings;
		document.body.toggleClass("show-file-path", showFilePath);
	}

	changeFilePathVisibility() {
		this.settings.showFilePath = !this.settings.showFilePath;
		this.updateFilePathVisibility();
		this.applySettingsUpdate();
	}

	initState() {
		// Initialize state with all default properties
		this.state = {
			...DEFAULT_SETTINGS.searchViewState,
			...this.settings.searchViewState,
		};
	}

	initModal(
		state: searchState,
		stateSave: boolean = false,
		clearQuery: boolean = false
	) {
		if (Platform.isMobile) {
			const query = clearQuery ? "" : state?.query ?? "";
			if (/(^|\s)(?:line|block|section|task(?:-todo|-done)?|match-case|ignore-case):|(^|\s)\/[^\n]+\//i.test(query)) {
				void initSearchViewWithLeaf(this.app, "sidebar", { ...state, query });
			} else this.openCmdkModal(query);
			return;
		}
		if (this.modal) {
			this.modal.close();
		}

		this.modal = new FloatSearchModal(
			(state) => {
				// Preserve all state properties when updating from modal
				this.state = {
					...DEFAULT_SETTINGS.searchViewState,
					...state,
				};
				if (stateSave) this.applyStateUpdate();
				this.settings.searchViewState = this.state;
				this.applySettingsUpdate();
			},
			this,
			{ ...state, query: clearQuery ? "" : state.query }
		);
		this.modal.open();
	}

	patchWorkspace() {
		let layoutChanging = false;
		const self = this;
		const uninstaller = around(Workspace.prototype, {
			getLeaf: (next) =>
				function (...args) {
					const activeLeaf = (this as Workspace).activeLeaf;
					if (activeLeaf) {
						// @ts-ignore
						const fsCtnEl = (
							activeLeaf.parent?.containerEl as HTMLElement | undefined
						)?.parentElement;
						if (fsCtnEl?.hasClass("fs-content")) {
							if (activeLeaf.view.getViewType() === "markdown") {
								return activeLeaf;
							}

							const newLeaf =
								self.app.workspace.getMostRecentLeaf();

							if (newLeaf) {
								this.setActiveLeaf(newLeaf);
							}
						}
						return next.call(this, ...args);
					}
					return next.call(this, ...args);
				},
			changeLayout(old) {
				return async function (workspace: unknown) {
					layoutChanging = true;
					try {
						// Don't consider hover popovers part of the workspace while it's changing
						await old.call(this, workspace);
					} finally {
						layoutChanging = false;
					}
				};
			},
			iterateLeaves(old) {
				type leafIterator = (item: WorkspaceLeaf) => boolean | void;
				return function (arg1, arg2) {
					// Fast exit if desired leaf found
					if (old.call(this, arg1, arg2)) return true;

					// Handle old/new API parameter swap
					const cb: leafIterator = (
						typeof arg1 === "function" ? arg1 : arg2
					) as leafIterator;
					const parent: WorkspaceItem = (
						typeof arg1 === "function" ? arg2 : arg1
					) as WorkspaceItem;

					if (!parent) return false; // <- during app startup, rootSplit can be null
					if (layoutChanging) return false; // Don't let HEs close during workspace change

					// 0.14.x doesn't have WorkspaceContainer; this can just be an instanceof check once 15.x is mandatory:

					if (!requireApiVersion("0.15.0")) {
						if (
							parent === self.app.workspace.rootSplit ||
							(WorkspaceContainer &&
								parent instanceof WorkspaceContainer)
						) {
							for (const popover of EmbeddedView.popoversForWindow(
								(parent as WorkspaceContainer).win
							)) {
								// Use old API here for compat w/0.14.x
								if (old.call(this, cb, popover.rootSplit))
									return false;
							}
						}
					}
					return false;
				};
			},
				setActiveLeaf(old) {
					return function (leaf: any, params?: any) {
						if (isEmebeddedLeaf(leaf)) {
							const result = old.call(this, leaf, params);
							leaf.activeTime = 1700000000000;
							return result;
						}
						return old.call(this, leaf, params);
					};
				},
			pushUndoHistory(old: any) {
				return function (
					leaf: WorkspaceLeaf,
					id: string,
					...args: any[]
				) {
					const viewState = leaf.getViewState();
					if (viewState.type === "search") {
						return;
					}
					return old.call(this, leaf, id, ...args);
				};
			},
		});
		this.register(uninstaller);
	}

	// Used for patch workspaceleaf pinned behaviors
	patchWorkspaceLeaf() {
		this.register(
			around(WorkspaceLeaf.prototype, {
				getRoot(old) {
					return function () {
						const top = old.call(this);
						return top?.getRoot === this.getRoot
							? top
							: top?.getRoot();
					};
				},
				setPinned(old) {
					return function (pinned: boolean) {
						old.call(this, pinned);
						if (isEmebeddedLeaf(this) && !pinned)
							this.setPinned(true);
					};
					},
					openFile(old) {
						return function (file: TFile, openState?: OpenViewState) {
							let uninstallCoreRecentPatch: (() => void) | undefined;
							let uninstallPluginRecentPatch:
								| (() => void)
								| undefined;
							const cleanupRecentPatches = () => {
								uninstallCoreRecentPatch?.();
								uninstallCoreRecentPatch = undefined;
								uninstallPluginRecentPatch?.();
								uninstallPluginRecentPatch = undefined;
							};

							if (isEmebeddedLeaf(this)) {
								uninstallCoreRecentPatch = around(
									Workspace.prototype,
									{
										recordMostRecentOpenedFile(next) {
											return function (_file: TFile) {
												// Don't update the quick switcher's recent list
												if (_file !== file) {
													return next.call(this, _file);
												}
											};
										},
									}
								);
								const recentFiles =
									this.app.plugins.plugins[
										"recent-files-obsidian"
									];
								if (recentFiles) {
									uninstallPluginRecentPatch = around(
										recentFiles,
										{
											shouldAddFile(next) {
												return function (_file: TFile) {
													// Don't update the Recent Files plugin
													return (
														_file !== file &&
														next.call(this, _file)
													);
												};
											},
										}
									);
								}
							}

							let view;
							try {
								view = old.call(this, file, openState);
							} catch (error) {
								cleanupRecentPatches();
								throw error;
							}
							if (uninstallCoreRecentPatch || uninstallPluginRecentPatch) {
								Promise.resolve(view).then(
									cleanupRecentPatches,
									cleanupRecentPatches
								);
							}
							setTimeout(() => {
								const fsCtnEl = (
									this.parent?.containerEl as HTMLElement | undefined
								)?.parentElement;
							if (!fsCtnEl?.classList.contains("fs-content"))
								return;
							if (file.extension != "canvas") return;

							const canvas = this.view.canvas;
							setTimeout(() => {
								if (canvas && openState?.eState?.match) {
									let node = canvas.data.nodes?.find(
										(e: any) =>
											e.text ===
											(openState?.eState as any)?.match
												?.content
									);
									if (node) {
										node = canvas.nodes.get(node.id);
										canvas.selectOnly(node);
										canvas.zoomToSelection();
									}
								}
							}, 20);
						}, 1);

						return view;
					};
				},
			})
		);
	}

	patchSearchView() {
		const checkCurrentViewType = (leaf: WorkspaceLeaf) => {
			const isModal =
				document.querySelector(".float-search-modal") !== null;
			const currentLeafRoot = leaf.getRoot();
			if (
				currentLeafRoot?.side &&
				(currentLeafRoot?.side === "left" ||
					currentLeafRoot?.side === "right")
			)
				return "sidebar";
			if (leaf.getContainer()?.type === "window") return "window";
			return isModal ? "modal" : "split";
		};

		const initViewMenu = (
			menu: Menu,
			current: searchType,
			originLeaf?: WorkspaceLeaf
		) => {
			menu.dom.toggleClass("float-search-view-menu", true);
			const availableViews = allViews.filter((view) => {
				if (current === "split") {
					return view.type !== "tab";
				} else {
					return view.type !== current;
				}
			});
			for (const view of availableViews) {
				menu.addItem((item: MenuItem) => {
					item.setTitle(`${view.type} view`)
						.setIcon(`${view.icon}`)
						.onClick(async () => {
							if (view.type === "modal") {
								originLeaf?.detach();
								setTimeout(() => {
									this.initModal(this.state, true, false);
								}, 10);
							} else if (view.type === "sidebar") {
								await initSearchViewWithLeaf(
									this.app,
									view.type,
									this.state
								);
							} else {
								if (current === "window") {
									originLeaf?.detach();
									setTimeout(async () => {
										await initSearchViewWithLeaf(
											this.app,
											<"tab" | "split">view.type,
											this.state
										);
									}, 10);
								} else {
									await initSearchViewWithLeaf(
										this.app,
										view.type,
										this.state
									);
								}
							}
							if (current === "modal") {
								this.modal.close();
							} else {
								originLeaf?.detach();
							}
						});
				});
			}
			return menu;
		};

		const patchSearch = async () => {
			const searchLeaf = this.app.workspace.getLeavesOfType("search")[0];
			if (!searchLeaf) return false;
			if (requireApiVersion("1.7.3") && searchLeaf.isDeferred) {
				await searchLeaf.loadIfDeferred();
			}

			const searchView = searchLeaf?.view as any;
			const self = this;

			if (!searchView) return false;

			const searchViewConstructor = searchView.constructor;

			this.register(
				around(searchViewConstructor.prototype, {
					onOpen(old) {
						return function () {
							old.call(this);

								const viewSwitchEl = createDiv({
									cls: "float-search-view-switch",
								});
								const targetEl = this.filterSectionToggleEl;
								if (!targetEl?.parentElement) return;
								const viewSwitchButton = new ExtraButtonComponent(
									viewSwitchEl
								);
								viewSwitchButton
									.setIcon("layout-template")
									.setTooltip("Switch search view");
							viewSwitchButton.onClick(() => {
								const currentType = checkCurrentViewType(
									this.leaf
								);
								const layoutMenu = initViewMenu(
									new Menu(),
									currentType,
									this.leaf
								);
								const viewSwitchButtonPos =
									viewSwitchEl.getBoundingClientRect();
								layoutMenu.showAtPosition({
									x: viewSwitchButtonPos.x,
									y: viewSwitchButtonPos.y + 30,
								});
							});
							targetEl.parentElement.insertBefore(
								viewSwitchEl,
								targetEl
							);
								if (
									!this.hidePathToggle &&
									this.searchParamsContainerEl
								) {
									this.hidePathToggle = new Setting(
										this.searchParamsContainerEl
									)
									.setName("Show file path")
									.addToggle((toggle) => {
										toggle.toggleEl.toggleClass(
											"mod-small",
											true
										);
										toggle
											.setValue(
												self.settings.showFilePath
											)
											.onChange(async (value) => {
												self.settings.showFilePath =
													!value;
												self.changeFilePathVisibility();
												self.applySettingsUpdate();
											});
									});
							}
								if (
									!this.showInstructionsToggle &&
									this.searchParamsContainerEl
								) {
									this.showInstructionsToggle = new Setting(
										this.searchParamsContainerEl
									)
									.setName("Show instructions")
									.addToggle((toggle) => {
										toggle.toggleEl.toggleClass(
											"mod-small",
											true
										);
										toggle
											.setValue(
												self.settings.showInstructions
											)
											.onChange(async (value) => {
												self.settings.showInstructions =
													value;
												self.applySettingsUpdate();
											});
									});
							}
								if (
									!this.defaultViewTypeDropdown &&
									this.searchParamsContainerEl
								) {
									this.defaultViewTypeDropdown = new Setting(
										this.searchParamsContainerEl
									)
									.setName("Default view type")
									.addDropdown((dropdown) => {
										dropdown.addOptions({
											modal: "Modal",
											split: "Split",
											tab: "Tab",
											window: "Window",
											sidebar: "Sidebar",
										});
										dropdown.setValue(
											self.settings.defaultViewType
										);
										dropdown.onChange((value) => {
											self.settings.defaultViewType =
												value as searchType;
											self.applySettingsUpdate();
										});
									});
							}
						};
					},
					setExplainSearch(old) {
						return function (value: boolean) {
							old.call(this, value);
							if (self.app.workspace.layoutReady) {
								self.settings.searchViewState.explainSearch =
									value;
								self.applySettingsUpdate();
							}
						};
					},
					setCollapseAll(old) {
						return function (value: boolean) {
							old.call(this, value);
							if (self.app.workspace.layoutReady) {
								self.settings.searchViewState.collapseAll =
									value;
								self.applySettingsUpdate();
							}
						};
					},
					setExtraContext(old) {
						return function (value: boolean) {
							old.call(this, value);
							if (self.app.workspace.layoutReady) {
								self.settings.searchViewState.extraContext =
									value;
								self.applySettingsUpdate();
							}
						};
					},
					setMatchingCase(old) {
						return function (value: boolean) {
							old.call(this, value);
							if (self.app.workspace.layoutReady) {
								self.settings.searchViewState.matchingCase =
									value;
								self.applySettingsUpdate();
							}
						};
					},
					setSortOrder(old) {
						return function (value: string) {
							old.call(this, value);
							if (self.app.workspace.layoutReady) {
								self.settings.searchViewState.sortOrder =
									value as sortOrder;
								self.applySettingsUpdate();
							}
						};
					},
					setQuery(old) {
						return function (value: string) {
							old.call(this, value);
							if (self.app.workspace.layoutReady) {
								self.settings.searchViewState.query = value;
								self.applySettingsUpdate();
							}
						};
					},
					setState(old) {
						return function (
							state: any,
							eState: Record<string, unknown>
						) {
							if (
								typeof state.query === "string" &&
								!state?.triggerBySelf
							) {
								if (self.queryLoaded) {
									if (
										self.settings.defaultViewType ===
										"modal"
									) {
										self.initModal(
											{
												...state,
												query: state.query,
												current: false,
												triggerBySelf: true,
											},
											true,
											false
										);
									} else {
										initSearchViewWithLeaf(
											self.app,
											self.settings.defaultViewType,
											{
												...state,
												query: state.query,
												current: false,
												triggerBySelf: true,
											}
										);
									}

									return;
								}

								self.queryLoaded = true;
							}

							old.call(this, state, eState);
						};
					},
				})
			);
			searchView.leaf?.rebuildView();
			return true;
		};
		this.app.workspace.onLayoutReady(async () => {
			if (!(await patchSearch())) {
				const evt = this.app.workspace.on("layout-change", async () => {
					(await patchSearch()) && this.app.workspace.offref(evt);
				});
				this.registerEvent(evt);
			}
		});
	}

	patchVchildren() {
		const patchSearchDom = () => {
			const searchView = this.app.workspace.getLeavesOfType("search")[0]
				?.view as any;
			if (!searchView) return false;

			const dom = searchView.dom.constructor;
			this.register(
				around(dom.prototype, {
					stopLoader(old) {
						return function () {
							old.call(this);
							// console.log(this?.vChildren?.children);
							this?.vChildren?.children?.forEach((child: any) => {
								if (child?.file && !child?.pathEl) {
									const path =
										child?.file.parent?.path || "/";
									const pathEl = createDiv({
										cls: "search-result-file-path",
									});
									const pathIconEl = pathEl.createDiv({
										cls: "search-result-file-path-icon",
									});
									setIcon(pathIconEl, "folder");
								pathEl.createDiv({
										cls: "search-result-file-path-text",
										text: path,
									});
										child.pathEl = pathEl;
										const titleEl = child.containerEl.find(
											".search-result-file-title"
										);
										if (!titleEl) return;
										titleEl.prepend(pathEl);
									}
								});
						};
					},
				})
			);
			return true;
		};
		this.app.workspace.onLayoutReady(() => {
			if (!patchSearchDom()) {
				const evt = this.app.workspace.on("layout-change", () => {
					patchSearchDom() && this.app.workspace.offref(evt);
				});
				this.registerEvent(evt);
			}
		});
	}

	patchDragManager() {
		const manager = this.app.dragManager;
		if (!manager) return;
		const self = this;

		this.register(
			around(manager.constructor.prototype, {
				dragFile(old: any) {
					return function (e: any, a: TFile) {
						const result = old.call(this, e, a);

						setTimeout(() => {
							self?.modal?.close();
						}, 10);
						return result;
					};
				},
			})
		);
	}

	registerObsidianURIHandler() {
		/**
		 * Handles obsidian://fs protocol for search functionality
		 *
		 * @param viewType - Where to open search:
		 *   - "modal" (default) - Opens in modal popup
		 *   - "tab" - Opens in new tab
		 *   - "split" - Opens in split pane
		 *   - "window" - Opens in new window
		 *   - "sidebar" - Opens in sidebar
		 * @param query - Search query string
		 *
		 * Examples:
		 * obsidian://fs?query=hello&viewType=modal
		 * obsidian://fs?query=world&viewType=tab
		 * obsidian://fs?query=test (defaults to modal)
		 */
		this.registerObsidianProtocolHandler(
			"fs",
			async (path: ObsidianProtocolData) => {
				const viewType = path.viewType || "modal";
				const query = path.query || "";

				if (viewType === "modal") {
					this.initModal(
						{
							...this.state,
							query,
							current: false,
						},
						true,
						false
					);
				} else {
					await initSearchViewWithLeaf(
						this.app,
						viewType as PaneType | "sidebar",
						{
							...this.state,
							query,
							current: false,
						}
					);
				}
			}
		);
	}

	private createCommand(options: {
		id: string;
		name: string;
		queryBuilder: (file?: TFile) => string;
		global: boolean;
	}): void {
		if (options.global) {
			this.addCommand({
				id: options.id,
				name: options.name,
				callback: () => {
					const query = options.queryBuilder();
					const viewType = this.settings.defaultViewType;

					if (viewType === "modal") {
						this.initModal(
							{ ...this.state, query, current: true },
							true,
							false
						);
					} else {
						initSearchViewWithLeaf(
							this.app,
							viewType as PaneType | "sidebar",
							{
								...this.state,
								query,
								current: true,
							}
						);
					}
				},
			});
		} else {
			this.addCommand({
				id: options.id,
				name: options.name,
				checkCallback: (checking: boolean) => {
					const activeLeaf = this.app.workspace.activeLeaf;
					if (!activeLeaf) return;

					const viewType = activeLeaf.view.getViewType();
					if (viewType === "markdown" || viewType === "canvas") {
						if (!checking) {
							const currentFile = activeLeaf.view.file;
							const query = options.queryBuilder(currentFile);
							const viewType = this.settings.defaultViewType;

							if (viewType === "modal") {
								this.initModal(
									{ ...this.state, query, current: true },
									true,
									false
								);
							} else {
								initSearchViewWithLeaf(
									this.app,
									viewType as PaneType | "sidebar",
									{
										...this.state,
										query,
										current: true,
									}
								);
							}
						}
						return true;
					}
				},
			});
		}
	}

	registerObsidianCommands() {
		if (Platform.isMobile) {
			this.addCommand({
				id: "open-mobile-search",
				name: "打开快速搜索（手机）",
				callback: () => this.openCmdkModal(),
			});
		}
		this.addCommand({
			id: "open-cmdk-search",
			name: "Open quick search (CMDK)",
			callback: () => this.openCmdkModal(),
		});

		this.addCommand({
			id: "show-or-hide-file-path",
			name: "Show/hide file path",
			callback: () => {
				this.changeFilePathVisibility();
			},
		});

		this.addCommand({
			id: "search-obsidian-globally",
			name: "Search obsidian globally",
			callback: () =>
				this.initModal(
					{ ...this.state, query: "", current: false },
					false,
					true
				),
		});

		this.addCommand({
			id: "search-obsidian-globally-state",
			name: "Search Obsidian Globally (With Last State)",
			callback: () =>
				this.initModal(
					{ ...this.state, query: this.state.query, current: false },
					true,
					false
				),
		});

		this.createCommand({
			id: "search-in-backlink",
			name: "Search in backlink Of current file",
			queryBuilder: (file?: TFile) => {
					if (!file) return "";
					const linkName = escapeRegExp(
						file.extension === "canvas" ? file.name : file.basename
					);
					return (
						" /\\[\\[" +
						linkName +
						"(\\|[^\\]]*)?\\]\\]/"
					);
				},
			global: false,
		});

		this.createCommand({
			id: "search-in-current-file",
			name: "Search in current file",
			queryBuilder: (file?: TFile) => {
				if (!file) return "";
				return " path:" + `"${file.path}"`;
			},
			global: false,
		});

		// Register search operator commands
		this.registerSearchOperatorCommands();

		for (const type of (Platform.isMobile ? ["tab"] : ["split", "tab", "window"]) as PaneType[]) {
			this.addCommand({
				id: `open-search-view-${type}`,
				name: `Open search view (${type})`,
				callback: async () => {
					const existingLeaf =
						this.app.workspace.getLeavesOfType("search");
					switch (type) {
						case "window":
							// @ts-ignore
							const isExistingWindowLeaf = existingLeaf.find(
								(leaf) =>
									leaf.parentSplit?.parent?.type === "window"
							);
							if (isExistingWindowLeaf) {
								this.app.workspace.revealLeaf(
									isExistingWindowLeaf
								);
								return;
							}
							await initSearchViewWithLeaf(this.app, type, {
								...this.state,
								triggerBySelf: true,
							});
							break;
						case "tab":
						case "split":
							// @ts-ignore
							const isExistingLeaf = existingLeaf.find(
								(leaf) => !leaf.parentSplit?.parent?.side
							);
							if (isExistingLeaf) {
								this.app.workspace.revealLeaf(isExistingLeaf);
								isExistingLeaf.setViewState({
									type: "search",
									active: true,
									state: {
										...this.state,
										triggerBySelf: true,
									} as Record<string, unknown>,
								});
								return;
							}
							await initSearchViewWithLeaf(this.app, type, {
								...this.state,
								triggerBySelf: true,
							});
							break;
					}
				},
			});
		}
	}

	registerSearchOperatorCommands() {
		const searchOperators = [
			{
				id: "search-file-operator",
				name: "Search: file: (Find text in filename)",
				query: "file:",
			},
			{
				id: "search-path-operator",
				name: "Search: path: (Find text in file path)",
				query: "path:",
			},
			{
				id: "search-content-operator",
				name: "Search: content: (Find text in file content)",
				query: "content:",
			},
			{
				id: "search-match-case-operator",
				name: "Search: match-case: (Case-sensitive match)",
				query: "match-case:",
			},
			{
				id: "search-ignore-case-operator",
				name: "Search: ignore-case: (Case-insensitive match)",
				query: "ignore-case:",
			},
			{
				id: "search-tag-operator",
				name: "Search: tag: (Find tag)",
				query: "tag:",
			},
			{
				id: "search-line-operator",
				name: "Search: line: (Find files with matching line)",
				query: "line:",
			},
			{
				id: "search-block-operator",
				name: "Search: block: (Find matches in the same block)",
				query: "block:",
			},
			{
				id: "search-section-operator",
				name: "Search: section: (Find matches in the same section)",
				query: "section:",
			},
			{
				id: "search-task-operator",
				name: "Search: task: (Find matches in a task)",
				query: "task:",
			},
			{
				id: "search-task-todo-operator",
				name: "Search: task-todo: (Find matches in uncompleted tasks)",
				query: "task-todo:",
			},
			{
				id: "search-task-done-operator",
				name: "Search: task-done: (Find matches in completed tasks)",
				query: "task-done:",
			},
			{
				id: "search-property",
				name: "Search: [property] or [property:value]",
				query: "[]",
			},
		];

		// Register all search operator commands
		searchOperators.forEach((operator) => {
			this.createCommand({
				id: operator.id,
				name: operator.name,
				queryBuilder: () => operator.query || "",
				global: true,
			});
		});
	}

	registerEditorMenuHandler() {
		this.registerEvent(
			this.app.workspace.on(
				"editor-menu",
				(menu: Menu, editor: Editor) => {
					if (!editor) {
						return;
					}
					if (editor.getSelection().length === 0) {
						return;
					}
					const selection = editor.getSelection().trim();
					let searchWord = selection;

					if (selection.length > 8) {
						searchWord =
							selection.substring(0, 3) +
							"..." +
							selection.substring(
								selection.length - 3,
								selection.length
							);
					} else {
						searchWord = selection;
					}

					menu.addItem((item) => {
						// Add sub menu
						item.setTitle(
							'Search "' + searchWord + '"' + " in Float Search"
						)
							.setIcon("search")
							.onClick(() =>
								this.initModal(
									{
										...this.state,
										query: selection,
										current: false,
									},
									true,
									false
								)
							);
					});
				}
			)
		);
	}

	registerContextMenuHandler() {
		if (Platform.isMobile) return;
		this.registerEvent(
			this.app.workspace.on(
				"file-menu",
				(
					menu: Menu,
					file: TAbstractFile,
					source: string,
					leaf?: WorkspaceLeaf
				) => {
					const popover = leaf
						? EmbeddedView.forLeaf(leaf)
						: undefined;
					if (file instanceof TFile && !popover && !leaf) {
						menu.addItem((item) => {
							item.setIcon("popup-open")
								.setTitle("Open in Float Preview")
								.onClick(async () => {
									if (this.modal) {
										await this.modal.initFileView(
											file,
											undefined
										);

										return;
									}

									this.initModal(
										{ ...this.state, current: false },
										true,
										true
									);
									setTimeout(async () => {
										await this.modal.initFileView(
											file,
											undefined
										);
									}, 20);
								})
								.setSection?.("open");
						});
					}
				}
			)
		);
	}

	registerIcons() {
		addIcon(
			"panel-left-inactive",
			`<path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:currentColor;stroke-opacity:1;stroke-miterlimit:4;" d="M 4.999687 3 L 19.000312 3 C 20.104688 3 21 3.895312 21 4.999687 L 21 19.000312 C 21 20.104688 20.104688 21 19.000312 21 L 4.999687 21 C 3.895312 21 3 20.104688 3 19.000312 L 3 4.999687 C 3 3.895312 3.895312 3 4.999687 3 Z M 4.999687 3 " transform="matrix(4.166667,0,0,4.166667,0,0)"/><path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:currentColor;stroke-opacity:1;stroke-miterlimit:4;" d="M 9 13.999688 L 9 15 " transform="matrix(4.166667,0,0,4.166667,0,0)"/><path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:currentColor;stroke-opacity:1;stroke-miterlimit:4;" d="M 9 19.000312 L 9 21 " transform="matrix(4.166667,0,0,4.166667,0,0)"/><path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:currentColor;stroke-opacity:1;stroke-miterlimit:4;" d="M 9 3 L 9 4.999687 " transform="matrix(4.166667,0,0,4.166667,0,0)"/><path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:currentColor;stroke-opacity:1;stroke-miterlimit:4;" d="M 9 9 L 9 10.000312 " transform="matrix(4.166667,0,0,4.166667,0,0)"/>`
		);
		addIcon(
			"app-window",
			`<path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:currentColor;stroke-opacity:1;stroke-miterlimit:4;" d="M 4.000312 4.000312 L 19.999688 4.000312 C 21.105 4.000312 22.000312 4.895625 22.000312 6 L 22.000312 18 C 22.000312 19.104375 21.105 19.999688 19.999688 19.999688 L 4.000312 19.999688 C 2.895 19.999688 1.999687 19.104375 1.999687 18 L 1.999687 6 C 1.999687 4.895625 2.895 4.000312 4.000312 4.000312 Z M 4.000312 4.000312 " transform="matrix(4.166667,0,0,4.166667,0,0)"/><path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:currentColor;stroke-opacity:1;stroke-miterlimit:4;" d="M 10.000312 4.000312 L 10.000312 7.999687 " transform="matrix(4.166667,0,0,4.166667,0,0)"/><path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:currentColor;stroke-opacity:1;stroke-miterlimit:4;" d="M 1.999687 7.999687 L 22.000312 7.999687 " transform="matrix(4.166667,0,0,4.166667,0,0)"/><path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:currentColor;stroke-opacity:1;stroke-miterlimit:4;" d="M 6 4.000312 L 6 7.999687 " transform="matrix(4.166667,0,0,4.166667,0,0)"/>`
		);
		addIcon(
			"panel-top",
			`<path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:currentColor;stroke-opacity:1;stroke-miterlimit:4;" d="M 4.999687 3 L 19.000312 3 C 20.104688 3 21 3.895312 21 4.999687 L 21 19.000312 C 21 20.104688 20.104688 21 19.000312 21 L 4.999687 21 C 3.895312 21 3 20.104688 3 19.000312 L 3 4.999687 C 3 3.895312 3.895312 3 4.999687 3 Z M 4.999687 3 " transform="matrix(4.166667,0,0,4.166667,0,0)"/><path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:currentColor;stroke-opacity:1;stroke-miterlimit:4;" d="M 3 9 L 21 9 " transform="matrix(4.166667,0,0,4.166667,0,0)"/>`
		);
		addIcon(
			"square-equal",
			`<path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:currentColor;stroke-opacity:1;stroke-miterlimit:4;" d="M 4.999687 3 L 19.000312 3 C 20.104688 3 21 3.895312 21 4.999687 L 21 19.000312 C 21 20.104688 20.104688 21 19.000312 21 L 4.999687 21 C 3.895312 21 3 20.104688 3 19.000312 L 3 4.999687 C 3 3.895312 3.895312 3 4.999687 3 Z M 4.999687 3 " transform="matrix(4.166667,0,0,4.166667,0,0)"/><path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:currentColor;stroke-opacity:1;stroke-miterlimit:4;" d="M 7.000312 10.000312 L 16.999688 10.000312 " transform="matrix(4.166667,0,0,4.166667,0,0)"/><path style="fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke:currentColor;stroke-opacity:1;stroke-miterlimit:4;" d="M 7.000312 13.999688 L 16.999688 13.999688 " transform="matrix(4.166667,0,0,4.166667,0,0)"/>`
		);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		this.settings.cmdkSortOrder = normalizeCmdkSortOrder(
			this.settings.cmdkSortOrder,
			DEFAULT_SETTINGS.cmdkSortOrder
		);
		this.settings.cmdkPreviewSplitRatio =
			typeof this.settings.cmdkPreviewSplitRatio === "number" &&
			Number.isFinite(this.settings.cmdkPreviewSplitRatio)
				? Math.min(
						MAX_CMDK_PREVIEW_SPLIT_RATIO,
						Math.max(
							MIN_CMDK_PREVIEW_SPLIT_RATIO,
							this.settings.cmdkPreviewSplitRatio
						)
					)
				: DEFAULT_SETTINGS.cmdkPreviewSplitRatio;
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

const TRIGGER_KEY_OPTIONS: Record<CmdkTriggerKey, string> = {
	Shift: "Double Shift",
	Control: "Double Ctrl",
	Alt: "Double Alt",
	Meta: "Double Meta (Cmd/Win)",
	none: "Disabled",
};

const CMDK_SORT_ORDER_OPTIONS: Record<CmdkSortOrder, string> = {
	relevance: "Relevance",
	"name-asc": "File name (A to Z)",
	"name-desc": "File name (Z to A)",
	"modified-desc": "Modified time (newest first)",
	"modified-asc": "Modified time (oldest first)",
	"created-desc": "Created time (newest first)",
	"created-asc": "Created time (oldest first)",
};

const CMDK_PANEL_SORT_ORDER_OPTIONS: Record<CmdkSortOrder, string> = {
	relevance: "相关度",
	"name-asc": "名称 A→Z",
	"name-desc": "名称 Z→A",
	"modified-desc": "修改 新→旧",
	"modified-asc": "修改 旧→新",
	"created-desc": "创建 新→旧",
	"created-asc": "创建 旧→新",
};

const CMDK_MOBILE_SORT_ORDER_OPTIONS: Record<CmdkSortOrder, string> = {
	relevance: "相关度", "name-asc": "名称升序", "name-desc": "名称降序",
	"modified-desc": "最近修改", "modified-asc": "最早修改",
	"created-desc": "最近创建", "created-asc": "最早创建",
};

const CMDK_FILTER_DESCRIPTIONS: Record<string, string> = {
	content: "匹配正文内容",
	ext: "匹配文件扩展名",
	file: "匹配文件名",
	head: "匹配标题与别名",
	heading: "匹配标题与别名",
	in: "限定匹配位置",
	path: "匹配文件路径",
	tag: "搜索标签",
	type: "限定结果类型",
};

const CMDK_FILTER_VALUE_DESCRIPTIONS: Record<string, string> = {
	content: "正文",
	file: "文件",
	heading: "标题",
	name: "文件名",
	path: "路径",
};

let cmdkFilterCompletionInstanceId = 0;

class FloatSearchSettingTab extends PluginSettingTab {
	plugin: FloatSearchPlugin;

	constructor(app: App, plugin: FloatSearchPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Float Search Settings" });
		if (Platform.isMobile) new Setting(containerEl).setName("快速搜索")
			.setDesc("也可从笔记标题栏的搜索图标或右上角更多菜单进入。")
			.addButton(button => button.setButtonText("打开快速搜索").onClick(() => this.plugin.openCmdkModal()));
		if (Platform.isMobile) {
			new Setting(containerEl)
				.setName("快速搜索")
				.setDesc("打开文件、标题与正文检索窗口。")
				.addButton(button => button.setButtonText("打开快速搜索").onClick(() => this.plugin.openCmdkModal()));
		}

		new Setting(containerEl)
			.setName("Quick search trigger")
			.setDesc(
				"Double-tap this key to open the quick search modal (CMDK)."
			)
			.addDropdown((dropdown) => {
				for (const [value, label] of Object.entries(
					TRIGGER_KEY_OPTIONS
				)) {
					dropdown.addOption(value, label);
				}
				dropdown.setValue(this.plugin.settings.cmdkTriggerKey);
				dropdown.onChange(async (value) => {
					this.plugin.settings.cmdkTriggerKey =
						value as CmdkTriggerKey;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Double-tap interval (ms)")
			.setDesc(
				"Maximum time between two key presses to trigger quick search. Default: 300ms."
			)
			.addSlider((slider) => {
				slider
					.setLimits(150, 600, 50)
					.setValue(this.plugin.settings.cmdkDoubleTapInterval)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.cmdkDoubleTapInterval =
							value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Quick search sort order")
			.setDesc(
				"Controls the file-group order in quick search. Matches inside each file remain ordered by relevance and line number."
			)
			.addDropdown((dropdown) => {
				for (const [value, label] of Object.entries(
					CMDK_SORT_ORDER_OPTIONS
				)) {
					dropdown.addOption(value, label);
				}
				dropdown.setValue(this.plugin.settings.cmdkSortOrder);
				dropdown.onChange(async (value) => {
					this.plugin.settings.cmdkSortOrder =
						normalizeCmdkSortOrder(value);
					await this.plugin.saveSettings();
				});
			});

		if (!Platform.isMobile) {
			new Setting(containerEl)
				.setName("Enable RAG enhanced search")
				.setDesc(
					"Show wiki-note RAG results in the quick search modal when the RAG toggle is active."
				)
				.addToggle((toggle) => {
					toggle
						.setValue(this.plugin.settings.cmdkRagEnabled)
						.onChange(async (value) => {
							this.plugin.settings.cmdkRagEnabled = value;
							await this.plugin.saveSettings();
						});
				});

			new Setting(containerEl)
				.setName("RAG results per vault")
				.setDesc(
					"Number of wiki-note RAG hits requested from each discovered vault. Higher values improve recall but can increase latency."
				)
				.addSlider((slider) => {
					slider
						.setLimits(
							MIN_CMDK_RAG_RESULTS_PER_VAULT,
							MAX_CMDK_RAG_RESULTS_PER_VAULT,
							1
						)
						.setValue(
							clampNumber(
								this.plugin.settings.cmdkRagResultsPerVault,
								MIN_CMDK_RAG_RESULTS_PER_VAULT,
								MAX_CMDK_RAG_RESULTS_PER_VAULT,
								DEFAULT_SETTINGS.cmdkRagResultsPerVault
							)
						)
						.setDynamicTooltip()
						.onChange(async (value) => {
							this.plugin.settings.cmdkRagResultsPerVault =
								clampNumber(
									value,
									MIN_CMDK_RAG_RESULTS_PER_VAULT,
									MAX_CMDK_RAG_RESULTS_PER_VAULT
								);
							await this.plugin.saveSettings();
						});
				});

		}
		containerEl.createEl("h3", { text: "Quick Create" });

		new Setting(containerEl)
			.setName("Enable quick create")
			.setDesc(
				"When no exact match is found in quick search, show an option to create a new note with the search text as content."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.cmdkQuickCreate)
					.onChange(async (value) => {
						this.plugin.settings.cmdkQuickCreate = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Quick create folder")
			.setDesc(
				"Folder to create new notes in. Leave empty for vault root."
			)
			.addText((text) => {
				text.setPlaceholder("e.g. Inbox")
					.setValue(this.plugin.settings.cmdkQuickCreateFolder)
					.onChange(async (value) => {
						this.plugin.settings.cmdkQuickCreateFolder =
							value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Title format")
			.setDesc(
				"Timestamp format for the note title. Tokens: YYYY, MM, DD, HH, mm, ss."
			)
			.addText((text) => {
				text.setPlaceholder("YYYYMMDDHHmmss")
					.setValue(
						this.plugin.settings.cmdkQuickCreateTitleFormat
					)
					.onChange(async (value) => {
						this.plugin.settings.cmdkQuickCreateTitleFormat =
							value;
						await this.plugin.saveSettings();
					});
			});
	}
}

function createInstructionElement(
	parentEl: HTMLElement,
	divCls: string,
	keyText: string,
	text: string
) {
	const divEl = parentEl.createDiv({ cls: divCls });
	const iconEl = divEl.createSpan({
		cls: "float-search-modal-instructions-key",
	});
	const textEl = divEl.createSpan({
		cls: "float-search-modal-instructions-text",
	});

	iconEl.setText(keyText);
	textEl.setText(text);

	return { divEl, iconEl, textEl };
}

class FloatSearchModal extends Modal {
	private readonly plugin: FloatSearchPlugin;
	private searchEmbeddedView: EmbeddedView;
	private fileEmbeddedView: EmbeddedView;

	searchLeaf: WorkspaceLeaf;
	fileLeaf: WorkspaceLeaf | undefined;

	private cb: (state: any) => void;
	private state: any;

	private fileState: any;

	private searchCtnEl: HTMLElement;
	private instructionsEl: HTMLElement;
	private fileEl: HTMLElement;
	private viewType: string;

	private focusdItem: any;
	private closed = false;
	private initSearchStateTimer: number | undefined;
	private initInputRetryTimer: number | undefined;

	private debouncedAutoPreview = debounce(() => {
		this.autoPreviewFocusedItem();
	}, 150);

	constructor(
		cb: (state: any) => void,
		plugin: FloatSearchPlugin,
		state: any,
		viewType: string = "search"
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.cb = cb;
		this.state = state;
		this.viewType = viewType;
	}

	async onOpen() {
		this.closed = false;
		const { contentEl, containerEl, modalEl } = this;

		this.searchCtnEl = contentEl.createDiv({
			cls: "float-search-modal-search-ctn",
		});
		this.instructionsEl = modalEl.createDiv({
			cls: "float-search-modal-instructions",
		});

		this.initInstructions(this.instructionsEl);
		this.initCss(contentEl, modalEl, containerEl);
		await this.initSearchView(this.searchCtnEl);
		if (this.closed) return;
		this.initInput();
		this.initContent();
	}

	onClose() {
		this.closed = true;
		if (this.initSearchStateTimer) {
			window.clearTimeout(this.initSearchStateTimer);
			this.initSearchStateTimer = undefined;
		}
		if (this.initInputRetryTimer) {
			window.clearTimeout(this.initInputRetryTimer);
			this.initInputRetryTimer = undefined;
		}

		if (this.searchLeaf?.view) {
			this.cb(this.searchLeaf.view.getState());
		}

		this.searchEmbeddedView?.hide();
		this.fileEmbeddedView?.hide();
	}

	initInstructions(instructionsEl: HTMLElement) {
		if (!this.plugin.settings.showInstructions) {
			return;
		}
		const navigate = createInstructionElement(
			instructionsEl,
			"float-search-modal-instructions-navigate",
			"↑↓",
			"Navigate"
		);
		const collapse = createInstructionElement(
			instructionsEl,
			"float-search-modal-instructions-collapse",
			"Shift+↑↓",
			"Collapse/Expand"
		);
		const enter = createInstructionElement(
			instructionsEl,
			"float-search-modal-instructions-enter",
			"↵",
			"Open in background"
		);
		const altEnter = createInstructionElement(
			instructionsEl,
			"float-search-modal-instructions-alt-enter",
			"Alt+↵",
			"Open File and Close"
		);
		const ctrlEnter = createInstructionElement(
			instructionsEl,
			"float-search-modal-instructions-ctrl-enter",
			"Ctrl+↵",
			"Create File When Not Exist"
		);
		const tab = createInstructionElement(
			instructionsEl,
			"float-search-modal-instructions-tab",
			"Tab/Shift+Tab",
			"Preview/Close Preview"
		);
		const switchView = createInstructionElement(
			instructionsEl,
			"float-search-modal-instructions-switch",
			"Ctrl+G",
			"Switch Between Search and File View"
		);
		const click = createInstructionElement(
			instructionsEl,
			"float-search-modal-instructions-click",
			"Alt+Click",
			"Close Modal While In File View"
		);
	}

	initCss(
		contentEl: HTMLElement,
		modalEl: HTMLElement,
		containerEl: HTMLElement
	) {
		contentEl.classList.add("float-search-modal-content");
		modalEl.classList.add("float-search-modal");
		containerEl.classList.add("float-search-modal-container");
	}

	async initSearchView(contentEl: HTMLElement) {
		const [createdLeaf, embeddedView] = spawnLeafView(
			this.plugin,
			contentEl
		);
		this.searchLeaf = createdLeaf;
		this.searchEmbeddedView = embeddedView;

		this.searchLeaf.setPinned(true);
		await embeddedView.runWhileOpen(() => this.searchLeaf.setViewState({
			type: "search",
			state: { ...this.state, triggerBySelf: true },
		}));
		if (this.closed) return;

			this.initSearchStateTimer = window.setTimeout(async () => {
				if (this.closed || !this.searchLeaf?.view) return;
				await this.searchEmbeddedView.runWhileOpen(() => this.searchLeaf.view.setState(
					{ ...this.state, triggerBySelf: true },
					{ history: false }
				));
				if (this.closed || !this.searchLeaf?.view) return;
				const searchComponent = (this.searchLeaf.view as SearchView)
					.searchComponent;
			if (searchComponent?.inputEl) {
				this.state?.current
					? searchComponent.inputEl.setSelectionRange(0, 0)
					: searchComponent.inputEl.setSelectionRange(
							0,
							this.state?.query?.length
					  );
			}
			}, 0);

		return;
	}

	initInput(retries = 10) {
		const inputEl = this.contentEl.getElementsByTagName("input")[0];
			if (!inputEl) {
				if (retries > 0) {
					this.initInputRetryTimer = window.setTimeout(
						() => this.initInput(retries - 1),
						50
					);
				}
				return;
			}
			if (this.closed) return;
		inputEl.focus();
		inputEl.onkeydown = (e) => {
			if (e.isComposing || e.key === "Process" || e.keyCode === 229) {
				return;
			}
			const currentView = this.searchLeaf.view as SearchView;
			switch (e.key) {
				case "ArrowDown":
				case "n":
					if (e.key === "n" && !e.ctrlKey) break;
					if (e.key === "n") e.preventDefault();

					if (e.shiftKey) {
						currentView.onKeyShowMoreAfter(e);
						if (currentView.dom.focusedItem) {
							if (currentView.dom.focusedItem.collapsible) {
								currentView.dom.focusedItem.setCollapse(false);
							}
							this.focusdItem = currentView.dom.focusedItem;
						}
					} else {
						currentView.onKeyArrowDownInFocus(e);
						this.focusdItem = currentView.dom.focusedItem;
						this.debouncedAutoPreview();
					}
					break;
				case "ArrowUp":
				case "p":
					if (e.key === "p" && !e.ctrlKey) break;
					if (e.key === "p") e.preventDefault();

					if (e.shiftKey) {
						currentView.onKeyShowMoreBefore(e);
						if (currentView.dom.focusedItem) {
							if (currentView.dom.focusedItem.collapseEl) {
								currentView.dom.focusedItem.setCollapse(true);
							}
							this.focusdItem = currentView.dom.focusedItem;
						}
					} else {
						currentView.onKeyArrowUpInFocus(e);
						this.focusdItem = currentView.dom.focusedItem;
						if (!currentView.dom.focusedItem.content) {
							this.focusdItem = undefined;
						}
						this.debouncedAutoPreview();
					}
					break;
				case "ArrowLeft":
					currentView.onKeyArrowLeftInFocus(e);
					break;
				case "ArrowRight":
					currentView.onKeyArrowRightInFocus(e);
					break;
				case "Enter":
					if (
						Keymap.isModifier(e, "Mod") &&
						Keymap.isModifier(e, "Shift") &&
						!this.focusdItem
					) {
						e.preventDefault();
						const fileName = inputEl.value.trim();
						const real = fileName.replace(/[/\\?%*:|"<>]/g, "-");
						this.plugin.app.workspace.openLinkText(real, "", true);
						this.close();
						break;
					}
					currentView.onKeyEnterInFocus(e);
					if (e.altKey && currentView.dom.focusedItem) {
						this.close();
					}
					break;
				case "Tab":
					e.preventDefault();
					if (e.shiftKey) {
						if (this.fileLeaf) {
							this.fileEmbeddedView?.hide();
							this.fileLeaf = undefined;
							this.modalEl.toggleClass(
								"float-search-width",
								false
							);
							this.fileEl.detach();

							break;
						}
					}

					if (currentView.dom.focusedItem) {
						const item = currentView.dom.focusedItem;
						const file =
							item.parent.file instanceof TFile
								? item.parent.file
								: item.file;

						item.parent.file instanceof TFile
							? this.initFileView(file, {
									match: {
										content: item.content,
										matches: item.matches,
									},
							  })
							: this.initFileView(file, undefined);
					}
					break;
				case "e":
					if (e.ctrlKey) {
						e.preventDefault();
						if (this.fileLeaf) {
							const estate = this.fileLeaf.getViewState();
							estate.state = {
								...estate.state,
								mode:
									"preview" === estate.state?.mode
										? "source"
										: "preview",
							};
							this.fileLeaf.setViewState(estate, {
								focus: true,
							});
							setTimeout(() => {
								(
									this.searchLeaf.view as SearchView
								).searchComponent?.inputEl?.focus();
							}, 0);
						}
					}
					break;
				case "g":
					if (this.fileLeaf && e.ctrlKey) {
						e.preventDefault();
						this.plugin.app.workspace.setActiveLeaf(this.fileLeaf, {
							focus: true,
						});
					}
					break;
				case "C":
					if (e.ctrlKey && e.shiftKey) {
						e.preventDefault();
						const text = currentView.dom.focusedItem.el.innerText;
						navigator.clipboard.writeText(text);
					}
					break;
			}
		};
	}

		private autoPreviewFocusedItem() {
			if (this.closed) return;
			const currentView = this.searchLeaf.view as SearchView;
		const item = currentView.dom?.focusedItem;
		if (!item) return;

		const file =
			item.parent?.file instanceof TFile
				? item.parent.file
				: item.file;
		if (!(file instanceof TFile)) return;

		const state =
			item.parent?.file instanceof TFile
				? {
						match: {
							content: item.content,
							matches: item.matches,
						},
				  }
				: undefined;

		this.initFileView(file, state);
	}

	initContent() {
		const { contentEl } = this;
			contentEl.onclick = (e) => {
				const resultElement = contentEl.getElementsByClassName(
					"search-results-children"
				)[0];
				if (!resultElement || resultElement.children.length < 2) {
					return;
				}

			let targetElement = e.target as HTMLElement | null;

			if (e.altKey || !this.fileLeaf) {
				while (targetElement) {
					if (targetElement.classList.contains("tree-item-icon")) {
						break;
					}
					if (
						targetElement.classList.contains(
							"search-result-hover-button"
						)
					) {
						break;
					}
					if (targetElement.classList.contains("tree-item")) {
						this.close();
						break;
					}
					targetElement = targetElement.parentElement;
				}
				return;
			}

			if (this.fileLeaf) {
				const currentView = this.searchLeaf.view as SearchView;

				if (
					(this.searchCtnEl as Node).contains(targetElement as Node)
				) {
					while (targetElement) {
						if (targetElement.classList.contains("tree-item")) {
							break;
						}
						targetElement = targetElement.parentElement;
					}
					if (!targetElement) return;

						const fileInnerEl = targetElement?.getElementsByClassName(
							"tree-item-inner"
						)[0] as HTMLElement;
						if (!fileInnerEl) return;
						const innerText = fileInnerEl.innerText;
					const file =
						this.plugin.app.metadataCache.getFirstLinkpathDest(
							innerText,
							""
						);

					if (file) {
						const item = currentView.dom.resultDomLookup.get(file);
						currentView.dom.setFocusedItem(item);
						this.initFileView(file, undefined);
						(
							this.searchLeaf.view as SearchView
						).searchComponent?.inputEl?.focus();
					}
				}

				return;
			}
		};
	}

	async initFileView(file: TFile, state: any) {
		if (this.closed) return;
		if (this.fileLeaf) {
			await this.fileEmbeddedView.openFile(file, {
				active: false,
				eState: state,
			}, this.fileLeaf);
			if (this.closed) return;

			if (
				this.fileState?.match?.matches[0] ===
					state?.match?.matches[0] &&
				state &&
				this.fileState
			) {
				setTimeout(() => {
					if (this.closed) return;
					(
						this.searchLeaf.view as SearchView
					).searchComponent?.inputEl?.focus();
				}, 0);
			} else {
				this.fileState = state;
				setTimeout(() => {
					if (this.closed) return;
					(
						this.searchLeaf.view as SearchView
					).searchComponent?.inputEl?.focus();
				}, 0);
			}

			return;
		}

		const { contentEl } = this;
		this.fileEl = contentEl.createDiv({
			cls: "float-search-modal-file-ctn",
		});
		this.modalEl.toggleClass("float-search-width", true);
		this.fileEl.onkeydown = (e) => {
			if (e.ctrlKey && e.key === "g") {
				e.preventDefault();
				e.stopPropagation();

				(
					this.searchLeaf.view as SearchView
				).searchComponent?.inputEl?.focus();
			}

			if (e.key === "Tab" && e.ctrlKey) {
				e.preventDefault();
				e.stopPropagation();

				(
					this.searchLeaf.view as SearchView
				).searchComponent?.inputEl?.focus();
			}
		};

		if (!this.fileEl) return;

		const [createdLeaf, embeddedView] = spawnLeafView(
			this.plugin,
			this.fileEl
		);
		this.fileLeaf = createdLeaf;
		this.fileEmbeddedView = embeddedView;

		this.fileLeaf.setPinned(true);
		await embeddedView.openFile(file, {
			active: false,
			eState: state,
		}, createdLeaf);
		if (this.closed) return;
		this.fileState = state;

		(this.searchLeaf.view as SearchView).searchComponent?.inputEl?.focus();
	}
}

const CmdkModalBase: typeof SuggestModal = Platform.isMobile
	? MobileSearchModal as unknown as typeof SuggestModal
	: SuggestModal;

class FloatSearchCmdkModal extends CmdkModalBase<CmdkResult> {
	private mobilePreview: MobileSearchPreview | undefined;
	private mobilePreviewResult: SearchableCmdkResult | null = null;
	private disposeMobileViewport: (() => void) | undefined;
	plugin: FloatSearchPlugin;
	private bodyEl: HTMLElement;
	private filtersEl: HTMLElement;
	private resultSummaryEl: HTMLElement | undefined;
	private ragToggleEl: HTMLButtonElement | undefined;
	private sortSelectEl: HTMLSelectElement | undefined;
	private typoToggleEl: HTMLButtonElement | undefined;
	private previewResizeHandleEl: HTMLElement | undefined;
	private previewResizeObserver: ResizeObserver | undefined;
	private previewSplitRatio = DEFAULT_SETTINGS.cmdkPreviewSplitRatio;
	private activePreviewResizePointerId: number | null = null;
	private previewResizeChanged = false;
	private previewEl: HTMLElement | undefined;
	private desktopPreview: DesktopSearchPreview | undefined;
	private desktopNativeHost: HTMLElement | undefined;
	private readonly nativePreviewQueue = new LatestPreviewQueue<WorkspaceLeaf | undefined>();
	private nativePreviewVersion = "";
	private desktopPreviewRequest: {key: string; requestId: number; promise: Promise<void>} | undefined;
	private cancelPreviewPaint: (() => void) | undefined;
	private previewInteractionGeneration = 0;
	private fileLeaf: WorkspaceLeaf | undefined;
	private fileEmbeddedView: EmbeddedView | undefined;
	private searchAbort: AbortController | null = null;
	private previewRequestId = 0;
	private historyPreviewLookupId = 0;
	private ragRequestId = 0;
	private ragSearchTimer: number | null = null;
	private stagedSearchTimer: number | null = null;
	private typoSearchTimer: number | null = null;
	private scrollLoadRaf: number | null = null;
	private searchGeneration = 0;
	private hasCommittedActiveSearch = false;
	private activeSearchSession: CmdkActiveSearchSession | null = null;
	private resultStore: SearchResultStore<CmdkResult>;
	private commitScheduler: TrailingCommitScheduler;
	private readonly resultWindow = new ResultWindow(undefined, {collapsedChildLimit: Platform.isMobile ? 0 : COLLAPSED_CHILD_LIMIT});
	private cmdkResults: CmdkResult[] = [];
	private cmdkSourceResults: CmdkResult[] = [];
	private activeFilterTokens: CmdkActiveFilterToken[] = [];
	private filterCompletionItems: CmdkFilterCompletionItem[] = [];
	private filterCompletionSelectedIndex = 0;
	private nextFilterTokenId = 1;
	private suppressFilterAutocomplete = false;
	private queryTokensEl: HTMLElement | undefined;
	private filterCompletionsEl: HTMLElement | undefined;
	private filterLiveRegionEl: HTMLElement | undefined;
	private readonly filterCompletionListId =
		`float-search-filter-completions-${++cmdkFilterCompletionInstanceId}`;
	private filters: CmdkSearchFilters = {
		file: true,
		heading: true,
		content: true,
	};
	private closed = false;
	private isComposing = false;
	private isSortSelectActive = false;
	private readonly onCompositionStart = () => {
		this.isComposing = true;
		this.closeFilterCompletions();
		this.hidePreview();
	};
	private readonly onCompositionEnd = () => {
		this.isComposing = false;
		this.suppressFilterAutocomplete = false;
		this.renderFilterCompletions();
		this.updateSuggestions();
	};
	private readonly onFilterInput = () => {
		if (this.isComposing) return;
		this.suppressFilterAutocomplete = false;
		this.filterCompletionSelectedIndex = 0;
		this.renderFilterCompletions();
	};
	private readonly onFilterFocus = () => {
		if (Platform.isMobile) {this.mobilePreview?.hide(); this.modalEl.removeClass("is-mobile-reading");}
		if (this.inputEl.value) this.renderFilterCompletions();
	};
	private readonly onFilterKeyDown = (evt: KeyboardEvent) => {
		if (
			this.isComposing ||
			evt.isComposing ||
			evt.keyCode === 229
		) {
			if (
				["Enter", "Tab", "Escape", "ArrowUp", "ArrowDown"].includes(
					evt.key
				)
			) {
				evt.stopImmediatePropagation();
			}
			return;
		}

		if (
			evt.key === "Backspace" &&
			this.inputEl.value.length === 0 &&
			this.inputEl.selectionStart === 0 &&
			this.inputEl.selectionEnd === 0 &&
			this.activeFilterTokens.length > 0
		) {
			evt.preventDefault();
			evt.stopImmediatePropagation();
			this.restoreLastFilterTokenForEditing();
			return;
		}

		if (!this.isFilterCompletionOpen()) return;
		if (evt.key === "ArrowDown" || evt.key === "ArrowUp") {
			evt.preventDefault();
			evt.stopImmediatePropagation();
			this.moveFilterCompletionSelection(
				evt.key === "ArrowDown" ? 1 : -1
			);
			return;
		}
		if (evt.key === "Escape") {
			evt.preventDefault();
			evt.stopImmediatePropagation();
			this.suppressFilterAutocomplete = true;
			this.closeFilterCompletions();
			return;
		}
		if (
			(evt.key !== "Tab" && evt.key !== "Enter") ||
			evt.shiftKey ||
			evt.metaKey ||
			evt.ctrlKey ||
			evt.altKey
		) {
			return;
		}

		const item =
			this.filterCompletionItems[this.filterCompletionSelectedIndex];
		if (!item || item.disabled) return;
		evt.preventDefault();
		evt.stopImmediatePropagation();
		this.acceptFilterCompletion(item, evt.key);
	};
	private readonly onResultScroll = () => {
		if (!isResultMotionActive(this.getCmdkResultContainer())) this.scheduleResultWindowLoad();
	};
	private readonly onPreviewMouseDown = (evt: MouseEvent) => {
		this.previewInteractionGeneration++;
		evt.stopPropagation();
	};
	private readonly onPreviewResizePointerDown = (evt: PointerEvent) => {
		if (
			this.activePreviewResizePointerId != null ||
			evt.button !== 0 ||
			!this.bodyEl.classList.contains("has-preview") ||
			window.matchMedia("(max-width: 720px)").matches
		) {
			return;
		}

		evt.preventDefault();
		evt.stopPropagation();
		this.previewInteractionGeneration++;
		this.activePreviewResizePointerId = evt.pointerId;
		this.previewResizeChanged = false;
		this.modalEl.addClass("is-resizing-preview");
		this.previewResizeHandleEl?.focus({ preventScroll: true });
		this.previewResizeHandleEl?.setPointerCapture(evt.pointerId);
	};
	private readonly onPreviewResizePointerMove = (evt: PointerEvent) => {
		if (evt.pointerId !== this.activePreviewResizePointerId) return;
		evt.preventDefault();
		evt.stopPropagation();

		if (window.matchMedia("(max-width: 720px)").matches) {
			this.finishPreviewResize(evt.pointerId, true);
			return;
		}

		const bodyRect = this.bodyEl.getBoundingClientRect();
		const bodyWidth = this.bodyEl.clientWidth;
		if (bodyWidth <= 0) return;
		const handleOffset =
			(this.previewResizeHandleEl?.offsetWidth ?? 0) / 2;
		const nextRatio =
			(evt.clientX -
				bodyRect.left -
				this.bodyEl.clientLeft -
				handleOffset) /
			bodyWidth;
		const previousRatio = this.previewSplitRatio;
		this.applyPreviewSplitRatio(nextRatio);
		if (Math.abs(previousRatio - this.previewSplitRatio) > 0.0001) {
			this.previewResizeChanged = true;
		}
	};
	private readonly onPreviewResizePointerEnd = (evt: PointerEvent) => {
		if (evt.pointerId !== this.activePreviewResizePointerId) return;
		evt.preventDefault();
		evt.stopPropagation();
		this.finishPreviewResize(evt.pointerId, true);
	};
	private readonly onPreviewResizeLostPointerCapture = (
		evt: PointerEvent
	) => {
		if (evt.pointerId !== this.activePreviewResizePointerId) return;
		this.finishPreviewResize(evt.pointerId, true);
	};
	private readonly onPreviewResizeKeyDown = (evt: KeyboardEvent) => {
		if (window.matchMedia("(max-width: 720px)").matches) return;
		const bounds = this.getPreviewSplitBounds();
		let nextRatio: number | null = null;
		switch (evt.key) {
			case "ArrowLeft":
				nextRatio =
					this.previewSplitRatio - (evt.shiftKey ? 0.05 : 0.02);
				break;
			case "ArrowRight":
				nextRatio =
					this.previewSplitRatio + (evt.shiftKey ? 0.05 : 0.02);
				break;
			case "Home":
				nextRatio = bounds.min;
				break;
			case "End":
				nextRatio = bounds.max;
				break;
			default:
				return;
		}

		evt.preventDefault();
		evt.stopPropagation();
		this.previewInteractionGeneration++;
		const previousRatio = this.previewSplitRatio;
		this.applyPreviewSplitRatio(nextRatio);
		if (Math.abs(previousRatio - this.previewSplitRatio) > 0.0001) {
			this.persistPreviewSplitRatio();
		}
	};

	private getPreviewSplitBounds() {
		const bodyWidth = this.bodyEl?.clientWidth ?? 0;
		if (bodyWidth <= 0) {
			return {
				min: MIN_CMDK_PREVIEW_SPLIT_RATIO,
				max: MAX_CMDK_PREVIEW_SPLIT_RATIO,
			};
		}

		const handleWidth = this.previewResizeHandleEl?.offsetWidth ?? 0;
		const min = Math.max(
			MIN_CMDK_PREVIEW_SPLIT_RATIO,
			MIN_CMDK_RESULTS_WIDTH / bodyWidth
		);
		const max = Math.min(
			MAX_CMDK_PREVIEW_SPLIT_RATIO,
			(bodyWidth - handleWidth - MIN_CMDK_PREVIEW_WIDTH) / bodyWidth
		);
		if (min <= max) return { min, max };

		const availableWidth = Math.max(bodyWidth - handleWidth, 0);
		const minimumWidth =
			MIN_CMDK_RESULTS_WIDTH + MIN_CMDK_PREVIEW_WIDTH;
		const fallback =
			bodyWidth > 0 && minimumWidth > 0
				? (availableWidth * MIN_CMDK_RESULTS_WIDTH) /
					minimumWidth /
					bodyWidth
				: DEFAULT_SETTINGS.cmdkPreviewSplitRatio;
		const clampedFallback = Math.min(
			MAX_CMDK_PREVIEW_SPLIT_RATIO,
			Math.max(MIN_CMDK_PREVIEW_SPLIT_RATIO, fallback)
		);
		return { min: clampedFallback, max: clampedFallback };
	}

	private applyPreviewSplitRatio(ratio: number) {
		const bounds = this.getPreviewSplitBounds();
		this.previewSplitRatio = Math.min(
			bounds.max,
			Math.max(bounds.min, ratio)
		);
		this.bodyEl.style.setProperty(
			"--float-search-cmdk-results-width",
			`${this.previewSplitRatio * 100}%`
		);
		this.previewResizeHandleEl?.setAttribute(
			"aria-valuemin",
			String(Math.round(bounds.min * 100))
		);
		this.previewResizeHandleEl?.setAttribute(
			"aria-valuemax",
			String(Math.round(bounds.max * 100))
		);
		this.previewResizeHandleEl?.setAttribute(
			"aria-valuenow",
			String(Math.round(this.previewSplitRatio * 100))
		);
		this.previewResizeHandleEl?.setAttribute(
			"aria-valuetext",
			`搜索结果区域 ${Math.round(this.previewSplitRatio * 100)}%`
		);
	}

	private persistPreviewSplitRatio() {
		const ratio = Math.round(this.previewSplitRatio * 10000) / 10000;
		this.previewSplitRatio = ratio;
		this.plugin.settings.cmdkPreviewSplitRatio = ratio;
		void this.plugin.saveSettings();
	}

	private finishPreviewResize(pointerId: number, persist: boolean) {
		if (pointerId !== this.activePreviewResizePointerId) return;
		const handleEl = this.previewResizeHandleEl;
		const changed = this.previewResizeChanged;
		this.activePreviewResizePointerId = null;
		this.previewResizeChanged = false;
		this.modalEl.removeClass("is-resizing-preview");
		if (handleEl?.hasPointerCapture(pointerId)) {
			handleEl.releasePointerCapture(pointerId);
		}
		if (persist && changed) {
			this.persistPreviewSplitRatio();
		}
	}

	private removePreviewResizeListeners() {
		const handleEl = this.previewResizeHandleEl;
		if (!handleEl) return;
		handleEl.removeEventListener(
			"pointerdown",
			this.onPreviewResizePointerDown
		);
		handleEl.removeEventListener(
			"pointermove",
			this.onPreviewResizePointerMove
		);
		handleEl.removeEventListener(
			"pointerup",
			this.onPreviewResizePointerEnd
		);
		handleEl.removeEventListener(
			"pointercancel",
			this.onPreviewResizePointerEnd
		);
		handleEl.removeEventListener(
			"lostpointercapture",
			this.onPreviewResizeLostPointerCapture
		);
		handleEl.removeEventListener(
			"keydown",
			this.onPreviewResizeKeyDown
		);
	}

	private getCmdkChooser() {
		return (this as unknown as { chooser: CmdkChooser }).chooser;
	}

	private getCmdkResultContainer() {
		return (this as unknown as { resultContainerEl: HTMLElement })
			.resultContainerEl;
	}

	private getRawQuery() {
		return [
			...this.activeFilterTokens.map(
				({ token }) => token.serialized
			),
			this.inputEl.value.trim(),
		]
			.filter(Boolean)
			.join(" ");
	}

	private setRawQuery(rawQuery: string) {
		const extracted = extractActivatedFilterTokens(rawQuery);
		this.activeFilterTokens = extracted.tokens.map((token) => ({
			id: this.nextFilterTokenId++,
			token,
		}));
		this.inputEl.value = extracted.input;
		this.suppressFilterAutocomplete = true;
		this.renderActiveFilterTokens();
		this.closeFilterCompletions();
	}

	private announceFilterState(message: string) {
		this.filterLiveRegionEl?.setText(message);
	}

	private renderActiveFilterTokens() {
		if (!this.queryTokensEl) return;
		this.queryTokensEl.empty();
		for (const activeToken of this.activeFilterTokens) {
			const { token } = activeToken;
			const tokenEl = this.queryTokensEl.createDiv({
				cls: "float-search-cmdk-query-token",
				attr: {
					title: `${token.serialized}（已启用）`,
				},
			});
			tokenEl.createSpan({
				cls: "float-search-cmdk-query-token-label",
				text: `${token.key}: ${token.values.join(", ")}`,
			});
			const removeEl = tokenEl.createEl("button", {
				cls: "float-search-cmdk-query-token-remove",
				attr: {
					"aria-label": `移除筛选条件 ${token.key}: ${token.values.join(
						", "
					)}`,
					type: "button",
				},
			});
			setIcon(removeEl, "x");
			removeEl.addEventListener("mousedown", (evt) => {
				evt.preventDefault();
				evt.stopPropagation();
			});
			removeEl.addEventListener("click", (evt) => {
				evt.preventDefault();
				evt.stopPropagation();
				this.removeActiveFilterToken(activeToken.id);
			});
		}
	}

	private removeActiveFilterToken(id: number) {
		const index = this.activeFilterTokens.findIndex(
			(activeToken) => activeToken.id === id
		);
		if (index < 0) return;
		const [removed] = this.activeFilterTokens.splice(index, 1);
		this.renderActiveFilterTokens();
		this.suppressFilterAutocomplete = true;
		this.closeFilterCompletions();
		this.announceFilterState(
			`已移除筛选条件 ${removed.token.key}: ${removed.token.values.join(
				", "
			)}`
		);
		this.updateSuggestions();
		this.focusSearchInputAfterAction();
	}

	private restoreLastFilterTokenForEditing() {
		const activeToken = this.activeFilterTokens.pop();
		if (!activeToken) return;
		this.inputEl.value = activeToken.token.serialized;
		this.inputEl.setSelectionRange(
			this.inputEl.value.length,
			this.inputEl.value.length
		);
		this.suppressFilterAutocomplete = false;
		this.renderActiveFilterTokens();
		this.renderFilterCompletions();
		this.announceFilterState(
			`正在编辑筛选条件 ${activeToken.token.key}`
		);
		this.updateSuggestions();
	}

	private getFilterSuggestionDescription(
		suggestion: FilterAutocompleteSuggestion
	) {
		if (suggestion.kind === "key") {
			return (
				CMDK_FILTER_DESCRIPTIONS[suggestion.key] ??
				"应用搜索筛选"
			);
		}
		return `${CMDK_FILTER_DESCRIPTIONS[suggestion.key] ?? "筛选"}：${
			CMDK_FILTER_VALUE_DESCRIPTIONS[suggestion.value ?? ""] ??
			suggestion.value ??
			""
		}`;
	}

	private getFilterCompletionItems(
		state: FilterAutocompleteState
	): CmdkFilterCompletionItem[] {
		if (state.canActivate && state.token) {
			return [
				{
					description: "按 Tab 或 Enter 应用筛选条件",
					id: `activate:${state.token.serialized}`,
					label: `${state.token.key}: ${state.token.values.join(
						", "
					)}`,
				},
			];
		}

		if (state.suggestions.length > 0) {
			return state.suggestions.map((suggestion) => ({
				description:
					this.getFilterSuggestionDescription(suggestion),
				id: suggestion.id,
				label:
					suggestion.kind === "value" && state.key
						? `${state.key}:${suggestion.label}`
						: suggestion.label,
				suggestionId: suggestion.id,
			}));
		}

		if (state.status === "value-incomplete" && state.key) {
			return [
				{
					description:
						state.reason === "unterminated-quote"
							? "补全右侧引号后可应用筛选"
							: `${
									CMDK_FILTER_DESCRIPTIONS[
										state.key
									] ?? "筛选"
								}；输入值后按 Tab 应用`,
					disabled: true,
					id: `incomplete:${state.key}`,
					label: `${state.key}:`,
				},
			];
		}

		if (state.status === "invalid") {
			return [
				{
					description:
						state.reason === "unknown-filter"
							? "未识别的筛选名称"
							: "筛选值无效，请修改后重试",
					disabled: true,
					id: `invalid:${state.rawToken}`,
					invalid: true,
					label: state.rawToken || "无效筛选",
				},
			];
		}

		return [];
	}

	private isFilterCompletionOpen() {
		return !!this.filterCompletionsEl?.hasClass("is-open");
	}

	private closeFilterCompletions() {
		this.filterCompletionItems = [];
		this.filterCompletionsEl?.empty();
		this.filterCompletionsEl?.removeClass("is-open");
		this.inputEl.setAttribute("aria-expanded", "false");
		this.inputEl.removeAttribute("aria-activedescendant");
	}

	private updateFilterCompletionSelectionDom() {
		if (!this.filterCompletionsEl) return;
		const optionEls = Array.from(
			this.filterCompletionsEl.querySelectorAll(
				".float-search-cmdk-filter-completion"
			)
		);
		for (const [index, optionEl] of optionEls.entries()) {
			const selected =
				index === this.filterCompletionSelectedIndex &&
				!this.filterCompletionItems[index]?.disabled;
			optionEl.toggleClass("is-selected", selected);
			optionEl.setAttribute("aria-selected", String(selected));
			if (selected) {
				this.inputEl.setAttribute(
					"aria-activedescendant",
					optionEl.id
				);
				optionEl.scrollIntoView({ block: "nearest" });
			}
		}
	}

	private renderFilterCompletions() {
		if (
			!this.filterCompletionsEl ||
			this.suppressFilterAutocomplete ||
			this.isComposing
		) {
			this.closeFilterCompletions();
			return;
		}

		const cursorOffset =
			this.inputEl.selectionStart ?? this.inputEl.value.length;
		if (
			this.inputEl.selectionEnd != null &&
			this.inputEl.selectionEnd !== cursorOffset
		) {
			this.closeFilterCompletions();
			return;
		}
		const state = analyzeFilterAutocomplete(
			this.inputEl.value,
			cursorOffset
		);
		const items = this.getFilterCompletionItems(state);
		if (!items.length) {
			this.closeFilterCompletions();
			return;
		}

		this.filterCompletionItems = items;
		const selectedItem = items[this.filterCompletionSelectedIndex];
		if (
			!selectedItem ||
			selectedItem.disabled ||
			this.filterCompletionSelectedIndex >= items.length
		) {
			const selectableIndex = items.findIndex((item) => !item.disabled);
			this.filterCompletionSelectedIndex = Math.max(
				selectableIndex,
				0
			);
		}

		this.filterCompletionsEl.empty();
		this.filterCompletionsEl.addClass("is-open");
		this.filterCompletionsEl.setAttribute("role", "listbox");
		this.filterCompletionsEl.setAttribute(
			"aria-label",
			"搜索筛选选项"
		);
		this.filterCompletionsEl.createDiv({
			cls: "float-search-cmdk-filter-completion-title",
			text: "搜索选项",
		});
		for (const [index, item] of items.entries()) {
			const optionEl = this.filterCompletionsEl.createEl("button", {
				cls: "float-search-cmdk-filter-completion",
				attr: {
					"aria-disabled": String(!!item.disabled),
					"aria-selected": "false",
					id: `${this.filterCompletionListId}-option-${index}`,
					role: "option",
					type: "button",
				},
			});
			optionEl.toggleClass("is-invalid", !!item.invalid);
			optionEl.toggleClass(
				"is-incomplete",
				!!item.disabled && !item.invalid
			);
			optionEl.disabled = !!item.disabled;
			optionEl.createSpan({
				cls: "float-search-cmdk-filter-completion-key",
				text: item.label,
			});
			optionEl.createSpan({
				cls: "float-search-cmdk-filter-completion-description",
				text: item.description,
			});
			optionEl.addEventListener("mousedown", (evt) => {
				evt.preventDefault();
				evt.stopPropagation();
			});
			optionEl.addEventListener("mouseenter", () => {
				if (item.disabled) return;
				this.filterCompletionSelectedIndex = index;
				this.updateFilterCompletionSelectionDom();
			});
			optionEl.addEventListener("click", (evt) => {
				evt.preventDefault();
				evt.stopPropagation();
				if (!item.disabled) {
					this.acceptFilterCompletion(item, "Enter");
				}
			});
		}
		this.filterCompletionsEl.createDiv({
			cls: "float-search-cmdk-filter-completion-hint",
			text: items.some((item) => !item.disabled)
				? "Tab / Enter 补全 · ↑↓ 选择 · Esc 关闭"
				: "当前筛选尚未完成",
		});
		this.inputEl.setAttribute("aria-expanded", "true");
		this.updateFilterCompletionSelectionDom();
	}

	private moveFilterCompletionSelection(direction: -1 | 1) {
		const selectableIndexes = this.filterCompletionItems
			.map((item, index) => (!item.disabled ? index : -1))
			.filter((index) => index >= 0);
		if (!selectableIndexes.length) return;
		const currentIndex = selectableIndexes.indexOf(
			this.filterCompletionSelectedIndex
		);
		const nextIndex =
			currentIndex < 0
				? 0
				: (currentIndex + direction + selectableIndexes.length) %
					selectableIndexes.length;
		this.filterCompletionSelectedIndex =
			selectableIndexes[nextIndex];
		this.updateFilterCompletionSelectionDom();
	}

	private acceptFilterCompletion(
		item: CmdkFilterCompletionItem,
		trigger: FilterAutocompleteTrigger
	) {
		const cursorOffset =
			this.inputEl.selectionStart ?? this.inputEl.value.length;
		const accepted = acceptFilterAutocomplete(
			this.inputEl.value,
			cursorOffset,
			trigger,
			item.suggestionId
		);
		if (!accepted) return;

		if (accepted.kind === "continued") {
			this.inputEl.value = accepted.input;
			this.inputEl.setSelectionRange(
				accepted.cursorOffset,
				accepted.cursorOffset
			);
			this.filterCompletionSelectedIndex = 0;
			this.suppressFilterAutocomplete = false;
			this.renderFilterCompletions();
			return;
		}
		if (!accepted.token) return;

		const before = accepted.input
			.slice(0, accepted.range.from)
			.trimEnd();
		const after = accepted.input
			.slice(accepted.range.to)
			.trimStart();
		this.inputEl.value =
			before && after ? `${before} ${after}` : before || after;
		const nextCursor = Math.min(
			before.length,
			this.inputEl.value.length
		);
		this.inputEl.setSelectionRange(nextCursor, nextCursor);
		this.activeFilterTokens.push({
			id: this.nextFilterTokenId++,
			token: accepted.token,
		});
		this.renderActiveFilterTokens();
		this.suppressFilterAutocomplete = true;
		this.closeFilterCompletions();
		this.announceFilterState(
			`已启用筛选条件 ${accepted.token.key}: ${accepted.token.values.join(
				", "
			)}`
		);
		this.updateSuggestions();
	}

	constructor(plugin: FloatSearchPlugin) {
		super(plugin.app);
		this.plugin = plugin;
		this.resultStore = this.createResultStore();
		this.commitScheduler = this.createCommitScheduler();
		this.limit = Number.MAX_SAFE_INTEGER;
		this.setPlaceholder(Platform.isMobile ? "搜索笔记、标题或正文" : "Search files and content...");
		this.setInstructions(Platform.isMobile ? [] : [
			{ command: "↑↓", purpose: "Navigate" },
			{ command: "↵", purpose: "Open" },
			{ command: "Shift ↵", purpose: "New tab" },
			{ command: "esc", purpose: "Close" },
		]);
		this.modalEl.addClass("float-search-cmdk");
		this.containerEl.addClass("float-search-cmdk-container");
	}

	onOpen() {
		super.onOpen();
		this.closed = false;
		if (Platform.isMobile) {
			this.disposeMobileViewport = bindMobileSearchViewport(this.modalEl);
			const nativeClose = this.modalEl.querySelector<HTMLElement>(".modal-close-button");
			if (nativeClose) nativeClose.setAttribute("aria-label", "关闭搜索");
			else {
				const close = this.modalEl.createEl("button", {
					cls: "float-search-mobile-close",
					text: "关闭",
					attr: { type: "button", "aria-label": "关闭搜索" },
				});
				close.addEventListener("click", () => this.close());
			}
		}
		const headerEl = createDiv("float-search-cmdk-header");
		this.inputEl.insertAdjacentElement("beforebegin", headerEl);
		this.typoToggleEl = headerEl.createEl("button", {
			cls: "float-search-cmdk-typo-toggle",
			attr: {
				"aria-label": "允许输错一个字",
				type: "button",
			},
		});
		this.typoToggleEl.addEventListener("mousedown", (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
		});
		this.typoToggleEl.addEventListener("click", async (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
			this.plugin.settings.cmdkTypoTolerance =
				!this.plugin.settings.cmdkTypoTolerance;
			this.historyPreviewLookupId++;
			this.invalidatePreviewRequest();
			this.renderTypoToggle();
			this.updateSuggestions();
			await this.plugin.saveSettings();
			this.focusSearchInputAfterAction();
		});
		this.renderTypoToggle();
		if (!Platform.isMobile) {
			this.ragToggleEl = headerEl.createEl("button", {
				cls: "float-search-cmdk-rag-toggle",
				attr: {
					"aria-label": "使用 RAG 增强检索",
					type: "button",
				},
			});
			this.ragToggleEl.addEventListener("mousedown", (evt) => {
				evt.preventDefault();
				evt.stopPropagation();
			});
			this.ragToggleEl.addEventListener("click", async (evt) => {
				evt.preventDefault();
				evt.stopPropagation();
				this.plugin.settings.cmdkRagEnabled =
					!this.plugin.settings.cmdkRagEnabled;
				this.clearRagSearchTimer();
				this.ragRequestId++;
				this.historyPreviewLookupId++;
				this.invalidatePreviewRequest();
				this.renderRagToggle();
				this.updateSuggestions();
				await this.plugin.saveSettings();
				this.focusSearchInputAfterAction();
			});
			this.renderRagToggle();
		}
		const queryRegionEl = headerEl.createDiv(
			"float-search-cmdk-query-region"
		);
		const queryShellEl = queryRegionEl.createDiv(
			"float-search-cmdk-query-shell"
		);
		this.queryTokensEl = queryShellEl.createDiv({
			cls: "float-search-cmdk-query-tokens",
			attr: {
				"aria-label": "已启用的搜索筛选条件",
			},
		});
		queryShellEl.appendChild(this.inputEl);
		queryShellEl.addEventListener("mousedown", (evt) => {
			if (evt.target === queryShellEl) {
				evt.preventDefault();
				this.inputEl.focus({ preventScroll: true });
			}
		});
		this.filterCompletionsEl = queryRegionEl.createDiv({
			cls: "float-search-cmdk-filter-completions",
			attr: {
				id: this.filterCompletionListId,
			},
		});
		this.filterLiveRegionEl = queryRegionEl.createDiv({
			cls: "float-search-cmdk-filter-live-region",
			attr: {
				"aria-live": "polite",
				role: "status",
			},
		});
		this.inputEl.setAttribute("aria-autocomplete", "list");
		this.inputEl.setAttribute(
			"aria-controls",
			this.filterCompletionListId
		);
		this.inputEl.setAttribute("aria-expanded", "false");
		this.sortSelectEl = headerEl.createEl("select", {
			cls: "float-search-cmdk-sort-select",
			attr: {
				"aria-label": "搜索结果排序",
				title: "搜索结果排序",
			},
		});
		for (const [value, label] of Object.entries(
			Platform.isMobile ? CMDK_MOBILE_SORT_ORDER_OPTIONS : CMDK_PANEL_SORT_ORDER_OPTIONS
		)) {
			const optionEl = this.sortSelectEl.createEl("option", {
				text: label,
			});
			optionEl.value = value;
		}
		this.sortSelectEl.value = this.plugin.settings.cmdkSortOrder;
		this.sortSelectEl.setAttribute(
			"title",
			`排序：${CMDK_PANEL_SORT_ORDER_OPTIONS[this.plugin.settings.cmdkSortOrder]}`
		);
		this.sortSelectEl.addEventListener("mousedown", (evt) => {
			evt.stopPropagation();
			this.isSortSelectActive = true;
			this.invalidatePreviewRequest();
		});
		this.sortSelectEl.addEventListener("click", (evt) => {
			evt.stopPropagation();
		});
		this.sortSelectEl.addEventListener("keydown", (evt) => {
			if (
				[
					"ArrowUp",
					"ArrowDown",
					"ArrowLeft",
					"ArrowRight",
					"Home",
					"End",
					"PageUp",
					"PageDown",
					"Enter",
					" ",
				].includes(evt.key)
			) {
				evt.stopPropagation();
			}
		});
		this.sortSelectEl.addEventListener("focus", () => {
			this.isSortSelectActive = true;
			this.invalidatePreviewRequest();
		});
		this.sortSelectEl.addEventListener("blur", () => {
			this.isSortSelectActive = false;
		});
		this.sortSelectEl.addEventListener("change", async (evt) => {
			evt.stopPropagation();
			const sortOrder = normalizeCmdkSortOrder(
				this.sortSelectEl?.value,
				DEFAULT_SETTINGS.cmdkSortOrder
			);
			this.plugin.settings.cmdkSortOrder = sortOrder;
			this.sortSelectEl?.setAttribute(
				"title",
				`排序：${CMDK_PANEL_SORT_ORDER_OPTIONS[sortOrder]}`
				);
				this.historyPreviewLookupId++;
				this.invalidatePreviewRequest();
				this.setSortedSuggestions(
					(this as unknown as { chooser: CmdkChooser }).chooser,
					this.cmdkSourceResults,
					true
				);
			await this.plugin.saveSettings();
		});
		this.filtersEl = headerEl.createDiv("float-search-cmdk-filters");
		this.renderFilters();
		this.bodyEl = createDiv("float-search-cmdk-body");
		this.modalEl.insertBefore(
			this.bodyEl,
			this.getCmdkResultContainer()
		);
		this.bodyEl.appendChild(this.getCmdkResultContainer());
		this.getCmdkResultContainer().addEventListener(
			"scroll",
			this.onResultScroll,
			{ passive: true }
		);
		this.getCmdkResultContainer().addEventListener(RESULT_MOTION_END_EVENT, this.onResultScroll);
		if (Platform.isMobile) {
			this.mobilePreview = new MobileSearchPreview(this.app, this.bodyEl, {
				read: file => this.plugin.contentReadCoordinator.read({path: file.path, mtime: file.stat.mtime, size: file.stat.size}, () => this.app.vault.cachedRead(file)),
				dismissKeyboard: () => this.dismissMobileKeyboard(),
				back: () => {
					this.modalEl.removeClass("is-mobile-reading");
					const results = this.getCmdkResultContainer();
					results.focus({preventScroll: true}); animateNavigation(results, "back");
				},
				open: (_target, event) => {
					if (!this.mobilePreviewResult) return;
					this.onChooseSuggestion(this.mobilePreviewResult, event); this.close();
				},
			});
			this.getCmdkResultContainer().setAttribute("tabindex", "-1");
			this.modalEl.addEventListener("pointerdown", event => {
				if (!this.isComposing && event.target !== this.inputEl && !(event.target as HTMLElement).closest(".float-search-cmdk-query-shell")) this.dismissMobileKeyboard();
			}, {passive: true});
		} else this.ensurePreviewPane();
		this.inputEl.addEventListener(
			"compositionstart",
			this.onCompositionStart
		);
		this.inputEl.addEventListener(
			"compositionend",
			this.onCompositionEnd
		);
		this.inputEl.addEventListener("input", this.onFilterInput);
		this.inputEl.addEventListener("focus", this.onFilterFocus);
		this.inputEl.addEventListener(
			"keydown",
			this.onFilterKeyDown,
			true
		);
		this.updateSuggestions(true);
		if (Platform.isMobile) this.inputEl.focus({preventScroll: true});
	}

	private dismissMobileKeyboard() {
		if (Platform.isMobile) this.inputEl.blur();
	}

	private focusSearchInputAfterAction() {
		if (Platform.isMobile) this.dismissMobileKeyboard();
		else this.inputEl.focus({preventScroll: true});
	}

	private showMobilePreview(result: SearchableCmdkResult) {
		this.dismissMobileKeyboard();
		this.closeFilterCompletions();
		this.mobilePreviewResult = result;
		this.modalEl.addClass("is-mobile-reading");
		void this.mobilePreview?.show(this.getContentPreviewTarget(result));
	}

	private getContentPreviewTarget(result: SearchableCmdkResult) {
		const target = this.getResultTarget(result);
		return {
			file: target.file,
			line: target.type === "file" ? undefined : target.line,
			heading: target.type === "heading" && !target.isAlias ? target.heading : undefined,
			content: target.type === "content" ? target.content : undefined,
			matchOffset: target.type === "content" ? target.contentMatch?.matches[0]?.[0] : undefined,
			matchText: parseCmdkQuery(this.getRawQuery()).query,
		};
	}

	private isTypoEnabled() {
		return !!this.plugin.settings.cmdkTypoTolerance;
	}

	setSearchQuery(query: string) {
		this.setRawQuery(query);
		this.updateSuggestions(true);
	}

	private getTypoMatch(
		query: string,
		text: string,
		options?: Parameters<typeof typoMatch>[2]
	): TypoMatch | null {
		if (!this.isTypoEnabled()) return null;
		return typoMatch(query, text, options);
	}

	private renderTypoToggle() {
		if (!this.typoToggleEl) return;
		const enabled = this.isTypoEnabled();
		this.typoToggleEl.empty();
		this.typoToggleEl.toggleClass("is-active", enabled);
		this.typoToggleEl.setAttribute("aria-pressed", String(enabled));
		this.typoToggleEl.setAttribute(
			"title",
			enabled
				? "已启用：精确结果不足时后台补充容错结果"
				: "精确结果不足时后台补充容错结果"
		);
		this.typoToggleEl.createSpan({ text: "容错" });
	}

	private isRagEnabled() {
		return !Platform.isMobile && !!this.plugin.settings.cmdkRagEnabled;
	}

	private renderRagToggle() {
		if (!this.ragToggleEl) return;
		const enabled = this.isRagEnabled();
		this.ragToggleEl.empty();
		this.ragToggleEl.toggleClass("is-active", enabled);
		this.ragToggleEl.setAttribute("aria-pressed", String(enabled));
		this.ragToggleEl.setAttribute(
			"title",
			enabled ? "已启用：使用 RAG 增强检索" : "使用 RAG 增强检索"
		);
		this.ragToggleEl.createSpan({ text: "RAG" });
	}

	private clearRagSearchTimer() {
		if (this.ragSearchTimer == null) return;
		window.clearTimeout(this.ragSearchTimer);
		this.ragSearchTimer = null;
	}

	// Required by SuggestModal but unused — we drive the chooser directly
	getSuggestions(_query: string): CmdkResult[] {
		return [];
	}

	private createResultStore() {
		return new SearchResultStore<CmdkResult>({
			getKey: (result) => this.getCmdkResultKey(result),
		});
	}

	private createCommitScheduler() {
		return new TrailingCommitScheduler(() => {
			const session = this.activeSearchSession;
			if (!session || !this.isCurrentSearchSession(session)) return;
			const preserveViewport = this.hasCommittedActiveSearch;
			this.setSortedSuggestions(
				session.chooser,
				this.resultStore.getResults(),
				preserveViewport
			);
			this.hasCommittedActiveSearch = true;
		});
	}

	private buildSearchIdentityKey(
		parsed: ParsedCmdkQuery,
		rawQuery: string
	) {
		return JSON.stringify({
			extensions: parsed.extensions
				? [...parsed.extensions].sort()
				: null,
			fields: parsed.fields ? [...parsed.fields].sort() : null,
			filters: this.filters,
			pathIncludes: parsed.pathIncludes,
			query: parsed.query,
			rag: this.isRagEnabled(),
			rawQuery,
			tags: parsed.tags,
			typo: this.isTypoEnabled(),
			types: parsed.types ? [...parsed.types].sort() : null,
		});
	}

	private clearStagedSearchTimers() {
		if (this.stagedSearchTimer != null) {
			window.clearTimeout(this.stagedSearchTimer);
			this.stagedSearchTimer = null;
		}
		if (this.typoSearchTimer != null) {
			window.clearTimeout(this.typoSearchTimer);
			this.typoSearchTimer = null;
		}
	}

	private cancelActiveSearch() {
		this.activeSearchSession?.controller.abort();
		this.searchAbort?.abort();
		this.searchAbort = null;
		this.activeSearchSession = null;
		this.clearStagedSearchTimers();
		this.clearRagSearchTimer();
		this.ragRequestId++;
		this.commitScheduler.cancel();
	}

	private buildHeadingLinesByPath(
		files: readonly TFile[],
		catalogEntriesByPath = new Map(
			this.plugin.searchCatalog
				.snapshot()
				.map((entry) => [entry.file.path, entry])
		)
	) {
		return buildHeadingLineIndex(
			files.map((file) => ({
				headings:
					catalogEntriesByPath.get(file.path)?.headings ??
					(
						this.app.metadataCache.getFileCache(file)?.headings ?? []
					).map((heading) => ({
						line: heading.position?.start.line,
					})),
				path: file.path,
			}))
		);
	}

	private createSearchSession(
		chooser: CmdkChooser,
		parsed: ParsedCmdkQuery,
		rawQuery: string,
		files: TFile[],
		catalogEntries: CatalogEntry[],
		preserveInitialViewport = false
	): CmdkActiveSearchSession {
		this.cancelActiveSearch();
		const controller = new AbortController();
		const identityKey = this.buildSearchIdentityKey(parsed, rawQuery);
		const catalogEntriesByPath = new Map(
			catalogEntries.map((entry) => [entry.file.path, entry])
		);
		const session: CmdkActiveSearchSession = {
			catalogEntries: catalogEntriesByPath,
			chooser,
			completedStages: new Set<SearchStage>(),
			controller,
			exactContentPaths: new Set<string>(),
			files,
			headingLinesByPath: this.buildHeadingLinesByPath(
				files,
				catalogEntriesByPath
			),
			identity: {
				generation: ++this.searchGeneration,
				query: identityKey,
			},
			parsed,
			preparedTypo: prepareTypoMatcher(parsed.query),
			query: parsed.query,
			signal: controller.signal,
			startedAt: performance.now(),
		};
		this.activeSearchSession = session;
		this.hasCommittedActiveSearch = preserveInitialViewport;
		this.searchAbort = controller;
		this.resultStore = this.createResultStore();
		this.commitScheduler = this.createCommitScheduler();
		this.resultWindow.beginQuery(identityKey);
		this.cmdkResults = [];
		this.cmdkSourceResults = [];
		return session;
	}

	private isCurrentSearchSession(session: CmdkActiveSearchSession) {
		return (
			!this.closed &&
			isCurrentSearchSession(this.activeSearchSession, session)
		);
	}

	private upsertSearchResults(
		session: CmdkActiveSearchSession,
		results: CmdkResult[],
		immediate = false
	) {
		if (!results.length || !this.isCurrentSearchSession(session)) return;
		const currentResults = results.filter((result) => {
			if (!isSearchableCmdkResult(result)) return true;
			return (
				this.app.vault.getAbstractFileByPath(result.file.path) === result.file
			);
		});
		if (!currentResults.length) return;
		if (!this.resultStore.upsertLexical(currentResults)) return;
		if (immediate) {
			this.commitScheduler.flush() || this.commitScheduler.schedule();
		} else {
			this.commitScheduler.schedule();
		}
	}

	private replaceSearchResults(
		session: CmdkActiveSearchSession,
		bucket: "pinned" | "rag" | "history" | "create",
		results: CmdkResult[],
		immediate = false
	) {
		if (!this.isCurrentSearchSession(session)) return;
		if (!this.resultStore.replaceCategory(bucket, results)) return;
		if (immediate) {
			this.commitScheduler.flush() || this.commitScheduler.schedule();
		} else {
			this.commitScheduler.schedule();
		}
	}

	private completeSearchStage(
		session: CmdkActiveSearchSession,
		stage: SearchStage
	) {
		if (!this.isCurrentSearchSession(session)) return;
		session.completedStages.add(stage);
		if (!this.hasCommittedActiveSearch && stage === "file") {
			this.commitScheduler.commitNow();
		} else {
			this.commitScheduler.flush();
		}
	}

	private yieldSearchWork() {
		return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
	}

	private renderFilters() {
		this.filtersEl.empty();
		const options: Array<{
			key: keyof CmdkSearchFilters;
			label: string;
			title: string;
		}> = [
			{ key: "file", label: Platform.isMobile ? "文件" : "Files", title: "搜索文件名" },
			{ key: "heading", label: Platform.isMobile ? "标题" : "Heads", title: "搜索标题与别名" },
			{ key: "content", label: Platform.isMobile ? "正文" : "Text", title: "搜索笔记正文" },
		];

		for (const option of options) {
			const buttonEl = this.filtersEl.createEl("button", {
				cls: `float-search-cmdk-filter${
					this.filters[option.key] ? " is-active" : ""
				}`,
				attr: {
					"aria-label": option.title,
					"aria-pressed": String(this.filters[option.key]),
					title: option.title,
					type: "button",
				},
			});
			buttonEl.addEventListener("mousedown", (evt) => {
				evt.preventDefault();
				evt.stopPropagation();
			});
			buttonEl.addEventListener("click", (evt) => {
				evt.preventDefault();
				evt.stopPropagation();
				this.filters[option.key] = !this.filters[option.key];
				buttonEl.toggleClass("is-active", this.filters[option.key]);
				buttonEl.setAttribute(
					"aria-pressed",
					String(this.filters[option.key])
				);
				this.updateSuggestions();
				this.focusSearchInputAfterAction();
			});
			buttonEl.createSpan({ text: option.label });
		}
	}

	private isTypeEnabled(
		type: CmdkSearchType,
		parsed: ParsedCmdkQuery
	) {
		return parsed.types
			? parsed.types.has(type)
			: this.filters[type];
	}

	private isFieldEnabled(
		field: CmdkSearchField,
		parsed: ParsedCmdkQuery
	) {
		return !parsed.fields || parsed.fields.has(field);
	}

	private fileMatchesFilters(file: TFile, parsed: ParsedCmdkQuery) {
		const pathLower = file.path.toLowerCase();
		if (parsed.extensions && !parsed.extensions.has(file.extension.toLowerCase())) {
			return false;
		}
		if (parsed.tags.length) {
			const cache = this.app.metadataCache.getFileCache(file);
			const fileTags = cache
				? (getAllTags(cache) ?? []).map((tag) =>
						tag.replace(/^#/, "").toLowerCase()
					)
				: [];
			if (
				!parsed.tags.every((tag) =>
					fileTags.some(
						(fileTag) =>
							fileTag === tag || fileTag.startsWith(`${tag}/`)
					)
				)
			) {
				return false;
			}
		}
		return parsed.pathIncludes.every((item) => pathLower.includes(item));
	}

	private resultMatchesCurrentQuery(
		result: SearchableCmdkResult,
		parsed: ParsedCmdkQuery,
		query: string
	) {
		if (!this.fileMatchesFilters(result.file, parsed)) return false;
		if (!this.isTypeEnabled(result.type, parsed)) return false;

		const trimmedQuery = query.trim();
		if (!trimmedQuery) return true;

		const fuzzy = prepareFuzzySearch(trimmedQuery);
		const textMatches = (text: string) =>
			!!fuzzy(text) || !!this.getTypoMatch(trimmedQuery, text);
		if (result.type === "file") {
			return (
				(this.isFieldEnabled("name", parsed) &&
					textMatches(result.file.basename)) ||
				(this.isFieldEnabled("path", parsed) &&
					textMatches(result.file.path))
			);
		}
		if (result.type === "heading") {
			return (
				this.isFieldEnabled("heading", parsed) &&
				textMatches(result.heading)
			);
		}
		return (
			this.isFieldEnabled("content", parsed) &&
			textMatches(result.content)
		);
	}

	private getCandidateFiles(
		parsed: ParsedCmdkQuery,
		catalogEntries?: CatalogEntry[]
	) {
		if (this.plugin.searchCatalog.isReady()) {
			return (catalogEntries ?? this.plugin.searchCatalog.snapshot())
				.filter((entry) => {
					if (
						parsed.extensions &&
						!parsed.extensions.has(entry.extension)
					) {
						return false;
					}
					if (
						!parsed.pathIncludes.every((item) =>
							entry.lowerPath.includes(item)
						)
					) {
						return false;
					}
					return parsed.tags.every((tag) =>
						[...entry.tags].some(
							(fileTag) =>
								fileTag === tag || fileTag.startsWith(`${tag}/`)
						)
					);
				})
				.map((entry) => entry.file);
		}
		return this.app.vault.getFiles().filter(
			(f: TFile) =>
				!isHiddenPath(f.path) &&
				this.fileMatchesFilters(f, parsed) &&
				(f.extension === "md" ||
					f.extension === "canvas" ||
					f.extension === "pdf")
		);
	}

	private getObsidianVaultRoot() {
		const adapter = this.app.vault.adapter as {
			getBasePath?: () => string;
		};
		try {
			return adapter.getBasePath?.() ?? "";
		} catch {
			return "";
		}
	}

	private shouldRunRag(parsed: ParsedCmdkQuery, query: string) {
		if (!this.isRagEnabled()) return false;
		if (query.trim().length < 2) return false;
		if (
			parsed.types &&
			!parsed.types.has("heading") &&
			!parsed.types.has("content")
		) {
			return false;
		}
		if (
			parsed.fields &&
			!parsed.fields.has("heading") &&
			!parsed.fields.has("content")
		) {
			return false;
		}
		return true;
	}

	private getRagScore(hit: CmdkRagHit) {
		const values = [
			hit.rerankScore,
			hit.similarity,
			hit.bm25Score,
		].filter(
			(value): value is number =>
				typeof value === "number" && Number.isFinite(value)
		);
		return values.length ? Math.max(...values) : 0;
	}

	private formatRagScoreValue(value: number) {
		const absolute = Math.abs(value);
		if (absolute >= 100) return value.toFixed(0);
		if (absolute >= 10) return value.toFixed(1);
		return value.toFixed(2);
	}

	private getRagScoreParts(hit: CmdkRagHit) {
		return [
			{ key: "R", label: "Rerank", value: hit.rerankScore },
			{ key: "V", label: "Vector", value: hit.similarity },
			{ key: "B", label: "BM25", value: hit.bm25Score },
		].filter(
			(part): part is { key: string; label: string; value: number } =>
				typeof part.value === "number" && Number.isFinite(part.value)
		);
	}

	private renderRagScoreBadge(el: HTMLElement, hit: CmdkRagHit) {
		const parts = this.getRagScoreParts(hit);
		if (!parts.length) return;

		const compactLabel = parts
			.map((part) => `${part.key} ${this.formatRagScoreValue(part.value)}`)
			.join(" · ");
		const fullLabel = parts
			.map(
				(part) =>
					`${part.label}: ${this.formatRagScoreValue(part.value)}`
			)
			.join(" · ");

		this.getAuxEl(el).createSpan({
			cls: "suggestion-flair float-search-cmdk-rag-score",
			text: compactLabel,
			attr: {
				"aria-label": `RAG recall score ${fullLabel}`,
				title: `RAG recall score · ${fullLabel}`,
			},
		});
	}

	private async buildRagResult(
		hit: CmdkRagHit,
		parsed: ParsedCmdkQuery
	): Promise<CmdkRagResult | null> {
		const file = this.app.vault.getAbstractFileByPath(hit.obsidianPath);
		if (!(file instanceof TFile)) return null;
		if (isHiddenPath(file.path) || !this.fileMatchesFilters(file, parsed)) {
			return null;
		}

		const filePreviewResult: CmdkFileResult = {
			file,
			nameMatch: null,
			pathMatch: null,
			score: this.getRagScore(hit),
			type: "file",
		};

		let previewResult: SearchableCmdkResult = filePreviewResult;
		if (file.extension === "md") {
			try {
				const text = await this.plugin.contentReadCoordinator.read(
					{
						mtime: file.stat.mtime,
						path: file.path,
						size: file.stat.size,
					},
					() => this.app.vault.cachedRead(file)
				);
				const match = findRagTextMatch(text, [
					hit.text ?? "",
					hit.textSnippet ?? "",
					hit.snippet,
				]);
				if (match) {
					previewResult = {
						file,
						content: match.lineText || hit.snippet || file.basename,
						contentMatch: null,
						line: match.line,
						nameMatch: null,
						pathMatch: null,
						score: filePreviewResult.score,
						type: "content",
					};
				}
			} catch (error) {
				console.error("Float Search failed to locate RAG chunk", error);
			}
		}

		return {
			file,
			hit,
			nameMatch: null,
			pathMatch: null,
			previewResult,
			score: filePreviewResult.score,
			type: "rag",
		};
	}

	private runRagStage(session: CmdkActiveSearchSession) {
		const { parsed, query } = session;
		if (!this.shouldRunRag(parsed, query)) {
			this.completeSearchStage(session, "rag");
			return;
		}

		const vaultRoot = this.getObsidianVaultRoot();
		if (!vaultRoot) {
			this.completeSearchStage(session, "rag");
			return;
		}

		const vaults = discoverRagVaults(vaultRoot);
		if (!vaults.length) {
			this.completeSearchStage(session, "rag");
			return;
		}

		const requestId = ++this.ragRequestId;
		this.ragSearchTimer = window.setTimeout(async () => {
			this.ragSearchTimer = null;
			try {
				const responses = await queryRagVaults(
					vaults,
					query.trim(),
					{
						fast: true,
						k: clampNumber(
							this.plugin.settings.cmdkRagResultsPerVault,
							MIN_CMDK_RAG_RESULTS_PER_VAULT,
							MAX_CMDK_RAG_RESULTS_PER_VAULT,
							DEFAULT_SETTINGS.cmdkRagResultsPerVault
						),
						scope: "both",
						timeoutMs: 9000,
					},
					session.controller.signal
				);
				if (
					!this.isCurrentSearchSession(session) ||
					requestId !== this.ragRequestId
				) {
					return;
				}

				const ragResults = (
					await Promise.all(
						responses
							.flatMap((response) => response.hits)
							.map((hit) => this.buildRagResult(hit, parsed))
					)
				).filter(
					(result): result is CmdkRagResult => result !== null
				);
				if (
					!this.isCurrentSearchSession(session) ||
					requestId !== this.ragRequestId
				) {
					return;
				}

				this.replaceSearchResults(session, "rag", ragResults);
			} catch (error) {
				console.error("Float Search RAG query failed", error);
			} finally {
				this.completeSearchStage(session, "rag");
			}
		}, 350);
	}

	private buildTypoContentResult(
		file: TFile,
		query: string,
		text: string,
		headingLinesByPath: HeadingLineIndex
	): SearchableCmdkResult | null {
		if (!this.isTypoEnabled()) return null;

		const MAX_TYPO_LINES = 300;
		const lineMatch = findFirstNonHeadingLineMatch(
			getContentLines(text, MAX_TYPO_LINES),
			file.path,
			headingLinesByPath,
			(lineText) =>
				this.getTypoMatch(query, lineText, { maxTextLength: 220 })
		);
		if (!lineMatch) return null;

		return {
			file,
			content: lineMatch.lineText,
			contentMatch: null,
			line: lineMatch.line,
			nameMatch: null,
			pathMatch: null,
			score: lineMatch.match.score - 80,
			type: "content",
		};
	}

	private scheduleTypoContentSearch(session: CmdkActiveSearchSession) {
		if (!this.isCurrentSearchSession(session)) return;
		const lexicalFiles = new Set(
			this.resultStore
				.getCategory("lexical")
				.filter(isSearchableCmdkResult)
				.map((result) => result.file.path)
		);
		if (
			!shouldRunTypoFallback({
				completedStages: session.completedStages,
				contentEnabled:
					this.isTypeEnabled("content", session.parsed) &&
					this.isFieldEnabled("content", session.parsed),
				distinctPrimaryFiles: lexicalFiles.size,
				enabled: this.isTypoEnabled(),
				matcherEligible: session.preparedTypo.isEligible,
			})
		) {
			this.completeSearchStage(session, "typo");
			return;
		}

		const remainingDelay = getTypoFallbackDelay(
			session.startedAt,
			performance.now()
		);
		this.typoSearchTimer = window.setTimeout(() => {
			this.typoSearchTimer = null;
			void this.runTypoContentStage(session);
		}, remainingDelay);
	}

	private async findTypoContentResult(
		session: CmdkActiveSearchSession,
		file: TFile,
		text: string
	): Promise<SearchableCmdkResult | null> {
		const maxLines = 300;
		const lines = getContentLines(text, maxLines);
		let sliceStartedAt = performance.now();

		for (let startIndex = 0; startIndex < lines.length; startIndex += 32) {
			if (!this.isCurrentSearchSession(session)) return null;
			const lineMatch = findFirstNonHeadingLineMatch(
				lines,
				file.path,
				session.headingLinesByPath,
				(lineText) =>
					session.preparedTypo.match(lineText, {
						maxTextLength: 220,
					}),
				startIndex,
				startIndex + 32
			);
			if (lineMatch) {
				return {
					content: lineMatch.lineText,
					contentMatch: null,
					file,
					line: lineMatch.line,
					nameMatch: null,
					pathMatch: null,
					score: lineMatch.match.score - 80,
					type: "content",
				};
			}
			if (performance.now() - sliceStartedAt >= 8) {
				await this.yieldSearchWork();
				sliceStartedAt = performance.now();
			}
		}
		return null;
	}

	private async runTypoContentStage(session: CmdkActiveSearchSession) {
		if (!this.isCurrentSearchSession(session)) return;
		const fileScores = new Map<string, number>();
		for (const result of this.resultStore.getCategory("lexical")) {
			if (!isSearchableCmdkResult(result)) continue;
			fileScores.set(
				result.file.path,
				Math.max(
					fileScores.get(result.file.path) ?? -Infinity,
					this.getSearchableScore(result)
				)
			);
		}
		const candidates = session.files
			.filter(
				(file) =>
					file.extension === "md" &&
					!session.exactContentPaths.has(file.path)
			)
			.sort((left, right) => {
				const scoreDiff =
					(fileScores.get(right.path) ?? -Infinity) -
					(fileScores.get(left.path) ?? -Infinity);
				return scoreDiff || left.path.localeCompare(right.path);
			});

		let found = 0;
		for (const file of candidates) {
			if (!this.isCurrentSearchSession(session) || found >= 50) break;
			let text: string;
			try {
				text = await this.plugin.contentReadCoordinator.read(
					{
						mtime: file.stat.mtime,
						path: file.path,
						size: file.stat.size,
					},
					() => this.app.vault.cachedRead(file)
				);
			} catch {
				continue;
			}
			if (!this.isCurrentSearchSession(session)) return;
			const result = await this.findTypoContentResult(session, file, text);
			if (!result) continue;
			found++;
			this.upsertSearchResults(session, [result]);
		}
		this.completeSearchStage(session, "typo");
	}

	private buildContentPreviewResult(
		file: TFile,
		query: string,
		text: string,
		simpleSearch: (text: string) => SearchResult | null,
		headingLinesByPath: HeadingLineIndex
	): SearchableCmdkResult | null {
		const result = findFirstNonHeadingExactMatch(
			text,
			file.path,
			headingLinesByPath,
			simpleSearch
		);
		if (!result) {
			return this.buildTypoContentResult(
				file,
				query,
				text,
				headingLinesByPath
			);
		}
		const lineMatch = simpleSearch(result.lineText);

		return {
			file,
			content: result.lineText,
			contentMatch: lineMatch,
			line: result.line,
			nameMatch: null,
			pathMatch: null,
			score: scoreCmdkText(query, result.lineText, lineMatch?.score),
			type: "content",
		};
	}

	private sortFilesForPreview(files: TFile[]) {
		return files
			.map((file) => ({
				file,
				score: file.stat.mtime,
			}))
			.sort((a, b) =>
				compareCmdkSortableItems(
					a,
					b,
					this.plugin.settings.cmdkSortOrder
				)
			)
			.map(({ file }) => file);
	}

	private getSearchTitles(
		file: TFile,
		entry?: CatalogEntry,
		aliasesOnly = false
	): Array<CatalogHeading & { isAlias?: boolean }> {
		const cache = entry ? null : this.app.metadataCache.getFileCache(file);
		const aliases = entry?.aliases ?? parseFrontMatterAliases(cache?.frontmatter) ?? [];
		const headings = aliasesOnly ? [] : entry?.headings ?? (cache?.headings ?? []).map((heading) => ({
			heading: heading.heading,
			level: heading.level,
			line: heading.position?.start.line,
		}));
		const seen = new Set<string>();
		return [
			...aliases.flatMap((alias) => {
				const heading = alias.trim();
				const key = heading.toLowerCase();
				if (!heading || seen.has(key)) return [];
				seen.add(key);
				return [{ heading, level: 0, isAlias: true }];
			}),
			...headings,
		];
	}

	private async getTopPreviewResultForQuery(rawQuery: string) {
		const parsed = parseCmdkQuery(rawQuery);
		const query = parsed.query;
		const files = this.getCandidateFiles(parsed);
		const previewFiles = this.sortFilesForPreview(files);

		if (!query.trim()) {
			const file = previewFiles[0];
			return file
				? ({
						file,
						nameMatch: null,
						pathMatch: null,
						type: "file",
					} as CmdkFileResult)
				: null;
		}

		const fuzzy = prepareFuzzySearch(query);
		if (this.isTypeEnabled("file", parsed)) {
			const fileResults: CmdkFileResult[] = [];
			for (const file of previewFiles) {
				const nameMatch = this.isFieldEnabled("name", parsed)
					? fuzzy(file.basename)
					: null;
				const pathMatch = this.isFieldEnabled("path", parsed)
					? fuzzy(file.path)
					: null;
				const nameTypoMatch =
					!nameMatch && this.isFieldEnabled("name", parsed)
						? this.getTypoMatch(query, file.basename)
						: null;
				const pathTypoMatch =
					!pathMatch && this.isFieldEnabled("path", parsed)
						? this.getTypoMatch(query, file.path, {
								maxTextLength: 220,
							})
						: null;
				if (!nameMatch && !pathMatch && !nameTypoMatch && !pathTypoMatch)
					continue;
				fileResults.push({
					file,
					nameMatch,
					pathMatch,
					score: Math.max(
						scoreCmdkText(query, file.basename, nameMatch?.score) +
							300,
						scoreCmdkText(query, file.path, pathMatch?.score) * 0.5,
						nameTypoMatch ? nameTypoMatch.score + 160 : -Infinity,
						pathTypoMatch ? pathTypoMatch.score * 0.5 : -Infinity
					),
					type: "file",
				});
			}
			fileResults.sort((a, b) =>
				compareCmdkSortableItems(
					a,
					b,
					this.plugin.settings.cmdkSortOrder
				)
			);
			if (fileResults[0]) return fileResults[0];
		}

		if (
			this.isTypeEnabled("heading", parsed) &&
			this.isFieldEnabled("heading", parsed)
		) {
			for (const file of previewFiles) {
				const heading = this.getSearchTitles(file).find(
					(item) =>
						fuzzy(item.heading) ||
						this.getTypoMatch(query, item.heading, {
							maxTextLength: 120,
						})
				);
				if (heading) {
					const headingMatch = fuzzy(heading.heading);
					return {
							file,
							isAlias: heading.isAlias,
							heading: heading.heading,
							headingMatch,
							level: heading.level,
							line: heading.line,
							nameMatch: null,
							pathMatch: null,
							type: "heading" as const,
					};
				}
			}
		}

		if (
			query.trim().length >= 2 &&
			this.isTypeEnabled("content", parsed) &&
			this.isFieldEnabled("content", parsed)
		) {
			const simpleSearch = prepareSimpleSearch(query);
			const recentMarkdownFiles = previewFiles.filter(
				(file) => file.extension === "md"
			);
			const headingLinesByPath = this.buildHeadingLinesByPath(
				recentMarkdownFiles
			);
			for (const file of recentMarkdownFiles) {
				if (this.closed) return null;
				let text: string;
				try {
					text = await this.plugin.contentReadCoordinator.read(
						{
							mtime: file.stat.mtime,
							path: file.path,
							size: file.stat.size,
						},
						() => this.app.vault.cachedRead(file)
					);
				} catch {
					continue;
				}
				const contentResult = this.buildContentPreviewResult(
					file,
					query,
					text,
					simpleSearch,
					headingLinesByPath
				);
				if (contentResult) return contentResult;
			}
		}

		return null;
	}

	private async showHistoryPreview(result: CmdkHistoryResult) {
		if (Platform.isMobile) return;
		const lookupId = ++this.historyPreviewLookupId;
		const previewResult = await this.getTopPreviewResultForQuery(result.query);
		if (this.closed || lookupId !== this.historyPreviewLookupId) return;
		if (previewResult) {
			this.showPreview(previewResult);
		} else {
			this.hidePreview();
		}
	}

	private async applyHistoryQuery(query: string) {
		this.setRawQuery(query);
		this.focusSearchInputAfterAction();
		this.inputEl.setSelectionRange(
			this.inputEl.value.length,
			this.inputEl.value.length
		);
		this.updateSuggestions();
		const lookupId = ++this.historyPreviewLookupId;
		const previewResult = await this.getTopPreviewResultForQuery(query);
		if (this.closed || lookupId !== this.historyPreviewLookupId) return;
		if (previewResult) {
			this.showPreview(previewResult);
		} else {
			this.hidePreview();
		}
	}

	private getAuxEl(el: HTMLElement) {
		const existing = el.querySelector(".suggestion-aux");
		if (existing instanceof HTMLElement) return existing;
		return el.createDiv("suggestion-aux");
	}

		private renderTypeBadge(
			el: HTMLElement,
			label: string,
			kind: string,
		extension?: string
	) {
		const auxEl = this.getAuxEl(el);
		auxEl.createSpan({
			cls: `suggestion-flair float-search-cmdk-type-badge is-${kind}`,
			text: label,
		});
		if (extension && extension !== "md") {
			auxEl.createSpan({
				cls: "suggestion-flair float-search-cmdk-ext-badge",
				text: extension,
			});
			}
		}

		private renderMatchCount(el: HTMLElement, count?: number) {
			if (!count || count < 2) return;
			const label = `${count} matches`;
			this.getAuxEl(el).createSpan({
				cls: "float-search-cmdk-match-count",
				text: count > 99 ? "99+" : String(count),
				attr: {
					"aria-label": label,
					title: label,
				},
			});
		}

		private toggleFileGroup(result: CmdkFileResult) {
			if (!result.childResults?.length) return;
			const key = result.file.path;
			const collapsed = this.resultWindow.getChildLimit(key) > this.resultWindow.collapsedChildLimit;
			if (collapsed) {
				this.resultWindow.collapseChildGroup(key);
			} else {
				this.resultWindow.expandChildGroup(key);
			}
			const chooser = this.getCmdkChooser();
			const update = () => this.setSortedSuggestions(
				chooser, this.cmdkSourceResults, true, collapsed ? key : undefined
			);
			const exitingKeys = new Set<string>();
			if (collapsed) for (const item of this.cmdkResults) {
				if (item.childOf === key || (item.type === "load-more" && item.filePath === key)) {
					exitingKeys.add(this.getCmdkMotionKey(item));
				}
			}
			animateResultChange(this.getCmdkResultContainer(), update, {
				exitingKeys,
				groupKey: this.getCmdkMotionKey(result),
				direction: collapsed ? "collapse" : "expand",
			});
			if (Platform.isMobile && this.mobilePreview?.visible) this.mobilePreview.content.focus({preventScroll: true});
		}

		private loadMoreResults(result: CmdkLoadMoreResult) {
			if (result.target === "children" && result.filePath) {
				this.resultWindow.loadMoreChildren(result.filePath);
			} else if (result.target === "files") {
				this.resultWindow.loadMoreFileGroups();
			} else if (result.target === "rag") {
				this.resultWindow.loadMoreRag();
			}
			const chooser = this.getCmdkChooser();
			this.setSortedSuggestions(chooser, this.cmdkSourceResults, true);
			this.focusSearchInputAfterAction();
		}

		private scheduleResultWindowLoad() {
			if (this.scrollLoadRaf != null || this.closed) return;
			this.scrollLoadRaf = window.requestAnimationFrame(() => {
				this.scrollLoadRaf = null;
				const container = this.getCmdkResultContainer();
				if (isResultMotionActive(container)) return;
				const distanceToBottom =
					container.scrollHeight -
					container.scrollTop -
					container.clientHeight;
				if (distanceToBottom > container.clientHeight * 2) return;
				const current = this.resultWindow.snapshot().fileGroupLimit;
				const groups = this.buildFileGroups(
					this.cmdkSourceResults.filter(
						(result): result is SearchableCmdkResult =>
							isSearchableCmdkResult(result) && !result.pinned
					)
				).length;
				if (current >= 300 || current >= groups) return;
				this.resultWindow.autoLoadMoreFileGroups();
				this.setSortedSuggestions(
					this.getCmdkChooser(),
					this.cmdkSourceResults,
					true
				);
			});
		}

		private renderDisclosure(el: HTMLElement, result: CmdkResult) {
			if (
				result.type === "file" &&
				result.childResults &&
				result.childResults.length > this.resultWindow.collapsedChildLimit
			) {
				const label = Platform.isMobile
					? (result.expanded ? "收起匹配" : "展开匹配")
					: (result.expanded ? "Collapse matches" : "Expand matches");
				const buttonEl = el.createEl("button", {
					cls: "clickable-icon float-search-cmdk-disclosure",
					attr: {
						"aria-label": label,
						"aria-expanded": String(!!result.expanded),
						title: label,
						type: "button",
					},
				});
				setIcon(buttonEl, result.expanded ? "chevron-down" : "chevron-right");
				const stopDisclosureEvent = (evt: MouseEvent) => {
					evt.preventDefault();
					evt.stopPropagation();
				};
				buttonEl.addEventListener("mousedown", stopDisclosureEvent);
				buttonEl.addEventListener("click", (evt) => {
					stopDisclosureEvent(evt);
					this.toggleFileGroup(result);
					this.focusSearchInputAfterAction();
				});
				return;
			}
			el.createSpan("float-search-cmdk-disclosure-spacer");
		}

		private getResultTarget(result: SearchableCmdkResult) {
			return result.type === "file" && result.previewResult
				? result.previewResult
				: result;
		}

		private getResultEphemeralState(result: SearchableCmdkResult) {
			const eState: Record<string, any> = {};
			if (result.type === "heading" && result.isAlias) return eState;
			if (result.type === "heading" && result.line != null) {
				eState.line = result.line;
			} else if (result.type === "heading" && result.heading) {
				eState.subpath = "#" + result.heading;
			} else if (result.type === "content" && result.line != null) {
				eState.line = result.line;
			}
			return eState;
		}

		private renderHeadingLevelBadge(el: HTMLElement, level?: number) {
			if (!level) return;
			el.createSpan({
				cls: "float-search-cmdk-heading-level",
				text: `H${level}`,
				attr: {
					"aria-label": `Heading level ${level}`,
					title: `Heading level ${level}`,
				},
			});
		}

			private renderPinButton(el: HTMLElement, result: SearchableCmdkResult) {
			const auxEl = this.getAuxEl(el);
			const isPinned = result.pinned || this.isPinnedResult(result);
		const buttonEl = auxEl.createEl("button", {
			cls: `clickable-icon float-search-cmdk-pin-button${
				isPinned ? " is-pinned" : ""
				}`,
				attr: {
					"aria-label": isPinned ? "Unpin result" : "Pin result",
					tabindex: "-1",
					title: isPinned ? "Unpin result" : "Pin result",
					type: "button",
				},
		});
		setIcon(buttonEl, "pin");
		const stopPinEvent = (evt: MouseEvent) => {
			evt.preventDefault();
			evt.stopPropagation();
		};
		buttonEl.addEventListener("mousedown", stopPinEvent);
		buttonEl.addEventListener("click", (evt) => {
			stopPinEvent(evt);
			this.togglePinnedResult(result);
		});
	}

		private getCmdkResultKey(result: CmdkResult) {
			if (isSearchableCmdkResult(result)) {
				return this.getSearchableResultKey(result);
			}
			if (result.type === "history") {
				return `history:${result.query}`;
			}
			if (result.type === "create") {
				return `create:${result.createQuery}`;
			}
			if (result.type === "rag") {
				return `rag:${result.hit.vaultId}:${result.hit.docId || result.hit.obsidianPath}:${result.hit.chunkIndex ?? ""}`;
			}
			if (result.type === "load-more") {
				return `load-more:${result.target}:${result.filePath ?? ""}`;
			}
			return `command:${result.commandId}`;
		}

		private getCmdkMotionKey(result: CmdkResult) {
			if (isSearchableCmdkResult(result) && result.type !== "file" && result.line != null) {
				return `${result.type}:${result.file.path}:${result.line}`;
			}
			return this.getCmdkResultKey(result);
		}

		private dedupeCmdkResults(results: CmdkResult[]) {
			const seen = new Set<string>();
			const deduped: CmdkResult[] = [];
			for (const result of results) {
				const key = this.getCmdkResultKey(result);
				if (seen.has(key)) continue;
				seen.add(key);
				deduped.push(result);
			}
			return deduped;
		}

		private getSearchableScore(result: SearchableCmdkResult) {
			return typeof result.score === "number" &&
				Number.isFinite(result.score)
				? result.score
				: -Infinity;
		}

		private compareChildResults(
			a: SearchableCmdkResult,
			b: SearchableCmdkResult
		) {
			if (a.type !== b.type) {
				if (a.type === "heading") return -1;
				if (b.type === "heading") return 1;
			}
			const scoreDiff =
				this.getSearchableScore(b) - this.getSearchableScore(a);
			if (scoreDiff !== 0) return scoreDiff;
			if (a.type === "content" && b.type === "content") {
				return a.line - b.line;
			}
			if (a.type === "heading" && b.type === "heading") {
				return (a.line ?? 0) - (b.line ?? 0);
			}
			return a.file.path.localeCompare(b.file.path);
		}

		private getBestChildResult(children: SearchableCmdkResult[]) {
			return [...children].sort((a, b) => {
				const scoreDiff =
					this.getSearchableScore(b) - this.getSearchableScore(a);
				if (scoreDiff !== 0) return scoreDiff;
				return this.compareChildResults(a, b);
			})[0];
		}

		private buildFileGroups(results: SearchableCmdkResult[]) {
			const groups = new Map<string, CmdkFileGroup>();
			for (const result of results) {
				const key = result.file.path;
				let group = groups.get(key);
				if (!group) {
					group = {
						children: [],
						file: result.file,
						score: -Infinity,
					};
					groups.set(key, group);
				}

				const score = this.getSearchableScore(result);
				group.score = Math.max(group.score, score);
				if (result.type === "file") {
					if (
						!group.fileResult ||
						score > this.getSearchableScore(group.fileResult)
					) {
						group.fileResult = result;
					}
				} else {
					group.children.push(result);
				}
			}
			return [...groups.values()].sort((a, b) =>
				compareCmdkSortableItems(
					a,
					b,
					this.plugin.settings.cmdkSortOrder
				)
			);
		}

		private buildVisibleFileResults(
			results: SearchableCmdkResult[],
			protectedResults: CmdkResult[] = [],
			skipChildProtectionPath?: string
		) {
			const visible: CmdkResult[] = [];
			const groups = this.buildFileGroups(results);
			const protectedFilePaths = new Set(
				protectedResults.flatMap((result) => {
					if (isSearchableCmdkResult(result)) return [result.file.path];
					if (result.type === "load-more" && result.filePath) {
						return [result.filePath];
					}
					return [];
				})
			);
			const protectedChildKeys = new Set(
				protectedResults
					.filter(
						(result): result is SearchableCmdkResult =>
							isSearchableCmdkResult(result) && !!result.childOf
					)
					.map((result) => this.getCmdkResultKey(result))
			);
			const anchorGroupIndex = groups.reduce(
				(maximum, group, index) =>
					protectedFilePaths.has(group.file.path)
						? Math.max(maximum, index)
						: maximum,
				-1
			);
			const groupLimit = this.resultWindow.getFileGroupLimit(
				anchorGroupIndex
			);
			const visibleGroups = groups.slice(0, groupLimit);
			for (const group of visibleGroups) {
				const children = group.children.sort((a, b) =>
					this.compareChildResults(a, b)
				);
				const bestChild = this.getBestChildResult(children);
				const protectedChildIndex =
					group.file.path === skipChildProtectionPath
						? -1
						: children.reduce(
								(maximum, child, index) =>
									protectedChildKeys.has(
										this.getCmdkResultKey(child)
									)
										? Math.max(maximum, index)
										: maximum,
								-1
							);
				const childLimit = this.resultWindow.getChildLimit(
					group.file.path,
					protectedChildIndex
				);
				const parent: CmdkFileResult = {
					...(group.fileResult ?? {
						file: group.file,
						nameMatch: null,
						pathMatch: null,
						score: group.score,
						type: "file" as const,
					}),
					childResults: children,
					expanded: children.length > this.resultWindow.collapsedChildLimit && childLimit > this.resultWindow.collapsedChildLimit,
					matchCount:
						children.length + (group.fileResult ? 1 : 0),
					previewResult: group.fileResult ? undefined : bestChild,
				};
				visible.push(parent);
				if (children.length) {
					const shownChildren = children.slice(0, childLimit);
					visible.push(
						...shownChildren.map((child) => ({
							...child,
							childOf: group.file.path,
						}))
					);
					if (
						childLimit > this.resultWindow.collapsedChildLimit &&
						shownChildren.length < children.length
					) {
						visible.push({
							filePath: group.file.path,
							label: "继续显示此文件的匹配",
							nameMatch: null,
							pathMatch: null,
							remaining: children.length - shownChildren.length,
							target: "children",
							type: "load-more",
						});
					}
				}
			}
			if (visibleGroups.length < groups.length) {
				visible.push({
					label: "继续加载文件结果",
					nameMatch: null,
					pathMatch: null,
					remaining: groups.length - visibleGroups.length,
					target: "files",
					type: "load-more",
				});
			}
			return visible;
		}

		private buildVisibleSuggestions(
			results: CmdkResult[],
			protectedResults: CmdkResult[] = [],
			skipChildProtectionPath?: string
		) {
			const pinned = results.filter(
				(result): result is SearchableCmdkResult =>
					isSearchableCmdkResult(result) && !!result.pinned
			);
		const pinnedKeys = new Set(
			pinned.map((result) => this.getSearchableResultKey(result))
		);
			const fileResults = this.buildVisibleFileResults(
				results
					.filter(
						(result): result is SearchableCmdkResult =>
							isSearchableCmdkResult(result) &&
							!result.pinned &&
							!pinnedKeys.has(this.getSearchableResultKey(result))
					),
				protectedResults,
				skipChildProtectionPath
			);
			const createResults = results.filter(isCreateCmdkResult);
			const historyResults = results.filter(
				(result): result is CmdkHistoryResult => result.type === "history"
			);
			const allRagResults = results.filter(
				(result): result is CmdkRagResult => result.type === "rag"
			);
			const ragResults: CmdkResult[] = allRagResults.slice(
				0,
				this.resultWindow.getRagLimit()
			);
			if (ragResults.length < allRagResults.length) {
				ragResults.push({
					label: "继续加载 RAG 结果",
					nameMatch: null,
					pathMatch: null,
					remaining: allRagResults.length - ragResults.length,
					target: "rag",
					type: "load-more",
				});
			}

			return [
				...this.withSection(pinned, "Pinned"),
				...this.withSection(historyResults, "History"),
				...this.withSection(ragResults, "RAG"),
				...this.withSection(fileResults, "Files"),
				...this.withSection(createResults, "Create"),
			];
		}

		private getResultSummary(results: CmdkResult[]) {
			const searchableResults = results.filter(isSearchableCmdkResult);
			const filePaths = new Set(
				searchableResults.map((result) => result.file.path)
			);
			const fileCount = filePaths.size;
			const headingCount = searchableResults.filter(
				(result) => result.type === "heading"
			).length;
			const contentCount = searchableResults.filter(
				(result) => result.type === "content"
			).length;
			const ragCount = results.filter(
				(result) => result.type === "rag"
			).length;
			const fileGroupCount = this.buildFileGroups(
				searchableResults.filter((result) => !result.pinned)
			).length;
			const visibleFileGroupCount = this.cmdkResults.filter(
				(result) =>
					result.type === "file" &&
					!result.pinned &&
					!result.childOf
			).length;
			const visibleRagCount = this.cmdkResults.filter(
				(result) => result.type === "rag"
			).length;
			return {
				contentCount,
				fileCount,
				fileGroupCount,
				headingCount,
				ragCount,
				total: fileCount + headingCount + contentCount + ragCount,
				visibleFileGroupCount,
				visibleRagCount,
			};
		}

		private renderResultSummary(results: CmdkResult[]) {
			this.resultSummaryEl?.remove();
			this.resultSummaryEl = undefined;

			const summary = this.getResultSummary(results);
			const shouldShow =
				summary.total > 0 || this.getRawQuery().length > 0;
			if (!shouldShow) return;

			const resultContainerEl = this.getCmdkResultContainer();
			this.resultSummaryEl = createDiv({
				cls: "float-search-cmdk-result-summary",
			});
				this.resultSummaryEl.createSpan({
					cls: "float-search-cmdk-result-summary-main",
					text: `${summary.total} 项结果`,
				});
				const detailsEl = this.resultSummaryEl.createSpan({
					cls: "float-search-cmdk-result-summary-detail",
				});
				detailsEl.setText(
					`${summary.fileCount} 文件 · 已显示 ${summary.visibleFileGroupCount}/${summary.fileGroupCount} 文件组` +
					(this.isRagEnabled() ? ` · RAG ${summary.visibleRagCount}/${summary.ragCount}` : "")
				);
				resultContainerEl.prepend(this.resultSummaryEl);
			}

		private findFirstVisibleSuggestionIndex(
			suggestionEls: HTMLElement[],
			visibleTop: number
		) {
			let low = 0;
			let high = suggestionEls.length - 1;
			let match = -1;

			while (low <= high) {
				const middle = Math.floor((low + high) / 2);
				if (
					suggestionEls[middle].getBoundingClientRect().bottom >
					visibleTop
				) {
					match = middle;
					high = middle - 1;
				} else {
					low = middle + 1;
				}
			}
			return match;
		}

		private getSelectedResultFallbackKey(result?: CmdkResult) {
			if (
				result?.type === "load-more" &&
				result.target === "children" &&
				result.filePath
			) {
				return `file:${result.filePath}`;
			}
			if (!result || !isSearchableCmdkResult(result) || !result.childOf) {
				return undefined;
			}
			return `file:${result.file.path}`;
		}

		private captureCmdkSuggestionViewport(
			chooser: CmdkChooser
		): SuggestionViewportSnapshot {
			const resultContainerEl = this.getCmdkResultContainer();
			const values = chooser.values ?? this.cmdkResults;
			const selectedResult = values[chooser.selectedItem ?? -1];
			if (resultContainerEl.scrollTop <= 0) {
				return captureSuggestionViewport({
					containerTop: 0,
					scrollTop: 0,
					selectedFallbackKey:
						this.getSelectedResultFallbackKey(selectedResult),
					selectedKey: selectedResult
						? this.getCmdkResultKey(selectedResult)
						: undefined,
				});
			}

			const containerRect = resultContainerEl.getBoundingClientRect();
			const summaryBottom =
				this.resultSummaryEl?.isConnected === true
					? this.resultSummaryEl.getBoundingClientRect().bottom
					: containerRect.top;
			const suggestionEls = chooser.suggestions ?? [];
			const anchorIndex = this.findFirstVisibleSuggestionIndex(
				suggestionEls,
				Math.max(containerRect.top, summaryBottom)
			);
			const anchorResult = values[anchorIndex];
			const anchorTop =
				anchorIndex >= 0
					? suggestionEls[anchorIndex]?.getBoundingClientRect().top
					: undefined;

			return captureSuggestionViewport({
				anchorFallbackKey:
					this.getSelectedResultFallbackKey(anchorResult),
				anchorKey: anchorResult
					? this.getCmdkResultKey(anchorResult)
					: undefined,
				anchorTop,
				containerTop: containerRect.top,
				scrollTop: resultContainerEl.scrollTop,
				selectedFallbackKey:
					this.getSelectedResultFallbackKey(selectedResult),
				selectedKey: selectedResult
					? this.getCmdkResultKey(selectedResult)
					: undefined,
			});
		}

		private restoreCmdkSuggestionViewport(
			chooser: CmdkChooser,
			snapshot: SuggestionViewportSnapshot,
			anchorIndex: number
		) {
			const resultContainerEl = this.getCmdkResultContainer();
			const containerRect = resultContainerEl.getBoundingClientRect();
			const anchorTop =
				anchorIndex >= 0
					? chooser.suggestions?.[anchorIndex]?.getBoundingClientRect().top
					: undefined;
			const restoredScrollTop = resolveSuggestionScrollTop(
				snapshot,
				containerRect.top,
				resultContainerEl.scrollTop,
				anchorTop
			);
			const maxScrollTop = Math.max(
				0,
				resultContainerEl.scrollHeight - resultContainerEl.clientHeight
			);
			resultContainerEl.scrollTop = Math.max(
				0,
				Math.min(restoredScrollTop, maxScrollTop)
			);
		}

		private setSortedSuggestions(
			chooser: CmdkChooser,
			results: CmdkResult[],
			preserveViewport = false,
			skipChildProtectionPath?: string
		) {
			const viewport = preserveViewport
				? this.captureCmdkSuggestionViewport(chooser)
				: null;
			const previousAnchor = viewport?.anchorKey
				? this.cmdkResults.find(
						(result) =>
							this.getCmdkResultKey(result) === viewport.anchorKey
					)
				: undefined;
			const previousSelected = viewport?.selectedKey
				? this.cmdkResults.find(
						(result) =>
							this.getCmdkResultKey(result) === viewport.selectedKey
					)
				: undefined;
			const protectedResults = [previousAnchor, previousSelected].filter(
				(result): result is CmdkResult => !!result
			);
			this.cmdkSourceResults = this.dedupeCmdkResults(results);
			this.cmdkResults = this.buildVisibleSuggestions(
				this.cmdkSourceResults,
				protectedResults,
				skipChildProtectionPath
			);
			const keys = this.cmdkResults.map((result) =>
				this.getCmdkResultKey(result)
			);
			const viewportIndexes = viewport
				? resolveSuggestionViewportIndexes(viewport, keys)
				: null;
			const renderedDirectly =
				!!viewport && !!viewportIndexes && !!chooser.renderSuggestions;
			if (viewport && viewportIndexes && chooser.renderSuggestions) {
				chooser.values = this.cmdkResults;
				chooser.selectedItem =
					viewportIndexes.selectedIndex >= 0
						? viewportIndexes.selectedIndex
						: 0;
				chooser.renderSuggestions();
			} else {
				chooser.setSuggestions(this.cmdkResults);
			}
			this.renderResultSummary(this.cmdkSourceResults);
			if (viewport && viewportIndexes) {
				if (!renderedDirectly && viewportIndexes.selectedIndex >= 0) {
					const suggestionEls = chooser.suggestions ?? [];
					suggestionEls[chooser.selectedItem ?? 0]?.classList.remove(
						"is-selected"
					);
					suggestionEls[viewportIndexes.selectedIndex]?.classList.add(
						"is-selected"
					);
					chooser.selectedItem = viewportIndexes.selectedIndex;
				}
				this.restoreCmdkSuggestionViewport(
					chooser,
					viewport,
					viewportIndexes.anchorIndex
				);
				const selectedResult =
					this.cmdkResults[chooser.selectedItem ?? 0];
				if (
					viewport.selectedKey &&
					selectedResult &&
					(this.getCmdkResultKey(selectedResult) !== viewport.selectedKey ||
						(!renderedDirectly &&
							viewportIndexes.selectedIndex > 0))
				) {
					this.onSelectedChange(selectedResult, null);
				}
			}
		}

	private withSection<T extends CmdkResult>(items: T[], section: string): T[] {
		return items.map((item, index) => ({
			...item,
			section: index === 0 ? section : undefined,
		}));
	}

		private getPinnedItemKey(item: CmdkPinnedItem) {
			if (item.type === "heading") {
				if (item.isAlias) return `alias:${item.filePath}:${item.heading ?? ""}`;
				return `${item.type}:${item.filePath}:${item.line ?? ""}:${
					item.heading ?? ""
				}`;
			}
			if (item.type === "content") {
				return `${item.type}:${item.filePath}:${item.line ?? 0}:${
					item.content ?? ""
				}`;
			}
			return `${item.type}:${item.filePath}`;
		}

		private getSearchableResultKey(result: SearchableCmdkResult) {
			if (result.type === "heading") {
				if (result.isAlias) return `alias:${result.file.path}:${result.heading}`;
				return `${result.type}:${result.file.path}:${result.line ?? ""}:${
					result.heading
				}`;
			}
			if (result.type === "content") {
				return `${result.type}:${result.file.path}:${result.line}:${
					result.content
				}`;
			}
			return `${result.type}:${result.file.path}`;
		}

		private pinnedItemMatchesResult(
			item: CmdkPinnedItem,
			result: SearchableCmdkResult
		) {
			if (item.type !== result.type || item.filePath !== result.file.path) {
				return false;
			}
			if (result.type === "heading") {
				if (!!item.isAlias !== !!result.isAlias) return false;
				return item.line != null
					? item.line === result.line && item.heading === result.heading
					: item.heading === result.heading;
			}
			if (result.type === "content") {
				return (
					item.line === result.line &&
					(!item.content || item.content === result.content)
				);
			}
			return true;
		}

		private isPinnedResult(result: SearchableCmdkResult) {
			return (this.plugin.settings.cmdkPinnedItems ?? []).some(
				(item) => this.pinnedItemMatchesResult(item, result)
			);
		}

	private resultToPinnedItem(result: SearchableCmdkResult): CmdkPinnedItem {
		return {
				type: result.type,
				filePath: result.file.path,
				isAlias: result.type === "heading" ? result.isAlias : undefined,
				heading: result.type === "heading" ? result.heading : undefined,
				headingLevel:
					result.type === "heading" ? result.level : undefined,
				content: result.type === "content" ? result.content : undefined,
				line:
					result.type === "heading" || result.type === "content"
						? result.line
						: undefined,
				query: this.getRawQuery().replace(/\s+/g, " ").trim(),
				pinnedAt: Date.now(),
			};
	}

	private pinnedItemToResult(item: CmdkPinnedItem): SearchableCmdkResult | null {
		const file = this.app.vault.getAbstractFileByPath(item.filePath);
		if (!(file instanceof TFile)) return null;

		if (item.type === "heading") {
			if (item.isAlias && !this.getSearchTitles(file).some(
				(title) => title.isAlias && title.heading === item.heading
			)) return null;
			return {
					file,
					isAlias: item.isAlias,
					heading: item.heading ?? file.basename,
					headingMatch: null,
					level: item.headingLevel,
					line: item.line,
					nameMatch: null,
					pathMatch: null,
				pinned: true,
				score: Number.MAX_SAFE_INTEGER,
				type: "heading",
			};
		}
		if (item.type === "content") {
			return {
				file,
				content: item.content ?? file.basename,
				contentMatch: null,
				line: item.line ?? 0,
				nameMatch: null,
				pathMatch: null,
				pinned: true,
				score: Number.MAX_SAFE_INTEGER,
				type: "content",
			};
		}

		return {
			file,
			nameMatch: null,
			pathMatch: null,
			pinned: true,
			score: Number.MAX_SAFE_INTEGER,
			type: "file",
		};
	}

	private getPinnedResults(
		parsed: ParsedCmdkQuery,
		query: string
	): SearchableCmdkResult[] {
		return (this.plugin.settings.cmdkPinnedItems ?? [])
			.map((item) => this.pinnedItemToResult(item))
			.filter(
				(result): result is SearchableCmdkResult =>
					!!result && this.resultMatchesCurrentQuery(result, parsed, query)
			);
	}

	private async togglePinnedResult(result: SearchableCmdkResult) {
			const item = this.resultToPinnedItem(result);
			const existing = this.plugin.settings.cmdkPinnedItems ?? [];
			const isPinned = existing.some((pinnedItem) =>
				this.pinnedItemMatchesResult(pinnedItem, result)
			);

		this.plugin.settings.cmdkPinnedItems = isPinned
				? existing.filter(
						(pinnedItem) =>
							!this.pinnedItemMatchesResult(pinnedItem, result)
					)
				: [item, ...existing].slice(0, 50);
		await this.plugin.saveSettings();
		const session = this.activeSearchSession;
		if (session && this.isCurrentSearchSession(session)) {
			this.replaceSearchResults(
				session,
				"pinned",
				this.getPinnedResults(session.parsed, session.query),
				true
			);
			this.focusSearchInputAfterAction();
			return;
		}
		this.updateSuggestions();
	}

	private getSearchHistoryResults(): CmdkHistoryResult[] {
		return (this.plugin.settings.cmdkSearchHistory ?? [])
			.slice(0, 8)
			.map((query) => ({
				nameMatch: null,
				pathMatch: null,
				query,
				type: "history" as const,
			}));
	}

	private recordSearchHistory(rawQuery: string) {
		const query = rawQuery.replace(/\s+/g, " ").trim();
		if (!query) return;

		const existing = this.plugin.settings.cmdkSearchHistory ?? [];
		this.plugin.settings.cmdkSearchHistory = [
			query,
			...existing.filter((item) => item !== query),
		].slice(0, 20);
		this.plugin.saveSettings();
	}

	updateSuggestions(force = false) {
		if (this.closed || this.isComposing || !this.bodyEl) return;
		const chooser = this.getCmdkChooser();
		const rawQuery = this.getRawQuery();
		const parsed = parseCmdkQuery(rawQuery);
		const identityKey = this.buildSearchIdentityKey(parsed, rawQuery);
		const repeatsActiveIdentity =
			this.activeSearchSession?.identity.query === identityKey;
		if (
			!force &&
			this.activeSearchSession &&
			!this.activeSearchSession.signal.aborted &&
			this.activeSearchSession.identity.query === identityKey
		) {
			return;
		}
		const catalogEntries = this.plugin.searchCatalog.snapshot();
		const session = this.createSearchSession(
			chooser,
			parsed,
			rawQuery,
			this.getCandidateFiles(parsed, catalogEntries),
			catalogEntries,
			force && repeatsActiveIdentity
		);
		this.replaceSearchResults(
			session,
			"pinned",
			this.getPinnedResults(parsed, parsed.query),
			true
		);

		const hasStructuralFilters =
			parsed.pathIncludes.length > 0 ||
			parsed.tags.length > 0 ||
			!!parsed.extensions ||
			!!parsed.types ||
			!!parsed.fields;
		if (!parsed.query.trim() && !hasStructuralFilters) {
			this.replaceSearchResults(
				session,
				"history",
				this.getSearchHistoryResults(),
				true
			);
			for (const stage of [
				"file",
				"heading",
				"content",
				"rag",
				"typo",
			] as SearchStage[]) {
				this.completeSearchStage(session, stage);
			}
			return;
		}

		const fileStage = this.runFileStage(session);
		if (parsed.query.trim().length < 2) {
			if (parsed.query.trim() && this.isTypeEnabled("heading", parsed) &&
				this.isFieldEnabled("heading", parsed)) {
				void this.runHeadingStage(session, true);
			} else {
				this.completeSearchStage(session, "heading");
			}
			this.completeSearchStage(session, "content");
			this.completeSearchStage(session, "typo");
		} else {
			this.stagedSearchTimer = window.setTimeout(async () => {
				this.stagedSearchTimer = null;
				if (!this.isCurrentSearchSession(session)) return;
				await fileStage;
				const stages: Promise<void>[] = [];
				if (
					this.isTypeEnabled("heading", parsed) &&
					this.isFieldEnabled("heading", parsed)
				) {
					stages.push(this.runHeadingStage(session));
				} else {
					this.completeSearchStage(session, "heading");
				}
				if (
					this.isTypeEnabled("content", parsed) &&
					this.isFieldEnabled("content", parsed)
				) {
					stages.push(this.runExactContentStage(session));
				} else {
					this.completeSearchStage(session, "content");
				}
				await Promise.all(stages);
				this.scheduleTypoContentSearch(session);
			}, 120);
		}

		this.runRagStage(session);
	}

	private async runFileStage(session: CmdkActiveSearchSession) {
		const { parsed, query } = session;
		if (!this.isTypeEnabled("file", parsed)) {
			this.completeSearchStage(session, "file");
			return;
		}

		const fuzzy = query.trim() ? prepareFuzzySearch(query) : null;
		const queryLower = query.trim().toLowerCase();
		let hasExactMatch = false;
		let batch: CmdkResult[] = [];
		let sliceStartedAt = performance.now();

		for (let index = 0; index < session.files.length; index++) {
			if (!this.isCurrentSearchSession(session)) return;
			const file = session.files[index];
			if (!hasExactMatch && queryLower) {
				const aliases = session.catalogEntries.get(file.path)?.aliases ??
					parseFrontMatterAliases(this.app.metadataCache.getFileCache(file)?.frontmatter) ?? [];
				hasExactMatch = aliases.some((alias) => alias.trim().toLowerCase() === queryLower);
			}
			if (!fuzzy) {
				batch.push({
					file,
					nameMatch: null,
					pathMatch: null,
					score: file.stat.mtime,
					type: "file",
				});
			} else {
				const nameMatch = this.isFieldEnabled("name", parsed)
					? fuzzy(file.basename)
					: null;
				const pathMatch = this.isFieldEnabled("path", parsed)
					? fuzzy(file.path)
					: null;
				const nameTypoMatch =
					!nameMatch &&
					this.isTypoEnabled() &&
					this.isFieldEnabled("name", parsed)
						? session.preparedTypo.match(file.basename)
						: null;
				const pathTypoMatch =
					!pathMatch &&
					this.isTypoEnabled() &&
					this.isFieldEnabled("path", parsed)
						? session.preparedTypo.match(file.path, {
								maxTextLength: 220,
							})
						: null;
				if (nameMatch || pathMatch || nameTypoMatch || pathTypoMatch) {
					hasExactMatch =
						hasExactMatch ||
						file.basename.toLowerCase() === queryLower;
					batch.push({
						file,
						nameMatch,
						pathMatch,
						score: Math.max(
							scoreCmdkText(
								query,
								file.basename,
								nameMatch?.score
							) + 300,
							scoreCmdkText(query, file.path, pathMatch?.score) *
								0.5,
							nameTypoMatch
								? nameTypoMatch.score + 160
								: -Infinity,
							pathTypoMatch
								? pathTypoMatch.score * 0.5
								: -Infinity
						),
						type: "file",
					});
				}
			}

			if (
				(index + 1) % 32 === 0 &&
				performance.now() - sliceStartedAt >= 8
			) {
				this.upsertSearchResults(session, batch);
				batch = [];
				await this.yieldSearchWork();
				sliceStartedAt = performance.now();
			}
		}

		this.upsertSearchResults(session, batch);
		if (
			query.trim() &&
			this.plugin.settings.cmdkQuickCreate &&
			!hasExactMatch
		) {
			this.replaceSearchResults(session, "create", [
				{
					createQuery: query.trim(),
					nameMatch: null,
					pathMatch: null,
					type: "create",
				},
			]);
		}
		this.completeSearchStage(session, "file");
	}

	private async runHeadingStage(session: CmdkActiveSearchSession, aliasesOnly = false) {
		const fuzzy = prepareFuzzySearch(session.query);
		let batch: CmdkResult[] = [];
		let processedHeadings = 0;
		let processedFiles = 0;
		let sliceStartedAt = performance.now();

		for (const file of session.files) {
			if (!this.isCurrentSearchSession(session)) return;
			const headings = this.getSearchTitles(file, session.catalogEntries.get(file.path), aliasesOnly);
			for (const heading of headings) {
				if (aliasesOnly && !heading.isAlias) continue;
				if (!this.isCurrentSearchSession(session)) return;
				const headingMatch = fuzzy(heading.heading);
				const typo =
					!headingMatch && this.isTypoEnabled()
						? session.preparedTypo.match(heading.heading, {
								maxTextLength: 120,
							})
						: null;
				if (headingMatch || typo) {
					batch.push({
						file,
						isAlias: heading.isAlias,
						heading: heading.heading,
						headingMatch,
						level: heading.level,
						line: heading.line,
						nameMatch: null,
						pathMatch: null,
						score: headingMatch
							? scoreCmdkText(
									session.query,
									heading.heading,
									headingMatch.score
							  ) + 120
							: (typo?.score ?? -Infinity) + 40,
						type: "heading",
					});
				}
				processedHeadings++;
				if (
					processedHeadings % 32 === 0 &&
					performance.now() - sliceStartedAt >= 8
				) {
					this.upsertSearchResults(session, batch);
					batch = [];
					await this.yieldSearchWork();
					sliceStartedAt = performance.now();
				}
			}
			if (++processedFiles % 32 === 0 && performance.now() - sliceStartedAt >= 8) {
				this.upsertSearchResults(session, batch);
				batch = [];
				await this.yieldSearchWork();
				sliceStartedAt = performance.now();
			}
		}
		this.upsertSearchResults(session, batch);
		this.completeSearchStage(session, "heading");
	}

	private async runExactContentStage(session: CmdkActiveSearchSession) {
		const simpleSearch = prepareSimpleSearch(session.query);
		let batch: CmdkResult[] = [];
		let sliceStartedAt = performance.now();

		for (const file of session.files) {
			if (!this.isCurrentSearchSession(session)) return;
			if (file.extension !== "md") continue;
			let text: string;
			try {
				text = await this.plugin.contentReadCoordinator.read(
					{
						mtime: file.stat.mtime,
						path: file.path,
						size: file.stat.size,
					},
					() => this.app.vault.cachedRead(file)
				);
			} catch {
				continue;
			}
			if (!this.isCurrentSearchSession(session)) return;
			const lines = getContentLines(text);
			let foundExactMatch = false;
			for (
				let startIndex = 0;
				startIndex < lines.length;
				startIndex += 32
			) {
				if (!this.isCurrentSearchSession(session)) return;
				const lineMatches = findAllNonHeadingLineMatches(
					lines,
					file.path,
					session.headingLinesByPath,
					simpleSearch,
					startIndex,
					startIndex + 32
				);
				foundExactMatch = foundExactMatch || lineMatches.length > 0;
				batch.push(
					...lineMatches.map((result) => ({
						content: result.lineText,
						contentMatch: result.match,
						file,
						line: result.line,
						nameMatch: null,
						pathMatch: null,
						score: scoreCmdkText(
							session.query,
							result.lineText,
							result.match.score
						),
						type: "content" as const,
					}))
				);

				if (performance.now() - sliceStartedAt >= 8) {
					this.upsertSearchResults(session, batch);
					batch = [];
					await this.yieldSearchWork();
					sliceStartedAt = performance.now();
				}
			}
			if (foundExactMatch) session.exactContentPaths.add(file.path);
		}
		this.upsertSearchResults(session, batch);
		this.completeSearchStage(session, "content");
	}

	renderSuggestion(result: CmdkResult, el: HTMLElement) {
		el.dataset.resultKey = this.getCmdkMotionKey(result);
		const groupPath = result.childOf ?? (result.type === "load-more" && result.target === "children" ? result.filePath : undefined);
		if (groupPath) el.dataset.motionGroup = `file:${groupPath}`;
		else delete el.dataset.motionGroup;
		el.addClass("mod-complex");
		if (result.section) {
			el.addClass("has-section");
			el.createDiv({
				cls: "float-search-cmdk-section",
				text: Platform.isMobile ? ({Pinned: "收藏", History: "最近搜索", Files: "搜索结果", Create: "新建"}[result.section] ?? result.section) : result.section,
			});
		}

		if (result.type === "load-more") {
			el.addClass("float-search-cmdk-load-more");
			const contentEl = el.createDiv("suggestion-content");
			contentEl.createDiv({
				cls: "suggestion-title",
				text: result.label,
			});
			contentEl.createDiv({
				cls: "suggestion-note",
				text: `${result.remaining} 项尚未显示`,
			});
			this.renderTypeBadge(el, Platform.isMobile ? "更多" : "MORE", "load-more");
			return;
		}

			if (result.type === "create") {
				el.addClass("float-search-cmdk-create-item");
				const contentEl = el.createDiv("suggestion-content");
				const titleEl = contentEl.createDiv("suggestion-title");
				titleEl.setText(Platform.isMobile ? "创建新笔记" : "Create new note");
			const noteEl = contentEl.createDiv("suggestion-note");
			const folder =
				this.plugin.settings.cmdkQuickCreateFolder || "/";
			noteEl.setText(
				`"${result.createQuery}" → ${folder}`
			);
			this.renderTypeBadge(el, Platform.isMobile ? "新建" : "CREATE", "create");
			return;
		}

		if (result.type === "history") {
			el.addClass("float-search-cmdk-history-item");
			const stopHistoryEvent = (evt: MouseEvent) => {
				evt.preventDefault();
				evt.stopPropagation();
			};
			el.addEventListener("mousedown", stopHistoryEvent, true);
			el.addEventListener(
				"click",
				(evt) => {
					stopHistoryEvent(evt);
					this.applyHistoryQuery(result.query);
				},
				true
			);
			const contentEl = el.createDiv("suggestion-content");
			const titleEl = contentEl.createDiv("suggestion-title");
			titleEl.setText(result.query);
				this.renderTypeBadge(el, Platform.isMobile ? "历史" : "HISTORY", "history");
				return;
			}

			if (result.type === "rag") {
				el.addClass("float-search-cmdk-result");
				el.addClass("float-search-cmdk-rag-item");
				el.addClass("is-rag");
				this.renderDisclosure(el, result);

				const contentEl = el.createDiv("suggestion-content");
				const titleEl = contentEl.createDiv("suggestion-title");
				titleEl.setText(result.hit.title);
				const noteEl = contentEl.createDiv("suggestion-note");
				const lineLabel =
					result.previewResult.type === "content"
						? ` · Line ${result.previewResult.line + 1}`
						: "";
				noteEl.setText(
					`${result.hit.vaultLabel} · ${result.hit.source.toUpperCase()} · ${result.hit.obsidianPath}${lineLabel}`
				);
					if (result.hit.snippet) {
						const snippetEl = contentEl.createDiv(
							"suggestion-note float-search-cmdk-rag-snippet"
						);
						snippetEl.setText(result.hit.snippet);
					}
					this.renderRagScoreBadge(el, result.hit);
					this.renderTypeBadge(el, "RAG", "rag");
					return;
				}

			const searchable = isSearchableCmdkResult(result);
			if (searchable) {
				el.addClass("float-search-cmdk-result");
				el.addClass(`is-${result.type}`);
				if (result.childOf) {
					el.addClass("is-child");
				} else if (result.type === "file") {
					el.addClass("is-file-parent");
					if (result.childResults?.length) {
						el.addClass("has-children");
					}
				}
				this.renderDisclosure(el, result);
			}

			const contentEl = el.createDiv("suggestion-content");

			if (result.type === "command") {
				const titleEl = contentEl.createDiv("suggestion-title");
				titleEl.setText(result.title);
				const noteEl = contentEl.createDiv("suggestion-note");
				noteEl.setText(result.commandId);
			} else if (result.type === "content" && result.content) {
				const titleEl = contentEl.createDiv("suggestion-title");
			if (result.contentMatch) {
				renderResults(titleEl, result.content, result.contentMatch);
			} else {
					titleEl.setText(result.content);
				}
				const noteEl = contentEl.createDiv("suggestion-note");
				noteEl.setText(
					result.childOf
						? Platform.isMobile ? `第 ${result.line + 1} 行` : `Line ${result.line + 1}`
						: result.file.path
				);
			} else if (result.type === "heading" && result.heading) {
				const titleEl = contentEl.createDiv(
					"suggestion-title float-search-cmdk-heading-title"
				);
				const headingTextEl = titleEl.createSpan(
					"float-search-cmdk-heading-text"
				);
				if (result.headingMatch) {
					renderResults(
						headingTextEl,
						result.heading,
						result.headingMatch
					);
				} else {
						headingTextEl.setText(result.heading);
					}
					this.renderHeadingLevelBadge(titleEl, result.level);
					const noteEl = contentEl.createDiv("suggestion-note");
					noteEl.setText(
					result.childOf && result.line != null
						? Platform.isMobile ? `第 ${result.line + 1} 行` : `Line ${result.line + 1}`
						: result.file.path
				);
			} else {
				const titleEl = contentEl.createDiv("suggestion-title");
				if (result.nameMatch) {
				renderResults(
					titleEl,
					result.file.basename,
					result.nameMatch
				);
			} else {
				titleEl.setText(result.file.basename);
			}

			const noteEl = contentEl.createDiv("suggestion-note");
			const parentPath = result.file.parent?.path || "/";
			if (result.pathMatch) {
				renderResults(noteEl, parentPath, result.pathMatch);
			} else {
				noteEl.setText(parentPath);
				}
			}

			if (result.type === "file") {
				this.renderMatchCount(el, result.matchCount);
			}
			if (searchable) {
				this.renderPinButton(el, result);
			}
		const typeLabels: Record<CmdkResult["type"], string> = {
			file: "FILE",
			heading: "HEADING",
			content: "CONTENT",
			command: "ACTION",
			history: "HISTORY",
			create: "CREATE",
			rag: "RAG",
			"load-more": "MORE",
		};
		this.renderTypeBadge(
			el,
			result.type === "heading" && result.isAlias
				? Platform.isMobile ? "别名" : "ALIAS"
				: Platform.isMobile ? ({file: "文件", heading: "标题", content: "正文", command: "操作", history: "历史", create: "新建", rag: "RAG", "load-more": "更多"}[result.type]) : typeLabels[result.type],
			result.type,
			isSearchableCmdkResult(result) ? result.file.extension : undefined
		);
	}

	selectSuggestion(result: CmdkResult, evt: MouseEvent | KeyboardEvent) {
		if (result.type === "history") {
			evt.preventDefault();
			evt.stopPropagation();
			this.applyHistoryQuery(result.query);
			return;
		}
		if (result.type === "load-more") {
			evt.preventDefault();
			evt.stopPropagation();
			this.loadMoreResults(result);
			return;
		}
		if (Platform.isMobile && isSearchableCmdkResult(result)) {
			evt.preventDefault(); evt.stopPropagation(); this.showMobilePreview(result); return;
		}
		super.selectSuggestion(result, evt);
	}

	onChooseSuggestion(
		result: CmdkResult,
		evt: MouseEvent | KeyboardEvent
	) {
		if (result.type === "load-more") {
			evt.preventDefault();
			evt.stopPropagation();
			this.loadMoreResults(result);
			return;
		}
		if (result.type === "create") {
			this.recordSearchHistory(this.getRawQuery());
			this.quickCreateNote(result.createQuery ?? "", evt);
			return;
		}
		if (result.type === "command") {
			return;
		}
		if (result.type === "history") {
			evt.preventDefault();
			evt.stopPropagation();
			this.applyHistoryQuery(result.query);
			return;
			}
			this.recordSearchHistory(this.getRawQuery());
			const target =
				result.type === "rag"
					? result.previewResult
					: this.getResultTarget(result);

			const leaf = Keymap.isModEvent(evt)
				? this.app.workspace.getLeaf("tab")
				: this.app.workspace.getMostRecentLeaf() ??
					this.app.workspace.getLeaf();

				const eState = this.getResultEphemeralState(target);

			const opened = leaf.openFile(target.file, {
				active: true,
				eState,
			});
			void opened.then(() => {
				const content = leaf.view?.containerEl;
				if (content?.isConnected && this.app.workspace.getMostRecentLeaf() === leaf) animateNavigation(content, "forward");
			});
	}

	private async quickCreateNote(
		content: string,
		evt: MouseEvent | KeyboardEvent
	) {
		const settings = this.plugin.settings;
		const fmt = settings.cmdkQuickCreateTitleFormat || "YYYYMMDDHHmmss";
		const title =
			sanitizePathSegment(this.formatTimestamp(new Date(), fmt)) ||
			"Untitled";

		const folderPath = this.normalizeFolderPath(
			settings.cmdkQuickCreateFolder
		);
		let file: TFile;
		try {
			if (folderPath) {
				await this.ensureFolderExists(folderPath);
			}
			const filePath = this.getAvailableQuickCreatePath(folderPath, title);
			file = await this.app.vault.create(filePath, content);
		} catch (error) {
			console.error(error);
			new Notice("Failed to create note. Check Float Search settings.");
			return;
		}

		const leaf = Keymap.isModEvent(evt)
			? this.app.workspace.getLeaf("tab")
			: this.app.workspace.getMostRecentLeaf() ??
				this.app.workspace.getLeaf();

		await leaf.setViewState({
			type: "markdown",
			state: { file: file.path },
			active: true,
		});
	}

	private normalizeFolderPath(folderPath: string) {
		return folderPath
			.replace(/\\/g, "/")
			.split("/")
			.map((part) => sanitizePathSegment(part))
			.filter(Boolean)
			.join("/");
	}

	private async ensureFolderExists(folderPath: string) {
		let current = "";
		for (const part of folderPath.split("/")) {
			current = current ? `${current}/${part}` : part;
			const existing = this.app.vault.getAbstractFileByPath(current);
			if (existing) {
				if (!(existing instanceof TFolder)) {
					throw new Error(`${current} exists and is not a folder`);
				}
				continue;
			}
			await this.app.vault.createFolder(current);
		}
	}

	private getAvailableQuickCreatePath(folderPath: string, title: string) {
		const prefix = folderPath ? `${folderPath}/` : "";
		let candidate = `${prefix}${title}.md`;
		let index = 1;
		while (this.app.vault.getAbstractFileByPath(candidate)) {
			candidate = `${prefix}${title}-${index}.md`;
			index++;
		}
		return candidate;
	}

	private formatTimestamp(date: Date, fmt: string): string {
		const pad = (n: number, len = 2) =>
			String(n).padStart(len, "0");
		const tokens: Record<string, string> = {
			YYYY: String(date.getFullYear()),
			YY: String(date.getFullYear()).slice(-2),
			MM: pad(date.getMonth() + 1),
			DD: pad(date.getDate()),
			HH: pad(date.getHours()),
			mm: pad(date.getMinutes()),
			ss: pad(date.getSeconds()),
		};
		let result = fmt;
		// Replace longest tokens first to avoid partial matches
		for (const token of ["YYYY", "YY", "MM", "DD", "HH", "mm", "ss"]) {
			result = result.split(token).join(tokens[token]);
		}
		return result;
	}

	// Called by internal Chooser on selection change
	// @ts-ignore
	onSelectedChange = debounce(
		(result: CmdkResult, _evt: Event | null) => {
			if (this.closed) return;
			this.historyPreviewLookupId++;
			if (this.isComposing) {
				this.hidePreview();
				return;
			}

			if (isSearchableCmdkResult(result)) {
				this.showPreview(result);
			} else if (result?.type === "rag") {
				this.showPreview(result.previewResult);
			} else if (result?.type === "history") {
				this.showHistoryPreview(result);
			} else {
				this.hidePreview();
			}
		},
		40
	);

	private invalidatePreviewRequest() {
		this.desktopPreviewRequest = undefined;
		this.previewRequestId++;
		this.cancelPreviewPaint?.();
		this.nativePreviewQueue.cancelPending();
		this.desktopPreview?.hide();
	}

	private hidePreview() {
		this.invalidatePreviewRequest();
		if (this.previewEl) cancelSearchMotion(this.previewEl);
		if (this.activePreviewResizePointerId != null) {
			this.finishPreviewResize(
				this.activePreviewResizePointerId,
				true
			);
		}
		this.bodyEl.removeClass("has-preview");
		this.previewResizeHandleEl?.hide();
		this.previewEl?.hide();
	}

	private restoreCmdkInputFocus(requestId: number, interactionGeneration: number) {
		if (Platform.isMobile) return;
		const restore = () => {
			if (
				this.closed ||
				this.isComposing ||
				this.isSortSelectActive ||
				interactionGeneration !== this.previewInteractionGeneration ||
				requestId !== this.previewRequestId
			) {
				return;
			}
			this.focusSearchInputAfterAction();
		};

		Promise.resolve().then(restore);
		window.requestAnimationFrame(restore);
		window.setTimeout(restore, 50);
		window.setTimeout(restore, 120);
	}

	private ensurePreviewTargetState(
		leaf: WorkspaceLeaf,
		eState: Record<string, any>,
		requestId: number
	) {
		if (this.closed || requestId !== this.previewRequestId) return;
		leaf.view.setEphemeralState(eState);
	}

	private ensurePreviewPane() {
		if (Platform.isMobile) return;
		if (this.previewEl) return;

		const resultEl = this.getCmdkResultContainer();
		if (!resultEl.id) {
			resultEl.id = `${this.filterCompletionListId}-results`;
		}
		this.previewResizeHandleEl = this.bodyEl.createDiv({
			cls: "float-search-cmdk-resize-handle",
			attr: {
				"aria-label": "调整搜索结果与预览区域宽度",
				"aria-orientation": "vertical",
				role: "separator",
				tabindex: "0",
			},
		});
		this.previewResizeHandleEl.hide();
		this.previewEl = this.bodyEl.createDiv(
			"float-search-cmdk-preview"
		);
		this.desktopNativeHost = this.previewEl.createDiv("fs-desktop-native-host");
		this.desktopPreview = new DesktopSearchPreview(this.app, this.previewEl, {
			read: file => this.plugin.contentReadCoordinator.read(
				{path: file.path, mtime: file.stat.mtime, size: file.stat.size},
				() => this.app.vault.cachedRead(file)
			),
		});
		this.previewEl.id = `${this.filterCompletionListId}-preview`;
		this.previewResizeHandleEl.setAttribute(
			"aria-controls",
			`${resultEl.id} ${this.previewEl.id}`
		);
		this.previewResizeHandleEl.addEventListener(
			"pointerdown",
			this.onPreviewResizePointerDown
		);
		this.previewResizeHandleEl.addEventListener(
			"pointermove",
			this.onPreviewResizePointerMove
		);
		this.previewResizeHandleEl.addEventListener(
			"pointerup",
			this.onPreviewResizePointerEnd
		);
		this.previewResizeHandleEl.addEventListener(
			"pointercancel",
			this.onPreviewResizePointerEnd
		);
		this.previewResizeHandleEl.addEventListener(
			"lostpointercapture",
			this.onPreviewResizeLostPointerCapture
		);
		this.previewResizeHandleEl.addEventListener(
			"keydown",
			this.onPreviewResizeKeyDown
		);
		this.applyPreviewSplitRatio(
			this.plugin.settings.cmdkPreviewSplitRatio
		);
		this.previewResizeObserver = new ResizeObserver(() => {
			if (
				this.closed ||
				this.activePreviewResizePointerId != null
			) {
				return;
			}
			this.applyPreviewSplitRatio(
				this.plugin.settings.cmdkPreviewSplitRatio
			);
		});
		this.previewResizeObserver.observe(this.bodyEl);
		const [leaf, view] = spawnLeafView(
			this.plugin,
			this.desktopNativeHost
		);
		this.fileLeaf = leaf;
		this.fileEmbeddedView = view;
		this.fileLeaf.setPinned(true);
		this.previewEl.addEventListener(
			"mousedown",
			this.onPreviewMouseDown,
			true
		);
	}

	private waitForPreviewPaint(): Promise<void> {
		this.cancelPreviewPaint?.();
		const win = this.previewEl?.ownerDocument.defaultView ?? window;
		return new Promise(resolve => {
			let frame = 0, paint = 0, fallback = 0, finished = false;
			const finish = () => {
				if (finished) return;
				finished = true;
				if (frame) win.cancelAnimationFrame(frame);
				if (paint) win.clearTimeout(paint);
				if (fallback) win.clearTimeout(fallback);
				if (this.cancelPreviewPaint === finish) this.cancelPreviewPaint = undefined;
				resolve();
			};
			this.cancelPreviewPaint = finish;
			frame = win.requestAnimationFrame(() => {frame = 0; paint = win.setTimeout(finish, 0);});
			fallback = win.setTimeout(finish, 80);
		});
	}

	async showPreview(result: SearchableCmdkResult) {
		if (this.closed) return;
		if (Platform.isMobile) return;
		if (window.matchMedia("(max-width: 720px)").matches) {
			this.hidePreview();
			return;
		}
		const target = this.getResultTarget(result);
		const file = target.file;
		const version = JSON.stringify([file.path, file.stat.mtime, file.stat.size]);
		const eState = this.getResultEphemeralState(target);
		const key = JSON.stringify([version, eState, this.inputEl?.value ?? ""]);
		const current = this.desktopPreviewRequest;
		if (current?.key === key && current.requestId === this.previewRequestId) return current.promise;

		const requestId = ++this.previewRequestId;
		const request = {key, requestId, promise: Promise.resolve()};
		this.desktopPreviewRequest = request;
		const clear = () => {
			if (this.desktopPreviewRequest === request) this.desktopPreviewRequest = undefined;
		};
		request.promise = this.loadDesktopPreview(target, eState, version, requestId).then(
			ready => {if (!ready) clear();},
			error => {clear(); throw error;},
		);
		return request.promise;
	}

	private async loadDesktopPreview(
		target: SearchableCmdkResult,
		eState: Record<string, unknown>,
		version: string,
		requestId: number
	): Promise<boolean> {
		const interactionGeneration = this.previewInteractionGeneration;
		this.cancelPreviewPaint?.();
		this.nativePreviewQueue.cancelPending();
		const previousActiveLeaf = this.app.workspace.activeLeaf;
		this.ensurePreviewPane();
		const previewEl = this.previewEl;
		if (!previewEl) return false;

		this.bodyEl.addClass("has-preview");
		this.previewResizeHandleEl?.show();
		previewEl.show();

		const file = target.file;
		if (!this.fileEmbeddedView) return false;

		const currentFile = (this.fileLeaf?.view as any)?.file as
			| TFile
			| undefined;
		const warm = this.fileLeaf && currentFile?.path === file.path &&
			this.nativePreviewVersion === version && !this.nativePreviewQueue.open && !this.fileEmbeddedView.opening;
		let leaf = warm ? this.fileLeaf : undefined;
		if (!warm) {
			await this.desktopPreview?.show(this.getContentPreviewTarget(target));
			if (this.closed || requestId !== this.previewRequestId) return false;
			if (file.extension === "md") await this.waitForPreviewPaint();
			if (this.closed || requestId !== this.previewRequestId) return false;
			try {
				leaf = await this.nativePreviewQueue.run(version, async () => {
					const ready = this.fileLeaf;
					if (ready && (ready.view as {file?: TFile}).file?.path === file.path &&
						this.nativePreviewVersion === version && !this.fileEmbeddedView?.opening) return ready;
					const loaded = await this.fileEmbeddedView?.openFile(file, {active: false, eState}, this.fileLeaf);
					if (!loaded || (loaded.view as {file?: TFile}).file?.path !== file.path) return undefined;
					this.nativePreviewVersion = version;
					return loaded;
				});
			} catch (error) {
				if (!this.closed && requestId === this.previewRequestId) console.warn("Floating Search: desktop preview", error);
				return false;
			}
		}
		if (!leaf || this.closed || requestId !== this.previewRequestId) return false;
		this.fileLeaf = leaf;
		this.desktopPreview?.hide();

		this.ensurePreviewTargetState(leaf, eState, requestId);
		if (this.closed || requestId !== this.previewRequestId) return false;
		if (this.desktopNativeHost) animateNavigation(this.desktopNativeHost);

		if (
			interactionGeneration === this.previewInteractionGeneration &&
			previousActiveLeaf &&
			this.app.workspace.activeLeaf === this.fileLeaf
		) {
			this.app.workspace.setActiveLeaf(previousActiveLeaf, {
				focus: false,
			});
		}

		if (!this.isComposing) {
			this.restoreCmdkInputFocus(requestId, interactionGeneration);
		}
		return true;
	}

	onClose() {
		cancelSearchMotion(this.modalEl);
		this.closed = true;
		this.cancelPreviewPaint?.();
		this.nativePreviewQueue.close();
		this.desktopPreview?.destroy(); this.desktopPreview = undefined;
		this.mobilePreview?.destroy(); this.mobilePreview = undefined; this.mobilePreviewResult = null;
		this.disposeMobileViewport?.();
		this.disposeMobileViewport = undefined;
		this.cancelActiveSearch();
		if (this.activePreviewResizePointerId != null) {
			this.finishPreviewResize(
				this.activePreviewResizePointerId,
				true
			);
		}
		this.previewResizeObserver?.disconnect();
		this.previewResizeObserver = undefined;
		this.removePreviewResizeListeners();
		this.previewResizeHandleEl = undefined;
		if (this.scrollLoadRaf != null) {
			window.cancelAnimationFrame(this.scrollLoadRaf);
			this.scrollLoadRaf = null;
		}
		this.getCmdkResultContainer().removeEventListener(
			"scroll",
			this.onResultScroll
		);
		this.getCmdkResultContainer().removeEventListener(RESULT_MOTION_END_EVENT, this.onResultScroll);
		this.hidePreview();
		this.inputEl.removeEventListener(
			"compositionstart",
			this.onCompositionStart
		);
		this.inputEl.removeEventListener(
			"compositionend",
			this.onCompositionEnd
		);
		this.inputEl.removeEventListener("input", this.onFilterInput);
		this.inputEl.removeEventListener("focus", this.onFilterFocus);
		this.inputEl.removeEventListener(
			"keydown",
			this.onFilterKeyDown,
			true
		);
		this.closeFilterCompletions();
		this.activeFilterTokens = [];
		this.isComposing = false;
		this.isSortSelectActive = false;
		this.previewEl?.removeEventListener(
			"mousedown",
			this.onPreviewMouseDown,
			true
		);
		this.fileEmbeddedView?.hide();
		if (Platform.isMobile) super.onClose();
	}
}
