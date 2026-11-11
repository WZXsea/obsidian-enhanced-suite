import { AnchoredPopover } from './popover';

export interface ReferenceEditorOptions {
  /** Stable note/group identity supplied by the caller, independent of DOM replacement. */
  draftKey?: string;
}

interface ReferenceDraft { source: string; value: string }
const documentDrafts = new WeakMap<Document, Map<string, ReferenceDraft>>();
const anchorDrafts = new WeakMap<HTMLElement, ReferenceDraft>();
const draftLimit = 64;
let editorSequence = 0;

/** Edits only native image references and captions next to the existing gallery. */
export class ReferenceEditor {
  private readonly popover: AnchoredPopover;
  private readonly input: HTMLTextAreaElement;
  private readonly status: HTMLSpanElement;
  private readonly saveButton: HTMLButtonElement;
  private readonly cancelButton: HTMLButtonElement;
  private readonly normalizedSource: string;
  private readonly draftKey?: string;
  private readonly drafts?: Map<string, ReferenceDraft>;
  private record?: ReferenceDraft;
  private opened = false;
  private closed = false;
  private composing = false;
  private saving = false;
  private deliberateClose = false;

  constructor(
    private readonly anchor: HTMLElement,
    private readonly sourceBody: string,
    private readonly saveBody: (body: string) => Promise<void>,
    options: ReferenceEditorOptions = {},
  ) {
    this.popover = new AnchoredPopover(anchor, '图片引用与图注', () => this.onClose());
    this.popover.el.classList.add('ilg-reference-editor');
    this.normalizedSource = sourceBody.replace(/\r\n?/g, '\n');
    this.draftKey = options.draftKey;
    if (this.draftKey !== undefined) {
      const doc = this.popover.el.ownerDocument;
      let drafts = documentDrafts.get(doc);
      if (!drafts) { drafts = new Map(); documentDrafts.set(doc, drafts); }
      this.drafts = drafts;
    }
    const recovered = this.drafts ? this.drafts.get(this.draftKey!) : anchorDrafts.get(anchor);
    if (recovered?.source === sourceBody) this.record = recovered;
    const doc = this.popover.el.ownerDocument;
    const label = doc.createElement('label');
    label.className = 'ilg-reference-label';
    label.textContent = '图片引用与图注';
    this.input = doc.createElement('textarea');
    this.input.className = 'ilg-reference-input';
    this.input.id = `ilg-reference-${++editorSequence}`;
    label.htmlFor = this.input.id;
    this.input.setAttribute('aria-label', '图片引用与图注');
    this.input.spellcheck = false;
    this.input.value = this.record?.value ?? this.normalizedSource;
    const footer = doc.createElement('div');
    footer.className = 'ilg-reference-footer';
    this.status = doc.createElement('span');
    this.status.className = 'ilg-reference-status';
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    if (this.record) this.status.textContent = '已恢复草稿';
    this.cancelButton = doc.createElement('button');
    this.cancelButton.type = 'button';
    this.cancelButton.className = 'ilg-reference-cancel';
    this.cancelButton.textContent = '取消';
    this.saveButton = doc.createElement('button');
    this.saveButton.type = 'button';
    this.saveButton.className = 'ilg-reference-save mod-cta';
    this.saveButton.textContent = '保存';
    this.saveButton.title = '保存（⌘ / Ctrl + Enter）';
    footer.append(this.status, this.cancelButton, this.saveButton);
    this.popover.contentEl.append(label, this.input, footer);

    this.popover.listen(this.cancelButton, 'click', event => { event.preventDefault(); event.stopPropagation(); this.cancel(); });
    this.popover.listen(this.saveButton, 'click', event => { event.preventDefault(); event.stopPropagation(); void this.submit(); });
    this.popover.listen(this.input, 'input', () => {
      this.rememberDraft();
      if (this.status.classList.contains('is-error')) {
        this.status.classList.remove('is-error');
        this.status.textContent = '';
      }
    });
    this.popover.listen(this.input, 'compositionstart', () => { this.composing = true; });
    this.popover.listen(this.input, 'compositionend', () => { this.composing = false; this.rememberDraft(); });
    this.popover.listen(this.input, 'contextmenu', event => event.stopPropagation());

    // Owner-window capture keeps popup shortcuts ahead of the note's document hotkeys.
    const shortcut: EventListener = event => {
      const key = event as KeyboardEvent;
      if (!this.containsEvent(event)) return;
      if (key.key === 'Escape') {
        event.stopImmediatePropagation();
        if (this.isComposing(key)) return;
        event.preventDefault();
        if (!this.saving) this.cancel();
      } else if (key.key === 'Enter' && (key.ctrlKey || key.metaKey)) {
        event.stopImmediatePropagation();
        if (this.isComposing(key)) return;
        event.preventDefault();
        void this.submit();
      }
    };
    if (doc.defaultView) this.popover.listen(doc.defaultView, 'keydown', shortcut, true);
    this.popover.listen(doc, 'keydown', shortcut, true);
    this.popover.listen(this.popover.el, 'keydown', event => {
      event.stopPropagation();
      const key = event as KeyboardEvent;
      if (key.key === 'Enter' && (key.ctrlKey || key.metaKey) && !this.isComposing(key)) {
        event.preventDefault();
        void this.submit();
      }
    });
    // Plain typing, Chinese composition, paste and multiline edits stay in the textarea.
    for (const event of ['keyup', 'beforeinput', 'input', 'compositionstart', 'compositionupdate', 'compositionend', 'paste', 'cut', 'copy']) {
      this.popover.listen(this.popover.el, event, event => event.stopPropagation());
    }
  }

  get el(): HTMLDivElement { return this.popover.el; }
  get contentEl(): HTMLDivElement { return this.popover.contentEl; }

  open(): void {
    if (this.opened || this.closed) return;
    if (!this.anchor.isConnected) { this.close(); return; }
    this.opened = true;
    this.popover.open();
    if (!this.closed) this.input.focus({ preventScroll: true });
  }

  /** Automatic closes retain an edited draft in this document's bounded session cache. */
  close(): void { this.popover.close(); }

  private containsEvent(event: Event): boolean {
    return event.composedPath().includes(this.popover.el) ||
      Boolean(event.target && this.popover.el.contains(event.target as Node));
  }

  private isComposing(event: KeyboardEvent): boolean {
    return this.composing || event.isComposing || event.keyCode === 229;
  }

  private rememberDraft(): void {
    if (this.deliberateClose) return;
    if (this.input.value === this.normalizedSource) { this.clearDraft(); return; }
    this.record = { source: this.sourceBody, value: this.input.value };
    if (this.drafts) {
      this.drafts.delete(this.draftKey!);
      this.drafts.set(this.draftKey!, this.record);
      while (this.drafts.size > draftLimit) this.drafts.delete(this.drafts.keys().next().value!);
    } else anchorDrafts.set(this.anchor, this.record);
  }

  private clearDraft(force = false): void {
    // A completed older save keeps a newer editor's independently edited draft intact.
    if (this.drafts) {
      if (force || (this.record && this.drafts.get(this.draftKey!) === this.record)) this.drafts.delete(this.draftKey!);
    } else if (force || (this.record && anchorDrafts.get(this.anchor) === this.record)) anchorDrafts.delete(this.anchor);
    this.record = undefined;
  }

  private cancel(): void {
    if (this.saving || this.closed) return;
    this.deliberateClose = true;
    this.clearDraft(true);
    this.popover.close();
  }

  private async submit(): Promise<void> {
    if (this.closed || this.saving || this.composing) return;
    this.rememberDraft();
    this.saving = true;
    this.saveButton.disabled = this.cancelButton.disabled = true;
    this.input.readOnly = true;
    this.saveButton.textContent = '保存中…';
    this.status.classList.remove('is-error');
    this.status.textContent = '';
    const value = this.input.value;
    // Unchanged bodies retain exact bytes; edited bodies follow their source's line endings.
    const body = value === this.normalizedSource ? this.sourceBody :
      this.sourceBody.includes('\r\n') ? value.replace(/\r\n?|\n/g, '\r\n') : value;
    try {
      await this.saveBody(body);
      this.deliberateClose = true;
      this.clearDraft();
      this.popover.close();
    } catch (error) {
      if (!this.closed) {
        const reason = error instanceof Error ? error.message.slice(0, 140) : '';
        this.status.classList.add('is-error');
        this.status.textContent = reason ? `保存失败：${reason}` : '保存失败，请重试';
        this.input.focus({ preventScroll: true });
      }
    } finally {
      this.saving = false;
      if (!this.closed) {
        this.saveButton.disabled = this.cancelButton.disabled = false;
        this.input.readOnly = false;
        this.saveButton.textContent = '保存';
      }
    }
  }

  private onClose(): void {
    if (this.closed) return;
    if (!this.deliberateClose) this.rememberDraft();
    this.closed = true;
  }
}
