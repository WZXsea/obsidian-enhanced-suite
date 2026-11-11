/** Layout against the visible viewport, including Android's on-screen keyboard. */
export interface PopupViewport { left: number; top: number; width: number; height: number; }
export interface PopupAnchor { left: number; top: number; bottom: number; width: number; }
export function popupPlacement(viewport: PopupViewport, anchor: PopupAnchor, contentHeight: number, editing: boolean) {
  const margin = Math.min(12, viewport.width / 4, viewport.height / 4);
  const availableWidth = Math.max(1, viewport.width - margin * 2);
  const width = Math.min(420, availableWidth);
  const maxHeight = Math.max(1, Math.min(editing ? 560 : 360, viewport.height - margin * 2));
  const height = Math.min(contentHeight, maxHeight);
  const left = Math.max(viewport.left + margin, Math.min(anchor.left - 12, viewport.left + viewport.width - width - margin));
  const below = anchor.bottom + 8;
  const top = below + height <= viewport.top + viewport.height - margin
    ? Math.max(viewport.top + margin, below)
    : Math.max(viewport.top + margin, Math.min(anchor.top - height - 8, viewport.top + viewport.height - height - margin));
  const side = top < anchor.top ? 'above' as const : 'below' as const;
  return { width, maxHeight, height, left, top, side };
}

/** A drag that starts over a badge should continue scrolling the note. */
export class TouchTap {
  private start: { id: number; x: number; y: number } | null = null;
  private moved = false;
  private readonly active = new Set<number>();
  begin(id: number, x: number, y: number): void {
    // A fresh down with a reused id also recovers a release outside the host.
    if (this.active.has(id)) this.active.clear();
    if (this.active.size === 0) { this.start = { id, x, y }; this.moved = false; }
    else if (!this.active.has(id)) this.moved = true;
    this.active.add(id);
  }
  move(id: number, x: number, y: number): void {
    if (this.start?.id === id && Math.hypot(x - this.start.x, y - this.start.y) > 10) this.moved = true;
  }
  end(id: number): void {
    this.active.delete(id);
    if (this.start?.id === id) this.start = null;
  }
  cancel(): void { this.moved = true; this.start = null; this.active.clear(); }
  get suppressed(): boolean { return this.moved; }
}
