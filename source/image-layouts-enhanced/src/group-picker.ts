import type { App } from 'obsidian';
import { AnchoredPopover } from './popover';
import type { GalleryImage } from './types';

export interface ContinuousRange { first: number; last: number }
const columns = 4;
const clampIndex = (index: number, count: number) => Math.max(0, Math.min(count - 1, Number.isFinite(index) ? Math.trunc(index) : 0));

/** Range indexes follow the original Markdown order and are inclusive. */
export function anchoredRange(anchor: number, target: number, count: number): ContinuousRange {
  if (!Number.isFinite(count) || count < 1) return { first: -1, last: -1 };
  const first = clampIndex(anchor, count), last = clampIndex(target, count);
  return { first: Math.min(first, last), last: Math.max(first, last) };
}

/** Painting adds every visited image and keeps the resulting source range continuous. */
export function extendRange(range: ContinuousRange, target: number, count: number): ContinuousRange {
  if (range.first < 0 || range.last < 0) return anchoredRange(target, target, count);
  const valid = anchoredRange(range.first, range.last, count);
  if (valid.first < 0) return valid;
  const index = clampIndex(target, count);
  return { first: Math.min(valid.first, index), last: Math.max(valid.last, index) };
}

export function pickerImageName(image: Pick<GalleryImage, 'alt' | 'target'>): string {
  const clean = (text: string) => text.split('|').map(part => part.trim())
    .filter(part => part && !/^\d+(?:\s*x\s*\d+)?(?:px)?$/i.test(part)).join(' · ');
  return clean(image.alt) || clean(image.target.split(/[\\/]/).pop() || '') || '图片';
}

/** Compact local picker. The caller performs source changes after this panel closes. */
export class GalleryGroupPicker {
  private readonly images: GalleryImage[];
  private readonly anchor: number;
  private readonly popover: AnchoredPopover;
  private range: ContinuousRange;
  private summary?: HTMLElement;
  private confirm?: HTMLButtonElement;
  private list?: HTMLElement;
  private cards: HTMLButtonElement[] = [];
  private opened = false;
  private closed = false;
  private submitted = false;
  private paintPointer: number | null = null;
  private suppressContextUntil = 0;
  private suppressClickUntil = 0;

  constructor(_app: App, images: GalleryImage[], anchorIndex: number,
    private readonly chosen: (first: number, last: number) => void, anchorEl?: HTMLElement) {
    this.images = images.map(image => ({ ...image }));
    this.anchor = this.images.length ? clampIndex(anchorIndex, this.images.length) : -1;
    this.range = anchoredRange(this.anchor, this.anchor, this.images.length);
    this.popover = new AnchoredPopover(anchorEl, '选择组成画廊的图片', () => this.cleanup());
    this.popover.el.classList.add('ilg-group-picker');
  }

  get el(): HTMLDivElement { return this.popover.el; }
  get contentEl(): HTMLDivElement { return this.popover.contentEl; }

  open(): void {
    if (this.opened || this.closed) return;
    this.opened = true;
    this.render();
    this.popover.open();
    this.cards[this.anchor]?.focus({ preventScroll: true });
  }

  close(): void { this.popover.close(); }

  private create<K extends keyof HTMLElementTagNameMap>(tag: K, parent: HTMLElement, className: string, text = ''): HTMLElementTagNameMap[K] {
    const element = this.contentEl.ownerDocument.createElement(tag);
    element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  private render(): void {
    this.contentEl.replaceChildren();
    this.list = this.create('div', this.contentEl, 'ilg-group-picker-list');
    this.list.setAttribute('role', 'group');
    this.list.setAttribute('aria-label', '按正文顺序排列的图片');
    this.images.forEach((image, index) => {
      const name = pickerImageName(image);
      const card = this.create('button', this.list!, 'ilg-group-picker-card');
      card.type = 'button';
      card.dataset.index = String(index);
      card.title = `${index + 1} · ${name}`;
      card.setAttribute('aria-label', `第 ${index + 1} 张图片：${name}`);
      if (index === this.anchor) card.setAttribute('aria-current', 'true');
      const preview = this.create('span', card, 'ilg-group-picker-preview');
      const img = this.create('img', preview, '');
      img.alt = name;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.draggable = false;
      const failure = () => {
        img.hidden = true;
        if (!preview.querySelector('.ilg-group-picker-placeholder')) this.create('span', preview, 'ilg-group-picker-placeholder', '…');
      };
      this.popover.listen(img, 'error', failure);
      if (image.missing || !image.src) failure();
      else img.src = image.src;
      const label = this.create('span', card, 'ilg-group-picker-card-label');
      this.create('span', label, 'ilg-group-picker-number', String(index + 1));
      this.create('span', label, 'ilg-group-picker-description', name);
      this.popover.listen(card, 'click', event => {
        event.stopPropagation();
        const mouse = event as MouseEvent;
        if (mouse.button !== 0 || this.paintPointer !== null || Date.now() < this.suppressClickUntil) { event.preventDefault(); return; }
        this.applyRange(anchoredRange(this.anchor, index, this.images.length));
      });
      this.popover.listen(card, 'pointerdown', event => {
        event.stopPropagation();
        const pointer = event as PointerEvent;
        if (pointer.button !== 2) return;
        event.preventDefault();
        this.paintPointer = pointer.pointerId;
        this.suppressContextUntil = Date.now() + 1000;
        this.paint(index);
        card.focus({ preventScroll: true });
      });
      this.popover.listen(card, 'pointerover', event => {
        event.stopPropagation();
        const pointer = event as PointerEvent;
        if (this.paintPointer === pointer.pointerId && (pointer.buttons & 2) !== 0) this.paint(index);
      });
      this.popover.listen(card, 'keydown', event => this.keydown(event as KeyboardEvent, index));
      // Target handlers keep image gestures away from Toolkit and note-level handlers.
      for (const name of ['dblclick', 'mousedown', 'mouseup', 'pointerup', 'pointermove', 'pointerout', 'pointerenter', 'pointerleave', 'pointercancel', 'auxclick']) {
        this.popover.listen(card, name, event => {
          event.stopPropagation();
          if (name === 'dblclick' || name === 'auxclick' || ((event as MouseEvent).button === 2 && name === 'mousedown')) event.preventDefault();
        });
      }
      this.popover.listen(card, 'contextmenu', event => { event.preventDefault(); event.stopPropagation(); });
      this.popover.listen(card, 'dragstart', event => { event.preventDefault(); event.stopPropagation(); });
      this.cards.push(card);
    });

    const footer = this.create('div', this.contentEl, 'ilg-group-picker-footer');
    this.summary = this.create('span', footer, 'ilg-group-picker-summary');
    this.summary.setAttribute('role', 'status');
    this.summary.setAttribute('aria-live', 'polite');
    this.confirm = this.create('button', footer, 'ilg-group-picker-confirm', '布局');
    this.confirm.type = 'button';
    this.confirm.setAttribute('aria-label', '选择布局');
    this.popover.listen(this.confirm, 'click', event => {
      event.stopPropagation();
      event.preventDefault();
      if (this.submitted || !this.images.length || this.range.first < 0 || this.range.last < this.range.first) return;
      this.submitted = true;
      const { first, last } = this.range;
      this.close();
      this.chosen(first, last);
    });
    this.registerPaintTracking();
    this.update();
  }

  private registerPaintTracking(): void {
    const doc = this.contentEl.ownerDocument;
    this.popover.listen(doc, 'pointermove', event => {
      const pointer = event as PointerEvent;
      if (this.paintPointer === null || pointer.pointerId !== this.paintPointer) return;
      event.stopPropagation();
      event.preventDefault();
      if ((pointer.buttons & 2) === 0) { this.stopPainting(); return; }
      const target = doc.elementFromPoint(pointer.clientX, pointer.clientY);
      const card = target?.closest<HTMLButtonElement>('.ilg-group-picker-card');
      if (!card || !this.el.contains(card)) return;
      const index = Number(card.dataset.index);
      if (Number.isInteger(index) && index >= 0 && index < this.images.length) this.paint(index);
    }, true);
    for (const name of ['pointerup', 'pointercancel']) this.popover.listen(doc, name, event => {
      const pointer = event as PointerEvent;
      if (this.paintPointer === null || pointer.pointerId !== this.paintPointer) return;
      event.stopPropagation();
      event.preventDefault();
      this.stopPainting();
    }, true);
    this.popover.listen(doc, 'contextmenu', event => {
      const target = event.target as Node | null;
      if (this.paintPointer !== null || Date.now() < this.suppressContextUntil || (target && this.el.contains(target))) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    this.popover.listen(doc, 'auxclick', event => {
      if ((event as MouseEvent).button === 2 && Date.now() < this.suppressContextUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    if (doc.defaultView) this.popover.listen(doc.defaultView, 'blur', () => this.stopPainting());
  }

  private stopPainting(): void {
    if (this.paintPointer === null) return;
    this.paintPointer = null;
    this.suppressContextUntil = Date.now() + 500;
    this.suppressClickUntil = Date.now() + 200;
  }

  private paint(index: number): void { this.applyRange(extendRange(this.range, index, this.images.length)); }

  private applyRange(range: ContinuousRange): void {
    if (range.first === this.range.first && range.last === this.range.last) return;
    this.range = range;
    this.update();
  }

  private update(): void {
    const count = this.range.first >= 0 ? this.range.last - this.range.first + 1 : 0;
    if (this.summary) this.summary.textContent = `${count}张`;
    this.cards.forEach((card, index) => {
      const selected = index >= this.range.first && index <= this.range.last;
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    });
    if (this.confirm) this.confirm.disabled = count === 0 || this.submitted;
  }

  private keydown(event: KeyboardEvent, index: number): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.key === 'ArrowLeft' ? index - 1 : event.key === 'ArrowRight' ? index + 1 :
      event.key === 'ArrowUp' ? index - columns : event.key === 'ArrowDown' ? index + columns :
      event.key === 'Home' ? 0 : event.key === 'End' ? this.images.length - 1 : undefined;
    if (target === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    const next = clampIndex(target, this.images.length);
    this.cards[next]?.focus({ preventScroll: true });
    this.applyRange(anchoredRange(this.anchor, next, this.images.length));
    const card = this.cards[next], list = this.list;
    if (card && list) {
      const top = card.offsetTop;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (top + card.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + card.offsetHeight - list.clientHeight;
    }
  }

  private cleanup(): void {
    this.stopPainting();
    this.closed = true;
    this.cards = [];
    this.list = undefined;
    this.summary = this.confirm = undefined;
    this.contentEl.replaceChildren();
  }
}
