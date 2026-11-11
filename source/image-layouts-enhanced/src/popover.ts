const openPopovers = new WeakMap<Document, AnchoredPopover>();
const exitingPopovers = new WeakMap<Document, Set<() => void>>();
const openRequests = new WeakMap<Document, number>();
const closingDocuments = new WeakMap<Document, number>();

function removeExitingPopovers(doc: Document): void {
  const exits = exitingPopovers.get(doc);
  if (!exits) return;
  for (const finish of [...exits]) finish();
}

export function closePopover(doc: Document): void {
  const previousDepth = closingDocuments.get(doc) ?? 0;
  closingDocuments.set(doc, previousDepth + 1);
  try { openPopovers.get(doc)?.close(); }
  finally {
    removeExitingPopovers(doc);
    if (previousDepth) closingDocuments.set(doc, previousDepth);
    else closingDocuments.delete(doc);
  }
}

/** An owner-document popover that keeps its interaction inside the floating panel. */
export class AnchoredPopover {
  readonly el: HTMLDivElement;
  readonly contentEl: HTMLDivElement;
  protected readonly doc: Document;
  protected readonly ownerWindow: (Window & typeof globalThis) | null;
  private readonly cleanup: Array<() => void> = [];
  private observer?: ResizeObserver;
  private positionFrame = 0;
  private readonly anchorRect?: DOMRect;
  private opened = false;
  private closed = false;

  constructor(private readonly anchor: HTMLElement | undefined, label: string, private readonly onClose?: () => void) {
    this.doc = anchor?.ownerDocument ?? (typeof activeDocument !== 'undefined' ? activeDocument : document);
    this.ownerWindow = this.doc.defaultView;
    this.anchorRect = anchor?.getBoundingClientRect();
    this.el = this.doc.createElement('div');
    this.el.className = 'ilg-popover';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', label);
    this.el.setAttribute('data-ilg-interactive', '1');
    this.el.tabIndex = -1;
    this.el.hidden = true;
    this.contentEl = this.doc.createElement('div');
    this.contentEl.className = 'ilg-popover-content';
    this.el.appendChild(this.contentEl);
  }

  open(): void {
    if (this.opened || this.closed) return;
    if (closingDocuments.has(this.doc)) { this.close(); return; }
    if (this.isImageAnchor() && !this.anchor?.isConnected) { this.close(); return; }
    const request = (openRequests.get(this.doc) ?? 0) + 1;
    openRequests.set(this.doc, request);
    removeExitingPopovers(this.doc);
    openPopovers.get(this.doc)?.close();
    removeExitingPopovers(this.doc);
    // A previous panel's close callback can open a newer panel synchronously.
    // Keep that newer request as the sole owner and dispose this superseded one.
    if (openRequests.get(this.doc) !== request) { this.close(); return; }
    openPopovers.set(this.doc, this);
    this.opened = true;

    // Target and child handlers run first; Obsidian and Toolkit delegated handlers stay outside.
    for (const event of ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'wheel', 'drag', 'dragend', 'dragenter', 'dragleave']) {
      this.listen(this.el, event, event => event.stopPropagation());
    }
    for (const event of ['dragover', 'drop']) this.listen(this.el, event, event => { event.preventDefault(); event.stopPropagation(); });
    this.listen(this.el, 'contextmenu', event => { event.preventDefault(); event.stopPropagation(); });
    this.listen(this.el, 'dragstart', event => {
      const target = event.target as Element | null;
      if (target?.tagName === 'IMG' || (typeof target?.closest === 'function' && target.closest('img'))) event.preventDefault();
      event.stopPropagation();
    });
    this.listen(this.doc, 'pointerdown', event => { if (!this.containsEvent(event)) this.close(); }, true);
    this.listen(this.doc, 'keydown', event => {
      const keyboard = event as KeyboardEvent;
      if (keyboard.key !== 'Escape' || keyboard.isComposing || keyboard.keyCode === 229) return;
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }, true);
    this.listen(this.doc, 'scroll', event => {
      if (this.containsEvent(event)) return;
      const target = event.target as Node | null;
      // A scrolling sibling (for example the thumbnail rail) keeps this anchor fixed.
      if (!this.anchor?.isConnected || !target || target === this.doc ||
        (typeof target.contains === 'function' && target.contains(this.anchor))) this.close();
    }, true);
    if (this.ownerWindow) {
      this.listen(this.ownerWindow, 'resize', () => this.queuePosition());
      if(this.ownerWindow.visualViewport){
        this.listen(this.ownerWindow.visualViewport,'resize',()=>this.queuePosition());
        this.listen(this.ownerWindow.visualViewport,'scroll',()=>this.queuePosition());
      }
      this.listen(this.ownerWindow, 'blur', () => this.close());
    }

    this.el.style.visibility = 'hidden';
    this.el.hidden = false;
    this.doc.body.appendChild(this.el);
    this.position();
    if (!this.reducedMotion()) {
      this.el.setAttribute('data-ilg-phase', 'initial');
      // Flush only the initial surface style; transitions then continue from the current value.
      this.el.getBoundingClientRect();
    }
    this.el.setAttribute('data-ilg-phase', 'open');
    this.el.style.visibility = '';

    const Observer = this.ownerWindow?.ResizeObserver;
    if (Observer && this.anchor?.isConnected) {
      const initial = this.anchor.getBoundingClientRect();
      const observer = new Observer(() => {
        if (!this.anchor?.isConnected) { this.close(); return; }
        const current = this.anchor.getBoundingClientRect();
        if (Math.abs(current.width - initial.width) > .5 || Math.abs(current.height - initial.height) > .5) { this.close(); return; }
        this.queuePosition();
      });
      this.observer = observer;
      observer.observe(this.anchor);
      observer.observe(this.el);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if(this.positionFrame)this.ownerWindow?.cancelAnimationFrame(this.positionFrame);
    this.positionFrame=0;
    this.observer?.disconnect();
    this.observer = undefined;
    this.cleanup.splice(0).forEach(dispose => dispose());
    if (openPopovers.get(this.doc) === this) openPopovers.delete(this.doc);
    // Interaction and draft lifecycle end now. Only a bounded, inert visual surface remains.
    this.el.setAttribute('aria-hidden', 'true');
    this.el.setAttribute('inert', '');
    this.el.inert = true;
    this.el.style.pointerEvents = 'none';
    if (this.opened && this.el.isConnected && !this.reducedMotion() && typeof this.ownerWindow?.setTimeout === 'function') {
      this.beginExit();
    } else this.el.remove();
    this.onClose?.();
  }

  listen(target: EventTarget, event: string, callback: EventListener, options?: boolean | AddEventListenerOptions): void {
    if (this.closed) return;
    target.addEventListener(event, callback, options);
    const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
    this.cleanup.push(() => target.removeEventListener(event, callback, capture));
  }

  private containsEvent(event: Event): boolean {
    if (event.composedPath().includes(this.el)) return true;
    const target = event.target as Node | null;
    return Boolean(target && typeof target.nodeType === 'number' && this.el.contains(target));
  }

  private queuePosition(): void {
    if(!this.ownerWindow?.requestAnimationFrame){this.position();return;}
    if(this.positionFrame)return;
    this.positionFrame=this.ownerWindow.requestAnimationFrame(()=>{
      this.positionFrame=0;
      if(!this.closed)this.position();
    });
  }

  private position(): void {
    const visual = this.ownerWindow?.visualViewport;
    const viewportWidth = visual?.width ?? this.ownerWindow?.innerWidth ?? this.doc.documentElement.clientWidth;
    const viewportHeight = visual?.height ?? this.ownerWindow?.innerHeight ?? this.doc.documentElement.clientHeight;
    const offsetLeft = visual?.offsetLeft ?? 0;
    const offsetTop = visual?.offsetTop ?? 0;
    const margin = 8;
    this.el.style.maxHeight = `${Math.max(80, viewportHeight - 2 * margin)}px`;
    this.el.style.maxWidth = `${Math.max(80, viewportWidth - 2 * margin)}px`;
    const rect = this.el.getBoundingClientRect();
    const panel = {width:this.el.offsetWidth||rect.width,height:this.el.offsetHeight||rect.height};
    const anchor = this.anchor?.isConnected ? this.anchor.getBoundingClientRect() : this.anchorRect;
    const imageAnchor = this.isImageAnchor();
    let left = anchor ? (imageAnchor ? anchor.right - panel.width : anchor.left) : (viewportWidth - panel.width) / 2;
    let top = anchor ? (imageAnchor ? anchor.top + 36 : anchor.bottom + 6) : (viewportHeight - panel.height) / 2;
    let placement = anchor ? 'below' : 'center';
    if (!imageAnchor && anchor && top + panel.height > viewportHeight - margin && anchor.top - panel.height - 6 >= margin) {
      top = anchor.top - panel.height - 6;
      placement = 'above';
    }
    left = Math.max(offsetLeft + margin, Math.min(left, Math.max(offsetLeft + margin, offsetLeft + viewportWidth - panel.width - margin)));
    top = Math.max(offsetTop + margin, Math.min(top, Math.max(offsetTop + margin, offsetTop + viewportHeight - panel.height - margin)));
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    const anchorX = anchor ? (imageAnchor ? anchor.right - 24 : (anchor.left + anchor.right) / 2) - left : panel.width / 2;
    const originX = Math.max(12, Math.min(anchorX, Math.max(12, panel.width - 12)));
    this.el.style.transformOrigin = `${originX}px ${placement === 'above' ? 'bottom' : placement === 'center' ? 'center' : 'top'}`;
    this.el.setAttribute('data-ilg-placement', placement);
  }

  private reducedMotion(): boolean {
    return this.ownerWindow?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  private beginExit(): void {
    this.el.setAttribute('data-ilg-phase', 'exiting');
    const exits = exitingPopovers.get(this.doc) ?? new Set<() => void>();
    exitingPopovers.set(this.doc, exits);
    let timer: number | undefined;
    const finish = () => {
      if (timer !== undefined) this.ownerWindow?.clearTimeout(timer);
      timer = undefined;
      this.el.remove();
      exits.delete(finish);
      if (!exits.size) exitingPopovers.delete(this.doc);
    };
    exits.add(finish);
    try { timer = this.ownerWindow!.setTimeout(finish, 120); }
    catch { finish(); }
  }

  private isImageAnchor(): boolean {
    return this.anchor?.tagName === 'IMG' || Boolean(this.anchor?.classList?.contains('image-anchor'));
  }
}
