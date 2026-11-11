var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  OutlineController: () => OutlineController,
  default: () => TransparentOutline
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/mobile-actions.ts
function mobileQuickActions(searchLoaded, imagesLoaded) {
  const result = [];
  if (searchLoaded) result.push("search");
  if (imagesLoaded) result.push("images");
  result.push("outline");
  return result;
}
function runMobileQuickAction(action, execute, toggleOutline) {
  if (action === "outline") {
    toggleOutline();
    return true;
  }
  if (action === "images") return execute("obsidian-image-toolkit:open");
  return execute("float-search:open-mobile-search") || execute("float-search:open-cmdk-search");
}
function mobileKeyboardVisible(layoutHeight, visibleHeight) {
  return layoutHeight > 0 && visibleHeight > 0 && layoutHeight - visibleHeight > 120;
}
function outlineDepth(desktopDepth, mobileDepth, mobile) {
  const value = mobile ? mobileDepth != null ? mobileDepth : 2 : desktopDepth;
  return Math.max(1, Math.min(6, Math.round(value)));
}
function mobileQuickBarBottom(hostBottom, visibleBottom, bars) {
  let bottom = Math.max(96, hostBottom - visibleBottom + 8);
  for (const rect of bars) {
    if (rect.width <= 0 || rect.height <= 0 || rect.top >= visibleBottom || rect.bottom < visibleBottom - 200) continue;
    bottom = Math.max(bottom, hostBottom - rect.top + 8);
  }
  return Math.ceil(bottom);
}

// src/main.ts
var DEFAULTS = { mode: "hover", width: 240, opacity: 0.74, background: "auto", narrowWidth: 900, shade: 0.82, blur: 16, depth: 6, mobileDepth: 2 };
var TransparentOutline = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", { ...DEFAULTS });
    __publicField(this, "controllers", /* @__PURE__ */ new Map());
    __publicField(this, "mobileControls", /* @__PURE__ */ new Map());
    __publicField(this, "refreshTimer", null);
    __publicField(this, "disposed", false);
  }
  async onload() {
    var _a, _b;
    const saved = await this.loadData();
    this.settings = {
      mode: ["hover", "pinned", "off"].includes((_a = saved == null ? void 0 : saved.mode) != null ? _a : "") ? saved.mode : "hover",
      width: typeof (saved == null ? void 0 : saved.width) === "number" && Number.isFinite(saved.width) ? Math.max(160, Math.min(360, saved.width)) : 240,
      opacity: typeof (saved == null ? void 0 : saved.opacity) === "number" && Number.isFinite(saved.opacity) ? Math.max(0.35, Math.min(1, saved.opacity)) : 0.74,
      background: ["auto", "transparent", "frosted", "tinted"].includes((_b = saved == null ? void 0 : saved.background) != null ? _b : "") ? saved.background : "auto",
      narrowWidth: typeof (saved == null ? void 0 : saved.narrowWidth) === "number" && Number.isFinite(saved.narrowWidth) ? Math.max(480, Math.min(1400, saved.narrowWidth)) : 900,
      shade: typeof (saved == null ? void 0 : saved.shade) === "number" && Number.isFinite(saved.shade) ? Math.max(0.45, Math.min(0.95, saved.shade)) : 0.82,
      blur: typeof (saved == null ? void 0 : saved.blur) === "number" && Number.isFinite(saved.blur) ? Math.max(4, Math.min(28, saved.blur)) : 16,
      depth: typeof (saved == null ? void 0 : saved.depth) === "number" && Number.isFinite(saved.depth) ? Math.max(1, Math.min(6, Math.round(saved.depth))) : 6,
      mobileDepth: typeof (saved == null ? void 0 : saved.mobileDepth) === "number" && Number.isFinite(saved.mobileDepth) ? Math.max(1, Math.min(6, Math.round(saved.mobileDepth))) : 2
    };
    for (const mode of ["hover", "pinned", "off"]) this.addCommand({ id: `mode-${mode}`, name: { hover: "\u60AC\u505C\u663E\u793A\u5927\u7EB2", pinned: "\u5E38\u5F00\u5927\u7EB2", off: "\u5173\u95ED\u5927\u7EB2" }[mode], callback: () => void this.setMode(mode) });
    this.addCommand({ id: "cycle-mode", name: "\u5207\u6362\u5927\u7EB2\u663E\u793A\u65B9\u5F0F", callback: () => void this.setMode(this.settings.mode === "hover" ? "pinned" : this.settings.mode === "pinned" ? "off" : "hover") });
    this.addCommand({ id: "toggle-current-outline", name: "\u6253\u5F00\u6216\u6536\u8D77\u5F53\u524D\u6587\u7AE0\u76EE\u5F55", callback: () => {
      const view = this.currentView();
      if (view) void this.toggleForView(view);
    } });
    this.addCommand({ id: "open-native-outline", name: "\u6253\u5F00\u53F3\u4FA7\u5B8C\u6574\u76EE\u5F55", callback: () => void this.openNativeOutline() });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, _file, _source, leaf) => {
      if (!import_obsidian.Platform.isMobile) return;
      const view = (leaf == null ? void 0 : leaf.view) instanceof import_obsidian.MarkdownView ? leaf.view : this.currentView();
      if (view) menu.addItem((item) => item.setTitle("\u6253\u5F00\u6587\u7AE0\u76EE\u5F55").setIcon("list-tree").onClick(() => void this.openForView(view)));
      menu.addItem((item) => item.setTitle("\u6253\u5F00\u53F3\u4FA7\u5B8C\u6574\u76EE\u5F55").setIcon("panel-right").onClick(() => void this.openNativeOutline()));
    }));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.scheduleRefresh()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.scheduleRefresh()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.scheduleRefresh()));
    this.registerEvent(this.app.metadataCache.on("changed", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("rename", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("delete", () => this.scheduleRefresh()));
    this.addSettingTab(new OutlineSettings(this));
    this.app.workspace.onLayoutReady(() => {
      if (!this.disposed) this.refreshAll();
    });
  }
  scheduleRefresh() {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.refreshAll();
    }, 100);
  }
  refreshAll() {
    if (this.disposed) return;
    const views = /* @__PURE__ */ new Set();
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof import_obsidian.MarkdownView && leaf.view.file && leaf.view.containerEl.isConnected) views.add(leaf.view);
    });
    for (const [view, controls] of this.mobileControls) if (!import_obsidian.Platform.isMobile || !views.has(view)) {
      controls.destroy();
      this.mobileControls.delete(view);
    }
    if (import_obsidian.Platform.isMobile) for (const view of views) {
      let controls = this.mobileControls.get(view);
      if (!controls) {
        controls = new MobileOutlineControls(this, view);
        this.mobileControls.set(view, controls);
      }
      controls.refresh();
    }
    for (const [view, controller] of this.controllers) if (!views.has(view) || this.settings.mode === "off") {
      controller.destroy();
      this.controllers.delete(view);
    }
    if (this.settings.mode === "off") return;
    for (const view of views) {
      let controller = this.controllers.get(view);
      if (!controller) {
        controller = new OutlineController(this, view);
        this.controllers.set(view, controller);
      }
      controller.refresh();
    }
  }
  async setMode(mode) {
    this.settings.mode = mode;
    this.refreshAll();
    await this.saveData(this.settings);
  }
  currentView() {
    var _a, _b, _c;
    return (_c = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView)) != null ? _c : ((_a = this.app.workspace.getMostRecentLeaf()) == null ? void 0 : _a.view) instanceof import_obsidian.MarkdownView ? (_b = this.app.workspace.getMostRecentLeaf()) == null ? void 0 : _b.view : null;
  }
  async toggleForView(view) {
    if (this.settings.mode === "off") await this.setMode("hover");
    this.refreshAll();
    const controller = this.controllers.get(view);
    if (!controller) return;
    if (import_obsidian.Platform.isMobile) controller.setMobileOpen(!controller.isMobileOpen);
    else await this.setMode(this.settings.mode === "pinned" ? "hover" : "pinned");
  }
  async openForView(view) {
    var _a;
    if (this.settings.mode === "off") await this.setMode("hover");
    this.refreshAll();
    if (import_obsidian.Platform.isMobile) (_a = this.controllers.get(view)) == null ? void 0 : _a.setMobileOpen(true);
    else await this.setMode("pinned");
  }
  updateMobileControls(view) {
    var _a;
    (_a = this.mobileControls.get(view)) == null ? void 0 : _a.updateState();
  }
  async openNativeOutline() {
    var _a, _b;
    try {
      const manager = this.app.plugins;
      const type = ((_a = manager == null ? void 0 : manager.getPlugin) == null ? void 0 : _a.call(manager, "obsidian-quiet-outline")) ? "quiet-outline" : "outline";
      const leaf = (_b = this.app.workspace.getLeavesOfType(type).find((item) => item.getRoot() === this.app.workspace.rightSplit)) != null ? _b : this.app.workspace.getRightLeaf(false);
      if (!leaf) return void 0;
      try {
        await leaf.setViewState({ type, active: true });
      } catch (e) {
        await leaf.setViewState({ type: "outline", active: true });
      }
      await this.app.workspace.revealLeaf(leaf);
      return leaf;
    } catch (e) {
      new import_obsidian.Notice("\u5728\u6838\u5FC3\u63D2\u4EF6\u4E2D\u542F\u7528\u201C\u5927\u7EB2\u201D\u540E\uFF0C\u53EF\u6253\u5F00\u53F3\u4FA7\u539F\u751F\u5927\u7EB2\u3002");
    }
    return void 0;
  }
  setDepth(depth, persist = true) {
    if (import_obsidian.Platform.isMobile) this.settings.mobileDepth = Math.max(1, Math.min(6, Math.round(depth)));
    else this.settings.depth = Math.max(1, Math.min(6, Math.round(depth)));
    for (const controller of this.controllers.values()) controller.applyDepth();
    if (persist) void this.saveData(this.settings);
  }
  getDepth() {
    return outlineDepth(this.settings.depth, this.settings.mobileDepth, import_obsidian.Platform.isMobile);
  }
  onunload() {
    this.disposed = true;
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    for (const controller of this.controllers.values()) controller.destroy();
    this.controllers.clear();
    for (const controls of this.mobileControls.values()) controls.destroy();
    this.mobileControls.clear();
  }
};
var MobileOutlineControls = class {
  constructor(plugin, view) {
    this.plugin = plugin;
    this.view = view;
    __publicField(this, "bar");
    __publicField(this, "header");
    __publicField(this, "listeners", []);
    __publicField(this, "observer");
    __publicField(this, "resizeObserver");
    __publicField(this, "actionSignature", "");
    __publicField(this, "layoutHeight");
    __publicField(this, "layoutWidth");
    var _a;
    const doc = view.containerEl.ownerDocument, win = (_a = doc.defaultView) != null ? _a : window;
    view.containerEl.addClass("to-mobile-quick-host");
    this.layoutHeight = win.innerHeight;
    this.layoutWidth = win.innerWidth;
    this.header = view.addAction("list-tree", "\u76EE\u5F55", () => void plugin.toggleForView(view));
    this.header.addClass("to-outline-header-action");
    this.header.setAttribute("aria-label", "\u6253\u5F00\u6216\u6536\u8D77\u6587\u7AE0\u76EE\u5F55");
    this.header.dataset.action = "outline";
    this.header.setText("\u76EE\u5F55");
    this.bar = view.containerEl.createDiv({ cls: "to-mobile-quickbar", attr: { role: "toolbar", "aria-label": "\u6587\u7AE0\u5FEB\u6377\u529F\u80FD" } });
    const update = () => this.updateState();
    for (const [target, type] of [[win, "resize"], [win.visualViewport, "resize"], [win.visualViewport, "scroll"]]) {
      if (!target) continue;
      target.addEventListener(type, update);
      this.listeners.push(() => target.removeEventListener(type, update));
    }
    this.observer = new MutationObserver(update);
    this.observer.observe(doc.body, { childList: true });
    this.resizeObserver = new ResizeObserver(update);
    this.resizeObserver.observe(view.containerEl);
    for (const element of Array.from(doc.querySelectorAll(".mobile-navbar,.mobile-toolbar,.mobile-toolbar-container,.mobile-toolbar-options-container"))) this.resizeObserver.observe(element);
  }
  refresh() {
    const manager = this.plugin.app.plugins;
    const loaded = (id) => {
      var _a, _b, _c;
      return !!((_c = (_a = manager == null ? void 0 : manager.getPlugin) == null ? void 0 : _a.call(manager, id)) != null ? _c : (_b = manager == null ? void 0 : manager.plugins) == null ? void 0 : _b[id]);
    };
    const actions = mobileQuickActions(loaded("float-search"), loaded("obsidian-image-toolkit"));
    const signature = actions.join(",");
    if (signature !== this.actionSignature) {
      this.actionSignature = signature;
      this.bar.empty();
      const names = { search: "\u641C\u7D22", images: "\u56FE\u7247", outline: "\u76EE\u5F55" };
      for (const action of actions) {
        const button = this.bar.createEl("button", { text: names[action], cls: `to-mobile-quick-${action}`, attr: { type: "button", "aria-label": `\u6253\u5F00${names[action]}`, "data-action": action } });
        button.addEventListener("pointerdown", (event) => event.preventDefault());
        button.addEventListener("click", (event) => {
          var _a;
          event.preventDefault();
          event.stopPropagation();
          if (action !== "outline") (_a = this.plugin.controllers.get(this.view)) == null ? void 0 : _a.setMobileOpen(false);
          this.plugin.app.workspace.setActiveLeaf(this.view.leaf, { focus: false });
          const execute = (id) => this.plugin.app.commands.executeCommandById(id);
          runMobileQuickAction(action, execute, () => void this.plugin.toggleForView(this.view));
        });
      }
    }
    this.updateState();
  }
  updateState() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const doc = this.bar.ownerDocument, win = (_a = doc.defaultView) != null ? _a : window;
    if (Math.abs(win.innerWidth - this.layoutWidth) > 100) {
      this.layoutWidth = win.innerWidth;
      this.layoutHeight = win.innerHeight;
    }
    this.layoutHeight = Math.max(this.layoutHeight, win.innerHeight);
    const keyboard = mobileKeyboardVisible(this.layoutHeight, (_c = (_b = win.visualViewport) == null ? void 0 : _b.height) != null ? _c : win.innerHeight);
    const modal = !!doc.querySelector(".modal-container");
    this.bar.hidden = keyboard || modal;
    const nativeBars = Array.from(doc.querySelectorAll(".mobile-navbar,.mobile-toolbar,.mobile-toolbar-container,.mobile-toolbar-options-container")).filter((element) => {
      const style = win.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    }).map((element) => element.getBoundingClientRect());
    const visibleBottom = ((_e = (_d = win.visualViewport) == null ? void 0 : _d.offsetTop) != null ? _e : 0) + ((_g = (_f = win.visualViewport) == null ? void 0 : _f.height) != null ? _g : win.innerHeight);
    const bottom = `${mobileQuickBarBottom(this.view.containerEl.getBoundingClientRect().bottom, visibleBottom, nativeBars)}px`;
    if (this.view.containerEl.style.getPropertyValue("--to-quickbar-bottom") !== bottom) this.view.containerEl.style.setProperty("--to-quickbar-bottom", bottom);
    const open = (_i = (_h = this.plugin.controllers.get(this.view)) == null ? void 0 : _h.isMobileOpen) != null ? _i : false;
    this.header.setAttribute("aria-expanded", String(open));
    (_j = this.bar.querySelector(".to-mobile-quick-outline")) == null ? void 0 : _j.setAttribute("aria-pressed", String(open));
  }
  destroy() {
    this.observer.disconnect();
    this.resizeObserver.disconnect();
    this.listeners.forEach((remove) => remove());
    this.header.remove();
    this.bar.remove();
    this.view.containerEl.removeClass("to-mobile-quick-host");
    this.view.containerEl.style.removeProperty("--to-quickbar-bottom");
  }
};
var OutlineController = class {
  constructor(plugin, view) {
    this.plugin = plugin;
    this.view = view;
    __publicField(this, "root");
    __publicField(this, "list");
    __publicField(this, "headings", []);
    __publicField(this, "activeIndex", -1);
    __publicField(this, "collapsed", /* @__PURE__ */ new Set());
    __publicField(this, "expanded", /* @__PURE__ */ new Set());
    __publicField(this, "depths", []);
    __publicField(this, "rowAnimations", /* @__PURE__ */ new Map());
    __publicField(this, "depthInput");
    __publicField(this, "depthLabel");
    __publicField(this, "depthControl");
    __publicField(this, "signature", "");
    __publicField(this, "filePath", "");
    __publicField(this, "listeners", []);
    __publicField(this, "observer");
    __publicField(this, "resizeObserver");
    __publicField(this, "themeObserver");
    __publicField(this, "timer", null);
    __publicField(this, "frame", null);
    __publicField(this, "destroyed", false);
    __publicField(this, "isMobileOpen", false);
    view.containerEl.addClass("to-outline-host");
    this.root = view.containerEl.createDiv({ cls: "to-outline", attr: { "aria-label": "\u6587\u7AE0\u5927\u7EB2" } });
    const edge = this.root.createEl("button", { cls: "to-outline-edge", attr: { "aria-label": "\u663E\u793A\u6587\u7AE0\u5927\u7EB2", title: "\u663E\u793A\u6587\u7AE0\u5927\u7EB2" } });
    edge.setText(import_obsidian.Platform.isMobile ? "\u76EE\u5F55" : "\u22EE");
    edge.setAttribute("aria-expanded", "false");
    edge.dataset.action = "outline";
    const toolbar = this.root.createDiv("to-outline-tools");
    toolbar.createSpan({ cls: "to-outline-caption", text: "\u5C55\u5F00\u5C42\u7EA7" });
    this.depthLabel = toolbar.createSpan({ cls: "to-outline-depth-value" });
    const mode = toolbar.createEl("button", { cls: "to-outline-mode", attr: { "aria-label": "\u5207\u6362\u60AC\u505C\u6216\u5E38\u5F00", title: "\u5207\u6362\u60AC\u505C\u6216\u5E38\u5F00" } });
    mode.setText("\u25C9");
    if (import_obsidian.Platform.isMobile) {
      const close = toolbar.createEl("button", { cls: "to-outline-close", text: "\u5173\u95ED", attr: { type: "button", "aria-label": "\u5173\u95ED\u6587\u7AE0\u76EE\u5F55", "data-action": "close-outline" } });
      this.listen(close, "click", () => this.setMobileOpen(false));
    }
    this.depthControl = this.root.createDiv("to-outline-depth");
    const track = this.depthControl.createDiv("to-outline-depth-track");
    track.createDiv("to-outline-depth-fill");
    const stops = track.createDiv("to-outline-depth-stops");
    for (let level = 1; level <= 6; level++) stops.createSpan({ cls: "to-outline-depth-stop", attr: { "data-depth": String(level) } });
    this.depthInput = track.createEl("input", { cls: "to-outline-depth-range", attr: { type: "range", min: "1", max: "6", step: "1", "aria-label": "\u5927\u7EB2\u5C55\u5F00\u5C42\u7EA7" } });
    const labels = this.depthControl.createDiv("to-outline-depth-labels");
    for (let level = 1; level <= 6; level++) {
      const button = labels.createEl("button", { text: String(level), attr: { "aria-label": `\u5C55\u5F00\u81F3\u7B2C ${level} \u5C42`, title: `\u5C55\u5F00\u81F3\u7B2C ${level} \u5C42` } });
      this.listen(button, "click", (event) => {
        if (event.detail > 0) button.blur();
        plugin.setDepth(level);
      });
    }
    this.listen(this.depthInput, "input", () => plugin.setDepth(Number(this.depthInput.value), false));
    this.listen(this.depthInput, "change", () => void plugin.saveData(plugin.settings));
    this.listen(this.depthInput, "pointerdown", () => {
      this.clearTimer();
      this.root.addClass("is-adjusting");
      this.root.addClass("is-revealed");
    });
    this.listen(this.depthInput, "pointerup", (event) => {
      this.root.removeClass("is-adjusting");
      if (event.pointerType !== "") this.depthInput.blur();
      if (!import_obsidian.Platform.isMobile && !this.root.matches(":hover")) this.root.removeClass("is-revealed");
    });
    this.listen(this.depthInput, "pointercancel", () => {
      this.root.removeClass("is-adjusting");
      if (!import_obsidian.Platform.isMobile) this.root.removeClass("is-revealed");
    });
    this.list = this.root.createEl("nav", { cls: "to-outline-list", attr: { "aria-label": "\u6807\u9898\u5BFC\u822A" } });
    this.listen(mode, "click", (event) => {
      if (event.detail > 0) mode.blur();
      void plugin.setMode(plugin.settings.mode === "hover" ? "pinned" : "hover");
    });
    this.listen(edge, "click", (event) => {
      if (event.detail > 0) edge.blur();
      if (import_obsidian.Platform.isMobile) this.setMobileOpen(!this.isMobileOpen);
      else void plugin.setMode(plugin.settings.mode === "hover" ? "pinned" : "hover");
    });
    this.listen(this.root, "pointerenter", () => {
      if (import_obsidian.Platform.isMobile) return;
      this.clearTimer();
      this.root.removeClass("is-dismissed");
      this.root.addClass("is-revealed");
    });
    this.listen(this.root, "pointerleave", () => {
      if (import_obsidian.Platform.isMobile || this.root.classList.contains("is-adjusting")) return;
      this.clearTimer();
      this.root.removeClass("is-dismissed");
      this.timer = window.setTimeout(() => {
        this.root.removeClass("is-revealed");
        this.timer = null;
      }, 180);
    });
    this.listen(this.root, "keydown", (event) => {
      if (event.key === "Escape") {
        if (import_obsidian.Platform.isMobile) this.setMobileOpen(false);
        else {
          this.clearTimer();
          this.root.removeClass("is-expanded");
          this.root.removeClass("is-revealed");
          this.root.addClass("is-dismissed");
        }
        event.target.blur();
      }
    });
    if (import_obsidian.Platform.isMobile) {
      const outside = (event) => {
        const target = event.target;
        if (this.isMobileOpen && target && !this.root.contains(target) && !target.closest(".to-mobile-quickbar,.to-outline-header-action")) this.setMobileOpen(false);
      };
      const doc = this.root.ownerDocument;
      doc.addEventListener("pointerdown", outside, true);
      this.listeners.push(() => doc.removeEventListener("pointerdown", outside, true));
    }
    this.listen(view.containerEl, "scroll", () => this.scheduleActive(), true);
    this.listen(view.containerEl, "keyup", () => this.scheduleActive());
    this.listen(view.containerEl, "mouseup", () => this.scheduleActive());
    this.observer = new MutationObserver((records) => {
      if (records.some((r) => !this.root.contains(r.target))) this.scheduleActive();
    });
    this.observer.observe(view.containerEl, { childList: true, subtree: true });
    this.resizeObserver = new ResizeObserver(() => {
      this.updateAppearance();
      this.scheduleActive();
    });
    this.resizeObserver.observe(view.containerEl);
    this.themeObserver = new MutationObserver(() => this.updateAppearance());
    this.themeObserver.observe(this.root.ownerDocument.body, { attributes: true, attributeFilter: ["class"] });
  }
  listen(el, type, handler, capture = false) {
    el.addEventListener(type, handler, capture);
    this.listeners.push(() => el.removeEventListener(type, handler, capture));
  }
  clearTimer() {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }
  setMobileOpen(open) {
    var _a;
    this.clearTimer();
    this.isMobileOpen = open;
    this.root.toggleClass("is-mobile-open", open);
    this.root.removeClass("is-dismissed");
    (_a = this.root.querySelector(".to-outline-edge")) == null ? void 0 : _a.setAttribute("aria-expanded", String(open));
    this.plugin.updateMobileControls(this.view);
  }
  refresh() {
    var _a, _b, _c;
    if (this.destroyed) return;
    const file = this.view.file;
    if (!file) return;
    const headings = (_b = (_a = this.plugin.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.headings) != null ? _b : [];
    const sig = file.path + "\n" + JSON.stringify(headings.map((h) => [h.heading, h.level, h.position.start.line]));
    if (import_obsidian.Platform.isMobile && this.root.dataset.mode !== this.plugin.settings.mode) this.setMobileOpen(this.plugin.settings.mode === "pinned");
    this.root.dataset.mode = this.plugin.settings.mode;
    this.root.dataset.mobile = String(import_obsidian.Platform.isMobile);
    this.root.style.setProperty("--to-width", `${this.plugin.settings.width}px`);
    this.root.style.setProperty("--to-opacity", String(this.plugin.settings.opacity));
    this.updateAppearance();
    (_c = this.root.querySelector(".to-outline-mode")) == null ? void 0 : _c.setAttribute("aria-pressed", String(this.plugin.settings.mode === "pinned"));
    if (sig !== this.signature) {
      this.collapsed.clear();
      this.expanded.clear();
      if (file.path !== this.filePath) {
        this.activeIndex = -1;
        this.list.scrollTop = 0;
      }
      this.filePath = file.path;
      this.signature = sig;
      this.headings = headings;
      this.render();
    }
    this.syncDepthControl();
    this.scheduleActive();
  }
  updateAppearance() {
    if (this.destroyed) return;
    const settings = this.plugin.settings;
    const scroller = this.view.getMode() === "source" ? this.view.containerEl.querySelector(".cm-scroller") : this.view.containerEl.querySelector(".markdown-preview-view");
    const gutter = scroller ? Math.max(15, scroller.offsetWidth - scroller.clientWidth) : 15;
    this.root.style.setProperty("--to-scrollbar-gutter", `${gutter}px`);
    if (this.view.containerEl.getBoundingClientRect().width === 0) this.settleAnimations();
    this.root.dataset.background = settings.background;
    const dark = this.root.ownerDocument.body.classList.contains("theme-dark");
    this.root.dataset.surface = settings.background === "auto" ? dark || this.view.containerEl.getBoundingClientRect().width < settings.narrowWidth ? "frosted" : "transparent" : settings.background;
    this.root.style.setProperty("--to-shade", `${settings.shade * 100}%`);
    this.root.style.setProperty("--to-blur", `${settings.blur}px`);
  }
  syncDepthControl() {
    const depth = this.plugin.getDepth();
    this.depthInput.value = String(depth);
    this.depthInput.setAttribute("aria-valuetext", depth === 6 ? "\u5C55\u5F00\u5168\u90E8\u5C42\u7EA7" : `\u5C55\u5F00\u81F3\u7B2C ${depth} \u5C42`);
    this.depthLabel.setText(depth === 6 ? "\u5168\u90E8" : `${depth} \u5C42`);
    this.depthControl.style.setProperty("--to-depth-progress", `${(depth - 1) * 20}%`);
    this.depthControl.querySelectorAll("[data-depth]").forEach((el) => {
      const value = Number(el.dataset.depth);
      el.toggleClass("is-selected", value === depth);
      el.toggleClass("is-passed", value < depth);
    });
    this.depthControl.querySelectorAll("button").forEach((button, index) => button.setAttribute("aria-pressed", String(index + 1 === depth)));
  }
  applyDepth() {
    this.collapsed.clear();
    this.expanded.clear();
    this.syncDepthControl();
    this.applyVisibility();
    this.paintActive();
  }
  folded(index) {
    return this.collapsed.has(index) || this.depths[index] >= this.plugin.getDepth() && !this.expanded.has(index);
  }
  render() {
    for (const animation of this.rowAnimations.values()) animation.cancel();
    this.rowAnimations.clear();
    const scroll = this.list.scrollTop;
    this.list.empty();
    if (!this.headings.length) this.list.createDiv({ cls: "to-outline-empty", text: "\u5F53\u524D\u6587\u7AE0\u6682\u65E0\u6807\u9898" });
    const parents = [];
    this.depths = [];
    this.headings.forEach((heading, index) => {
      var _a;
      while (parents.length && this.headings[parents[parents.length - 1]].level >= heading.level) parents.pop();
      this.depths[index] = parents.length + 1;
      parents.push(index);
      const row = this.list.createDiv({ cls: "to-outline-row", attr: { "data-index": String(index), "data-level": String(heading.level) } });
      row.style.setProperty("--to-level", String(this.depths[index] - 1));
      const child = ((_a = this.headings[index + 1]) == null ? void 0 : _a.level) > heading.level;
      if (child) {
        const toggle = row.createEl("button", { cls: "to-outline-fold", text: "\u203A", attr: { "aria-label": `\u6298\u53E0\u6216\u5C55\u5F00 ${heading.heading}`, "aria-expanded": String(!this.collapsed.has(index)) } });
        toggle.addEventListener("click", (event) => {
          if (event.detail > 0) toggle.blur();
          if (this.folded(index)) {
            this.collapsed.delete(index);
            this.expanded.add(index);
          } else {
            this.collapsed.add(index);
            this.expanded.delete(index);
          }
          this.applyVisibility();
          this.paintActive();
        });
      } else row.createSpan("to-outline-fold-space");
      const link = row.createEl("button", { cls: "to-outline-link", text: heading.heading, attr: { title: heading.heading, "aria-label": `H${heading.level} ${heading.heading}` } });
      link.addEventListener("click", (event) => {
        if (event.detail > 0) link.blur();
        this.jump(index);
      });
    });
    this.applyVisibility(false);
    this.paintActive();
    this.list.scrollTop = scroll;
  }
  settleAnimations() {
    for (const [row, animation] of this.rowAnimations) {
      animation.cancel();
      row.hidden = row.dataset.collapsed === "true";
      row.removeClass("is-animating");
    }
    this.rowAnimations.clear();
  }
  applyVisibility(animate = true) {
    var _a, _b;
    const parents = [];
    const changes = [];
    const motion = animate && !((_a = this.root.ownerDocument.defaultView) == null ? void 0 : _a.matchMedia("(prefers-reduced-motion: reduce)").matches) && this.root.getBoundingClientRect().width > 0 && getComputedStyle(this.list).visibility === "visible";
    this.headings.forEach((h, i) => {
      while (parents.length && this.headings[parents[parents.length - 1]].level >= h.level) parents.pop();
      const row = this.list.children[i];
      if (row) {
        const hidden = parents.some((p) => this.folded(p));
        const toggle = row.querySelector(".to-outline-fold");
        if (toggle) {
          toggle.setText("\u203A");
          toggle.setAttribute("aria-expanded", String(!this.folded(i)));
        }
        if (row.dataset.collapsed !== String(hidden)) {
          const style = getComputedStyle(row);
          changes.push({ row, hidden, height: row.hidden ? 0 : row.getBoundingClientRect().height, opacity: row.hidden ? "0" : style.opacity, marginTop: row.hidden ? "0px" : style.marginTop, marginBottom: row.hidden ? "0px" : style.marginBottom, transform: row.hidden ? "translateY(-3px)" : style.transform });
        }
      }
      parents.push(i);
    });
    for (const change of changes) {
      const { row, hidden } = change;
      (_b = this.rowAnimations.get(row)) == null ? void 0 : _b.cancel();
      this.rowAnimations.delete(row);
      row.removeClass("is-animating");
      row.dataset.collapsed = String(hidden);
      row.inert = hidden;
      row.setAttribute("aria-hidden", String(hidden));
      row.hidden = motion ? false : hidden;
    }
    if (!motion) {
      this.settleAnimations();
      return;
    }
    const natural = changes.map(({ row }) => {
      const style = getComputedStyle(row);
      return { height: row.getBoundingClientRect().height, marginTop: style.marginTop, marginBottom: style.marginBottom };
    });
    changes.forEach((change, index) => {
      const { row, hidden } = change;
      if (typeof row.animate !== "function") {
        row.hidden = hidden;
        return;
      }
      const end = natural[index];
      const animation = row.animate([
        { height: `${change.height}px`, opacity: change.opacity, marginTop: change.marginTop, marginBottom: change.marginBottom, transform: change.transform },
        { height: hidden ? "0px" : `${end.height}px`, opacity: hidden ? 0 : 1, marginTop: hidden ? "0px" : end.marginTop, marginBottom: hidden ? "0px" : end.marginBottom, transform: hidden ? "translateY(-3px)" : "translateY(0)" }
      ], { duration: hidden ? 220 : 280, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)", fill: "both" });
      row.addClass("is-animating");
      this.rowAnimations.set(row, animation);
      animation.onfinish = () => {
        if (this.destroyed || this.rowAnimations.get(row) !== animation) return;
        row.hidden = hidden;
        row.removeClass("is-animating");
        this.rowAnimations.delete(row);
        animation.cancel();
      };
    });
  }
  jump(index) {
    var _a;
    const heading = this.headings[index];
    if (!heading || ((_a = this.view.file) == null ? void 0 : _a.path) !== this.filePath) return;
    this.plugin.app.workspace.setActiveLeaf(this.view.leaf, { focus: !import_obsidian.Platform.isMobile });
    this.view.leaf.setEphemeralState({ line: heading.position.start.line });
    if (this.view.getMode() === "source") {
      const pos = { line: heading.position.start.line, ch: 0 };
      this.view.editor.setCursor(pos);
      this.view.editor.scrollIntoView({ from: pos, to: pos }, true);
      if (import_obsidian.Platform.isMobile) this.view.editor.blur();
    }
    this.activeIndex = index;
    this.paintActive(true);
  }
  scheduleActive() {
    if (this.destroyed || this.frame !== null) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.updateActive();
    });
  }
  updateActive() {
    var _a, _b, _c, _d, _e;
    if (this.destroyed || !this.headings.length) return;
    const previous = this.activeIndex;
    let line = null;
    if (this.view.getMode() === "source") {
      const cm = this.view.editor.cm;
      try {
        if ((cm == null ? void 0 : cm.scrollDOM) && typeof cm.lineBlockAtHeight === "function") line = cm.state.doc.lineAt(cm.lineBlockAtHeight(cm.scrollDOM.getBoundingClientRect().top - cm.documentTop + 48).from).number - 1;
      } catch (e) {
      }
      line != null ? line : line = this.view.editor.getCursor().line;
    } else {
      const mode = this.view.previewMode;
      const area = this.view.containerEl.querySelector(".markdown-preview-view");
      const sections = (_a = mode == null ? void 0 : mode.renderer) == null ? void 0 : _a.sections;
      if (area && Array.isArray(sections)) {
        const top = area.getBoundingClientRect().top + 64;
        for (const section of sections) {
          const start = (_c = (_b = section.start) == null ? void 0 : _b.line) != null ? _c : section.lineStart;
          const rect = (_d = section.el) == null ? void 0 : _d.getBoundingClientRect();
          if (((_e = section.el) == null ? void 0 : _e.isConnected) && rect && rect.height > 0 && typeof start === "number" && rect.top <= top) line = Math.max(line != null ? line : 0, start);
        }
      }
    }
    if (line !== null) {
      let active = 0;
      this.headings.forEach((h, i) => {
        if (h.position.start.line <= line) active = i;
      });
      this.activeIndex = active;
    }
    this.paintActive(previous !== this.activeIndex);
  }
  paintActive(reveal = false) {
    this.list.querySelectorAll(".to-outline-row").forEach((row, i) => {
      row.toggleClass("is-active", i === this.activeIndex);
      const link = row.querySelector("button.to-outline-link");
      if (i === this.activeIndex) link == null ? void 0 : link.setAttribute("aria-current", "location");
      else link == null ? void 0 : link.removeAttribute("aria-current");
    });
    if (reveal) {
      let row = this.list.children[this.activeIndex];
      while (row && (row.hidden || row.dataset.collapsed === "true")) row = row.previousElementSibling;
      if (row) {
        const rect = row.getBoundingClientRect(), area = this.list.getBoundingClientRect();
        if (rect.top < area.top) this.list.scrollTop += rect.top - area.top;
        else if (rect.bottom > area.bottom) this.list.scrollTop += rect.bottom - area.bottom;
      }
    }
  }
  destroy() {
    this.destroyed = true;
    for (const animation of this.rowAnimations.values()) animation.cancel();
    this.rowAnimations.clear();
    this.clearTimer();
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    this.frame = null;
    this.observer.disconnect();
    this.resizeObserver.disconnect();
    this.themeObserver.disconnect();
    this.listeners.forEach((remove) => remove());
    this.listeners = [];
    this.root.remove();
    this.view.containerEl.removeClass("to-outline-host");
  }
};
var OutlineSettings = class extends import_obsidian.PluginSettingTab {
  constructor(plugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }
  display() {
    this.containerEl.empty();
    new import_obsidian.Setting(this.containerEl).setName("\u663E\u793A\u65B9\u5F0F").addDropdown((dropdown) => dropdown.addOption("hover", "\u60AC\u505C").addOption("pinned", "\u5E38\u5F00").addOption("off", "\u5173\u95ED").setValue(this.plugin.settings.mode).onChange((value) => this.plugin.setMode(value)));
    new import_obsidian.Setting(this.containerEl).setName("\u80CC\u666F\u6548\u679C").setDesc("\u81EA\u52A8\u6A21\u5F0F\u5728\u591C\u95F4\u4F7F\u7528\u589E\u5F3A\u78E8\u73BB\u7483\uFF1B\u6D45\u8272\u6A21\u5F0F\u4F9D\u636E\u6587\u7AE0\u680F\u5BBD\u5EA6\u542F\u7528\u3002").addDropdown((dropdown) => dropdown.addOption("auto", "\u7A84\u7A97\u53E3\u81EA\u52A8\u78E8\u73BB\u7483").addOption("transparent", "\u7EAF\u900F\u660E").addOption("frosted", "\u59CB\u7EC8\u78E8\u73BB\u7483").addOption("tinted", "\u534A\u900F\u660E\u5E95\u8272").setValue(this.plugin.settings.background).onChange(async (value) => {
      this.plugin.settings.background = value;
      this.plugin.refreshAll();
      await this.plugin.saveData(this.plugin.settings);
    }));
    new import_obsidian.Setting(this.containerEl).setName("\u81EA\u52A8\u542F\u7528\u5BBD\u5EA6").setDesc("\u5F53\u524D\u6587\u7AE0\u680F\u5BBD\u5EA6\u4F4E\u4E8E\u6B64\u503C\u65F6\u542F\u7528\uFF0C\u5355\u4F4D px\u3002").addSlider((slider) => slider.setLimits(480, 1400, 20).setValue(this.plugin.settings.narrowWidth).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.narrowWidth = value;
      this.plugin.refreshAll();
      await this.plugin.saveData(this.plugin.settings);
    }));
    new import_obsidian.Setting(this.containerEl).setName("\u80CC\u666F\u906E\u853D\u5F3A\u5EA6").setDesc("\u6DF1\u8272\u589E\u52A0 10 \u4E2A\u767E\u5206\u70B9\uFF0C\u6700\u9AD8 98%\uFF1B\u6D45\u8272\u589E\u52A0 6 \u4E2A\u767E\u5206\u70B9\uFF0C\u6700\u9AD8 95%\u3002").addSlider((slider) => slider.setLimits(0.45, 0.95, 0.05).setValue(this.plugin.settings.shade).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.shade = value;
      this.plugin.refreshAll();
      await this.plugin.saveData(this.plugin.settings);
    }));
    new import_obsidian.Setting(this.containerEl).setName("\u78E8\u73BB\u7483\u6A21\u7CCA\u534A\u5F84").setDesc("\u5355\u4F4D px\uFF1B\u591C\u95F4\u589E\u52A0 8px\u3002").addSlider((slider) => slider.setLimits(4, 28, 2).setValue(this.plugin.settings.blur).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.blur = value;
      this.plugin.refreshAll();
      await this.plugin.saveData(this.plugin.settings);
    }));
    new import_obsidian.Setting(this.containerEl).setName("\u6587\u5B57\u900F\u660E\u5EA6").addSlider((slider) => slider.setLimits(0.35, 1, 0.05).setValue(this.plugin.settings.opacity).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.opacity = value;
      this.plugin.refreshAll();
      await this.plugin.saveData(this.plugin.settings);
    }));
    new import_obsidian.Setting(this.containerEl).setName("\u5927\u7EB2\u5BBD\u5EA6").setDesc("160\u2013360 px").addSlider((slider) => slider.setLimits(160, 360, 10).setValue(this.plugin.settings.width).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.width = value;
      this.plugin.refreshAll();
      await this.plugin.saveData(this.plugin.settings);
    }));
  }
};
