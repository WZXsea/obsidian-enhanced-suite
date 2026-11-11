import { App, Modal, setIcon } from 'obsidian';
import type { GalleryImage } from './types';
import {ImageGestures,attachImageGestures} from './gestures';

/** Independent viewer used when the optional Image Toolkit adapter is unavailable. */
export class GalleryViewer extends Modal {
  private index: number;
  private gestures = new ImageGestures();
  private rotation = 0;
  private image!: HTMLImageElement;
  private stage!: HTMLElement;
  private count!: HTMLElement;
  private caption!: HTMLElement;
  private error!: HTMLElement;
  private previous!: HTMLButtonElement;
  private next!: HTMLButtonElement;
  private dispose: Array<() => void> = [];
  private observer?:ResizeObserver;

  constructor(app: App, private readonly images: GalleryImage[], index: number) {
    super(app);
    this.index = Math.max(0, Math.min(images.length - 1, Number.isFinite(index) ? Math.trunc(index) : 0));
  }

  onOpen(): void {
    this.modalEl.addClass('ilg-viewer');
    this.titleEl.setText('图片预览');
    const toolbar = this.contentEl.createDiv('ilg-viewer-toolbar');
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', '图片查看工具');
    const button = (icon: string, title: string, action: () => void): HTMLButtonElement => {
      const element = toolbar.createEl('button', { attr: { type: 'button', 'aria-label': title, title } });
      setIcon(element, icon);
      this.listen(element, 'click', action);
      return element;
    };
    this.previous = button('chevron-left', '上一张（←）', () => this.change(-1));
    this.next = button('chevron-right', '下一张（→）', () => this.change(1));
    button('zoom-in', '放大（＋）', () => this.zoom(1.25));
    button('zoom-out', '缩小（－）', () => this.zoom(0.8));
    button('maximize', '适应窗口（0）', () => this.reset());
    button('rotate-cw', '顺时针旋转（R）', () => this.rotate());
    button('x', '关闭图片预览', () => this.close());
    this.count = toolbar.createSpan('ilg-viewer-count');
    this.count.setAttribute('aria-live', 'polite');
    this.stage = this.contentEl.createDiv('ilg-viewer-stage');
    this.stage.setAttribute('aria-label', '双指或滚轮缩放，拖动平移，双击恢复');
    this.image = this.stage.createEl('img', { attr: { draggable: 'false', decoding: 'async' } });
    this.error = this.stage.createDiv({ cls: 'ilg-viewer-error', text: '图片加载失败，可切换其他图片' });
    this.error.setAttribute('role', 'status');
    this.error.hidden = true;
    this.caption = this.contentEl.createDiv('ilg-viewer-caption');
    this.caption.setAttribute('aria-live', 'polite');
    this.listen(this.image, 'error', () => { this.error.hidden = false; this.image.hidden = true; });
    this.listen(this.image, 'load', () => { this.error.hidden = true; this.image.hidden = false; this.transform(); });
    this.listen(this.stage, 'wheel', (event: WheelEvent) => {
      event.preventDefault();
      if (event.deltaY !== 0) this.zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    this.listen(this.stage, 'dblclick', () => this.reset());
    this.dispose.push(attachImageGestures(this.stage, this.gestures, () => this.transform()));
    const Observer=this.stage.ownerDocument.defaultView?.ResizeObserver;
    if(Observer){this.observer=new Observer(()=>this.transform());this.observer.observe(this.stage);}
    this.scope.register([], 'ArrowLeft', () => { this.change(-1); return false; });
    this.scope.register([], 'ArrowRight', () => { this.change(1); return false; });
    this.scope.register([], '+', () => { this.zoom(1.25); return false; });
    this.scope.register(['Shift'], '=', () => { this.zoom(1.25); return false; });
    this.scope.register([], '=', () => { this.zoom(1.25); return false; });
    this.scope.register([], '-', () => { this.zoom(0.8); return false; });
    this.scope.register([], '0', () => { this.reset(); return false; });
    this.scope.register([], 'r', () => { this.rotate(); return false; });
    this.show();
  }

  private listen<K extends keyof HTMLElementEventMap>(element: HTMLElement, type: K,
    listener: (event: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions): void {
    const handler = listener as EventListener;
    element.addEventListener(type, handler, options);
    this.dispose.push(() => element.removeEventListener(type, handler, options));
  }

  private change(delta: number): void {
    if (this.images.length < 2) return;
    this.index = (this.index + delta + this.images.length) % this.images.length;
    this.show();
  }

  private show(): void {
    const item = this.images[this.index];
    this.previous.disabled = this.next.disabled = this.images.length < 2;
    this.count.setText(item ? `${this.index + 1} / ${this.images.length}` : '0 / 0');
    this.caption.setText(item?.alt || item?.target || '');
    this.caption.hidden = !this.caption.textContent;
    this.image.hidden = !item;
    this.error.hidden = true;
    if (item) { this.image.src = item.src; this.image.alt = item.alt; }
    this.reset();
  }

  private zoom(factor: number): void {
    this.gestures.zoom(factor);
    this.transform();
  }

  private rotate(): void { this.rotation = (this.rotation + 90) % 360; this.transform(); }
  private reset(): void { this.gestures.reset(); this.rotation = 0; this.transform(); }
  private transform(): void {
    const rect=this.stage.getBoundingClientRect(),swapped=Math.abs(this.rotation%180)===90;
    this.image.style.maxWidth=`${swapped?rect.height:rect.width}px`;
    this.image.style.maxHeight=`${swapped?rect.width:rect.height}px`;
    this.image.style.transform = `translate(${this.gestures.x}px, ${this.gestures.y}px) rotate(${this.rotation}deg) scale(${this.gestures.scale})`;
  }

  onClose(): void {
    this.observer?.disconnect();this.observer=undefined;
    for (const dispose of this.dispose.splice(0)) dispose();
    this.contentEl.empty();
  }
}
