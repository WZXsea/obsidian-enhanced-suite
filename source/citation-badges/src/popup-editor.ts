import { Component, Platform, type App } from 'obsidian';
import { DefinitionEditError } from './definition-edit';
import { createEmbeddedEditor } from './embedded-editor';
import { MobileContentEditor, type ContentEditor } from './mobile-editor';

export interface ContentEditorBridge {
  app: App;
  path: string;
  save(expected: string, content: string): Promise<string>;
  read(): Promise<string>;
  requestEditing(): void;
  changed(): void;
}

/** Desktop Live Preview and the mobile renderer share one guarded save buffer. */
export class PopupContentEditor {
  private readonly native: ContentEditor;
  private readonly host: HTMLElement;
  private readonly meta: HTMLElement;
  private readonly status: HTMLElement;
  private readonly reload: HTMLButtonElement;
  private expected: string;
  private draft: string;
  private savedDraft: string;
  private saving: Promise<void> | null = null;
  private saveTimer: number | null = null;
  private composing = false;
  private alive = true;
  private editing = false;

  constructor(container: HTMLElement, content: string, number: number, component: Component,
    private readonly bridge: ContentEditorBridge) {
    this.expected = this.draft = this.savedDraft = content;
    container.classList.add('citation-editable-content');
    this.host = container.createDiv({ cls: 'citation-inline-editor' });
    this.meta = container.createDiv({ cls: 'citation-edit-status' });
    this.meta.hidden = true;
    this.status = this.meta.createEl('span', { attr: { role: 'status', 'aria-live': 'polite' } });
    this.reload = this.meta.createEl('button', { text: '重新载入', attr: { type: 'button' } });
    this.reload.hidden = true;
    const options = {
      value: content, path: bridge.path, label: `编辑脚注 ${number} 的正文`,
      onChange: (value: string) => this.changed(value),
      onFocus: () => { if (this.alive) bridge.requestEditing(); },
      onLayout: () => bridge.changed()
    };
    this.native = Platform.isMobile
      ? new MobileContentEditor(bridge.app, this.host, options, component, () => new Component())
      : createEmbeddedEditor(bridge.app, this.host, options);
    this.native.setEditable(false);
    // Enable native caret handling before CodeMirror receives the same event.
    component.registerDomEvent(this.host, 'mousedown', event => {
      if (event.button !== 0 || this.editing) return;
      if (Platform.isMobile) return;
      const target = event.target as HTMLElement;
      if (target.closest('a,button,.cm-link,.external-link,.cm-hmd-external-link,.cm-hmd-internal-link')) return;
      this.bridge.requestEditing();
    }, true);
    component.registerDomEvent(this.host, 'compositionstart', () => {
      this.composing = true;
      if (this.saveTimer !== null) { window.clearTimeout(this.saveTimer); this.saveTimer = null; }
    }, true);
    component.registerDomEvent(this.host, 'compositionend', () => {
      this.composing = false;
      // CM commits its final composition transaction after the DOM event.
      window.setTimeout(() => { if (this.alive) this.changed(this.native.getValue(), true); }, 0);
    }, true);
    component.registerDomEvent(this.host.ownerDocument, 'visibilitychange', () => {
      if (this.host.ownerDocument.hidden) void this.flush().catch(() => {});
    });
    component.registerDomEvent(this.reload, 'click', () => { void this.reloadContent(); });
    component.register(() => this.destroy());
  }

  get dirty(): boolean { return this.draft !== this.savedDraft; }
  get focused(): boolean { return this.native.focused; }
  ownsTarget(target: Node): boolean { return this.host.contains(target) || this.native.ownsTarget(target); }

  setEditing(editing: boolean, focus = false): void {
    this.editing = editing;
    this.native.setEditable(editing);
    if (!editing) this.native.blur();
    if (focus && editing) this.native.focus();
    this.bridge.changed();
  }

  private changed(value: string, committed = false): void {
    if (!this.alive) return;
    const changed = this.draft !== value;
    this.draft = value;
    if (changed || committed) this.clearStatus();
    this.bridge.changed();
    if (!changed && !committed) return;
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (this.composing || this.native?.isComposing || !this.dirty) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      if (!this.composing && !this.native.isComposing) void this.flush(false).catch(() => {});
    }, 150);
  }

  async flush(finishComposition = true): Promise<void> {
    if (this.composing || this.native.isComposing) {
      if (!finishComposition) return;
      this.native.blur();
      await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    }
    this.draft = this.native.getValue();
    if (this.saveTimer !== null) { window.clearTimeout(this.saveTimer); this.saveTimer = null; }
    if (this.saving) {
      await this.saving;
      if (this.dirty) return this.flush(finishComposition);
      return;
    }
    const save = async () => {
      while (this.dirty) {
        if (!finishComposition && (this.composing || this.native.isComposing)) return;
        const submitted = this.draft;
        const canonical = await this.bridge.save(this.expected, submitted);
        this.expected = canonical;
        this.savedDraft = submitted;
      }
      if (this.alive) { this.clearStatus(); this.bridge.changed(); }
    };
    this.saving = save().catch(error => {
      if (this.alive) {
        this.status.textContent = error instanceof DefinitionEditError ? error.message : '保存暂缓，编辑内容已保留。';
        this.reload.hidden = !(error instanceof DefinitionEditError && error.code === 'conflict');
        this.meta.hidden = false;
        this.bridge.changed();
      }
      throw error;
    });
    try { await this.saving; } finally { this.saving = null; }
  }

  private async reloadContent(): Promise<void> {
    try {
      const content = await this.bridge.read();
      if (!this.alive) return;
      if (this.saveTimer !== null) { window.clearTimeout(this.saveTimer); this.saveTimer = null; }
      this.expected = this.draft = this.savedDraft = content;
      this.native.setValue(content);
      this.clearStatus();
      this.bridge.changed();
    } catch {
      if (this.alive) {
        this.status.textContent = '当前正文正在更新，编辑内容已保留。';
        this.meta.hidden = false;
        this.bridge.changed();
      }
    }
  }

  private clearStatus(): void {
    this.meta.hidden = true;
    this.status.textContent = '';
    this.reload.hidden = true;
  }

  private destroy(): void {
    this.alive = false;
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.native.destroy();
  }
}
