type Reorder = (from: number, to: number, visibleOrder: number[]) => Promise<void>;
interface DropTarget { element: HTMLElement; index: number; side: 'left' | 'right' | 'top' | 'bottom' }
interface DragSession {
  pointer: number; touch: boolean; trusted: boolean; source: HTMLButtonElement; track: HTMLElement;
  from: number; order: number[]; x: number; y: number; startX: number; startY: number;
  active: boolean; timer?: number; target?: DropTarget;
}

/** 缩略图保持原位，拖放完成后由调用方保存顺序并刷新画廊。 */
export class ThumbnailReorder {
  private readonly doc: Document;
  private readonly win: Window | null;
  private session?: DragSession;
  private frame = 0;
  private pending = false;
  private destroyed = false;
  private suppressClickUntil = 0;
  private clickCleanup?: () => void;
  private readonly listeners: Array<() => void> = [];
  private readonly gestureListeners: Array<() => void> = [];

  constructor(private readonly root: HTMLElement, private readonly track: () => HTMLElement | undefined,
    private readonly order: () => number[], private readonly reorder: Reorder) {
    this.doc = root.ownerDocument;
    this.win = this.doc.defaultView;
    root.classList.add('ilg-reorder-enabled');
    this.listen(root, 'pointerdown', event => this.down(event as PointerEvent));
    this.listen(root, 'click', event => {
      if (Date.now() >= this.suppressClickUntil) return;
      this.suppressClickUntil = 0;
      event.preventDefault();event.stopImmediatePropagation();
    }, true);
    this.listen(root, 'contextmenu', event => {
      if (this.session?.active) { event.preventDefault();event.stopPropagation(); }
    }, true);
    this.listen(root, 'keydown', event => this.key(event as KeyboardEvent));
  }

  destroy(): void {
    this.destroyed = true;
    this.cancel();
    this.listeners.splice(0).forEach(remove => remove());
    this.root.classList.remove('ilg-reorder-enabled', 'ilg-reorder-pending');
    this.root.removeAttribute('aria-busy');
  }

  /** 版式或主图切换时取消尚在进行的拖动。 */
  cancel(): void { this.finish(false); }

  private listen(target: EventTarget, type: string, listener: EventListener,
    options: boolean | AddEventListenerOptions = false, gesture = false): void {
    target.addEventListener(type, listener, options);
    (gesture ? this.gestureListeners : this.listeners).push(() => target.removeEventListener(type, listener, options));
  }

  private down(event: PointerEvent): void {
    if (this.destroyed || this.pending || event.button !== 0 || event.isPrimary === false) return;
    if (this.session) { this.cancel();return; }
    const track = this.track();
    const source = (event.target as Element | null)?.closest<HTMLButtonElement>('.ilg-thumb[data-index]');
    const order = this.order();
    if (!track || !source || !track.contains(source) || order.length < 2) return;
    const from = Number(source.dataset.index);
    if (!order.includes(from)) return;
    const session: DragSession = { pointer: event.pointerId, touch: event.pointerType === 'touch', trusted: event.isTrusted,
      source, track, from, order: [...order], x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, active: false };
    this.session = session;
    if (session.touch) session.timer = this.win?.setTimeout(() => this.begin(session), 420);
    this.listen(this.doc, 'pointermove', move => this.move(move as PointerEvent), { capture: true, passive: false }, true);
    this.listen(this.doc, 'pointerup', up => {
      if ((up as PointerEvent).pointerId !== session.pointer) return;
      if (session.active) { up.preventDefault();up.stopPropagation(); }
      this.finish(true);
    }, true, true);
    this.listen(this.doc, 'pointercancel', () => this.cancel(), true, true);
    this.listen(this.doc, 'pointerdown', down => {
      if ((down as PointerEvent).pointerId !== session.pointer) this.cancel();
    }, true, true);
    this.listen(this.doc, 'keydown', key => {
      if ((key as KeyboardEvent).key === 'Escape') { key.preventDefault();key.stopPropagation();this.cancel(); }
    }, true, true);
    // 长按开始后拦截触摸滚动；长按前的移动继续交给原生页面/缩略条滚动。
    this.listen(this.doc, 'touchmove', move => {
      if (this.session?.active) move.preventDefault();
    }, { capture: true, passive: false }, true);
    this.listen(this.doc, 'scroll', scroll => {
      if (!session.active || scroll.target !== session.track) this.cancel();
    }, true, true);
    if (this.win) this.listen(this.win, 'blur', () => this.cancel(), false, true);
  }

  private begin(session: DragSession): void {
    if (this.session !== session || !session.source.isConnected || this.track() !== session.track) return;
    session.active = true;
    this.win?.clearTimeout(session.timer);
    session.source.classList.add('ilg-drag-source');
    session.source.setAttribute('aria-grabbed', 'true');
    this.root.classList.add('ilg-sorting');
    if (session.trusted) this.root.setPointerCapture(session.pointer);
    this.updateTarget(session);
    this.tick();
  }

  private move(event: PointerEvent): void {
    const session = this.session;
    if (!session || event.pointerId !== session.pointer) return;
    session.x = event.clientX;session.y = event.clientY;
    if (!session.active) {
      if (Math.hypot(session.x - session.startX, session.y - session.startY) < 7) return;
      if (session.touch) { this.cancel();return; }
      this.begin(session);
    }
    if (!session.source.isConnected || this.track() !== session.track) { this.cancel();return; }
    event.preventDefault();event.stopPropagation();
    this.updateTarget(session);
  }

  private horizontal(track: HTMLElement): boolean {
    if (track.classList.contains('ilg-stage-thumbnails')) return Number(track.dataset.sideColumns ?? 1) > 1;
    return !track.closest('.ilg-focus-side');
  }

  private updateTarget(session: DragSession): void {
    session.target?.element.removeAttribute('data-ilg-drop-side');
    session.target = undefined;
    const hit = this.doc.elementFromPoint(session.x, session.y);
    const button = hit?.closest<HTMLButtonElement>('.ilg-thumb[data-index]');
    if (!button || !session.track.contains(button)) return;
    const index = Number(button.dataset.index), position = session.order.indexOf(index), from = session.order.indexOf(session.from);
    if (position < 0) return;
    const element = button.closest<HTMLElement>('.ilg-stage-thumb-figure') ?? button;
    const rect = element.getBoundingClientRect(), horizontal = this.horizontal(session.track);
    const after = horizontal ? session.x > rect.left + rect.width / 2 : session.y > rect.top + rect.height / 2;
    const destination = Math.max(0, Math.min(session.order.length - 1, position + Number(after) - Number(from < position + Number(after))));
    if (destination === from) return;
    const side = horizontal ? (after ? 'right' : 'left') : (after ? 'bottom' : 'top');
    session.target = { element, index: session.order[destination], side };
    element.setAttribute('data-ilg-drop-side', side);
  }

  private tick(): void {
    const session = this.session;
    if (!session?.active || !this.win) return;
    const rect = session.track.getBoundingClientRect();
    const edge = (value: number, start: number, end: number) => value < start + 28 ? -9 : value > end - 28 ? 9 : 0;
    if (session.x >= rect.left - 18 && session.x <= rect.right + 18 && session.y >= rect.top - 18 && session.y <= rect.bottom + 18) {
      if (session.track.scrollWidth > session.track.clientWidth) session.track.scrollLeft += edge(session.x, rect.left, rect.right);
      if (session.track.scrollHeight > session.track.clientHeight) session.track.scrollTop += edge(session.y, rect.top, rect.bottom);
      this.updateTarget(session);
    }
    this.frame = this.win.requestAnimationFrame(() => { this.frame = 0;this.tick(); });
  }

  private finish(drop: boolean): void {
    const session = this.session;
    if (!session) return;
    this.session = undefined;
    this.win?.clearTimeout(session.timer);
    if (this.frame) this.win?.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.gestureListeners.splice(0).forEach(remove => remove());
    session.source.classList.remove('ilg-drag-source');session.source.removeAttribute('aria-grabbed');
    session.target?.element.removeAttribute('data-ilg-drop-side');
    this.root.classList.remove('ilg-sorting');
    if (this.root.hasPointerCapture(session.pointer)) this.root.releasePointerCapture(session.pointer);
    if (session.active) this.suppressNextClick();
    if (drop && session.active && session.target) this.commit(session.from, session.target.index, session.order);
  }

  private suppressNextClick(): void {
    this.clickCleanup?.();
    this.suppressClickUntil = Date.now() + 700;
    const group = this.root.dataset.ilgGallery;
    let timer: number | undefined;
    const remove = () => {
      this.doc.removeEventListener('click', suppress, true);this.win?.clearTimeout(timer);
      this.suppressClickUntil = 0;
      if (this.clickCleanup === remove) this.clickCleanup = undefined;
    };
    const suppress = (event: Event) => {
      const target = event.target as Element | null, gallery = target?.closest<HTMLElement>('.ilg-gallery');
      if (!target || (!this.root.contains(target) && (!gallery || gallery.dataset.ilgGallery !== group))) return;
      event.preventDefault();event.stopImmediatePropagation();remove();
    };
    // 保存成功可能先替换原画廊；文档级的一次性监听同样覆盖替换后的兼容点击。
    this.doc.addEventListener('click', suppress, true);
    timer = this.win?.setTimeout(remove, 700);
    this.clickCleanup = remove;
  }

  private key(event: KeyboardEvent): void {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || this.pending || this.session) return;
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('.ilg-thumb[data-index]');
    if (!button || !this.track()?.contains(button)) return;
    const delta = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : 0;
    if (!delta) return;
    const order = this.order(), from = Number(button.dataset.index), position = order.indexOf(from), next = position + delta;
    event.preventDefault();event.stopPropagation();
    if (position >= 0 && next >= 0 && next < order.length) this.commit(from, order[next], order);
  }

  private commit(from: number, to: number, order: number[]): void {
    if (this.pending || this.destroyed || from === to) return;
    this.pending = true;this.root.classList.add('ilg-reorder-pending');this.root.setAttribute('aria-busy', 'true');
    // 持久化入口负责错误提示；此处统一释放提交状态以支持再次拖动。
    void (async () => {
      try { await this.reorder(from, to, [...order]); }
      catch { /* 调用方已显示保存错误。 */ }
      finally {
        this.pending = false;
        if (!this.destroyed) { this.root.classList.remove('ilg-reorder-pending');this.root.removeAttribute('aria-busy'); }
      }
    })();
  }
}
