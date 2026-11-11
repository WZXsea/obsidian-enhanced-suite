import { App, MarkdownView, WorkspaceLeaf } from 'obsidian';
import type { GalleryImage } from './types';
import { GalleryViewer } from './viewer';

interface ToolkitBridge {
  imageLayoutBridgeVersion: 1;
  openGallery(images: Array<{ src: string; alt: string }>, index: number,
    origin: HTMLImageElement, sourcePath: string): boolean;
}
interface ToolkitPlugin {
  manifest?: { version?: string };
  noteImageStage?: Partial<ToolkitBridge>;
}
export interface ToolkitIntegrationStatus {
  available: boolean;
  compatible: boolean;
  version: string;
  reason: 'ready' | 'disabled' | 'adapter-unavailable';
}

function getToolkit(app: App): ToolkitPlugin | undefined {
  try {
    const manager = (app as unknown as { plugins?: { getPlugin?: (id: string) => ToolkitPlugin | undefined } }).plugins;
    return manager?.getPlugin?.('obsidian-image-toolkit');
  } catch { return undefined; }
}

export function getToolkitIntegrationStatus(app: App): ToolkitIntegrationStatus {
  const toolkit = getToolkit(app);
  const bridge = toolkit?.noteImageStage;
  const compatible = bridge?.imageLayoutBridgeVersion === 1 && typeof bridge.openGallery === 'function';
  return {
    available: !!toolkit, compatible, version: toolkit?.manifest?.version ?? '',
    reason: compatible ? 'ready' : toolkit ? 'adapter-unavailable' : 'disabled',
  };
}

function findSourceLeaf(app: App, origin: HTMLImageElement, sourcePath?: string): WorkspaceLeaf | undefined {
  const candidates = app.workspace.getLeavesOfType('markdown').filter(leaf =>
    leaf.view instanceof MarkdownView && !!leaf.view.file && (!sourcePath || leaf.view.file.path === sourcePath));
  return candidates.find(leaf => leaf.view.containerEl.contains(origin))
    ?? candidates.find(leaf => leaf === app.workspace.getMostRecentLeaf())
    ?? candidates[0];
}

function displaysImage(origin: HTMLImageElement, image: GalleryImage): boolean {
  try { return origin.src === new URL(image.src, origin.ownerDocument.baseURI).href; }
  catch { return origin.src === image.src; }
}

/** Open an exact source-order group. Bridge v1 handles duplicates independently of gallery DOM. */
export function openGalleryImage(app: App, images: GalleryImage[], index: number,
  origin?: HTMLImageElement, sourcePath?: string): 'toolkit' | 'fallback' {
  const requested = images[Math.max(0, Math.min(images.length - 1, Number.isFinite(index) ? Math.trunc(index) : 0))];
  const available = images.filter(image => !!image.src && !image.missing);
  const selected = Math.max(0, available.indexOf(requested));
  const toolkit = getToolkit(app);
  const bridge = toolkit?.noteImageStage;
  if (origin?.isConnected && available.length && bridge?.imageLayoutBridgeVersion === 1
    && typeof bridge.openGallery === 'function' && displaysImage(origin, available[selected])) {
    try {
      const leaf = findSourceLeaf(app, origin, sourcePath);
      if (leaf?.view instanceof MarkdownView && leaf.view.file) {
        app.workspace.setActiveLeaf(leaf, { focus: false });
        if (bridge.openGallery(available.map(({ src, alt }) => ({ src, alt })), selected,
          origin, leaf.view.file.path) === true) return 'toolkit';
      }
    } catch (error) {
      console.warn('Image Layouts Enhanced: Image Toolkit adapter uses the independent viewer', error);
    }
  }
  new GalleryViewer(app, available, selected).open();
  return 'fallback';
}
