/** Pane identity owns navigation; opening a second window keeps the first pane's stage intact. */
export class StageRegistry<Pane, Stage extends {close(): void}> {
  private readonly stages = new Map<Pane, Stage>();
  constructor(private readonly create: (pane: Pane) => Stage) {}
  reconcile(panes: readonly Pane[]): Map<Pane, Stage> {
    const retained = new Set(panes);
    for (const [pane, stage] of this.stages) if (!retained.has(pane)) { stage.close(); this.stages.delete(pane); }
    for (const pane of panes) if (!this.stages.has(pane)) this.stages.set(pane, this.create(pane));
    return new Map(this.stages);
  }
  get(pane: Pane): Stage | undefined { return this.stages.get(pane); }
  values(): IterableIterator<Stage> { return this.stages.values(); }
  close(): void { for (const stage of this.stages.values()) stage.close(); this.stages.clear(); }
}

export function isStageRootMounted(root: HTMLElement | null, container: HTMLElement): boolean {
  return Boolean(container.isConnected && root?.isConnected && root.parentElement === container);
}

/** A completed empty render differs from a missing or detached image-bearing stage. */
export function canReuseStageRender(root: HTMLElement | null, container: HTMLElement, renderedEmpty: boolean): boolean {
  return isStageRootMounted(root, container) || Boolean(renderedEmpty && root === null && container.isConnected);
}

interface StagePane {containerEl: {ownerDocument: {hasFocus(): boolean}}}
export function pickStageSource<T extends StagePane>(panes: readonly T[], active: T | null | undefined, recent: T | null | undefined, previous: T | null): T | null {
  const focused = panes.filter(pane => pane.containerEl.ownerDocument.hasFocus());
  const candidates = focused.length ? focused : panes;
  return [active, recent, previous].find((pane): pane is T => Boolean(pane && candidates.includes(pane))) ?? candidates[0] ?? null;
}

/** IDs are scoped to their owner window, including cancellation after DOM detachment. */
export class PaneTimers {
  private readonly timers = new Map<string, number>();
  constructor(private readonly owner: Pick<Window, 'setTimeout' | 'clearTimeout'>) {}
  has(name: string): boolean { return this.timers.has(name); }
  schedule(name: string, callback: () => void, delay: number): void {
    this.cancel(name);
    const id = this.owner.setTimeout(() => {
      if (this.timers.get(name) !== id) return;
      this.timers.delete(name); callback();
    }, delay);
    this.timers.set(name, id);
  }
  cancel(name: string): void {
    const id = this.timers.get(name);
    if (id !== undefined) this.owner.clearTimeout(id);
    this.timers.delete(name);
  }
  clear(): void { for (const name of [...this.timers.keys()]) this.cancel(name); }
}
