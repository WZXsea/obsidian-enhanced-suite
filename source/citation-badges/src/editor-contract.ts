import type { EditorView } from '@codemirror/view';
import type { Cluster, DocumentModel } from './types';

export interface EditorBridge {
  model(source: string, path: string): DocumentModel;
  createBadge(cluster: Cluster, path: string, view: EditorView): HTMLElement;
  disposeBadge(element: HTMLElement): void;
}
