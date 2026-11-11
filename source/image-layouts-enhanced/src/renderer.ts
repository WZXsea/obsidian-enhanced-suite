import { getDominantGridDefinition, getFocusPlacement, getMatchingGridDefinition, getMasonryColumnCount, getStageLayoutLabel, getStageThumbnailOrder, swapStageImage, type GridDefinition } from './layouts';
import { getLayoutChoices, type LayoutChoice } from './layout-choices';
import { type Fit, type GalleryCallbacks, type GalleryImage, type GalleryOptions } from './types';

const FIT_LABELS: Record<Fit, string> = { contain: '完整显示', cover: '填满区域', natural: '原始比例' };
const FIT_ORDER: Fit[] = ['contain', 'cover', 'natural'];
const FIT_ICONS: Record<Fit, string> = {
  contain: 'M4 3h16v18H4zM4 7h16M4 17h16',
  cover: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 17 17 7M10 7h7v7',
  natural: 'M3 7V3h4m10 0h4v4M3 17v4h4m10 0h4v-4M6 10l2-2v8m8-6 2-2v8M12 10h.01M12 14h.01',
};
const TOOLBAR_ICONS = {
  layout: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  settings: 'M4 5h16M4 12h16M4 19h16M8 3v4M16 10v4M10 17v4',
  edit: 'M9 7l-5 5 5 5m6-10 5 5-5 5m-1-13-4 16',
  unwrap: 'M3 10h5m-5 0V5m0 5a8 8 0 1 1 2.5 9',
};
type FigureKind = 'cell' | 'main' | 'filmstrip' | 'masonry';

/** A self-contained DOM view. All source edits remain the caller's responsibility. */
export class GalleryRenderer {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly counter: HTMLElement;
  private readonly select: HTMLSelectElement;
  private readonly layoutButton: HTMLButtonElement;
  private readonly fitButton: HTMLButtonElement;
  private layoutChoices: LayoutChoice[] = [];
  private readonly cleanups: Array<() => void> = [];
  private options: GalleryOptions;
  private readonly images: GalleryImage[];
  private index = 0;
  private destroyed = false;
  private observer?: ResizeObserver;
  private mainFigure?: HTMLElement;
  private track?: HTMLElement;
  private thumbButtons: HTMLButtonElement[] = [];
  private stageThumbnailOrder: number[] = [];
  private stageSlot = -1;
  private stripFigures: HTMLElement[] = [];
  private previous?: HTMLButtonElement;
  private next?: HTMLButtonElement;
  private focusPanel?: HTMLElement;
  private focusPlacement: 'side' | 'bottom' = 'bottom';
  private scrollFrame = 0;
  private focusFrame = 0;
  private pointerStart?: { x: number; y: number; id: number };
  private suppressClickUntil = 0;

  constructor(
    private readonly host: HTMLElement,
    images: GalleryImage[],
    options: GalleryOptions,
    private readonly callbacks: GalleryCallbacks,
  ) {
    this.doc = host.ownerDocument;
    this.images = images.map(image => ({ ...image }));
    this.index=Math.max(0,Math.min(images.length-1,callbacks.initialIndex??0));
    this.options = { ...options, descriptions: [...options.descriptions] };
    this.root = this.element('section', 'ilg-gallery');
    this.root.tabIndex = 0;
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', options.caption || '图片画廊');
    this.root.dataset.ilgGallery = options.id;
    const toolbar = this.element('div', 'ilg-toolbar');
    this.select = this.element('select', 'ilg-layout-select') as HTMLSelectElement;
    this.select.setAttribute('aria-label', '图片布局');
    this.select.hidden = true;
    this.select.tabIndex = -1;
    this.select.setAttribute('aria-hidden', 'true');
    this.listen(this.select, 'change', () => {
      const choice = this.layoutChoices.find(item => item.key === this.select.value);
      if (choice) this.requestChange({ layout: choice.layout, ...(choice.grid ? { grid: choice.grid } : {}) });
    });
    toolbar.appendChild(this.select);
    this.layoutButton = this.iconButton('layout', '选择图片布局', TOOLBAR_ICONS.layout, () => callbacks.pickLayout?.(this.layoutButton));
    this.layoutButton.disabled = !callbacks.pickLayout;
    toolbar.appendChild(this.layoutButton);
    this.fitButton = this.iconButton('fit', '切换图片适配方式', FIT_ICONS[this.options.fit], () => {
      this.requestChange({ fit: FIT_ORDER[(FIT_ORDER.indexOf(this.options.fit) + 1) % FIT_ORDER.length] });
    });
    this.fitButton.classList.add('ilg-fit');
    toolbar.appendChild(this.fitButton);
    if(callbacks.configure){
      const settings=this.iconButton('settings', '画廊设置', TOOLBAR_ICONS.settings, () => callbacks.configure?.(settings));
      toolbar.appendChild(settings);
    }
    const edit = this.iconButton('edit', '编辑图片引用与图注', TOOLBAR_ICONS.edit, () => callbacks.edit(edit));
    toolbar.appendChild(edit);
    const unwrap = this.iconButton('unwrap', '恢复普通 Markdown 图片', TOOLBAR_ICONS.unwrap, () => callbacks.unwrap());
    unwrap.classList.add('ilg-unwrap');
    toolbar.appendChild(unwrap);
    this.counter = this.element('span', 'ilg-counter');
    this.counter.setAttribute('aria-live', 'polite');
    this.counter.setAttribute('aria-atomic', 'true');
    toolbar.appendChild(this.counter);
    this.root.appendChild(toolbar);
    this.body = this.element('div', 'ilg-body');
    this.root.appendChild(this.body);
    host.appendChild(this.root);

    // Obsidian and Image Toolkit both delegate image clicks to ancestors.
    // This region dispatches exactly one explicit open callback for a main image.
    this.listen(this.root, 'click', event => event.stopPropagation());
    this.listen(this.root, 'keydown', event => this.onKeyDown(event as KeyboardEvent));
    this.focusPlacement = getFocusPlacement(host.getBoundingClientRect().width);
    const Resize = this.doc.defaultView?.ResizeObserver;
    if (Resize) {
      this.observer = new Resize(entries => {
        if (this.destroyed) return;
        const width = entries.find(entry => entry.target === host)?.contentRect.width;
        if (width === undefined) return;
        const placement = getFocusPlacement(width);
        if (placement !== this.focusPlacement) {
          this.focusPlacement = placement;
          if(this.focusPanel&&!this.focusFrame){
            const win=this.doc.defaultView;
            if(win?.requestAnimationFrame)this.focusFrame=win.requestAnimationFrame(()=>{this.focusFrame=0;if(!this.destroyed)this.applyFocusPlacement();});
            else this.applyFocusPlacement();
          }
        }
      });
      this.observer.observe(host);
    }
    this.render();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.observer?.disconnect();
    this.cleanups.splice(0).forEach(cleanup => cleanup());
    if (this.scrollFrame) this.doc.defaultView?.cancelAnimationFrame(this.scrollFrame);
    if (this.focusFrame) this.doc.defaultView?.cancelAnimationFrame(this.focusFrame);
    this.root.remove();
    this.thumbButtons = [];
    this.stripFigures = [];
    this.track = undefined;
    this.mainFigure = undefined;
  }

  private element(tag: string, className = ''): HTMLElement {
    const element = this.doc.createElement(tag);
    element.className = className;
    return element;
  }

  private listen(target: EventTarget, type: string, listener: EventListener): void {
    target.addEventListener(type, listener);
    this.cleanups.push(() => target.removeEventListener(type, listener));
  }

  private button(text: string, className: string, label: string, action: () => void): HTMLButtonElement {
    const button = this.element('button', className) as HTMLButtonElement;
    button.type = 'button';
    button.textContent = text;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.addEventListener('click', event => {
      event.stopPropagation();
      action();
    });
    return button;
  }

  private iconButton(action: string, label: string, path: string, callback: () => void): HTMLButtonElement {
    const button = this.button('', 'ilg-toolbar-button ilg-toolbar-icon', label, callback);
    button.dataset.action = action;
    this.setButtonIcon(button, path);
    return button;
  }

  private setButtonIcon(button: HTMLButtonElement, pathData: string): void {
    const svg = this.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = this.doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    svg.appendChild(path);
    button.replaceChildren(svg);
  }

  private requestChange(patch: Partial<GalleryOptions>): void {
    if (this.destroyed) return;
    this.options = { ...this.options, ...patch };
    this.render();
    this.callbacks.change(patch);
  }

  private render(): void {
    if (this.scrollFrame) this.doc.defaultView?.cancelAnimationFrame(this.scrollFrame);
    if (this.focusFrame) this.doc.defaultView?.cancelAnimationFrame(this.focusFrame);
    this.scrollFrame = 0;
    this.mainFigure = undefined;
    this.track = undefined;
    this.focusPanel = undefined;
    this.previous = undefined;
    this.next = undefined;
    this.thumbButtons = [];
    this.stripFigures = [];
    this.pointerStart = undefined;
    this.body.replaceChildren();
    this.root.dataset.layout = this.options.layout;
    this.root.dataset.fit = this.options.fit;
    this.root.dataset.overlay = this.options.overlay;
    this.root.dataset.align = this.options.align;
    this.root.style.setProperty('--ilg-height', `${this.options.height}px`);
    this.root.style.setProperty('--ilg-gap', `${this.options.gap}px`);
    this.root.style.setProperty('--ilg-radius', `${this.options.radius}px`);
    this.root.style.width = this.options.align === 'full' ? '100%' : this.options.width;
    this.root.style.maxWidth = this.options.width;
    this.updateLayoutChoices();
    this.setButtonIcon(this.fitButton, FIT_ICONS[this.options.fit]);
    this.fitButton.dataset.fit = this.options.fit;
    const nextFit = FIT_ORDER[(FIT_ORDER.indexOf(this.options.fit) + 1) % FIT_ORDER.length];
    const fitLabel = `图片适配：${FIT_LABELS[this.options.fit]}；点击切换为${FIT_LABELS[nextFit]}`;
    this.fitButton.title = fitLabel;
    this.fitButton.setAttribute('aria-label', fitLabel);
    this.index = Math.min(this.index, Math.max(0, this.images.length - 1));

    if (!this.images.length) {
      const empty = this.element('div', 'ilg-empty');
      empty.textContent = '添加图片引用后，画廊将在此显示。';
      this.body.appendChild(empty);
    } else if (this.options.layout === 'filmstrip') {
      this.renderFilmstrip();
    } else if (this.options.layout === 'carousel' || this.options.layout === 'focus') {
      this.renderViewer();
    } else {
      const columns = getMasonryColumnCount(this.options.layout);
      if (columns) this.renderMasonry(columns);
      else {
        const dominant = getDominantGridDefinition(this.options.layout, this.images.length);
        if (dominant) this.renderDominantGrid(dominant);
        else this.renderGrid();
      }
    }
    if (this.options.caption) {
      const caption = this.element('p', 'ilg-gallery-caption');
      caption.textContent = this.options.caption;
      this.body.appendChild(caption);
    }
    this.updateNavigation();
  }

  private description(index: number): string {
    return (this.options.descriptions[index] || this.images[index]?.alt || '').replace(/\|\s*\d+(?:\s*x\s*\d+)?\s*$/i, '').trim();
  }

  private updateLayoutChoices(): void {
    this.layoutChoices = getLayoutChoices(this.images.length);
    const normalizeGrid = (grid: string) => grid.split(/\r?\n/).map(line => line.replace(/\s+/g, '')).join('\n').trim();
    let current = this.layoutChoices.find(choice => choice.layout === this.options.layout &&
      (choice.layout !== 'custom' || normalizeGrid(choice.grid || '') === normalizeGrid(this.options.grid)));
    if (!current) {
      const stage = getDominantGridDefinition(this.options.layout, this.images.length);
      if (stage) {
        const signature = (grid: GridDefinition) => JSON.stringify([grid.columnFractions, grid.rows, grid.areas]);
        current = this.layoutChoices.find(choice => {
          const candidate = getDominantGridDefinition(choice.layout, this.images.length);
          return candidate && signature(candidate) === signature(stage);
        });
      }
    }
    if (!current) {
      current = {
        key: 'current-layout', label: getStageLayoutLabel(this.options.layout, this.images.length, this.options.grid),
        layout: this.options.layout, grid: this.options.layout === 'custom' ? this.options.grid : undefined,
        preview: [],
      };
      this.layoutChoices.unshift(current);
    }
    this.select.replaceChildren();
    this.layoutChoices.forEach(choice => {
      const option = this.doc.createElement('option');
      option.value = choice.key;
      option.textContent = choice.label;
      this.select.appendChild(option);
    });
    this.select.value = current.key;
    const label = `图片布局：${current.label}；选择版式`;
    this.layoutButton.title = label;
    this.layoutButton.setAttribute('aria-label', label);
    this.layoutButton.dataset.layout = this.options.layout;
  }

  private imageButton(index: number, thumbnail = false): HTMLButtonElement {
    const image = this.images[index];
    const alt = this.description(index) || `图片 ${index + 1}`;
    let img: HTMLImageElement;
    const button = this.button('', thumbnail ? 'ilg-thumb' : 'ilg-image-button',
      thumbnail ? `显示图片 ${index + 1}：${alt}` : `查看图片 ${index + 1}：${alt}`, () => {
        if (thumbnail) this.setActive(index);
        else if (Date.now() >= this.suppressClickUntil) this.callbacks.open(index, img);
      });
    img = this.doc.createElement('img');
    img.alt = alt;
    img.loading = thumbnail || !['carousel', 'focus'].includes(this.options.layout) ? 'lazy' : 'eager';
    img.decoding = 'async';
    img.draggable = false;
    img.dataset.ilgViewerIndex = String(index);
    button.dataset.index = String(index);
    const failure = () => {
      button.classList.add('ilg-image-error');
      img.hidden = true;
      if (!button.querySelector('.ilg-placeholder')) {
        const placeholder = this.element('span', 'ilg-placeholder');
        placeholder.textContent = `图片暂未载入\n${image.alt || image.target || `图片 ${index + 1}`}`;
        button.appendChild(placeholder);
      }
    };
    img.addEventListener('error', failure, { once: true });
    button.appendChild(img);
    if (image.missing || !image.src) failure();
    else img.src = image.src;
    return button;
  }

  private figure(index: number, kind: FigureKind, thumbnail = false): HTMLElement {
    const figure = this.element('figure', `ilg-figure ilg-${kind}-figure`);
    figure.dataset.index = String(index);
    const button = this.imageButton(index, thumbnail);
    figure.appendChild(button);
    const description = this.description(index);
    if (description) {
      const caption = this.element('figcaption', 'ilg-image-caption');
      caption.textContent = description;
      caption.title = description;
      figure.appendChild(caption);
    }
    if (!thumbnail && (kind === 'main' || getDominantGridDefinition(this.options.layout))) {
      const zoom = this.button('', 'ilg-stage-zoom', `放大图片 ${index + 1}`, () => {
        const origin = button.querySelector('img');
        if (origin) this.callbacks.open(index, origin);
      });
      // Inline SVG keeps this DOM renderer independent of Obsidian's icon API.
      const svg = this.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      const path = this.doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6');
      svg.appendChild(path);
      zoom.appendChild(svg);
      figure.appendChild(zoom);
    }
    if (kind === 'filmstrip') {
      const img = button.querySelector('img')!;
      const updateRatio = () => {
        if (img.naturalHeight > 0) figure.style.setProperty('--ilg-image-ratio', String(img.naturalWidth / img.naturalHeight));
      };
      img.addEventListener('load', updateRatio, { once: true });
      if (img.complete) updateRatio();
    }
    return figure;
  }

  private renderDominantGrid(grid: GridDefinition): void {
    if (this.stageThumbnailOrder.length !== Math.max(0, this.images.length - 1) ||
      this.stageThumbnailOrder.includes(this.index)) {
      this.stageThumbnailOrder = getStageThumbnailOrder(this.images.length, this.index);
    }
    const stage = this.element('div', 'ilg-grid ilg-dominant-grid');
    stage.style.gridTemplateColumns = grid.columnFractions.map(weight => `minmax(0, ${weight}fr)`).join(' ');
    stage.style.gridTemplateRows = `repeat(${grid.rows}, minmax(0, 1fr))`;
    stage.style.setProperty('--ilg-stage-rows', String(grid.rows));
    const primary = grid.cells[0];
    const main = this.element('div', 'ilg-main ilg-stage-main');
    main.style.gridColumn = `${primary.column} / span ${primary.columnSpan}`;
    main.style.gridRow = `1 / span ${grid.rows}`;
    this.mainFigure = this.element('div', 'ilg-stage-main-content');
    this.mainFigure.appendChild(this.figure(this.index, 'cell'));
    main.appendChild(this.mainFigure);
    this.attachArrows(main);
    this.attachSwipe(main);
    stage.appendChild(main);
    if (grid.slots > 1) {
      this.track = this.element('div', 'ilg-stage-thumbnails');
      const sideColumn = primary.column === 1 ? primary.column + primary.columnSpan : 1;
      const sideColumns = grid.columns - primary.columnSpan;
      this.track.style.gridColumn = `${sideColumn} / span ${sideColumns}`;
      this.track.style.gridRow = `1 / span ${grid.rows}`;
      this.track.style.gridTemplateColumns = `repeat(${sideColumns}, minmax(0, 1fr))`;
      this.track.style.gridTemplateRows = `repeat(${grid.rows}, minmax(0, 1fr))`;
      this.track.dataset.sideColumns = String(sideColumns);
      this.track.setAttribute('aria-label', '切换主图，本组全部候选图片');
      this.renderStageThumbnails(grid);
      stage.appendChild(this.track);
    }
    this.body.appendChild(stage);
  }

  private renderStageThumbnails(grid = getDominantGridDefinition(this.options.layout, this.images.length)): void {
    const track = this.track;
    if (!track) return;
    const scrollTop = track.scrollTop;
    const restoreFocus = track.contains(this.doc.activeElement);
    this.thumbButtons = [];
    track.replaceChildren();
    this.stageThumbnailOrder.forEach((index, slot) => {
      const figure = this.figure(index, 'cell', true);
      figure.classList.add('ilg-stage-thumb-figure');
      figure.dataset.slot = String(slot);
      const cell = grid?.cells[slot + 1];
      if (cell && grid) {
        const primary = grid.cells[0];
        const sideColumn = primary.column === 1 ? primary.column + primary.columnSpan : 1;
        figure.style.gridColumn = `${cell.column - sideColumn + 1} / span ${cell.columnSpan}`;
        figure.style.gridRow = `${cell.row} / span ${cell.rowSpan}`;
      }
      const button = figure.querySelector('button')!;
      this.thumbButtons.push(button);
      track.appendChild(figure);
    });
    if (!this.stageThumbnailOrder.length) {
      const empty = this.element('div', 'ilg-grid-placeholder');
      empty.textContent = '待添加图片';
      track.appendChild(empty);
    }
    track.scrollTop = scrollTop;
    if (restoreFocus) this.thumbButtons[this.stageSlot]?.focus({ preventScroll: true });
  }

  private renderGrid(): void {
    const grid = getMatchingGridDefinition(this.options.layout, this.images.length, this.options.grid);
    const stage = this.element('div', 'ilg-grid ilg-complete-grid');
    stage.style.gridTemplateColumns = grid.columnFractions.map(weight => `minmax(0, ${weight}fr)`).join(' ');
    stage.style.gridTemplateRows = `repeat(${grid.rows}, minmax(0, 1fr))`;
    stage.style.setProperty('--ilg-stage-rows', String(grid.rows));
    stage.style.gridTemplateAreas = grid.areas;
    grid.cells.forEach(cell => {
      let figure: HTMLElement;
      if (cell.imageIndex < this.images.length) figure = this.figure(cell.imageIndex, 'cell');
      else {
        figure = this.element('div', 'ilg-grid-placeholder');
        figure.textContent = '待添加图片';
        figure.setAttribute('aria-label', `图片位置 ${cell.imageIndex + 1}`);
      }
      figure.style.gridArea = cell.area;
      stage.appendChild(figure);
    });
    this.body.appendChild(stage);
    if (grid.fallbackReason) {
      const message = this.element('p', 'ilg-layout-message');
      message.textContent = `自定义网格：${grid.fallbackReason} 当前按 ${this.images.length} 张图片完整排列。`;
      this.body.appendChild(message);
    }
  }

  private renderMasonry(columns: number): void {
    const masonry = this.element('div', 'ilg-masonry');
    masonry.style.columnCount = String(columns);
    this.images.forEach((_, index) => masonry.appendChild(this.figure(index, 'masonry')));
    this.body.appendChild(masonry);
  }

  private renderFilmstrip(): void {
    const wrap = this.element('div', 'ilg-filmstrip-wrap');
    this.track = this.element('div', 'ilg-filmstrip');
    this.track.setAttribute('aria-label', '横向滚动图片带');
    this.images.forEach((_, index) => {
      const figure = this.figure(index, 'filmstrip');
      this.stripFigures.push(figure);
      this.track!.appendChild(figure);
    });
    const track = this.track;
    track.addEventListener('scroll', () => {
      if (this.scrollFrame || this.destroyed) return;
      this.scrollFrame = this.doc.defaultView?.requestAnimationFrame(() => {
        this.scrollFrame = 0;
        if (this.destroyed || this.track !== track) return;
        const center = track.scrollLeft + track.clientWidth / 2;
        let nearest = 0;
        let distance = Infinity;
        this.stripFigures.forEach((figure, index) => {
          const diff = Math.abs(figure.offsetLeft - track.offsetLeft + figure.offsetWidth / 2 - center);
          if (diff < distance) { distance = diff; nearest = index; }
        });
        this.index = nearest;
        this.callbacks.select?.(this.index);
        this.updateNavigation();
      }) || 0;
    }, { passive: true });
    wrap.appendChild(track);
    this.attachArrows(wrap);
    this.body.appendChild(wrap);
    if (this.index > 0) this.scrollToActive(false);
  }

  private renderViewer(): void {
    const viewer = this.element('div', this.options.layout === 'focus' ? 'ilg-focus' : 'ilg-carousel');
    if (this.options.layout === 'focus') this.focusPanel = viewer;
    const stage = this.element('div', 'ilg-main');
    this.mainFigure = this.element('div', 'ilg-main-content');
    this.mainFigure.appendChild(this.figure(this.index, 'main'));
    stage.appendChild(this.mainFigure);
    this.attachArrows(stage);
    this.attachSwipe(stage);
    viewer.appendChild(stage);
    this.track = this.element('div', this.options.thumbnails ? 'ilg-thumbnails' : 'ilg-pills');
    this.track.setAttribute('aria-label', '选择图片');
    this.images.forEach((_, index) => {
      const button = this.options.thumbnails ? this.imageButton(index, true) :
        this.button(String(index + 1), 'ilg-pill', `显示图片 ${index + 1}`, () => this.setActive(index));
      this.thumbButtons.push(button);
      this.track!.appendChild(button);
    });
    viewer.appendChild(this.track);
    this.body.appendChild(viewer);
    this.applyFocusPlacement();
  }

  private attachSwipe(stage: HTMLElement): void {
    stage.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch') {
        if(this.pointerStart){this.pointerStart=undefined;return;}
        this.pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
      }
    }, { passive: true });
    stage.addEventListener('pointerup', event => {
      const start = this.pointerStart;
      this.pointerStart = undefined;
      if (!start || start.id !== event.pointerId) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        this.suppressClickUntil = Date.now() + 400;
        this.setActive(this.index + (dx < 0 ? 1 : -1));
      }
    });
    stage.addEventListener('pointercancel', () => { this.pointerStart = undefined; });
  }

  private attachArrows(container: HTMLElement): void {
    this.previous = this.button('‹', 'ilg-nav ilg-prev', '上一张图片', () => this.setActive(this.index - 1));
    this.next = this.button('›', 'ilg-nav ilg-next', '下一张图片', () => this.setActive(this.index + 1));
    container.append(this.previous, this.next);
    if (this.images.length === 1) {
      this.previous.hidden = true;
      this.next.hidden = true;
    }
  }

  private applyFocusPlacement(): void {
    if (!this.focusPanel) return;
    this.focusPanel.classList.toggle('ilg-focus-side', this.focusPlacement === 'side');
    this.focusPanel.classList.toggle('ilg-focus-bottom', this.focusPlacement === 'bottom');
  }

  /** Locate a source occurrence without opening a viewer or moving keyboard focus. */
  revealImage(index:number):HTMLElement|null {
    if(this.destroyed||index<0||index>=this.images.length)return null;
    this.setActive(index);
    return this.mainFigure??this.root.querySelector<HTMLElement>(`.ilg-figure[data-index="${index}"]`);
  }

  private setActive(index: number): void {
    if (this.destroyed || !this.images.length) return;
    const next = Math.max(0, Math.min(this.images.length - 1, index));
    if (next === this.index) return;
    const dominant = !!getDominantGridDefinition(this.options.layout);
    if (dominant) {
      this.stageSlot = this.stageThumbnailOrder.indexOf(next);
      this.stageThumbnailOrder = swapStageImage(this.stageThumbnailOrder, this.index, next);
    }
    const restoreMainFocus = this.mainFigure?.contains(this.doc.activeElement);
    this.index = next;
    this.callbacks.select?.(this.index);
    if (this.mainFigure) this.mainFigure.replaceChildren(this.figure(this.index, dominant ? 'cell' : 'main'));
    if (dominant) this.renderStageThumbnails();
    if (restoreMainFocus) this.mainFigure?.querySelector('button')?.focus({ preventScroll: true });
    this.updateNavigation();
    this.scrollToActive(true);
  }

  private scrollToActive(smooth: boolean): void {
    if (!this.track) return;
    if (getDominantGridDefinition(this.options.layout)) return;
    const target = this.options.layout === 'filmstrip' ? this.stripFigures[this.index] : this.thumbButtons[this.index];
    if (!target) return;
    const reduced = this.doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = smooth && !reduced ? 'smooth' : 'auto';
    if (this.options.layout === 'focus' && this.focusPlacement === 'side' && this.options.thumbnails) {
      const top = target.offsetTop - this.track.offsetTop;
      if (top < this.track.scrollTop || top + target.offsetHeight > this.track.scrollTop + this.track.clientHeight) {
        this.track.scrollTo({ top: Math.max(0, top - this.track.clientHeight / 2 + target.offsetHeight / 2), behavior });
      }
    } else {
      const left = target.offsetLeft - this.track.offsetLeft;
      if (this.options.layout === 'filmstrip' || left < this.track.scrollLeft || left + target.offsetWidth > this.track.scrollLeft + this.track.clientWidth) {
        this.track.scrollTo({ left: Math.max(0, left - (this.track.clientWidth - target.offsetWidth) / 2), behavior });
      }
    }
  }

  private updateNavigation(): void {
    this.counter.textContent = `${this.images.length ? this.index + 1 : 0} / ${this.images.length}`;
    if (this.previous) this.previous.disabled = this.index === 0;
    if (this.next) this.next.disabled = this.index >= this.images.length - 1;
    this.root.dataset.activeIndex = String(this.index);
    this.thumbButtons.forEach((button, index) => {
      const selected = Number(button.dataset.index ?? index) === this.index;
      button.classList.toggle('ilg-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    this.stripFigures.forEach((figure, index) => figure.classList.toggle('ilg-selected', index === this.index));
  }

  private onKeyDown(event: KeyboardEvent): void {
    const element = event.target as Element | null;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      !this.root.contains(this.doc.activeElement) ||
      (element?.nodeType === 1 && element.closest('input, textarea, select, [contenteditable="true"]'))) return;
    if (!['carousel', 'focus', 'filmstrip'].includes(this.options.layout) && !getDominantGridDefinition(this.options.layout)) return;
    const target = event.key === 'ArrowLeft' ? this.index - 1 : event.key === 'ArrowRight' ? this.index + 1 :
      event.key === 'Home' ? 0 : event.key === 'End' ? this.images.length - 1 : undefined;
    if (target === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    this.setActive(target);
  }
}
