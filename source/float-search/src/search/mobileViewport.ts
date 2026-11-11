interface ViewportSurface {
	width: number;
	height: number;
	offsetLeft: number;
	offsetTop: number;
}

interface ViewportWindow {
	innerWidth: number;
	innerHeight: number;
	visualViewport?: ViewportSurface | null;
}

const positive = (value: number | undefined, fallback: number) =>
	value != null && Number.isFinite(value) && value > 0 ? value : fallback;

/** Coordinates follow the area above the Android keyboard, including viewport panning. */
export function getMobileSearchViewport(win: ViewportWindow) {
	const visual = win.visualViewport;
	const width = positive(visual?.width, positive(win.innerWidth, 1));
	const height = positive(visual?.height, positive(win.innerHeight, 1));
	const left = Math.max(0, visual?.offsetLeft ?? 0);
	const top = Math.max(0, visual?.offsetTop ?? 0);
	return {width, height, left, top, margin: Math.min(8, width / 4, height / 4)};
}

/** Scoped CSS variables and listeners live only for the duration of an open search. */
export function bindMobileSearchViewport(modalEl: HTMLElement,
	ownerWindow: Window = modalEl.ownerDocument.defaultView ?? window): () => void {
	const names = ["width", "height", "left", "top", "margin"] as const;
	const previous = names.map(name => {
		const property = `--fs-visible-${name}`;
		return {property, value: modalEl.style.getPropertyValue(property), priority: modalEl.style.getPropertyPriority(property)};
	});
	const update = () => {
		const viewport = getMobileSearchViewport(ownerWindow);
		for (const name of names) modalEl.style.setProperty(`--fs-visible-${name}`, `${viewport[name]}px`);
	};
	const visual = ownerWindow.visualViewport;
	ownerWindow.addEventListener("resize", update);
	visual?.addEventListener("resize", update);
	visual?.addEventListener("scroll", update);
	update();
	let disposed = false;
	return () => {
		if (disposed) return;
		disposed = true;
		ownerWindow.removeEventListener("resize", update);
		visual?.removeEventListener("resize", update);
		visual?.removeEventListener("scroll", update);
		for (const {property, value, priority} of previous) {
			if (value) modalEl.style.setProperty(property, value, priority);
			else modalEl.style.removeProperty(property);
		}
	};
}
