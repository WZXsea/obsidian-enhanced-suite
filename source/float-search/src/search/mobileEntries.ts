import type {App, Menu, Plugin, View} from "obsidian";

type ActionView = View & {addAction(icon: string, title: string, callback: () => void): HTMLElement};

/** Public view actions and file menus expose the same command on phones/tablets. */
export function registerMobileSearchEntries(plugin: Plugin, app: App, open: () => void): void {
	const actions = new Map<ActionView, HTMLElement>();
	let alive = true;
	const refresh = () => {
		if (!alive) return;
		const views = new Set(app.workspace.getLeavesOfType("markdown").map(leaf => leaf.view as ActionView));
		for (const [view, action] of actions) {
			if (!views.has(view) || !action.isConnected) {action.remove(); actions.delete(view);}
		}
		for (const view of views) {
			if (actions.has(view) || !view.containerEl.isConnected || typeof view.addAction !== "function") continue;
			const action = view.addAction("search", "快速搜索", open);
			action.classList.add("float-search-mobile-header-action");
			action.setAttribute("aria-label", "快速搜索");
			actions.set(view, action);
		}
	};
	plugin.registerEvent(app.workspace.on("layout-change", refresh));
	plugin.registerEvent(app.workspace.on("active-leaf-change", refresh));
	plugin.registerEvent(app.workspace.on("file-open", refresh));
	plugin.registerEvent(app.workspace.on("file-menu", (menu: Menu) => {
		menu.addItem(item => item.setTitle("快速搜索").setIcon("search").onClick(open));
	}));
	app.workspace.onLayoutReady(refresh);
	plugin.register(() => {alive = false; for (const action of actions.values()) action.remove(); actions.clear();});
}
