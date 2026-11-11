export interface MobileChooserOptions<T> {
	render(result: T, element: HTMLElement): void;
	choose(result: T, event: MouseEvent | KeyboardEvent): void;
	selected?(result: T, event: MouseEvent | KeyboardEvent | null): void;
}

let nextMobileChooserId = 0;

/** A portable result list that uses DOM APIs instead of SuggestModal internals. */
export class MobileChooser<T> {
	values: T[] = [];
	selectedItem = -1;
	suggestions: HTMLElement[] = [];
	private readonly rowCleanup: Array<() => void> = [];
	private readonly cleanup: Array<() => void> = [];
	private readonly activePointers = new Map<number, {x: number; y: number}>();
	private readonly optionPrefix = `float-search-mobile-option-${++nextMobileChooserId}`;
	private readonly previousRole: string | null;
	private suppressTap = false;
	private destroyed = false;

	constructor(private readonly container: HTMLElement,
		private readonly options: MobileChooserOptions<T>) {
		this.previousRole = container.getAttribute("role");
		container.setAttribute("role", "listbox");
		const doc = container.ownerDocument;
		const listen = (target: EventTarget, type: string, listener: EventListener,
			options?: AddEventListenerOptions | boolean) => {
			target.addEventListener(type, listener, options);
			this.cleanup.push(() => target.removeEventListener(type, listener, options));
		};
		listen(doc, "pointerdown", event => {
			const pointer = event as PointerEvent;
			if (pointer.pointerType === "touch" && this.activePointers.size > 0 &&
				!this.activePointers.has(pointer.pointerId)) {
				this.suppressTap = true;
				this.activePointers.set(pointer.pointerId, {x: pointer.clientX, y: pointer.clientY});
			}
		}, {capture: true, passive: true});
		listen(container, "pointerdown", event => {
			const pointer = event as PointerEvent;
			if (pointer.pointerType !== "touch") return;
			if (this.activePointers.size === 0) this.suppressTap = pointer.isPrimary === false;
			else this.suppressTap = true;
			this.activePointers.set(pointer.pointerId, {x: pointer.clientX, y: pointer.clientY});
		}, {passive: true});
		const track = (event: Event) => {
			const pointer = event as PointerEvent;
			const start = this.activePointers.get(pointer.pointerId);
			if (start && Math.hypot(pointer.clientX - start.x, pointer.clientY - start.y) > 10) {
				this.suppressTap = true;
			}
		};
		listen(doc, "pointermove", track, {capture: true, passive: true});
		listen(doc, "pointerup", event => {
			track(event);
			this.activePointers.delete((event as PointerEvent).pointerId);
		}, {capture: true, passive: true});
		listen(doc, "pointercancel", event => {
			if (this.activePointers.delete((event as PointerEvent).pointerId)) this.suppressTap = true;
		}, {capture: true, passive: true});
		listen(container, "scroll", () => {
			if (this.activePointers.size) this.suppressTap = true;
		}, {passive: true});
		listen(container, "click", event => {
			if (!this.suppressTap) return;
			event.preventDefault();
			event.stopImmediatePropagation();
		}, true);
	}

	setSuggestions(results: T[]): void {
		if (this.destroyed) return;
		this.values = [...results];
		this.selectedItem = this.values.length ? 0 : -1;
		this.renderSuggestions();
		if (this.selectedItem >= 0) this.options.selected?.(this.values[this.selectedItem], null);
	}

	renderSuggestions(): void {
		if (this.destroyed) return;
		this.clearRows();
		this.container.textContent = "";
		this.selectedItem = this.values.length
			? Math.max(0, Math.min(this.selectedItem, this.values.length - 1)) : -1;
		this.values.forEach((result, index) => {
			const row = this.container.ownerDocument.createElement("div");
			row.className = "suggestion-item";
			row.id = `${this.optionPrefix}-${index}`;
			row.style.minHeight = "44px";
			row.setAttribute("role", "option");
			this.options.render(result, row);
			const click = (event: MouseEvent) => {
				event.preventDefault();
				event.stopPropagation();
				if (this.destroyed || this.suppressTap) return;
				this.select(index, event);
				this.options.choose(result, event);
			};
			row.addEventListener("click", click);
			this.rowCleanup.push(() => row.removeEventListener("click", click));
			this.suggestions.push(row);
			this.container.appendChild(row);
		});
		this.paintSelection();
	}

	moveSelection(delta: number): void {
		if (this.destroyed || !this.values.length || !Number.isFinite(delta)) return;
		const next = Math.max(0, Math.min(this.values.length - 1, this.selectedItem + Math.trunc(delta)));
		this.select(next, null);
		this.suggestions[next]?.scrollIntoView?.({block: "nearest"});
	}

	chooseSelected(event: MouseEvent | KeyboardEvent): boolean {
		if (this.destroyed || this.selectedItem < 0 || this.selectedItem >= this.values.length) return false;
		event.preventDefault();
		event.stopPropagation();
		this.options.choose(this.values[this.selectedItem], event);
		return true;
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.cleanup.splice(0).forEach(dispose => dispose());
		this.activePointers.clear();
		this.clearRows();
		this.values = [];
		this.selectedItem = -1;
		if (this.previousRole === null) this.container.removeAttribute("role");
		else this.container.setAttribute("role", this.previousRole);
	}

	private select(index: number, event: MouseEvent | KeyboardEvent | null): void {
		this.selectedItem = index;
		this.paintSelection();
		this.options.selected?.(this.values[index], event);
	}

	private paintSelection(): void {
		this.suggestions.forEach((row, index) => {
			const selected = index === this.selectedItem;
			row.classList.toggle("is-selected", selected);
			row.setAttribute("aria-selected", String(selected));
		});
	}

	private clearRows(): void {
		this.rowCleanup.splice(0).forEach(dispose => dispose());
		this.suggestions.forEach(row => row.remove());
		this.suggestions = [];
	}
}
