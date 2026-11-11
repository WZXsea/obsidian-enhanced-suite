import { MarkdownRenderer } from 'obsidian';
import type { App, Component } from 'obsidian';
import type { EmbeddedEditorOptions } from './embedded-editor';
import { TouchTap } from './mobile';

export interface ContentEditor {
  readonly focused: boolean;
  readonly isComposing: boolean;
  getValue(): string;
  setValue(value: string): void;
  setEditable(editable: boolean): void;
  focus(): void;
  focusAtCoords(x: number, y: number): void;
  blur(): void;
  ownsTarget(target: EventTarget | null): boolean;
  destroy(): void;
}

/** Public APIs keep footnote editing available in Android WebView. */
export class MobileContentEditor implements ContentEditor {
  private readonly preview: HTMLElement;
  private readonly input: HTMLTextAreaElement;
  private readonly toggle: HTMLButtonElement;
  private composing = false;
  private alive = true;
  private rendering = 0;
  private renderChild: Component | null = null;

  constructor(private readonly app: App, private readonly container: HTMLElement,
    private readonly options: EmbeddedEditorOptions, private readonly component: Component,
    private readonly makeComponent: () => Component) {
    container.classList.add('citation-mobile-editor');
    this.toggle = container.createEl('button', { text: '编辑正文', cls: 'citation-mobile-edit', attr: { type: 'button' } });
    this.preview = container.createDiv({ cls: 'citation-mobile-preview markdown-rendered' });
    this.input = container.createEl('textarea', { cls: 'citation-mobile-input', attr: {
      'aria-label': options.label ?? '引用正文', rows: '3', spellcheck: 'true'
    } });
    this.input.value = options.value;
    this.input.hidden = true;
    const tap = new TouchTap();
    component.registerDomEvent(container, 'pointerdown', event => tap.begin(event.pointerId, event.clientX, event.clientY), { passive: true });
    component.registerDomEvent(container, 'pointermove', event => tap.move(event.pointerId, event.clientX, event.clientY), { passive: true });
    component.registerDomEvent(container, 'pointerup', event => tap.end(event.pointerId));
    component.registerDomEvent(container, 'pointercancel', () => tap.cancel());
    component.registerDomEvent(container, 'click', event => {
      if (tap.suppressed && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    component.registerDomEvent(this.preview, 'click', event => {
      const target = event.target as HTMLElement;
      if (target.closest('a,button,.external-link,.internal-link')) return;
      options.onFocus?.(); this.focus();
    });
    component.registerDomEvent(this.toggle, 'click', () => {
      if (this.input.hidden) { options.onFocus?.(); this.setEditable(true); this.focus(); }
      else { this.blur(); this.setEditable(false); }
    });
    component.registerDomEvent(this.input, 'input', () => { options.onChange(this.input.value); this.resize(); });
    component.registerDomEvent(this.input, 'compositionstart', () => { this.composing = true; });
    component.registerDomEvent(this.input, 'compositionend', () => { this.composing = false; options.onChange(this.input.value); });
    component.registerDomEvent(this.input, 'focus', () => options.onFocus?.());
    component.registerDomEvent(this.input, 'blur', () => options.onBlur?.());
    void this.render();
  }

  get focused(): boolean { return this.container.ownerDocument.activeElement === this.input; }
  get isComposing(): boolean { return this.composing; }
  getValue(): string { return this.input.value; }
  setValue(value: string): void { this.input.value = value; this.resize(); void this.render(); }
  setEditable(editable: boolean): void {
    this.input.hidden = !editable;
    this.preview.hidden = editable;
    this.toggle.textContent = editable ? '预览正文' : '编辑正文';
    this.toggle.setAttribute('aria-expanded', String(editable));
    if (editable) this.resize(); else void this.render();
    this.options.onLayout?.();
  }
  focus(): void { this.setEditable(true); this.input.focus({ preventScroll: true }); }
  focusAtCoords(_x: number, _y: number): void { this.focus(); }
  blur(): void { this.input.blur(); }
  ownsTarget(target: EventTarget | null): boolean {
    return !!target && 'nodeType' in target && this.container.contains(target as Node);
  }
  destroy(): void {
    this.alive = false; this.rendering++;
    if (this.renderChild) this.component.removeChild(this.renderChild);
    this.renderChild = null;
    this.container.empty();
  }
  private resize(): void {
    this.input.style.height = 'auto';
    this.input.style.height = `${Math.max(96, this.input.scrollHeight)}px`;
    this.options.onLayout?.();
  }
  private async render(): Promise<void> {
    const serial = ++this.rendering;
    const root = this.container.ownerDocument.createElement('div');
    const child = this.component.addChild(this.makeComponent());
    try {
      await MarkdownRenderer.render(this.app, this.input.value, root, this.options.path, child);
      if (!this.alive || serial !== this.rendering) { this.component.removeChild(child); return; }
      if (this.renderChild) this.component.removeChild(this.renderChild);
      this.renderChild = child;
      this.preview.replaceChildren(root);
      this.options.onLayout?.();
    } catch {
      this.component.removeChild(child);
      if (this.alive && serial === this.rendering) this.preview.textContent = this.input.value;
    }
  }
}
