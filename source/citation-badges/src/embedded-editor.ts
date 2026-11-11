import { EditorSelection, EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { ViewUpdate } from '@codemirror/view';
import { MarkdownView, Scope } from 'obsidian';
import type { App, Component, Editor, MarkdownFileInfo, TFile } from 'obsidian';

export interface EmbeddedEditorOptions {
  value: string;
  path: string;
  label?: string;
  onChange(value: string): void;
  onFocus?(): void;
  onBlur?(): void;
  onLayout?(): void;
}

interface Suggestion {
  context?: { editor?: Editor } | null;
  suggestEl?: HTMLElement;
  isOpen?: boolean;
}

interface NativeSuggest {
  currentSuggest?: Suggestion | null;
  close(): void;
  reposition(): void;
  trigger(...args: unknown[]): void;
}

interface NativeOwner extends MarkdownFileInfo {
  app: App;
  file: TFile | null;
  path: string;
  editor: Editor;
  editMode: NativeMode;
  scope: Scope;
  citationBadgeEmbeddedEditor: true;
  getMode(): 'source';
  getHoverSource(): 'editor';
  syncScroll(): void;
  onMarkdownScroll(): void;
  showSearch(): void;
  toggleMode(): void;
}

interface NativeMode extends Component {
  cm: EditorView;
  editor: Editor;
  editorEl: HTMLElement;
  sizerEl: HTMLElement;
  sourceMode: boolean;
  owner: NativeOwner;
  editorSuggest: NativeSuggest;
  set(value: string, clear?: boolean): void;
  updateOptions(): void;
  getDynamicExtensions(): Extension[];
  onUpdate(update: ViewUpdate, changed: boolean): void;
  onResize(): void;
  destroy(): void;
}

type NativeConstructor = new (app: App, container: HTMLElement, owner: NativeOwner) => NativeMode;
interface TemporaryEmbed extends Component {
  editable: boolean;
  editMode?: NativeMode;
  showEditor(): void;
}
interface InternalApp extends App {
  embedRegistry?: { embedByExtension?: { md?: (context: { app: App; containerEl: HTMLElement }, file: null,
    subpath: string) => TemporaryEmbed } };
}

const constructors = new WeakMap<App, NativeConstructor>();
const owners = new WeakMap<object, EmbeddedMarkdownEditor>();
const editorAdapters = new WeakMap<Editor, EmbeddedMarkdownEditor>();
const modeAdapters = new WeakMap<object, EmbeddedMarkdownEditor>();

function adapterForOwner(current: MarkdownFileInfo | null): EmbeddedMarkdownEditor | undefined {
  if (!current || current instanceof MarkdownView) return undefined;
  const direct = owners.get(current);
  if (direct) return direct;
  const editor = current.editor;
  const editorAdapter = editor ? editorAdapters.get(editor) : undefined;
  if (editorAdapter) return editorAdapter;
  const mode = (current as MarkdownFileInfo & { editMode?: unknown }).editMode;
  return mode && typeof mode === 'object' ? modeAdapters.get(mode) : undefined;
}

function findScrollableConstructor(mode: unknown): NativeConstructor | null {
  if (!mode || typeof mode !== 'object') return null;
  let prototype = Object.getPrototypeOf(mode) as Record<string, unknown> | null;
  while (prototype && prototype !== Object.prototype) {
    if (Object.prototype.hasOwnProperty.call(prototype, 'getScroll')
      && Object.prototype.hasOwnProperty.call(prototype, 'handleScroll')
      && typeof prototype.getDynamicExtensions === 'function' && typeof prototype.set === 'function') {
      return prototype.constructor as NativeConstructor;
    }
    prototype = Object.getPrototypeOf(prototype) as Record<string, unknown> | null;
  }
  return null;
}

/** Resolve a native constructor without creating or changing a workspace leaf. */
function resolveConstructor(app: App, document: Document): NativeConstructor {
  const cached = constructors.get(app);
  if (cached) return cached;
  // An existing Markdown view exposes the same ScrollableMarkdownEditor used by
  // Markdown embeds. This route avoids even a temporary editor during discovery.
  for (const leaf of app.workspace.getLeavesOfType('markdown')) {
    const found = findScrollableConstructor((leaf.view as unknown as { editMode?: unknown }).editMode);
    if (found) { constructors.set(app, found); return found; }
  }
  const creator = (app as InternalApp).embedRegistry?.embedByExtension?.md;
  if (!creator) throw new Error('当前 Obsidian 的原生 Markdown 编辑器正在初始化。');
  const container = document.createElement('div');
  let embed: TemporaryEmbed | undefined;
  try {
    embed = creator({ app, containerEl: container }, null, '');
    embed.editable = true;
    embed.showEditor();
    const found = findScrollableConstructor(embed.editMode);
    if (!found) throw new Error('当前 Obsidian 的原生 Markdown 编辑器需要重新初始化。');
    constructors.set(app, found);
    return found;
  } finally {
    // A detached embed starts unloaded, so unload alone would leave its CM view
    // allocated. Destroy that view explicitly and release any loaded children.
    embed?.editMode?.destroy();
    embed?.editMode?.unload();
    embed?.unload();
    container.remove();
  }
}

function editorApp(app: App): App {
  const vault = new Proxy(app.vault, {
    get(target, property, receiver) {
      if (property === 'getConfig') return (name: string) => {
        if (['showLineNumber', 'showIndentGuide', 'foldHeading', 'foldIndent'].includes(name)) return false;
        if (name === 'propertiesInDocument') return 'hidden';
        if (name === 'livePreview') return true;
        return (target as typeof target & { getConfig(key: string): unknown }).getConfig(name);
      };
      return Reflect.get(target, property, receiver);
    }
  });
  return new Proxy(app, {
    get(target, property, receiver) { return property === 'vault' ? vault : Reflect.get(target, property, receiver); }
  });
}

/** One native Live Preview region, toggled between rendered reading and editing. */
export class EmbeddedMarkdownEditor {
  readonly element: HTMLElement;
  readonly cm: EditorView;
  private readonly mode: NativeMode;
  private readonly owner: NativeOwner;
  private readonly scope: Scope;
  private previousActiveEditor: MarkdownFileInfo | null;
  private editable = false;
  private setting = true;
  private alive = true;
  private composing = false;
  private scopePushed = false;
  private compositionTimer: number | null = null;
  private layoutFrame: number | null = null;

  constructor(private readonly app: App, container: HTMLElement, private readonly options: EmbeddedEditorOptions) {
    this.previousActiveEditor = this.rootActiveEditor(app.workspace.activeEditor);
    this.scope = new Scope(app.scope);
    const file = app.vault.getAbstractFileByPath(options.path);
    // The controller supplies relative-link context while its save path remains
    // the caller's footnote-body callback; it has no MarkdownView requestSave.
    const owner = this.owner = {
      app, file: file && 'extension' in file ? file as TFile : null, path: options.path,
      scope: this.scope, citationBadgeEmbeddedEditor: true,
      getMode: () => 'source', getHoverSource: () => 'editor',
      syncScroll: () => {}, onMarkdownScroll: () => {}, showSearch: () => {}, toggleMode: () => {}
    } as NativeOwner;
    owners.set(owner, this);
    const adapter = this;
    const Base = resolveConstructor(app, container.ownerDocument);
    class CitationEditor extends Base {
      override getDynamicExtensions(): Extension[] {
        this.sourceMode = false;
        // Native contentAttributes includes contenteditable:true. Place ours
        // first so read-only mode also has the correct DOM and accessibility.
        return [EditorView.contentAttributes.of({
          contenteditable: String(adapter.editable), 'aria-readonly': String(!adapter.editable),
          'aria-label': options.label ?? '引用正文', 'aria-multiline': 'true', role: 'textbox'
        }), ...super.getDynamicExtensions(), EditorView.editable.of(adapter.editable),
        EditorState.readOnly.of(!adapter.editable)];
      }
      override onUpdate(update: ViewUpdate, changed: boolean): void {
        if (!adapter.alive) return;
        // ScrollableMarkdownEditor broadcasts global editor events. Emitting
        // them during readonly initialization or empty-state teardown lets
        // other plugins adopt this fragment as the workspace's active editor.
        if (!adapter.setting && adapter.editable && this.cm?.hasFocus) super.onUpdate(update, changed);
        if (!adapter.setting && update.docChanged) options.onChange(update.state.doc.toString());
        adapter.scheduleLayout();
      }
      updateBottomPadding(): void {}
    }
    const mode = this.mode = new CitationEditor(editorApp(app), container, owner);
    this.cm = mode.cm;
    this.element = mode.editorEl;
    owner.editMode = mode;
    owner.editor = mode.editor;
    editorAdapters.set(mode.editor, this);
    modeAdapters.set(mode, this);
    this.element.classList.add('citation-native-editor', 'citation-editor-readonly');
    mode.sourceMode = false;
    // Native suggestion state is global. Closing an unrelated embedded editor
    // should preserve the suggestions owned by the editor currently in focus.
    const suggestions = mode.editorSuggest;
    mode.editorSuggest = new Proxy(suggestions, {
      get(target, property, receiver) {
        if (property === 'close' || property === 'reposition') return () => {
          if (adapter.ownsSuggestion() || app.workspace.activeEditor === owner || mode.cm.hasFocus) {
            (target[property] as () => void).call(target);
          }
        };
        if (property === 'trigger') return (...args: unknown[]) => {
          if (adapter.editable && mode.cm.hasFocus) target.trigger(...args);
        };
        return Reflect.get(target, property, receiver);
      }
    });
    mode.load();
    mode.registerDomEvent(this.cm.contentDOM, 'focus', () => this.handleFocus(), { capture: true });
    mode.registerDomEvent(this.cm.contentDOM, 'blur', () => this.blurred(), { capture: true });
    mode.registerDomEvent(this.cm.contentDOM, 'compositionstart', () => { this.composing = true; });
    mode.registerDomEvent(this.cm.contentDOM, 'compositionend', () => {
      this.composing = false;
      const win = this.element.ownerDocument.defaultView;
      if (win) this.compositionTimer = win.setTimeout(() => {
        this.compositionTimer = null;
        if (this.alive) options.onChange(this.getValue());
      }, 0);
    });
    mode.set(options.value, true);
    this.setting = false;
    this.scheduleLayout();
  }

  get focused(): boolean { return this.cm.hasFocus; }

  get isComposing(): boolean { return this.composing || this.cm.composing; }

  getValue(): string { return this.cm.state.doc.toString(); }

  setValue(value: string): void {
    if (!this.alive || value === this.getValue()) return;
    this.setting = true;
    try { this.mode.set(value, true); } finally { this.setting = false; }
    this.scheduleLayout();
  }

  setEditable(editable: boolean): void {
    if (!this.alive || this.editable === editable) return;
    if (!editable && this.cm.hasFocus) this.blur();
    this.editable = editable;
    this.element.classList.toggle('citation-editor-readonly', !editable);
    this.mode.sourceMode = false;
    this.mode.updateOptions();
    this.scheduleLayout();
  }

  focus(): void {
    if (!this.alive) return;
    this.setEditable(true);
    this.cm.focus();
  }

  focusAtCoords(x: number, y: number): void {
    if (!this.alive) return;
    const position = this.cm.posAtCoords({ x, y }, false) ?? this.cm.state.selection.main.head;
    this.focus();
    this.cm.dispatch({ selection: EditorSelection.single(position), userEvent: 'select.pointer' });
  }

  blur(): void { if (this.alive) this.cm.contentDOM.blur(); }

  ownsTarget(target: EventTarget | null): boolean {
    if (!target || !('nodeType' in target)) return false;
    const node = target as Node;
    if (this.element.contains(node)) return true;
    const current = this.mode.editorSuggest.currentSuggest;
    const suggestions = current?.suggestEl?.closest('.suggestion-container') ?? current?.suggestEl;
    return this.ownsSuggestion() && !!suggestions?.contains(node);
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    const win = this.element.ownerDocument.defaultView;
    if (this.compositionTimer !== null) win?.clearTimeout(this.compositionTimer);
    if (this.layoutFrame !== null) win?.cancelAnimationFrame(this.layoutFrame);
    if (this.cm.hasFocus) this.cm.contentDOM.blur();
    this.popScope();
    this.restoreActiveEditor();
    this.mode.unload();
    this.mode.destroy();
    this.element.remove();
    this.restoreDisposedEditor();
    // Native DOM cleanup and third-party listeners can finish in a microtask.
    // Restore only a disposed citation controller, preserving any newer focus.
    queueMicrotask(() => this.restoreDisposedEditor());
  }

  private ownsSuggestion(): boolean {
    return this.mode.editorSuggest.currentSuggest?.context?.editor === this.mode.editor;
  }

  private handleFocus(): void {
    if (!this.alive || !this.editable) return;
    if (this.app.workspace.activeEditor !== this.owner) {
      // Switching A→B→A should retain the original document controller rather
      // than form a cycle among the temporary citation editor controllers.
      this.previousActiveEditor = this.rootActiveEditor(this.app.workspace.activeEditor);
    }
    this.app.workspace.activeEditor = this.owner;
    if (!this.scopePushed) { this.app.keymap.pushScope(this.scope); this.scopePushed = true; }
    this.options.onFocus?.();
  }

  private blurred(): void {
    this.popScope();
    if (!this.alive) return;
    this.options.onBlur?.();
    queueMicrotask(() => {
      if (!this.ownsTarget(this.element.ownerDocument.activeElement)) this.restoreActiveEditor();
    });
  }

  private popScope(): void {
    if (this.scopePushed) { this.app.keymap.popScope(this.scope); this.scopePushed = false; }
  }

  private rootActiveEditor(current: MarkdownFileInfo | null): MarkdownFileInfo | null {
    const visited = new Set<MarkdownFileInfo>();
    while (current) {
      const adapter = adapterForOwner(current);
      if (!adapter) return current;
      if (visited.has(current)) return null;
      visited.add(current);
      current = adapter.previousActiveEditor;
    }
    return null;
  }

  private restoreActiveEditor(): void {
    if (adapterForOwner(this.app.workspace.activeEditor) !== this) return;
    let previous = this.previousActiveEditor;
    const visited = new Set<MarkdownFileInfo>();
    while (previous) {
      if (previous === this.owner || visited.has(previous)) { previous = null; break; }
      visited.add(previous);
      const adapter = adapterForOwner(previous);
      if (!adapter || adapter.alive) break;
      previous = adapter.previousActiveEditor;
    }
    this.setActiveEditorBaseline(previous);
  }

  private restoreDisposedEditor(): void {
    const current = this.app.workspace.activeEditor;
    const adapter = adapterForOwner(current);
    if (adapter && !adapter.alive) {
      this.setActiveEditorBaseline(adapter.rootActiveEditor(adapter.previousActiveEditor));
    }
  }

  private setActiveEditorBaseline(previous: MarkdownFileInfo | null): void {
    // Obsidian's setter deliberately ignores MarkdownView assignments. Clear
    // the fragment override so its getter resumes returning the active view.
    this.app.workspace.activeEditor = previous instanceof MarkdownView ? null : previous;
  }

  private scheduleLayout(): void {
    if (!this.alive || this.layoutFrame !== null) return;
    const win = this.element?.ownerDocument.defaultView;
    if (win) this.layoutFrame = win.requestAnimationFrame(() => {
      this.layoutFrame = null;
      if (this.alive) { this.cm.requestMeasure(); this.options.onLayout?.(); }
    });
  }
}

export function createEmbeddedEditor(app: App, container: HTMLElement, options: EmbeddedEditorOptions): EmbeddedMarkdownEditor {
  return new EmbeddedMarkdownEditor(app, container, options);
}
