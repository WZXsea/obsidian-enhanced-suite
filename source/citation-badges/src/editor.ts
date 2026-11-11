import { StateEffect, type Extension } from '@codemirror/state';
import { Decoration, ViewPlugin, WidgetType, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';
import { editorInfoField, editorLivePreviewField } from 'obsidian';
import type { EditorBridge } from './editor-contract';
import type { Cluster, DocumentModel } from './types';

// A transaction effect schedules a normal view update after composition events.
const refreshComposition = StateEffect.define<null>();

function editorPath(view: EditorView): string {
  const info = view.state.field(editorInfoField, false);
  const path = info?.file?.path ?? (info as { path?: string } | undefined)?.path ?? '';
  return view.dom.closest('.citation-inline-editor') ? `__citation-inline__/${path}` : path;
}

function widgetIdentity(cluster: Cluster, path: string): string {
  return JSON.stringify([
    path, cluster.from, cluster.to, cluster.label, cluster.numbers,
    cluster.members.map(member => [
      member.kind, member.sourceId, member.from, member.to, member.number,
      member.occurrence, member.content,
      member.definition && [member.definition.id, member.definition.from,
        member.definition.to, member.definition.content],
    ]),
  ]);
}

class BadgeLifecycle {
  private readonly elements = new Set<HTMLElement>();

  constructor(private readonly bridge: EditorBridge) {}

  mount(cluster: Cluster, path: string, view: EditorView): HTMLElement {
    const element = this.bridge.createBadge(cluster, path, view);
    this.elements.add(element);
    return element;
  }

  dispose(element: HTMLElement): void {
    if (this.elements.delete(element)) this.bridge.disposeBadge(element);
  }

  destroy(): void {
    for (const element of [...this.elements]) this.dispose(element);
  }
}

class CitationWidget extends WidgetType {
  private readonly identity: string;

  constructor(
    private readonly cluster: Cluster,
    private readonly path: string,
    private readonly lifecycle: BadgeLifecycle,
  ) {
    super();
    this.identity = widgetIdentity(cluster, path);
  }

  override eq(other: CitationWidget): boolean {
    return this.lifecycle === other.lifecycle && this.identity === other.identity;
  }

  override toDOM(view: EditorView): HTMLElement {
    return this.lifecycle.mount(this.cluster, this.path, view);
  }

  override ignoreEvent(): boolean {
    // The bridge owns badge pointer/keyboard interactions. Editor selections
    // independently expose the authored reference markers for source editing.
    return true;
  }

  override destroy(element: HTMLElement): void {
    this.lifecycle.dispose(element);
  }
}

export function citationEditorExtension(bridge: EditorBridge): Extension {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet = Decoration.none;
    private readonly lifecycle = new BadgeLifecycle(bridge);
    private model: DocumentModel;
    private path: string;
    private composing = false;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private disposed = false;

    constructor(view: EditorView) {
      this.path = editorPath(view);
      this.model = bridge.model(view.state.doc.toString(), this.path);
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate): void {
      const nextPath = editorPath(update.view);
      const pathChanged = nextPath !== this.path;
      if (update.docChanged || pathChanged) {
        this.path = nextPath;
        this.model = bridge.model(update.state.doc.toString(), this.path);
      }
      // View-field changes can toggle Live Preview without changing the doc.
      const modeChanged = update.startState.field(editorLivePreviewField, false)
        !== update.state.field(editorLivePreviewField, false);
      const compositionChanged = update.transactions.some(transaction =>
        transaction.effects.some(effect => effect.is(refreshComposition)));
      if (update.docChanged || pathChanged || update.selectionSet || update.viewportChanged
        || modeChanged || compositionChanged) this.decorations = this.build(update.view);
    }

    private build(view: EditorView): DecorationSet {
      if (view.dom.closest('.citation-inline-editor')) return Decoration.none;
      if (view.state.field(editorLivePreviewField, false) !== true) return Decoration.none;
      const ranges = view.state.selection.ranges;
      const compositionLines = this.composing || view.compositionStarted || view.composing
        ? ranges.map(range => ({
          from: view.state.doc.lineAt(range.from).from,
          to: view.state.doc.lineAt(range.to).to,
        })) : [];
      const decorations = [];
      for (const cluster of this.model.clusters) {
        // ViewPlugin decorations may replace inline content, not line breaks.
        // Multiline inline-footnote syntax remains editable as source.
        if (this.model.source.slice(cluster.from, cluster.to).includes('\n')) continue;
        // Expose the entire cluster for every intersecting selection. Including
        // both boundaries lets arrow movement and boundary insertion enter source.
        if (ranges.some(range => range.from <= cluster.to && range.to >= cluster.from)) continue;
        if (compositionLines.some(line => line.from <= cluster.to && line.to >= cluster.from)) continue;
        if (!view.visibleRanges.some(range => range.from < cluster.to && range.to > cluster.from)) continue;
        decorations.push(Decoration.replace({
          widget: new CitationWidget(cluster, this.path, this.lifecycle),
          inclusive: false,
        }).range(cluster.from, cluster.to));
      }
      return Decoration.set(decorations, true);
    }

    compositionStart(view: EditorView): void {
      this.composing = true;
      this.scheduleRefresh(view, 0, false);
    }

    compositionEnd(view: EditorView): void {
      // Keep the composition line exposed while final IME mutations settle.
      this.scheduleRefresh(view, 60, true);
    }

    private scheduleRefresh(view: EditorView, delay: number, endComposition: boolean): void {
      if (this.timer !== undefined) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = undefined;
        if (this.disposed) return;
        if (endComposition) this.composing = false;
        view.dispatch({ effects: refreshComposition.of(null) });
      }, delay);
    }

    destroy(): void {
      this.disposed = true;
      if (this.timer !== undefined) clearTimeout(this.timer);
      this.lifecycle.destroy();
    }
  }, {
    decorations: value => value.decorations,
    eventObservers: {
      compositionstart(_event, view) { this.compositionStart(view); },
      compositionend(_event, view) { this.compositionEnd(view); },
    },
  });
}
