import type {App} from "obsidian";
import {MobileSearchPreview, type MobilePreviewOptions, type MobilePreviewTarget} from "./mobilePreview";

/** Bounded first paint while the native, editable preview loads behind it. */
export class DesktopSearchPreview {
	private readonly preview: MobileSearchPreview;
	readonly element: HTMLElement;
	readonly content: HTMLElement;

	constructor(app: App, host: HTMLElement, options: Pick<MobilePreviewOptions, "read"> = {}) {
		this.preview = new MobileSearchPreview(app, host, {
			...options, presentation: "desktop", open() {}, back() {}, dismissKeyboard() {},
		});
		this.element = this.preview.element;
		this.content = this.preview.content;
	}

	get visible() {return this.preview.visible;}
	get whenFormatted() {return this.preview.whenFormatted;}
	get lastTimings() {return this.preview.lastTimings;}

	/** Markdown gets an immediate read-only fragment; other file types use the native view. */
	show(target: MobilePreviewTarget): Promise<void> {
		if (target.file.extension !== "md") {this.hide(); return Promise.resolve();}
		return this.preview.show(target);
	}

	hide(): void {this.preview.hide();}
	destroy(): void {this.preview.destroy();}
}
