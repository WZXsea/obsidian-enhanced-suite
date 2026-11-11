import { EditorView } from '@codemirror/view';
import type { MarkdownView } from 'obsidian';

interface VisibleBounds { top: number; bottom: number; }

const editorRequests = new WeakMap<EditorView, object>();
const trailingSpace = new WeakMap<HTMLElement, () => void>();

/** The pane's visible content area, including clipping by embeds and split panes. */
function visibleBounds(scroller: HTMLElement): VisibleBounds {
  const window = scroller.ownerDocument.defaultView;
  const rect = scroller.getBoundingClientRect();
  const contentTop = rect.top + scroller.clientTop;
  let top = Math.max(0, contentTop);
  let bottom = Math.min(window?.innerHeight ?? rect.bottom, contentTop + scroller.clientHeight);
  for (let parent = scroller.parentElement; parent; parent = parent.parentElement) {
    const style = window?.getComputedStyle(parent);
    if (!style || !/(auto|scroll|hidden|clip)/.test(style.overflowY)) continue;
    const outer = parent.getBoundingClientRect();
    top = Math.max(top, outer.top + parent.clientTop);
    bottom = Math.min(bottom, outer.top + parent.clientTop + parent.clientHeight);
  }
  return { top, bottom };
}

/**
 * Add space only when the existing theme padding cannot center the last entry.
 * The original inline style is restored on the user's next interaction or on
 * DOM removal, so navigation never installs a persistent layout preference.
 */
function reserveTrailingSpace(scroller: HTMLElement, content: HTMLElement, extra: number): void {
  if (extra < 1) return;
  trailingSpace.get(scroller)?.();
  const doc = scroller.ownerDocument;
  const window = doc.defaultView;
  const original = content.style.getPropertyValue('padding-bottom');
  const priority = content.style.getPropertyPriority('padding-bottom');
  const base = parseFloat(window?.getComputedStyle(content).paddingBottom ?? '0') || 0;
  const padding = `${base + Math.ceil(extra) + 2}px`;
  content.style.setProperty('padding-bottom', padding);
  let disposed = false;
  const restore = () => {
    if (disposed) return;
    disposed = true;
    if (content.style.getPropertyValue('padding-bottom') === padding) {
      if (original) content.style.setProperty('padding-bottom', original, priority);
      else content.style.removeProperty('padding-bottom');
    }
    doc.removeEventListener('pointerdown', restore, true);
    doc.removeEventListener('keydown', restore, true);
    doc.removeEventListener('wheel', restore, true);
    window?.removeEventListener('pagehide', restore);
    observer?.disconnect();
    trailingSpace.delete(scroller);
  };
  const observer = window && new window.MutationObserver(() => {
    if (!scroller.isConnected || !content.isConnected) restore();
  });
  observer?.observe(doc.body, { childList: true, subtree: true });
  doc.addEventListener('pointerdown', restore, true);
  doc.addEventListener('keydown', restore, true);
  doc.addEventListener('wheel', restore, { capture: true, passive: true });
  window?.addEventListener('pagehide', restore);
  trailingSpace.set(scroller, restore);
}

function correction(scroller: HTMLElement, targetCenter: number): number {
  const { top, bottom } = visibleBounds(scroller);
  if (bottom <= top) return 0;
  return targetCenter - (top + bottom) / 2;
}

/** Uses the CM6 scroll effect to render distant lines before measuring them. */
export function centerEditorPosition(view: EditorView, position: number): void {
  const window = view.dom.ownerDocument.defaultView;
  if (!window || !view.dom.isConnected) return;
  trailingSpace.get(view.scrollDOM)?.();
  const pos = Math.max(0, Math.min(position, view.state.doc.length));
  const doc = view.state.doc;
  const request = {};
  editorRequests.set(view, request);
  view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
  // The effect is applied at the end of CodeMirror's first measurement pass.
  // Correct after that pass, without depending on synchronous DOM layout.
  const measure = (attempt: number) => window.requestAnimationFrame(() => {
    if (!view.dom.isConnected || editorRequests.get(view) !== request || view.state.doc !== doc) return;
    view.requestMeasure({
      key: request,
      read: () => {
        // A queued measurement can run after another pane or a concurrent edit
        // has replaced the document. Preserve that newer editor state.
        if (!view.dom.isConnected || editorRequests.get(view) !== request || view.state.doc !== doc) return null;
        const rect = view.coordsAtPos(pos);
        if (!rect) return null;
        let delta = correction(view.scrollDOM, (rect.top + rect.bottom) / 2);
        // Respect editor panels that declare their occluded areas through CM6.
        let topMargin = 0, bottomMargin = 0;
        for (const source of view.state.facet(EditorView.scrollMargins)) {
          const margins = source(view);
          topMargin = Math.max(topMargin, margins?.top ?? 0);
          bottomMargin = Math.max(bottomMargin, margins?.bottom ?? 0);
        }
        delta -= (topMargin - bottomMargin) / 2;
        const desired = view.scrollDOM.scrollTop + delta;
        const missing = desired - (view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight);
        return { delta, missing };
      },
      write: measured => {
        if (!view.dom.isConnected || editorRequests.get(view) !== request || view.state.doc !== doc) return;
        if (!measured) { if (attempt < 2) measure(attempt + 1); return; }
        if (measured.missing > 1) reserveTrailingSpace(view.scrollDOM, view.contentDOM, measured.missing);
        if (Math.abs(measured.delta) > 1) view.scrollDOM.scrollTop += measured.delta;
        // Recheck once after virtualized content and any tail space settle.
        if (attempt < 2 && (measured.missing > 1 || Math.abs(measured.delta) > 1)) measure(attempt + 1);
      },
    });
  });
  measure(0);
}

function editorView(value: unknown): value is EditorView {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EditorView>;
  return !!candidate.dom && !!candidate.scrollDOM && !!candidate.state?.doc
    && typeof candidate.state.facet === 'function'
    && typeof candidate.dispatch === 'function' && typeof candidate.requestMeasure === 'function'
    && typeof candidate.coordsAtPos === 'function';
}

/** Public editor APIs remain the fallback when Obsidian's CM6 bridge changes. */
export async function centerMarkdownPosition(view: MarkdownView, position: number): Promise<void> {
  const point = view.editor.offsetToPos(position);
  view.editor.setCursor(point);
  const cm: unknown = (view.editor as unknown as { cm?: unknown }).cm;
  if (editorView(cm) && cm.dom.isConnected) centerEditorPosition(cm, position);
  else view.editor.scrollIntoView({ from: point, to: point }, true);
}

/** Center only the nearest scrolling pane, preserving other panes and the window. */
export function centerRenderedTarget(target: HTMLElement): void {
  const window = target.ownerDocument.defaultView;
  if (!window || !target.isConnected) return;
  let scroller: HTMLElement | null = target.parentElement;
  while (scroller) {
    const style = window.getComputedStyle(scroller);
    if (/(auto|scroll)/.test(style.overflowY) && scroller.clientHeight > 0) break;
    scroller = scroller.parentElement;
  }
  if (!scroller) return;
  const pane = scroller;
  trailingSpace.get(pane)?.();
  const move = () => {
    if (!target.isConnected || !pane.isConnected) return;
    const rect = target.getBoundingClientRect();
    if (rect.height <= 0) return;
    const delta = correction(pane, (rect.top + rect.bottom) / 2);
    const missing = pane.scrollTop + delta - (pane.scrollHeight - pane.clientHeight);
    const content = pane.querySelector<HTMLElement>(':scope > .markdown-preview-sizer') ?? pane;
    if (missing > 1) reserveTrailingSpace(pane, content, missing);
    pane.scrollTop += delta;
  };
  move();
  window.requestAnimationFrame(move);
}
