import {App, Modal} from "obsidian";
import {MobileChooser} from "./mobileChooser";

/** Android owns the result list and uses only Obsidian's public Modal API. */
export abstract class MobileSearchModal<T> extends Modal {
	readonly inputEl: HTMLInputElement;
	readonly resultContainerEl: HTMLElement;
	readonly chooser: MobileChooser<T>;
	limit = 100;
	private inputAttached = false;
	private readonly onInput = () => this.updateSuggestions();

	constructor(app: App) {
		super(app);
		this.modalEl.empty();
		this.modalEl.addClass("prompt");
		const inputContainer = this.modalEl.createDiv("prompt-input-container");
		this.inputEl = inputContainer.createEl("input", {
			cls: "prompt-input", attr: {type: "search", "aria-label": "搜索文件、标题与正文", autocomplete: "off"},
		});
		this.resultContainerEl = this.modalEl.createDiv("prompt-results");
		this.resultContainerEl.setAttribute("role", "listbox");
		this.chooser = new MobileChooser(this.resultContainerEl, {
			render: (result, element) => this.renderSuggestion(result, element),
			choose: (result, event) => this.selectSuggestion(result, event),
		});
		this.scope.register([], "ArrowDown", event => {
			if (event.isComposing || event.defaultPrevented) return true;
			this.chooser.moveSelection(1); return false;
		});
		this.scope.register([], "ArrowUp", event => {
			if (event.isComposing || event.defaultPrevented) return true;
			this.chooser.moveSelection(-1); return false;
		});
		this.scope.register([], "Enter", event => {
			if (event.isComposing || event.defaultPrevented || event.keyCode === 229) return true;
			return !this.chooser.chooseSelected(event);
		});
	}

	setPlaceholder(value: string) { this.inputEl.placeholder = value; }
	setInstructions(_instructions: Array<{command: string; purpose: string}>) { /* Touch controls are visible in the header. */ }
	abstract getSuggestions(query: string): T[] | Promise<T[]>;
	abstract renderSuggestion(result: T, element: HTMLElement): void;
	abstract onChooseSuggestion(result: T, event: MouseEvent | KeyboardEvent): void;

	updateSuggestions() {
		void Promise.resolve(this.getSuggestions(this.inputEl.value)).then(results => this.chooser.setSuggestions(results));
	}
	selectSuggestion(result: T, event: MouseEvent | KeyboardEvent) {
		this.onChooseSuggestion(result, event);
		this.close();
	}
	onOpen() {
		this.inputEl.addEventListener("input", this.onInput);
		this.inputAttached = true;
	}
	onClose() {
		if (this.inputAttached) this.inputEl.removeEventListener("input", this.onInput);
		this.inputAttached = false;
		this.chooser.destroy();
	}
}
