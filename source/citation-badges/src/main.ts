import {
  Component, MarkdownRenderChild, MarkdownRenderer, MarkdownView, Platform, Plugin, PluginSettingTab, Setting, TFile,
  type App, type MarkdownPostProcessorContext
} from 'obsidian';
import type { EditorView } from '@codemirror/view';
import { citationEditorExtension } from './editor';
import { buildDocumentModel, formatNumbers } from './model';
import { prepareCallout } from './callout';
import type { Cluster, DocumentModel, Reference } from './types';
import { DefinitionEditError, replaceDefinitionContent } from './definition-edit';
import { PopupContentEditor } from './popup-editor';
import { popupPlacement, TouchTap } from './mobile';
import { centerEditorPosition, centerMarkdownPosition, centerRenderedTarget } from './navigation';

interface BadgeSettings { scale: number; tint: number; radius: number; }
const defaults: BadgeSettings = { scale: 0.71, tint: 10, radius: 3 };
interface BadgeState {
  cluster: Cluster;
  path: string;
  button: HTMLButtonElement;
  view?: EditorView;
  native?: Map<string, HTMLAnchorElement>;
  cleanup: Array<() => void>;
}
interface Popup {
  badge: HTMLElement;
  element: HTMLElement;
  component: Component;
  pinned: boolean;
  state: BadgeState;
  editing: boolean;
  editors: PopupContentEditor[];
  rect: DOMRect;
  place?: () => void;
  closing?: Promise<boolean>;
  animation?: Animation;
  owner: HTMLElement | null;
}
function referenceKey(reference: Reference): string { return `${reference.sourceId}:${reference.occurrence}`; }
function sameCluster(first: Cluster, second: Cluster): boolean {
  return first.members.map(referenceKey).join('|') === second.members.map(referenceKey).join('|');
}
function popupOpeningFrames(side: 'above' | 'below'): Keyframe[] {
  return [
    { opacity: 0, transform: `translateY(${side === 'above' ? 4 : -4}px) scale(0.94)` },
    { opacity: 1, transform: 'translateY(0) scale(1)' }
  ];
}

export default class CitationBadgesPlugin extends Plugin {
  override settings: BadgeSettings = { ...defaults };
  private models = new Map<string, DocumentModel>();
  private badges = new Map<HTMLElement, BadgeState>();
  private readingRestores = new Map<HTMLElement, () => void>();
  private alive = true;
  private popup: Popup | null = null;
  private hoverTimer: number | null = null;
  private closeTimer: number | null = null;
  private manualMounts = new Map<HTMLElement, { component: Component; path: string }>();
  private refreshTimer: number | null = null;
  private calloutRenders = new WeakMap<HTMLElement, { key: string; dispose: () => void }>();
  private popupSerial = 0;
  private popupRequest = 0;
  private writes = new Map<string, Promise<string>>();
  private returnLocation: { view: MarkdownView; path: string; from: number; sourceId: string; occurrence: number; state: Record<string, unknown> } | null = null;

  override async onload(): Promise<void> {
    this.register(() => { this.alive = false; });
    this.settings = { ...defaults, ...await this.loadData() };
    if (!this.alive) return;
    this.applySettings();
    this.registerEditorExtension(citationEditorExtension({
      model: (source, path) => this.model(source, path),
      createBadge: (cluster, path, view) => this.createBadge(cluster, path, view),
      disposeBadge: element => this.disposeBadge(element)
    }));
    this.registerMarkdownPostProcessor((element, context) => this.processRendered(element, context));
    this.addSettingTab(new BadgeSettingTab(this.app, this));
    this.registerEvent(this.app.workspace.on('layout-change', () => {
      if (!this.popup?.editing) void this.closePopup(false);
      else this.popup.place?.();
      this.scheduleReadingRefresh();
    }));
    this.registerEvent(this.app.workspace.on('file-open', () => this.scheduleReadingRefresh()));
    this.registerEvent(this.app.vault.on('modify', file => {
      if (file instanceof TFile && file.extension === 'md') {
        this.models.delete(file.path);
        if (this.popup?.state.path === file.path && !this.popup.editing) void this.closePopup(false);
        this.scheduleReadingRefresh();
      }
    }));
    this.registerEvent(this.app.vault.on('rename', () => {
      this.models.clear(); void this.closePopup(false);
      [...this.readingRestores.keys()].forEach(element => this.disposeBadge(element));
      this.scheduleReadingRefresh();
    }));
    this.addCommand({ id: 'refresh-citation-badges', name: '刷新当前引用徽标', callback: () => this.scheduleReadingRefresh() });
    this.addCommand({ id: 'return-to-citation', name: '返回最近引用位置', callback: () => { void this.returnToCitation(); } });
    this.register(() => {
      this.clearTimers();
      if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
      void this.closePopup(false, true);
      [...this.badges.keys()].forEach(element => this.disposeBadge(element));
      this.manualMounts.clear();
      this.models.clear();
      document.body.style.removeProperty('--citation-scale');
      document.body.style.removeProperty('--citation-tint');
      document.body.style.removeProperty('--citation-radius');
    });
    this.app.workspace.onLayoutReady(() => this.scheduleReadingRefresh());
  }

  model(source: string, path: string): DocumentModel {
    const cached = this.models.get(path);
    if (cached?.source === source) return cached;
    const model = buildDocumentModel(source);
    this.models.set(path, model);
    if (this.models.size > 12) this.models.delete(this.models.keys().next().value as string);
    return model;
  }

  createBadge(cluster: Cluster, path: string, view?: EditorView, native?: Map<string, HTMLAnchorElement>): HTMLElement {
    const doc = view?.dom.ownerDocument ?? native?.values().next().value?.ownerDocument ?? document;
    const host = doc.createElement('span');
    host.className = 'citation-badge';
    host.dataset.citationLabel = cluster.label;
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'citation-badge-button';
    button.textContent = cluster.label;
    button.setAttribute('aria-label', `脚注 ${cluster.numbers.join('、')}，共 ${cluster.numbers.length} 条来源`);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-haspopup', 'dialog');
    host.append(button);
    const state: BadgeState = { cluster, path, button, view, native, cleanup: [] };
    this.badges.set(host, state);
    const popup = this.popup;
    if (popup?.editing && popup.state.path === path && sameCluster(popup.state.cluster, cluster)) {
      (doc.defaultView ?? window).requestAnimationFrame(() => {
        if (this.popup !== popup || !host.isConnected || host.closest('.workspace-leaf-content') !== popup.owner) return;
        popup.badge = host; popup.state = state;
        button.setAttribute('aria-controls', popup.element.id);
        button.setAttribute('aria-expanded', 'true');
        popup.place?.();
      });
    }
    const on = <K extends keyof HTMLElementEventMap>(type: K, action: (event: HTMLElementEventMap[K]) => void) => {
      host.addEventListener(type, action);
      state.cleanup.push(() => host.removeEventListener(type, action));
    };
    const tap = new TouchTap();
    on('pointerdown', event => {
      tap.begin(event.pointerId, event.clientX, event.clientY);
    });
    on('pointermove', event => tap.move(event.pointerId, event.clientX, event.clientY));
    on('pointerup', event => tap.end(event.pointerId));
    on('pointercancel', () => tap.cancel());
    on('mousedown', event => { event.preventDefault(); event.stopPropagation(); });
    on('click', event => {
      event.preventDefault(); event.stopPropagation();
      if (tap.suppressed && event.detail !== 0) return;
      this.clearTimers();
      if (this.popup?.badge === host) {
        if (this.popup.pinned) void this.closePopup(true);
        else { this.popup.pinned = true; this.popup.element.querySelector<HTMLButtonElement>('.citation-source-jump')?.focus(); }
      } else void this.openPopup(host, true);
    });
    on('mouseenter', () => {
      if (!doc.defaultView?.matchMedia('(hover: hover)').matches) return;
      if (this.closeTimer !== null) { window.clearTimeout(this.closeTimer); this.closeTimer = null; }
      if (this.popup?.pinned || this.popup?.badge === host) return;
      if (this.hoverTimer !== null) window.clearTimeout(this.hoverTimer);
      this.hoverTimer = window.setTimeout(() => { this.hoverTimer = null; if (host.isConnected) void this.openPopup(host, false); }, 150);
    });
    on('mouseleave', () => {
      if (this.hoverTimer !== null) { window.clearTimeout(this.hoverTimer); this.hoverTimer = null; }
      if (this.popup?.badge === host && !this.popup.pinned) this.deferClose();
    });
    return host;
  }

  disposeBadge(element: HTMLElement): void {
    if (this.popup?.badge === element && !this.popup.editing) void this.closePopup(false, true);
    const state = this.badges.get(element);
    state?.cleanup.forEach(cleanup => cleanup());
    this.badges.delete(element);
    const restore = this.readingRestores.get(element);
    this.readingRestores.delete(element);
    restore?.();
  }

  private clearTimers(): void {
    if (this.hoverTimer !== null) window.clearTimeout(this.hoverTimer);
    if (this.closeTimer !== null) window.clearTimeout(this.closeTimer);
    this.hoverTimer = this.closeTimer = null;
  }
  private deferClose(): void {
    if (this.closeTimer !== null) window.clearTimeout(this.closeTimer);
    this.closeTimer = window.setTimeout(() => { this.closeTimer = null; if (!this.popup?.pinned) void this.closePopup(false); }, 240);
  }

  private async openPopup(badge: HTMLElement, pinned: boolean): Promise<void> {
    const request = ++this.popupRequest;
    const previous = this.badges.get(badge);
    if (!previous || !await this.closePopup(false)) return;
    if (!this.alive || request !== this.popupRequest) return;
    let state = this.badges.get(badge);
    if (!state) {
      const replacement = [...this.badges].find(([element, candidate]) => element.isConnected && candidate.path === previous.path && sameCluster(candidate.cluster, previous.cluster));
      if (replacement) [badge, state] = replacement;
    }
    if (!state) return;
    // Reading sections may be reused when only a definition changes. Resolve
    // bodies against the current document each time the popover opens.
    const source = await this.sourceForPath(state.path);
    if (!this.alive || request !== this.popupRequest || !badge.isConnected) return;
    const model = this.model(source, state.path);
    const members = state.cluster.members.map(reference => model.references.find(item => referenceKey(item) === referenceKey(reference)));
    if (members.some(reference => !reference || reference.number === null || !reference.definition)) return;
    const current = members as Reference[];
    const numbers = [...new Set(current.map(reference => reference.number as number))];
    state = { ...state, cluster: { from: current[0].from, to: current[current.length - 1].to, members: current, numbers, label: formatNumbers(numbers) } };
    this.badges.set(badge, state);
    state.button.textContent = state.cluster.label;
    state.button.setAttribute('aria-label', `脚注 ${numbers.join('、')}，共 ${numbers.length} 条来源`);
    badge.dataset.citationLabel = state.cluster.label;
    const doc = badge.ownerDocument;
    const element = doc.createElement('div');
    element.className = 'citation-badge-popover';
    element.id = `citation-source-popover-${++this.popupSerial}`;
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-label', '引用来源列表');
    const component = this.addChild(new Component());
    component.load();
    const popup: Popup = { badge, element, component, pinned, state, editing: false, editors: [], rect: badge.getBoundingClientRect(), owner: badge.closest('.workspace-leaf-content') };
    this.popup = popup;
    state.button.setAttribute('aria-controls', element.id);
    state.button.setAttribute('aria-expanded', 'true');
    const top = element.createDiv({ cls: 'citation-popover-header' });
    top.createEl('span', { text: `引用来源 · ${state.cluster.numbers.length} 项`, cls: 'citation-popover-title' });
    const close = top.createEl('button', { text: '关闭', cls: 'citation-popover-close', attr: { type: 'button', 'aria-label': '保存并关闭引用来源' } });
    component.registerDomEvent(close, 'click', () => { void this.closePopup(true); });
    const list = element.createDiv({ cls: 'citation-source-list' });
    const beginEditing = () => {
      if (this.popup !== popup || popup.closing || popup.editing) return;
      this.clearTimers();
      popup.editing = true; popup.pinned = true;
      element.classList.add('citation-popup-editing');
      popup.editors.forEach(editor => editor.setEditing(true));
      popup.place?.();
    };
    const seen = new Set<number>();
    for (const reference of state.cluster.members) {
      if (reference.number === null || seen.has(reference.number)) continue;
      seen.add(reference.number);
      const row = list.createDiv({ cls: 'citation-source-row' });
      row.createEl('span', { text: String(reference.number), cls: 'citation-source-number' });
      const content = row.createDiv({ cls: 'citation-source-content' });
      const text = reference.definition?.content ?? reference.content;
      const path = state.path;
      const editor = new PopupContentEditor(content, text, reference.number, component, {
        app: this.app, path,
        save: (expected, draft) => this.writeContent(popup, reference.sourceId, expected, draft),
        read: async () => {
          const source = await this.sourceForPath(path);
          const definition = this.model(source, path).definitions.get(reference.sourceId);
          if (!definition) throw new DefinitionEditError('missing', '引用定义已更新，编辑内容已保留。');
          return definition.content;
        },
        requestEditing: beginEditing,
        changed: () => popup.place?.()
      });
      popup.editors.push(editor);
      const jump = row.createEl('button', { text: '定位', cls: 'citation-source-jump', attr: { type: 'button', 'aria-label': `定位脚注 ${reference.number}` } });
      component.registerDomEvent(jump, 'click', () => { void this.navigateReference(popup.state, reference); });
    }
    component.registerDomEvent(element, 'mouseenter', () => { if (this.closeTimer !== null) { window.clearTimeout(this.closeTimer); this.closeTimer = null; } });
    component.registerDomEvent(element, 'mouseleave', () => { if (!popup.pinned) this.deferClose(); });
    component.registerDomEvent(doc, 'keydown', event => {
      if (event.key === 'Escape' && !event.isComposing && !event.defaultPrevented && this.popup === popup) { event.preventDefault(); void this.closePopup(true); }
    }, true);
    component.registerDomEvent(doc, 'pointerdown', event => {
      const target = event.target as Node;
      if (popup.editors.some(editor => editor.ownsTarget(target))) return;
      if (this.popup === popup && !element.contains(target) && !popup.badge.contains(target)) void this.closePopup(false);
    }, true);
    let side: 'above' | 'below' = 'below';
    const place = () => {
      if (this.popup !== popup) return;
      const win = doc.defaultView ?? window;
      const liveRect = popup.badge.getBoundingClientRect();
      if (liveRect.width > 0) popup.rect = liveRect;
      const rect = popup.rect;
      const visual = win.visualViewport;
      const viewport = { left: visual?.offsetLeft ?? 0, top: visual?.offsetTop ?? 0,
        width: visual?.width ?? win.innerWidth, height: visual?.height ?? win.innerHeight };
      // Width must settle before measuring wrapped text and native editor height.
      const { width, maxHeight } = popupPlacement(viewport, rect, 0, popup.editing);
      element.style.width = `${width}px`;
      element.style.maxHeight = `${maxHeight}px`;
      const contentHeight = element.scrollHeight + element.offsetHeight - element.clientHeight;
      const placement = popupPlacement(viewport, rect, contentHeight, popup.editing);
      const { left, top: topY, height } = placement;
      if (side !== placement.side) {
        side = placement.side;
        const effect = popup.animation?.effect;
        if (!popup.closing && effect instanceof win.KeyframeEffect) effect.setKeyframes(popupOpeningFrames(side));
      }
      element.dataset.citationSide = side;
      element.style.left = `${left}px`;
      // Keep the edge nearest the badge fixed as native content changes height.
      element.style.top = side === 'above' ? 'auto' : `${topY}px`;
      element.style.bottom = side === 'above' ? `${(doc.documentElement.clientHeight || win.innerHeight) - topY - height}px` : 'auto';
      element.style.transformOrigin = `${Math.max(0, Math.min(width, rect.left + rect.width / 2 - left))}px ${side === 'above' ? 'bottom' : 'top'}`;
    };
    popup.place = place;
    doc.body.append(element);
    place();
    component.registerDomEvent(doc, 'scroll', event => {
      if (element.contains(event.target as Node)) return;
      if (popup.pinned) place(); else void this.closePopup(false);
    }, true);
    component.registerDomEvent(doc.defaultView ?? window, 'resize', place);
    const visual = doc.defaultView?.visualViewport;
    if (visual) {
      visual.addEventListener('resize', place); visual.addEventListener('scroll', place);
      component.register(() => { visual.removeEventListener('resize', place); visual.removeEventListener('scroll', place); });
    }
    component.registerDomEvent(element, 'focusin', event => {
      const target = event.target as HTMLElement;
      if (Platform.isMobile && target.matches('textarea')) {
        const timer = window.setTimeout(() => {
          if (this.popup !== popup) return;
          place(); target.scrollIntoView({ block: 'nearest' });
        }, 180);
        component.register(() => window.clearTimeout(timer));
      }
    });
    if (pinned && !Platform.isMobile) element.querySelector<HTMLButtonElement>('.citation-source-jump')?.focus({ preventScroll: true });
    const win = doc.defaultView ?? window;
    if (!win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      popup.animation = element.animate(popupOpeningFrames(side),
        { duration: 210, easing: 'cubic-bezier(0.18,0.8,0.2,1)', fill: 'both' });
      popup.animation.onfinish = () => { popup.animation?.cancel(); popup.animation = undefined; };
    }
    component.register(() => popup.animation?.cancel());
    if (win.ResizeObserver) {
      const observer = new win.ResizeObserver(place);
      observer.observe(element); component.register(() => observer.disconnect());
    }
    window.requestAnimationFrame(place);
  }

  private writeContent(popup: Popup, id: string, expected: string, draft: string): Promise<string> {
    const path = popup.state.path;
    const previous = this.writes.get(path) ?? Promise.resolve('');
    const work = previous.catch(() => '').then(async () => {
      const views = this.app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view)
        .filter((view): view is MarkdownView => view instanceof MarkdownView && view.file?.path === path && view.getMode() === 'source');
      const preferred = views.find(view => popup.state.view && view.contentEl.contains(popup.state.view.dom)) ?? views[0];
      if (preferred) {
        const source = preferred.editor.getValue();
        if (views.some(view => view.editor.getValue() !== source)) {
          throw new DefinitionEditError('conflict', '笔记存在并行编辑，完成同步后即可保存。');
        }
        const replacement = replaceDefinitionContent(source, id, expected, draft);
        if (replacement.source !== source) {
          preferred.editor.transaction({ changes: [{
            from: preferred.editor.offsetToPos(replacement.from), to: preferred.editor.offsetToPos(replacement.to), text: replacement.insert
          }] }, 'citation-badges:edit-footnote');
          this.models.delete(path);
          await preferred.save();
        }
        return replacement.definition.content;
      }
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) throw new DefinitionEditError('missing', '引用所在笔记已更新，编辑内容已保留。');
      let content = expected;
      await this.app.vault.process(file, source => {
        const replacement = replaceDefinitionContent(source, id, expected, draft);
        content = replacement.definition.content; return replacement.source;
      });
      this.models.delete(path); this.scheduleReadingRefresh();
      return content;
    });
    this.writes.set(path, work);
    void work.finally(() => { if (this.writes.get(path) === work) this.writes.delete(path); }).catch(() => {});
    return work;
  }

  private async navigateReference(state: BadgeState, reference: Reference): Promise<void> {
    const native = state.native?.get(referenceKey(reference));
    if (!await this.closePopup(false)) return;
    const source = await this.sourceForPath(state.path);
    if (!this.alive) return;
    const current = this.model(source, state.path).references.find(item => referenceKey(item) === referenceKey(reference));
    if (current) reference = current;
    const view = this.app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view)
      .find((item): item is MarkdownView => item instanceof MarkdownView && item.file?.path === state.path
        && (state.view ? item.contentEl.contains(state.view.dom) : !!native && item.contentEl.contains(native)))
      ?? this.app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view)
        .find((item): item is MarkdownView => item instanceof MarkdownView && item.file?.path === state.path);
    if (view) this.returnLocation = {
      view, path: state.path, from: state.cluster.from,
      sourceId: state.cluster.members[0].sourceId, occurrence: state.cluster.members[0].occurrence,
      state: { ...view.getState() }
    };
    if (native?.isConnected) {
      const id = native.getAttribute('href')?.slice(1);
      const root = native.closest('.markdown-preview-view');
      const target = id && root?.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
      if (target && target.getBoundingClientRect().height > 0) { centerRenderedTarget(target); return; }
    }
    if (state.view && reference.definition && view?.file?.path === state.path && view.getMode() === 'source'
      && state.view.dom.isConnected && view.contentEl.contains(state.view.dom)) {
      const pos = Math.min(reference.definition.from, state.view.state.doc.length);
      state.view.dispatch({ selection: { anchor: pos } });
      state.view.focus();
      centerEditorPosition(state.view, pos);
      return;
    }
    // Current Obsidian hides definitions in Reading view. Use the public view
    // state and editor APIs to reveal the actual definition for navigation.
    if (view && reference.definition) {
      this.app.workspace.setActiveLeaf(view.leaf, { focus: true });
      // View.setState also works while a leaf navigation is busy; WorkspaceLeaf
      // may otherwise silently discard a mode-only transition in that window.
      await view.setState({ mode: 'source', source: false }, { history: false });
      if (!this.alive || view.leaf.view !== view || view.file?.path !== state.path || view.getMode() !== 'source') return;
      view.editor.focus();
      await centerMarkdownPosition(view, reference.definition.from);
    }
  }

  private async returnToCitation(): Promise<void> {
    const location = this.returnLocation;
    if (!location) return;
    const file = this.app.vault.getAbstractFileByPath(location.path);
    if (!(file instanceof TFile)) return;
    if (!await this.closePopup(false)) return;
    const leaf = location.view.leaf;
    if (!(leaf.view instanceof MarkdownView) || leaf.view.file?.path !== location.path) await leaf.openFile(file);
    const view = leaf.view;
    if (!(view instanceof MarkdownView)) return;
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    await view.setState(location.state, { history: false });
    if (!this.alive || leaf.view !== view || view.file?.path !== location.path) return;
    const source = await this.sourceForPath(location.path);
    const reference = this.model(source, location.path).references.find(item => item.sourceId === location.sourceId && item.occurrence === location.occurrence);
    const from = Math.min(source.length, reference?.from ?? location.from);
    const line = source.slice(0, from).split('\n').length - 1;
    leaf.setEphemeralState({ line });
    if (view.getMode() === 'source') {
      const position = view.editor.offsetToPos(from);
      view.editor.setCursor(position); view.editor.focus();
      await centerMarkdownPosition(view, from);
    }
  }

  private async closePopup(focus: boolean, immediate = false): Promise<boolean> {
    this.clearTimers();
    const popup = this.popup;
    if (!popup) return true;
    if (popup.closing) return popup.closing;
    const close = async (): Promise<boolean> => {
      popup.element.inert = true;
      try { await Promise.all(popup.editors.map(editor => editor.flush())); }
      catch { popup.element.inert = false; popup.pinned = true; popup.closing = undefined; return false; }
      const state = this.badges.get(popup.badge) ?? popup.state;
      state.button.setAttribute('aria-expanded', 'false');
      state.button.removeAttribute('aria-controls');
      const win = popup.element.ownerDocument.defaultView ?? window;
      const style = win.getComputedStyle(popup.element);
      const opacity = style.opacity, transform = style.transform;
      popup.animation?.cancel(); popup.animation = undefined;
      if (!immediate && popup.element.isConnected && !win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        popup.animation = popup.element.animate([
          { opacity, transform }, { opacity: 0, transform: 'scale(0.97)' }
        ], { duration: 110, easing: 'ease-out', fill: 'both' });
        await popup.animation.finished.catch(() => {});
      }
      if (this.popup === popup) this.popup = null;
      popup.animation?.cancel();
      this.removeChild(popup.component); popup.component.unload(); popup.element.remove();
      if (focus && state.button.isConnected) state.button.focus();
      return true;
    };
    popup.closing = close();
    const result = await popup.closing;
    if (!result) popup.closing = undefined;
    return result;
  }

  private async processRendered(element: HTMLElement, context: MarkdownPostProcessorContext): Promise<void> {
    if (!this.alive || element.closest('.citation-badge-popover, .citation-callout-render')) return;
    const child = new MarkdownRenderChild(element);
    context.addChild(child);
    let alive = true;
    child.register(() => { alive = false; });
    const source = await this.sourceForPath(context.sourcePath);
    if (this.alive && alive) {
      const model = this.model(source, context.sourcePath);
      if (await this.enhanceCallout(element, context.sourcePath, model, child)) return;
      this.enhanceReading(element, context.sourcePath, model, child);
    }
  }

  private async enhanceCallout(root: HTMLElement, path: string, model: DocumentModel, component: Component): Promise<boolean> {
    const block = root.closest<HTMLElement>('.cm-callout');
    // The native block widget owns the exact source range, including nested callouts.
    const widget = (block as (HTMLElement & { cmTile?: { widget?: { start: number; end: number; text: string } } }) | null)?.cmTile?.widget;
    if (!block || !widget || model.source.slice(widget.start, widget.end) !== widget.text) return false;
    const previous = this.calloutRenders.get(block);
    const prepared = prepareCallout(model, widget.start, widget.end);
    if (!prepared.clusters.length) { previous?.dispose(); return false; }
    const text = widget.text, from = widget.start, to = widget.end;
    const key = JSON.stringify([path, from, to, text, prepared.clusters.map(cluster => [cluster.label,
      cluster.members.map(member => [member.from, member.to, member.sourceId, member.occurrence])])]);
    if (previous?.key === key) return true;
    const foldStates = Array.from(root.matches('.callout') ? [root, ...Array.from(root.querySelectorAll('.callout'))]
      : root.querySelectorAll('.callout')).map(callout => callout.classList.contains('is-collapsed'));
    previous?.dispose();
    const renderComponent = component.addChild(new Component());
    const mount = { key, dispose: () => { component.removeChild(renderComponent); renderComponent.unload(); } };
    this.calloutRenders.set(block, mount);
    renderComponent.register(() => {
      if (this.calloutRenders.get(block) === mount) this.calloutRenders.delete(block);
    });
    const rendered = root.ownerDocument.createElement('div');
    rendered.className = 'citation-callout-render';
    await MarkdownRenderer.render(this.app, prepared.source, rendered, path, renderComponent);
    if (!this.alive || !block.isConnected || this.calloutRenders.get(block) !== mount
      || widget.text !== text || widget.start !== from || widget.end !== to) {
      mount.dispose();
      return true;
    }
    const original = root.matches('.callout') ? root : root.querySelector('.callout');
    const replacement = rendered.querySelector('.callout');
    if (!original || !replacement) { mount.dispose(); return false; }
    const callouts = [replacement, ...Array.from(replacement.querySelectorAll('.callout'))];
    callouts.forEach((callout, index) => callout.classList.toggle('is-collapsed', foldStates[index] ?? false));
    // Live Preview's delegated task handler needs the original local line numbers.
    const nativeTasks = original.querySelectorAll<HTMLInputElement>('.task-list-item-checkbox');
    Array.from(replacement.querySelectorAll<HTMLInputElement>('.task-list-item-checkbox')).forEach((task, index) => {
      const line = nativeTasks[index]?.getAttribute('data-line');
      if (line !== null && line !== undefined) task.setAttribute('data-line', line);
    });
    for (const marker of Array.from(replacement.querySelectorAll<HTMLElement>('[data-citation-callout]'))) {
      const cluster = prepared.clusters[Number(marker.dataset.citationCallout)];
      if (!cluster) continue;
      const badge = this.createBadge(cluster, path);
      marker.replaceWith(badge);
      renderComponent.register(() => this.disposeBadge(badge));
    }
    // Keep the renderer's container: native fold/link handlers delegate from it.
    original.replaceWith(rendered);
    renderComponent.register(() => {
      if (rendered.isConnected) {
        [original, ...Array.from(original.querySelectorAll('.callout'))].forEach((callout, index) => {
          callout.classList.toggle('is-collapsed', callouts[index]?.classList.contains('is-collapsed') ?? false);
        });
        rendered.replaceWith(original);
      }
    });
    return true;
  }

  private async sourceForPath(path: string): Promise<string> {
    const view = this.app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view)
      .find((item): item is MarkdownView => item instanceof MarkdownView && item.file?.path === path && item.getMode() === 'source');
    if (view?.editor) return view.editor.getValue();
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? this.app.vault.cachedRead(file) : '';
  }

  private enhanceReading(root: HTMLElement, path: string, model: DocumentModel, component: Component): void {
    const candidates = Array.from(root.querySelectorAll<HTMLElement>('sup.footnote-ref'))
      .filter(sup => !sup.classList.contains('citation-native-reference') && !sup.closest('.citation-badge-popover'));
    const nativeReferences = new Map(model.references.filter(reference => reference.kind === 'standard' && reference.number !== null)
      .map(reference => [referenceKey(reference), reference]));
    const records = candidates.map(sup => {
      const anchor = sup.querySelector<HTMLAnchorElement>('a.footnote-link');
      const match = anchor?.textContent?.match(/^\[(\d+)(?:-(\d+))?\]$/);
      if (!anchor || !match || !anchor.dataset.footref || anchor.dataset.footref.startsWith('[inline')) return null;
      const sourceId = anchor.dataset.footref;
      const occurrence = Number(match[2] ?? 0);
      const reference = nativeReferences.get(`${sourceId}:${occurrence}`);
      if (!reference) return null;
      return { sup, anchor, reference: { ...reference, number: Number(match[1]) } };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
    for (let index = 0; index < records.length;) {
      const group = [records[index++]];
      while (index < records.length) {
        const previous = group[group.length - 1];
        const next = records[index];
        if (previous.reference.to !== next.reference.from || previous.sup.parentElement !== next.sup.parentElement || previous.sup.nextSibling !== next.sup) break;
        group.push(next); index++;
      }
      const members = group.map(item => item.reference);
      const numbers = [...new Set(members.map(item => item.number as number))];
      const cluster: Cluster = { from: members[0].from, to: members[members.length - 1].to, members, numbers, label: formatNumbers(numbers) };
      const native = new Map(group.map(item => [referenceKey(item.reference), item.anchor]));
      const badge = this.createBadge(cluster, path, undefined, native);
      group[0].sup.before(badge);
      const restore = group.map(({ sup, anchor }) => {
        const aria = sup.getAttribute('aria-hidden');
        const tab = anchor.getAttribute('tabindex');
        sup.classList.add('citation-native-reference');
        sup.setAttribute('aria-hidden', 'true');
        anchor.setAttribute('tabindex', '-1');
        return () => {
          sup.classList.remove('citation-native-reference');
          if (aria === null) sup.removeAttribute('aria-hidden'); else sup.setAttribute('aria-hidden', aria);
          if (tab === null) anchor.removeAttribute('tabindex'); else anchor.setAttribute('tabindex', tab);
        };
      });
      this.readingRestores.set(badge, () => { badge.remove(); restore.forEach(action => action()); });
      component.register(() => this.disposeBadge(badge));
    }
  }

  private scheduleReadingRefresh(): void {
    if (!this.alive) return;
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => { this.refreshTimer = null; void this.refreshReading(); }, 100);
  }
  private async refreshReading(): Promise<void> {
    if (!this.alive) return;
    for (const [root, mount] of this.manualMounts) {
      if (!root.isConnected) {
        this.removeChild(mount.component); mount.component.unload(); this.manualMounts.delete(root);
      }
    }
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || !view.file) continue;
      const path = view.file.path;
      const callouts = view.contentEl.querySelectorAll<HTMLElement>('.cm-callout > .markdown-rendered');
      if (callouts.length) {
        const model = this.model(await this.sourceForPath(path), path);
        for (const callout of Array.from(callouts)) {
          let mount = this.manualMounts.get(callout);
          if (!mount) {
            const component = this.addChild(new MarkdownRenderChild(callout));
            component.load(); mount = { component, path }; this.manualMounts.set(callout, mount);
          }
          await this.enhanceCallout(callout, path, model, mount.component);
        }
      }
      const root = view.contentEl.querySelector<HTMLElement>('.markdown-preview-view');
      if (!root || !root.isConnected) continue;
      let mount = this.manualMounts.get(root);
      if (mount && mount.path !== path) {
        this.removeChild(mount.component); mount.component.unload(); this.manualMounts.delete(root); mount = undefined;
      }
      if (!root.querySelector('sup.footnote-ref:not(.citation-native-reference)')) continue;
      const source = await this.sourceForPath(path);
      if (!this.alive || !root.isConnected || view.file?.path !== path) continue;
      if (!mount) {
        const component = this.addChild(new MarkdownRenderChild(root));
        component.load(); mount = { component, path }; this.manualMounts.set(root, mount);
      }
      this.enhanceReading(root, path, this.model(source, path), mount.component);
    }
  }

  applySettings(): void {
    document.body.style.setProperty('--citation-scale', `${this.settings.scale}em`);
    document.body.style.setProperty('--citation-tint', `${this.settings.tint}%`);
    document.body.style.setProperty('--citation-radius', `${this.settings.radius}px`);
  }
  async saveSettings(): Promise<void> { this.applySettings(); await this.saveData(this.settings); }
}

class BadgeSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: CitationBadgesPlugin) { super(app, plugin); }
  override display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName('引用字号比例').setDesc('引用字号随正文变化，默认约为正文的 71%。')
      .addSlider(slider => slider.setLimits(0.6, 0.9, 0.01).setValue(this.plugin.settings.scale).setDynamicTooltip().onChange(value => { this.plugin.settings.scale = value; void this.plugin.saveSettings(); }));
    new Setting(containerEl).setName('淡底强度').setDesc('主题强调色在徽标背景中的比例。')
      .addSlider(slider => slider.setLimits(5, 20, 1).setValue(this.plugin.settings.tint).setDynamicTooltip().onChange(value => { this.plugin.settings.tint = value; void this.plugin.saveSettings(); }));
    new Setting(containerEl).setName('徽标圆角').setDesc('单位为像素。')
      .addSlider(slider => slider.setLimits(2, 6, 1).setValue(this.plugin.settings.radius).setDynamicTooltip().onChange(value => { this.plugin.settings.radius = value; void this.plugin.saveSettings(); }));
  }
}
