import {describe, expect, it} from "vitest";
import {MobileChooser} from "./mobileChooser";

interface FakeEvent {
	type: string;
	target: Surface;
	defaultPrevented: boolean;
	propagationStopped: boolean;
	immediateStopped: boolean;
	pointerId?: number;
	pointerType?: string;
	isPrimary?: boolean;
	clientX?: number;
	clientY?: number;
	preventDefault(): void;
	stopPropagation(): void;
	stopImmediatePropagation(): void;
}

class Surface {
	parentNode: Surface | null = null;
	listeners = new Map<string, Array<{fn: EventListener; capture: boolean}>>();
	addEventListener(type: string, fn: EventListener, options?: boolean | AddEventListenerOptions) {
		const group = this.listeners.get(type) ?? [];
		group.push({fn, capture: typeof options === "boolean" ? options : options?.capture ?? false});
		this.listeners.set(type, group);
	}
	removeEventListener(type: string, fn: EventListener) {
		this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item.fn !== fn));
	}
	emit(type: string, props: Partial<FakeEvent> = {}) {
		const event: FakeEvent = {type, target: this, defaultPrevented: false,
			propagationStopped: false, immediateStopped: false,
			preventDefault() {this.defaultPrevented = true;},
			stopPropagation() {this.propagationStopped = true;},
			stopImmediatePropagation() {this.immediateStopped = this.propagationStopped = true;}, ...props};
		const path: Surface[] = [];
		for (let node: Surface | null = this; node; node = node.parentNode) path.push(node);
		const run = (node: Surface, capture: boolean) => {
			for (const item of [...node.listeners.get(type) ?? []]) {
				if (item.capture === capture) item.fn(event as unknown as Event);
				if (event.immediateStopped) break;
			}
		};
		for (const node of [...path].reverse()) {run(node, true); if (event.propagationStopped) return event;}
		for (const node of path) {run(node, false); if (event.propagationStopped) break;}
		return event;
	}
}

class FakeDocument extends Surface {
	createElement() {return new FakeElement(this);}
}
class FakeElement extends Surface {
	className = "";
	id = "";
	style = {minHeight: ""};
	attributes = new Map<string, string>();
	children: FakeElement[] = [];
	classes = new Set<string>();
	scrolls = 0;
	classList = {
		toggle: (name: string, force: boolean) => force ? this.classes.add(name) : this.classes.delete(name),
		contains: (name: string) => this.classes.has(name),
	};
	constructor(readonly ownerDocument: FakeDocument) {super();}
	set textContent(_value: string) {for (const child of [...this.children]) child.remove();}
	getAttribute(name: string) {return this.attributes.get(name) ?? null;}
	setAttribute(name: string, value: string) {this.attributes.set(name, value);}
	removeAttribute(name: string) {this.attributes.delete(name);}
	appendChild(child: FakeElement) {child.remove(); child.parentNode = this; this.children.push(child); return child;}
	remove() {
		if (this.parentNode instanceof FakeElement) {
			this.parentNode.children = this.parentNode.children.filter(item => item !== this);
		}
		this.parentNode = null;
	}
	scrollIntoView() {this.scrolls++;}
}

function fixture() {
	const doc = new FakeDocument(), container = new FakeElement(doc);
	container.parentNode = doc;
	const chosen: string[] = [], selected: string[] = [];
	const chooser = new MobileChooser(container as unknown as HTMLElement, {
		render: (value: string, element) => element.setAttribute("data-value", value),
		choose: value => chosen.push(value), selected: value => selected.push(value),
	});
	chooser.setSuggestions(["a", "b", "c"]);
	const row = (index = 0) => chooser.suggestions[index] as unknown as FakeElement;
	const touch = (target: Surface, type: string, id = 1, x = 10, y = 20, primary = true) =>
		target.emit(type, {pointerId: id, pointerType: "touch", isPrimary: primary, clientX: x, clientY: y});
	return {doc, container, chooser, chosen, selected, row, touch};
}

describe("mobile public DOM result chooser", () => {
	it("renders structural chooser state and accessible 44 px rows", () => {
		const f = fixture();
		expect(f.chooser.values).toEqual(["a", "b", "c"]);
		expect(f.chooser.selectedItem).toBe(0);
		expect(f.container.getAttribute("role")).toBe("listbox");
		expect(f.row().getAttribute("role")).toBe("option");
		expect(f.row().getAttribute("aria-selected")).toBe("true");
		expect(f.row().style.minHeight).toBe("44px");
		expect(f.row(1).getAttribute("data-value")).toBe("b");
		expect(f.selected).toEqual(["a"]);
	});
	it("moves selection with bounds and chooses through an explicit keyboard event", () => {
		const f = fixture(); f.chooser.moveSelection(1); f.chooser.moveSelection(100);
		expect(f.chooser.selectedItem).toBe(2);
		expect(f.row(2).getAttribute("aria-selected")).toBe("true");
		const event = f.container.emit("unused");
		expect(f.chooser.chooseSelected(event as unknown as KeyboardEvent)).toBe(true);
		expect(f.chosen).toEqual(["c"]); expect(event.defaultPrevented).toBe(true);
		f.chooser.moveSelection(-100); expect(f.chooser.selectedItem).toBe(0);
		f.chooser.setSuggestions([]); expect(f.chooser.selectedItem).toBe(-1);
		expect(f.chooser.chooseSelected(event as unknown as KeyboardEvent)).toBe(false);
	});
	it("isolates a quick tap from the native parent result delegation", () => {
		const f = fixture(); let native = 0; f.container.addEventListener("click", () => native++);
		f.touch(f.row(1), "pointerdown"); f.touch(f.row(1), "pointerup");
		const click = f.row(1).emit("click");
		expect(f.chosen).toEqual(["b"]); expect(native).toBe(0); expect(click.propagationStopped).toBe(true);
	});
	it("suppresses a scroll gesture including child controls, then accepts the next tap", () => {
		const f = fixture(), child = new FakeElement(f.doc); let control = 0;
		f.row().appendChild(child); child.addEventListener("click", () => control++);
		f.touch(child, "pointerdown"); f.touch(f.doc, "pointermove", 1, 10, 70); f.touch(f.doc, "pointerup", 1, 10, 70);
		child.emit("click"); expect(control).toBe(0); expect(f.chosen).toEqual([]);
		f.touch(f.row(), "pointerdown"); f.touch(f.doc, "pointerup"); f.row().emit("click");
		expect(f.chosen).toEqual(["a"]);
	});
	it("suppresses multiple fingers even when the second lands outside the list", () => {
		const f = fixture();
		f.touch(f.row(), "pointerdown"); f.touch(f.doc, "pointerdown", 2, 20, 20, false);
		f.touch(f.doc, "pointerup", 2); f.touch(f.doc, "pointerup"); f.row().emit("click");
		expect(f.chosen).toEqual([]);
		f.touch(f.row(2), "pointerdown"); f.touch(f.doc, "pointerup"); f.row(2).emit("click");
		expect(f.chosen).toEqual(["c"]);
	});
	it("cancels touch selection and recovers after an outside release", () => {
		const f = fixture(); f.touch(f.row(), "pointerdown"); f.touch(f.doc, "pointercancel"); f.row().emit("click");
		expect(f.chosen).toEqual([]);
		f.touch(f.row(1), "pointerdown"); f.touch(f.doc, "pointerup"); f.row(1).emit("click");
		expect(f.chosen).toEqual(["b"]);
	});
	it("retains suppression until a second finger outside the list also releases", () => {
		const f = fixture(); f.touch(f.row(), "pointerdown");
		f.touch(f.doc, "pointerdown", 2, 30, 20, false); f.touch(f.doc, "pointerup");
		f.touch(f.row(1), "pointerdown", 3, 10, 20, false); f.touch(f.doc, "pointerup", 3);
		f.row(1).emit("click"); expect(f.chosen).toEqual([]);
		f.touch(f.doc, "pointerup", 2);
		f.touch(f.row(2), "pointerdown"); f.touch(f.doc, "pointerup"); f.row(2).emit("click");
		expect(f.chosen).toEqual(["c"]);
	});
	it("removes old row events and preserves caller-assigned selected indexes on redraw", () => {
		const f = fixture(), old = f.row();
		f.chooser.values = ["x", "y"]; f.chooser.selectedItem = 1; f.chooser.renderSuggestions();
		old.emit("click"); expect(f.chosen).toEqual([]);
		expect(old.listeners.get("click")?.length).toBe(0);
		expect(f.row(1).classList.contains("is-selected")).toBe(true);
		f.row(1).emit("click"); expect(f.chosen).toEqual(["y"]);
	});
	it("destroy releases document and row handlers, restores attributes and is idempotent", () => {
		const f = fixture(), old = f.row(); f.chooser.destroy(); f.chooser.destroy();
		expect(f.container.getAttribute("role")).toBeNull(); expect(f.container.children).toEqual([]);
		for (const target of [f.doc, f.container, old]) {
			for (const group of target.listeners.values()) expect(group).toHaveLength(0);
		}
		old.emit("click"); f.chooser.setSuggestions(["new"]); expect(f.chosen).toEqual([]);
		expect(f.chooser.values).toEqual([]);
	});
});
