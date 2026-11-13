import {ImageResizeHandle} from './image-resize';

export interface ImageControlContext {
  grouped: boolean;
  layout: () => void;
  configure?: () => void;
  standalone?: boolean;
  block?: boolean;
  width?: number;
  resize?: {save: (width: number) => Promise<void>};
  restore?: () => void;
}

/** Lightweight controls above the original image, without modifying its wrapper or events. */
export class ImageControls {
  private readonly toolbar: HTMLDivElement;
  private readonly layoutButton: HTMLButtonElement;
  private readonly settingsButton: HTMLButtonElement;
  private readonly restoreButton: HTMLButtonElement;
  private resizer?: ImageResizeHandle;
  private readonly ownerWindow: Window | null;
  private image: HTMLImageElement | undefined;
  private context: ImageControlContext | undefined;
  private hideTimer: number | undefined;
  private pressTimer: number | undefined;
  private press: {id:number;x:number;y:number;image:HTMLImageElement} | undefined;
  private suppressedImage: HTMLImageElement | undefined;
  private suppressUntil = 0;
  private releaseClick = false;
  private touchControls = false;
  private readonly dispose: Array<() => void> = [];

  constructor(private readonly doc: Document, private readonly resolve: (image: HTMLImageElement) => ImageControlContext | undefined) {
    this.ownerWindow = doc.defaultView;
    this.toolbar = doc.createElement('div');
    this.toolbar.className = 'ilg-image-controls';
    this.toolbar.setAttribute('role', 'toolbar');
    this.toolbar.setAttribute('aria-label', '图片操作');
    this.toolbar.hidden = true;
    this.layoutButton = this.createButton('布局', () => this.context?.layout);
    this.settingsButton = this.createButton('设置', () => this.context?.configure);
    this.settingsButton.setAttribute('aria-label', '画廊设置');
    this.restoreButton = this.createButton('恢复尺寸', () => this.context?.restore);
    this.restoreButton.setAttribute('aria-label', '恢复笔记中的图片尺寸');
    doc.body.appendChild(this.toolbar);

    // A stationary long press exposes the same controls as desktop hover. Scroll and pinch cancel it.
    this.listen(doc, 'pointerdown', event => {
      const pointer=event as PointerEvent;
      this.releaseClick=false;this.suppressedImage=undefined;
      const target=this.element(event.target);
      if(target&&(this.toolbar.contains(target)||this.resizer?.contains(target)))return;
      if(pointer.pointerType!=='touch'){if(!this.findImage(target))this.hide();return;}
      if(this.press){this.cancelPress();return;}
      const image=this.findImage(target);
      if(!image){this.hide();return;}
      this.press={id:pointer.pointerId,x:pointer.clientX,y:pointer.clientY,image};
      this.pressTimer=this.ownerWindow?.setTimeout(()=>{
        if(!this.press)return;
        this.touchControls=true;this.suppressedImage=image;this.releaseClick=true;this.suppressUntil=Date.now()+1800;
        this.show(image);this.cancelPress();
      },450);
    },true);
    this.listen(doc,'pointermove',event=>{
      const pointer=event as PointerEvent;
      if(this.press&&(pointer.pointerId!==this.press.id||Math.hypot(pointer.clientX-this.press.x,pointer.clientY-this.press.y)>10))this.cancelPress();
    },true);
    for(const type of ['pointerup','pointercancel'])this.listen(doc,type,()=>this.cancelPress(),true);
    this.listen(doc,'click',event=>{
      const click=event as MouseEvent&{pointerType?:string};
      const compatible=click.detail!==0||click.pointerType==='touch';
      // 新工具栏可能出现在原触点下；仅吞掉这次长按抬手产生的兼容点击。
      if(this.releaseClick&&Date.now()<this.suppressUntil&&compatible){
        event.preventDefault();event.stopImmediatePropagation();this.releaseClick=false;this.suppressedImage=undefined;return;
      }
      if(compatible&&this.suppressedImage&&Date.now()<this.suppressUntil&&this.findImage(this.element(event.target))===this.suppressedImage){event.preventDefault();event.stopImmediatePropagation();this.suppressedImage=undefined;}
    },true);
    this.listen(doc,'contextmenu',event=>{
      if(this.touchControls&&this.findImage(this.element(event.target))===this.image){event.preventDefault();event.stopPropagation();}
    },true);

    this.listen(doc, 'pointerover', (event) => {
      if((event as PointerEvent).pointerType==='touch')return;
      const target = this.element(event.target);
      if (target && (this.toolbar.contains(target)||this.resizer?.contains(target))) { this.cancelHide(); return; }
      if(this.resizer?.active)return;
      const image = this.findImage(target);
      if (image) this.show(image);
    });
    this.listen(doc, 'pointerout', (event) => {
      const pointer = event as PointerEvent;
      if(pointer.pointerType==='touch'||this.touchControls||this.resizer?.active)return;
      const target = this.element(pointer.target);
      if (!target || (this.findImage(target) !== this.image && !this.toolbar.contains(target)&&!this.resizer?.contains(target))) return;
      const related = this.element(pointer.relatedTarget);
      if (related && (this.findImage(related) === this.image || this.toolbar.contains(related)||this.resizer?.contains(related))) this.cancelHide();
      else this.scheduleHide();
    });
    this.listen(doc, 'focusin', (event) => {
      const target = this.element(event.target);
      if (target && (this.toolbar.contains(target)||this.resizer?.contains(target))) { this.cancelHide(); return; }
      const image = this.findImage(target);
      if (image) this.show(image);
      else this.scheduleHide();
    });
    this.listen(doc, 'keydown', (event) => { if ((event as KeyboardEvent).key === 'Escape') this.hide(); });
    this.listen(doc, 'scroll', event => {
      this.cancelPress();
      if (this.resizer?.active) return;
      const target = event.target as Node | null;
      if (!this.image || !target || target === this.doc ||
        (typeof target.contains === 'function' && target.contains(this.image))) this.hide();
    }, true);
    this.listen(doc, 'wheel', () => { this.cancelPress(); this.hide(); }, true);
    if (this.ownerWindow) this.listen(this.ownerWindow, 'resize', () => this.hide());
  }

  destroy(): void {
    this.cancelPress();
    this.releaseClick=false;this.suppressedImage=undefined;
    this.hide();
    this.dispose.splice(0).forEach(dispose => dispose());
    this.resizer?.destroy();
    this.resizer=undefined;
    this.toolbar.remove();
  }

  isResizing(image:HTMLImageElement):boolean{return this.image===image&&Boolean(this.resizer?.active);}

  private createButton(text: string, action: () => (() => void) | undefined): HTMLButtonElement {
    const button = this.doc.createElement('button');
    button.type = 'button';
    button.textContent = text;
    this.toolbar.appendChild(button);
    this.listen(button, 'pointerdown', event => { event.preventDefault(); event.stopPropagation(); });
    this.listen(button, 'click', event => {
      event.preventDefault();
      event.stopPropagation();
      const callback = action();
      this.hide();
      callback?.();
    });
    return button;
  }

  private element(target: EventTarget | null): Element | undefined {
    const element = target as Element | null;
    return element && typeof element.closest === 'function' ? element : undefined;
  }

  private findImage(target: Element | undefined): HTMLImageElement | undefined {
    if (!target || target.closest('.ilg-viewer, .nis-viewer, .ilg-image-controls, .ilg-popover, .nis-stage')) return;
    const image = target.closest('img') ?? target.closest('button')?.querySelector('img');
    if (image?.tagName !== 'IMG' || !image.closest('.markdown-source-view, .markdown-preview-view')) return;
    return image as HTMLImageElement;
  }

  private show(image: HTMLImageElement): void {
    this.cancelHide();
    const rect = image.getBoundingClientRect();
    const viewportWidth = this.ownerWindow?.innerWidth ?? this.doc.documentElement.clientWidth;
    const viewportHeight = this.ownerWindow?.innerHeight ?? this.doc.documentElement.clientHeight;
    if (!image.isConnected || rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= viewportHeight || rect.right <= 0 || rect.left >= viewportWidth) {
      this.hide(); return;
    }
    const context = this.resolve(image);
    if (!context) { this.hide(); return; }
    this.image = image;
    this.context = context;
    const label = context.grouped ? '画廊布局' : '图片布局';
    this.layoutButton.setAttribute('aria-label', label);
    this.layoutButton.title = label;
    this.settingsButton.title = '画廊设置';
    this.settingsButton.hidden = !context.grouped;
    this.settingsButton.disabled = !context.configure;
    this.restoreButton.hidden = !context.restore;
    if(context.resize){this.resizer??=new ImageResizeHandle(this.doc);this.resizer.show(image,context.resize);}
    else this.resizer?.hide();
    this.toolbar.style.visibility = 'hidden';
    this.toolbar.hidden = false;
    const bounds = this.toolbar.getBoundingClientRect();
    const margin = 8;
    const desiredLeft = rect.width >= bounds.width + 2 * margin ? rect.right - bounds.width - margin : rect.right + 6;
    const left = Math.max(margin, Math.min(desiredLeft, Math.max(margin, viewportWidth - bounds.width - margin)));
    const top = Math.max(margin, Math.min(rect.top + margin, Math.max(margin, viewportHeight - bounds.height - margin)));
    this.toolbar.style.left = `${left}px`;
    this.toolbar.style.top = `${top}px`;
    this.toolbar.style.visibility = '';
  }

  private scheduleHide(): void {
    if(this.touchControls)return;
    this.cancelHide();
    if (this.ownerWindow) this.hideTimer = this.ownerWindow.setTimeout(() => this.hide(), 150);
    else this.hide();
  }

  private cancelHide(): void {
    if (this.hideTimer !== undefined) this.ownerWindow?.clearTimeout(this.hideTimer);
    this.hideTimer = undefined;
  }

  private cancelPress(): void {
    if(this.pressTimer!==undefined)this.ownerWindow?.clearTimeout(this.pressTimer);
    this.pressTimer=undefined;this.press=undefined;
  }

  private hide(): void {
    this.cancelHide();this.touchControls=false;
    this.toolbar.hidden = true;
    this.resizer?.hide();
    this.image = undefined;
    this.context = undefined;
  }

  private listen(target: EventTarget, event: string, callback: EventListener, capture = false): void {
    target.addEventListener(event, callback, capture);
    this.dispose.push(() => target.removeEventListener(event, callback, capture));
  }
}
