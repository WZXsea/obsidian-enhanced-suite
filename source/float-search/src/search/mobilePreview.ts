import {Component, MarkdownRenderer} from "obsidian";
import type {App, TFile} from "obsidian";
import {planMobilePreview, previewFragmentAtOffset, previewTargetFragment, previewTargetOffset, type PreviewDocumentPlan, type PreviewFragment} from "./mobilePreviewPlan";
import {animateMobileNavigation, cancelMobileMotion} from "./mobileMotion";

export interface MobilePreviewTarget {
	file: TFile;
	line?: number;
	heading?: string;
	content?: string;
	matchOffset?: number;
	matchText?: string;
}

export interface MobilePreviewOptions {
	open(target: MobilePreviewTarget, event: MouseEvent): void;
	back(): void;
	dismissKeyboard(): void;
	read?(file: TFile): Promise<string>;
	presentation?: "mobile" | "desktop";
}

/** Compatibility view of the bounded initial fragment, retaining authored line positions. */
export function mobilePreviewSource(source: string, line = 0) {
	const plan = planMobilePreview(source), fragment = plan.fragments[previewTargetFragment(plan, {line})];
	const selected = Math.max(plan.contentStart, Math.min(plan.lines.length - 1, Math.trunc(line) || 0));
	return {markdown: fragment.text, start: fragment.startLine, selected, truncated: plan.fragments.length > 1,
		needle: plan.lines[selected]?.replace(/^\s*#{1,6}\s+/, "").replace(/[*_`]/g, "").trim() ?? ""};
}

interface CachedDocument {key: string; path: string; plan: PreviewDocumentPlan;}
interface CachedFragment {node: HTMLElement; component: Component | null; documentKey: string;}
interface PreparedTarget {
	plan: PreviewDocumentPlan;
	line?: number;
	heading?: string;
	content?: string;
	matchOffset?: number;
	matchText?: string;
	position: number;
	length: number;
	needles: string[];
}
interface FormattingJob {
	key: string;
	component: Component | null;
	frame: number;
	timer: number;
	fallback: number;
	resolve(): void;
}
export interface MobilePreviewTimings {
	readMs: number;
	firstContentMs: number;
	formattedMs?: number;
	renderMs?: number;
	fragmentChars: number;
	cacheHit: boolean;
	sourceCacheHit: boolean;
}

const fileKey = (file: TFile) => JSON.stringify([file.path, file.stat?.mtime ?? 0, file.stat?.size ?? 0]);
const now = () => performance.now();

export class MobileSearchPreview {
	readonly element: HTMLElement;
	readonly content: HTMLElement;
	whenFormatted: Promise<void> = Promise.resolve();
	lastTimings: MobilePreviewTimings | null = null;
	private readonly title: HTMLElement;
	private readonly path: HTMLElement;
	private readonly previous: HTMLButtonElement;
	private readonly next: HTMLButtonElement;
	private readonly pageStatus: HTMLElement;
	private readonly formatStatus: HTMLElement;
	private readonly navigation: HTMLElement;
	private readonly isMobile: boolean;
	private target: MobilePreviewTarget | null = null;
	private preparedTarget: PreparedTarget | null = null;
	private presentedTarget: PreparedTarget | null = null;
	private serial = 0;
	private alive = true;
	private started = 0;
	private userScrolled = false;
	private readonly documents = new Map<string, CachedDocument>();
	private readonly reads = new Map<string, Promise<CachedDocument>>();
	private readonly rendered = new Map<string, CachedFragment>();
	private currentDocument: CachedDocument | null = null;
	private currentIndex = 0;
	private currentKey = "";
	private job: FormattingJob | null = null;

	constructor(private readonly app: App, host: HTMLElement, private readonly options: MobilePreviewOptions) {
		this.isMobile = options.presentation !== "desktop";
		this.element = host.createEl("section", {cls: this.isMobile ? "float-search-mobile-preview" : "float-search-fast-preview", attr: {"aria-label": "笔记只读预览"}});
		this.element.hidden = true;
		const toolbar = this.element.createDiv("float-search-mobile-preview-toolbar");
		toolbar.hidden = !this.isMobile;
		const back = toolbar.createEl("button", {text: "返回结果", cls: "fs-preview-back", attr: {type: "button"}});
		const open = toolbar.createEl("button", {text: "打开笔记", cls: "fs-preview-open", attr: {type: "button"}});
		back.addEventListener("click", event => {event.preventDefault(); options.dismissKeyboard(); this.hide(); options.back();});
		open.addEventListener("click", event => {event.preventDefault(); options.dismissKeyboard(); if (this.target) options.open(this.target, event);});
		const heading = this.element.createDiv("float-search-mobile-preview-heading");
		this.title = heading.createEl("h2");
		this.path = heading.createDiv("float-search-mobile-preview-path");
		this.content = this.element.createDiv({cls: "float-search-mobile-preview-content markdown-rendered", attr: {tabindex: "-1"}});
		this.content.setAttribute("contenteditable", "false");
		const navigation = this.navigation = this.element.createDiv("fs-preview-context-nav");
		navigation.hidden = true;
		this.previous = navigation.createEl("button", {text: "向前阅读", cls: "fs-preview-previous", attr: {type: "button"}});
		this.pageStatus = navigation.createSpan("fs-preview-page-status");
		this.next = navigation.createEl("button", {text: "继续阅读", cls: "fs-preview-next", attr: {type: "button"}});
		this.formatStatus = navigation.createSpan({cls: "fs-preview-format-status", attr: {role: "status", "aria-live": "polite"}});
		this.previous.addEventListener("click", () => this.move(-1));
		this.next.addEventListener("click", () => this.move(1));
		if (this.isMobile) this.element.addEventListener("pointerdown", () => options.dismissKeyboard(), {passive: true});
		for (const event of ["wheel", "touchmove"]) this.content.addEventListener(event, () => {this.userScrolled = true;}, {passive: true});
	}

	get visible() {return !this.element.hidden;}

	/** Resolves when readable first content is mounted; rich formatting continues separately. */
	async show(target: MobilePreviewTarget): Promise<void> {
		if (!this.alive) return;
		const request = ++this.serial, started = this.started = now(), key = fileKey(target.file);
		this.target = target;
		this.userScrolled = false;
		if (this.isMobile) {
			this.options.dismissKeyboard();
			this.element.parentElement?.classList.add("has-mobile-preview");
		}
		this.element.hidden = false;
		this.title.textContent = target.file.basename;
		this.path.textContent = target.file.path + (target.line != null ? ` · 第 ${target.line + 1} 行` : "");
		if (this.isMobile) this.content.focus({preventScroll: true});
		if (target.file.extension !== "md") {
			this.cancelFormatting(); this.currentKey = "";
			this.content.textContent = "此文件可通过“打开笔记”查看。";
			this.previous.disabled = this.next.disabled = true; this.pageStatus.textContent = "";
			this.navigation.hidden = true; this.formatStatus.textContent = ""; this.whenFormatted = Promise.resolve();
			if (this.isMobile) animateMobileNavigation(this.content);
			return;
		}
		const cached = this.documents.get(key);
		if (!cached) {
			this.cancelFormatting(); this.currentKey = ""; this.currentDocument = null;
			const instant = this.content.ownerDocument.createElement("p");
			instant.className = "fs-mobile-preview-instant";
			const sample = target.heading || target.content || "";
			const offset = Math.max(0, (target.matchOffset ?? 0) - 160);
			instant.textContent = sample ? sample.slice(offset, offset + 1600) : "正在读取匹配上下文…";
			this.content.replaceChildren(instant);
			this.previous.disabled = this.next.disabled = true; this.pageStatus.textContent = "";
		}
		try {
			const document = cached ?? await this.readDocument(target.file, key);
			if (!this.alive || request !== this.serial || !this.visible) return;
			if (fileKey(target.file) !== key) {await this.show(target); return;}
			this.documents.delete(key); this.documents.set(key, document);
			this.lastTimings = {readMs: now() - started, firstContentMs: 0, fragmentChars: 0, cacheHit: false, sourceCacheHit: !!cached};
			this.preparedTarget = this.prepareTarget(document.plan, target);
			this.present(document, previewFragmentAtOffset(document.plan, this.preparedTarget.position));
		} catch (error) {
			if (!this.alive || request !== this.serial) return;
			this.content.textContent = "预览暂缓，可通过“打开笔记”查看原文。";
			console.warn("Floating Search: mobile preview", error);
		}
	}

	private async readDocument(file: TFile, key: string): Promise<CachedDocument> {
		const existing = this.reads.get(key); if (existing) return existing;
		const path = file.path;
		const work = (async () => {
			const source = await (this.options.read?.(file) ?? this.app.vault.cachedRead(file));
			const document = {key, path, plan: planMobilePreview(source)};
			if (!this.alive || fileKey(file) !== key) return document;
			for (const [otherKey, other] of this.documents) if (other.path === path && otherKey !== key) this.dropDocument(otherKey);
			this.documents.set(key, document);
			while (this.documents.size > 2) this.dropDocument(this.documents.keys().next().value as string);
			return document;
		})();
		this.reads.set(key, work);
		try {return await work;} finally {if (this.reads.get(key) === work) this.reads.delete(key);}
	}

	private prepareTarget(plan: PreviewDocumentPlan, target: MobilePreviewTarget): PreparedTarget {
		const previous = this.preparedTarget;
		if (previous?.plan === plan && previous.line === target.line && previous.heading === target.heading &&
			previous.content === target.content && previous.matchOffset === target.matchOffset && previous.matchText === target.matchText) return previous;
		const line = Math.max(plan.contentStart, Math.min(plan.lines.length - 1, target.line ?? plan.contentStart));
		const raw = plan.lines[line]?.replace(/^\s*#{1,6}\s+/, "").replace(/[*_`]/g, "").trim();
		return {plan, line: target.line, heading: target.heading, content: target.content, matchOffset: target.matchOffset, matchText: target.matchText,
			position: previewTargetOffset(plan, target), length: Math.min(120, (target.matchText || target.heading || target.content || "").length || 1),
			needles: [target.heading, raw, target.content, target.matchText].filter((value): value is string => !!value && value.length > 1)};
	}

	private present(document: CachedDocument, index: number, direction: "forward" | "next" | "previous" = "forward"): void {
		const key = `${document.key}:${index}`, fragment = document.plan.fragments[index];
		const same = this.currentKey === key && this.content.querySelector(".fs-mobile-preview-fragment");
		const targetChanged = this.presentedTarget !== this.preparedTarget;
		this.presentedTarget = this.preparedTarget;
		this.currentDocument = document; this.currentIndex = index;
		this.navigation.hidden = !this.isMobile || document.plan.fragments.length < 2;
		this.previous.disabled = index === 0; this.next.disabled = index === document.plan.fragments.length - 1;
		this.pageStatus.textContent = `${index + 1}/${document.plan.fragments.length} · 第 ${fragment.startLine + 1}–${fragment.endLine + 1} 行`;
		const cached = this.rendered.get(key);
		if (!same) {
			this.cancelFormatting(); this.currentKey = key;
			this.content.replaceChildren(cached && !fragment.plain ? cached.node : this.plainFragment(fragment));
			this.content.scrollTop = 0;
		}
		else if (targetChanged && (!cached || fragment.plain) && this.content.querySelector(".fs-mobile-preview-plain")) this.content.replaceChildren(this.plainFragment(fragment));
		if (this.isMobile) animateMobileNavigation(this.content, direction);
		if (this.lastTimings) Object.assign(this.lastTimings, {firstContentMs: now() - this.started, fragmentChars: fragment.text.length, cacheHit: !!cached});
		if (cached) {
			if (fragment.plain) cached.node = this.content.querySelector<HTMLElement>(".fs-mobile-preview-fragment") ?? cached.node;
			this.rendered.delete(key); this.rendered.set(key, cached);
			this.whenFormatted = Promise.resolve(); this.formatStatus.textContent = fragment.plain ? "原文片段" : "";
			this.locate(document.plan, fragment); return;
		}
		if (this.job?.key === key) {this.locate(document.plan, fragment); return;}
		if (fragment.plain) {
			const node = this.content.querySelector<HTMLElement>(".fs-mobile-preview-fragment");
			if (node) this.cacheFragment(key, {node, component: null, documentKey: document.key});
			this.formatStatus.textContent = "原文片段"; this.whenFormatted = Promise.resolve(); this.locate(document.plan, fragment); return;
		}
		this.locate(document.plan, fragment);
		this.formatStatus.textContent = "正在排版…";
		this.scheduleFormatting(document, fragment, key);
	}

	private plainFragment(fragment: PreviewFragment): HTMLElement {
		const node = this.content.ownerDocument.createElement("div");
		node.className = "fs-mobile-preview-fragment"; node.dataset.state = "plain";
		const text = node.createEl("p", {cls: "fs-mobile-preview-plain"});
		text.style.whiteSpace = "pre-wrap"; text.style.overflowWrap = "anywhere";
		const position = this.preparedTarget ? this.preparedTarget.position - fragment.start : -1;
		if (position >= 0 && position < fragment.text.length) {
			const span = text.ownerDocument.createElement("span"); span.className = "is-search-target";
			const length = this.preparedTarget?.length ?? 1;
			text.append(fragment.text.slice(0, position)); span.textContent = fragment.text.slice(position, position + length);
			text.append(span, fragment.text.slice(position + length));
		} else text.textContent = fragment.text;
		return node;
	}

	private scheduleFormatting(document: CachedDocument, fragment: PreviewFragment, key: string): void {
		const win = this.content.ownerDocument.defaultView ?? window;
		let resolve!: () => void;
		this.whenFormatted = new Promise<void>(yes => {resolve = yes;});
		const job: FormattingJob = {key, component: null, frame: 0, timer: 0, fallback: 0, resolve}; this.job = job;
		const render = async () => {
			if (this.job !== job || !this.alive) {resolve(); return;}
			if (job.timer) win.clearTimeout(job.timer); job.timer = 0;
			if (job.fallback) win.clearTimeout(job.fallback); job.fallback = 0;
			const started = now(), root = this.content.ownerDocument.createElement("div");
			const component = new Component(); component.load(); job.component = component;
			try {
				await MarkdownRenderer.render(this.app, fragment.text, root, document.path, component);
				if (this.job !== job || !this.alive || !this.visible || this.currentKey !== key) {component.unload(); return;}
				root.querySelectorAll<HTMLInputElement>("input,textarea,select,button").forEach(input => {input.disabled = true;});
				const node = this.content.ownerDocument.createElement("div"); node.className = "fs-mobile-preview-fragment"; node.dataset.state = "formatted"; node.append(root);
				const scroll = this.content.scrollTop; this.content.replaceChildren(node);
				this.cacheFragment(key, {node, component, documentKey: document.key});
				this.formatStatus.textContent = "";
				if (this.lastTimings) Object.assign(this.lastTimings, {formattedMs: now() - this.started, renderMs: now() - started});
				if (this.userScrolled) this.content.scrollTop = scroll; else this.locate(document.plan, fragment);
			} catch (error) {
				component.unload();
				if (this.job === job && this.alive) {this.formatStatus.textContent = "原文预览"; console.warn("Floating Search: preview formatting", error);}
			} finally {if (this.job === job) this.job = null; resolve();}
		};
		let scheduled = false;
		const start = () => {if (scheduled) return; scheduled = true; if (job.frame) win.cancelAnimationFrame(job.frame); job.frame = 0; void render();};
		job.frame = win.requestAnimationFrame(() => {job.frame = 0; if (job.fallback) win.clearTimeout(job.fallback); job.fallback = 0; job.timer = win.setTimeout(start, 0);});
		// Hidden windows can throttle animation frames; keep formatting available.
		job.fallback = win.setTimeout(start, 100);
	}

	private locate(plan: PreviewDocumentPlan, fragment: PreviewFragment): void {
		const target = this.preparedTarget;
		if (target?.plan !== plan) return;
		const position = target.position;
		if (position < fragment.start || position >= fragment.end) return;
		const precise = this.content.querySelector<HTMLElement>(".fs-mobile-preview-plain .is-search-target");
		if (precise) {this.scrollToTarget(precise, plan); return;}
		this.content.querySelectorAll(".is-search-target").forEach(element => element.classList.remove("is-search-target"));
		const elements = Array.from(this.content.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,p,li,td,blockquote"));
		const match = target.needles.map(needle => elements.find(element => element.textContent?.includes(needle))).find(Boolean);
		if (!match) return;
		match.classList.add("is-search-target");
		this.scrollToTarget(match, plan);
	}

	private scrollToTarget(match: HTMLElement, plan: PreviewDocumentPlan): void {
		const scroll = () => {
			if (!this.alive || this.currentDocument?.plan !== plan || this.userScrolled || !this.content.contains(match)) return;
			this.content.scrollTop += match.getBoundingClientRect().top - this.content.getBoundingClientRect().top - 20;
		};
		scroll();
		this.content.ownerDocument.defaultView?.requestAnimationFrame(scroll);
	}

	private cacheFragment(key: string, value: CachedFragment): void {
		this.rendered.delete(key); this.rendered.set(key, value);
		while (this.rendered.size > 3) {
			const first = this.rendered.keys().next().value as string;
			this.rendered.get(first)?.component?.unload(); this.rendered.delete(first);
		}
	}
	private dropDocument(key: string): void {
		this.documents.delete(key);
		for (const [fragmentKey, cached] of this.rendered) if (cached.documentKey === key) {cached.component?.unload(); this.rendered.delete(fragmentKey);}
	}
	private move(delta: number): void {
		const document = this.currentDocument; if (!document) return;
		if (this.target && fileKey(this.target.file) !== document.key) {void this.show(this.target); return;}
		const index = this.currentIndex + delta; if (index < 0 || index >= document.plan.fragments.length) return;
		if (this.isMobile) this.options.dismissKeyboard();
		this.started = now(); this.userScrolled = false;
		this.lastTimings = {readMs: 0, firstContentMs: 0, fragmentChars: 0, cacheHit: false, sourceCacheHit: true};
		this.present(document, index, delta > 0 ? "next" : "previous");
		if (this.isMobile) this.content.focus({preventScroll: true});
	}
	private cancelFormatting(): void {
		const job = this.job; if (!job) return;
		this.job = null;
		const win = this.content.ownerDocument.defaultView ?? window;
		if (job.frame) win.cancelAnimationFrame(job.frame);
		if (job.timer) win.clearTimeout(job.timer);
		if (job.fallback) win.clearTimeout(job.fallback);
		job.component?.unload(); job.resolve();
	}

	hide(): void {
		cancelMobileMotion(this.element);
		this.serial++; this.cancelFormatting(); this.element.hidden = true;
		if (this.isMobile) this.element.parentElement?.classList.remove("has-mobile-preview");
	}
	destroy(): void {
		this.alive = false; this.hide(); this.target = null;
		this.preparedTarget = this.presentedTarget = null; this.currentDocument = null;
		for (const cached of this.rendered.values()) cached.component?.unload();
		this.rendered.clear(); this.documents.clear(); this.reads.clear(); this.element.remove();
	}
}
