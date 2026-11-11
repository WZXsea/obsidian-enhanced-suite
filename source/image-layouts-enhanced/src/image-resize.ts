export interface ImageResizeContext {
  save: (width: number) => Promise<void>;
}

type SavedStyle = {name: string; value: string; priority: string};
type Preview = {image: HTMLImageElement; styles: SavedStyle[]; hadStyle: boolean; restored: boolean};
type Drag = Preview & {
  pointer: number | null;
  startX: number;
  startWidth: number;
  width: number;
  maxWidth: number;
  centered: boolean;
  ratio: number;
  context: ImageResizeContext;
};

/** A corner control owns capture and temporary styles; the image keeps its normal gestures. */
export class ImageResizeHandle {
  private readonly root: HTMLDivElement;
  private readonly handle: HTMLButtonElement;
  private readonly readout: HTMLSpanElement;
  private readonly win: (Window & typeof globalThis) | null;
  private readonly dispose: Array<() => void> = [];
  private visibleDispose: Array<() => void> = [];
  private image?: HTMLImageElement;
  private context?: ImageResizeContext;
  private container?: HTMLElement;
  private drag?: Drag;
  private pending?: Preview;
  private frame = 0;
  private nextX?: number;
  private destroyed = false;

  constructor(private readonly doc: Document) {
    this.win = doc.defaultView;
    this.root = doc.createElement('div');
    this.root.className = 'ilg-image-resize';
    this.root.hidden = true;
    this.root.setAttribute('data-ilg-interactive', '1');
    this.handle = doc.createElement('button');
    this.handle.type = 'button';
    this.handle.className = 'ilg-image-resize-handle';
    this.handle.setAttribute('role', 'slider');
    this.handle.setAttribute('aria-orientation', 'horizontal');
    this.handle.setAttribute('aria-label', '调整图片宽度');
    this.handle.title = '拖动调整图片大小';
    this.root.appendChild(this.handle);
    this.readout = doc.createElement('span');
    this.readout.className = 'ilg-image-resize-readout';
    this.readout.setAttribute('aria-hidden', 'true');
    this.root.appendChild(this.readout);
    doc.body.appendChild(this.root);
    this.listen(this.handle, 'pointerdown', event => this.down(event as PointerEvent));
    this.listen(this.handle, 'pointermove', event => this.move(event as PointerEvent));
    this.listen(this.handle, 'pointerup', event => {
      if (this.drag?.pointer !== (event as PointerEvent).pointerId) return;
      this.flush();
      this.commit();
    });
    for (const type of ['pointercancel', 'lostpointercapture']) {
      this.listen(this.handle, type, event => {
        if (this.drag?.pointer === (event as PointerEvent).pointerId) this.abort();
      });
    }
    this.listen(this.handle, 'keydown', event => this.key(event as KeyboardEvent));
    this.listen(this.handle, 'click', event => { event.preventDefault(); event.stopPropagation(); });
  }

  get active(): boolean { return Boolean(this.drag || this.pending); }

  contains(target: Node | null): boolean { return Boolean(target && this.root.contains(target)); }

  show(image: HTMLImageElement, context: ImageResizeContext): void {
    if (this.destroyed || this.active) return;
    if (this.image === image) { this.context = context; this.position(); return; }
    this.hide();
    if (!image.isConnected) return;
    this.image = image;
    this.context = context;
    this.container = this.findContainer(image);
    this.root.hidden = false;
    this.handle.disabled = false;
    if (!this.position()) return;

    const listen = (target: EventTarget, type: string, callback: EventListener, capture = false) => {
      target.addEventListener(type, callback, capture);
      this.visibleDispose.push(() => target.removeEventListener(type, callback, capture));
    };
    listen(this.doc, 'scroll', () => this.hide(), true);
    listen(this.doc, 'keydown', event => {
      const key = event as KeyboardEvent;
      if (key.key === 'Escape' && !key.isComposing && key.keyCode !== 229) this.hide();
    }, true);
    if (this.win) {
      listen(this.win, 'resize', () => this.hide());
      listen(this.win, 'blur', () => this.hide());
      if (this.win.visualViewport) {
        listen(this.win.visualViewport, 'resize', () => this.hide());
        listen(this.win.visualViewport, 'scroll', () => this.hide());
      }
      const containerWidth = this.container?.getBoundingClientRect().width;
      const observer = new this.win.ResizeObserver(() => {
        if (!this.image?.isConnected || (containerWidth !== undefined && this.container &&
          Math.abs(this.container.getBoundingClientRect().width - containerWidth) > .5)) this.hide();
        else this.position();
      });
      observer.observe(image);
      if (this.container) observer.observe(this.container);
      this.visibleDispose.push(() => observer.disconnect());
      const mutation = new this.win.MutationObserver(() => {
        if (!image.isConnected) this.hide();
      });
      mutation.observe(this.doc.documentElement, {childList: true, subtree: true});
      this.visibleDispose.push(() => mutation.disconnect());
    }
  }

  hide(): void {
    this.visibleDispose.splice(0).forEach(dispose => dispose());
    this.abort();
    if (this.pending) this.restore(this.pending);
    this.pending = undefined;
    this.image = undefined;
    this.context = undefined;
    this.container = undefined;
    this.root.hidden = true;
    this.handle.disabled = false;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.hide();
    this.dispose.splice(0).forEach(dispose => dispose());
    this.root.remove();
  }

  private findContainer(image: HTMLImageElement): HTMLElement | undefined {
    let element = image.parentElement;
    while (element && (element.matches('.image-embed, .image-wrapper, a') ||
      this.win?.getComputedStyle(element).display === 'contents')) element = element.parentElement;
    return element ?? undefined;
  }

  private contentBounds(): {left: number; width: number} {
    const element = this.container;
    if (!element || !this.win) return {left: 0, width: Math.max(32, this.win?.innerWidth ?? 32)};
    const rect = element.getBoundingClientRect();
    const style = this.win.getComputedStyle(element);
    const left = parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
    const right = parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth);
    return {left: rect.left + left, width: Math.max(32, rect.width - left - right)};
  }

  private isCentered(image: HTMLImageElement): boolean {
    const marked = image.closest<HTMLElement>('[data-ilg-image-align], [data-ilg-align]');
    const align = marked?.dataset.ilgImageAlign ?? marked?.dataset.ilgAlign ?? image.getAttribute('align');
    if (align === 'center') return true;
    if (align === 'left' || align === 'right') return false;
    const rect = image.getBoundingClientRect(), bounds = this.contentBounds();
    return Math.abs(rect.left + rect.width / 2 - bounds.left - bounds.width / 2) < 3;
  }

  private start(pointer: number | null, x: number): Drag | undefined {
    const image = this.image, context = this.context;
    if (!image?.isConnected || !context || this.active) return;
    const rect = image.getBoundingClientRect();
    const drag: Drag = {
      image, context, pointer, startX: x, startWidth: rect.width,
      width: rect.width, maxWidth: Math.floor(this.contentBounds().width),
      centered: this.isCentered(image),
      ratio: image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : rect.width / rect.height,
      styles: ['width', 'height', 'max-width', 'max-height'].map(name => ({
        name, value: image.style.getPropertyValue(name), priority: image.style.getPropertyPriority(name),
      })), hadStyle: image.hasAttribute('style'), restored: false,
    };
    this.drag = drag;
    this.root.classList.add('is-dragging');
    return drag;
  }

  private down(event: PointerEvent): void {
    if (this.pending || event.button !== 0) return;
    if (this.drag) { if (this.drag.pointer !== event.pointerId) this.abort(); return; }
    if (!this.start(event.pointerId, event.clientX)) return;
    event.preventDefault();
    event.stopPropagation();
    try { this.handle.setPointerCapture(event.pointerId); }
    catch { this.abort(); }
  }

  private move(event: PointerEvent): void {
    if (!this.drag || this.drag.pointer !== event.pointerId) return;
    this.nextX = event.clientX;
    if (!this.frame && this.win) this.frame = this.win.requestAnimationFrame(() => {
      this.frame = 0;
      this.flush();
    });
  }

  private flush(): void {
    if (this.frame) this.win?.cancelAnimationFrame(this.frame);
    this.frame = 0;
    const drag = this.drag, x = this.nextX;
    this.nextX = undefined;
    if (!drag || x === undefined) return;
    this.preview(drag, drag.startWidth + (x - drag.startX) * (drag.centered ? 2 : 1));
  }

  private preview(drag: Drag, requested: number): void {
    drag.width = Math.round(Math.max(32, Math.min(drag.maxWidth, requested)));
    drag.image.style.setProperty('width', `${drag.width}px`, 'important');
    drag.image.style.setProperty('height', 'auto', 'important');
    drag.image.style.setProperty('max-width', `${drag.maxWidth}px`, 'important');
    drag.image.style.setProperty('max-height', 'none', 'important');
    this.updateValue(drag.width, drag.maxWidth);
    this.readout.textContent = `${drag.width} × ${Math.round(drag.width / drag.ratio)} px`;
    this.position();
  }

  private commit(): void {
    const drag = this.drag;
    if (!drag) return;
    if (Math.abs(drag.width - drag.startWidth) < .5) { this.abort(); return; }
    this.drag = undefined;
    this.root.classList.remove('is-dragging');
    this.pending = drag;
    this.handle.disabled = true;
    this.release(drag.pointer);
    void Promise.resolve().then(() => drag.context.save(drag.width)).catch(() => undefined).finally(() => {
      this.restore(drag);
      if (this.pending === drag) { this.pending = undefined; this.hide(); }
    });
  }

  private abort(): void {
    if (this.frame) this.win?.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.nextX = undefined;
    const drag = this.drag;
    this.drag = undefined;
    this.root.classList.remove('is-dragging');
    if (drag) { this.restore(drag); this.release(drag.pointer); }
  }

  private restore(preview: Preview): void {
    if (preview.restored) return;
    preview.restored = true;
    for (const style of preview.styles) {
      if (style.value) preview.image.style.setProperty(style.name, style.value, style.priority);
      else preview.image.style.removeProperty(style.name);
    }
    if (!preview.hadStyle && preview.image.style.length === 0) preview.image.removeAttribute('style');
  }

  private release(pointer: number | null): void {
    if (pointer !== null && this.handle.hasPointerCapture(pointer)) this.handle.releasePointerCapture(pointer);
  }

  private key(event: KeyboardEvent): void {
    if (event.isComposing || event.keyCode === 229 || this.active) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const drag = this.start(null, 0);
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 50 : 10;
    this.preview(drag, event.key === 'Home' ? 32 : event.key === 'End' ? drag.maxWidth : drag.startWidth + (event.key === 'ArrowRight' ? step : -step));
    this.commit();
  }

  private updateValue(width: number, maxWidth: number): void {
    this.handle.setAttribute('aria-valuemin', '32');
    this.handle.setAttribute('aria-valuemax', String(Math.round(maxWidth)));
    this.handle.setAttribute('aria-valuenow', String(Math.round(width)));
    this.handle.setAttribute('aria-valuetext', `图片宽度 ${Math.round(width)} 像素`);
  }

  private position(): boolean {
    const image = this.image;
    if (!image?.isConnected) { this.hide(); return false; }
    const rect = image.getBoundingClientRect();
    const width = this.win?.innerWidth ?? this.doc.documentElement.clientWidth;
    const height = this.win?.innerHeight ?? this.doc.documentElement.clientHeight;
    if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= height || rect.right <= 0 || rect.left >= width) {
      this.hide(); return false;
    }
    this.root.style.left = `${Math.max(8, Math.min(width - 8, rect.right))}px`;
    this.root.style.top = `${Math.max(8, Math.min(height - 8, rect.bottom))}px`;
    if (!this.drag) this.updateValue(rect.width, this.contentBounds().width);
    return true;
  }

  private listen(target: EventTarget, type: string, callback: EventListener): void {
    target.addEventListener(type, callback);
    this.dispose.push(() => target.removeEventListener(type, callback));
  }
}
