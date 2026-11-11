export interface SuggestionViewportSnapshot {
	anchorFallbackKey?: string;
	anchorKey?: string;
	anchorOffset: number;
	fallbackScrollTop: number;
	selectedFallbackKey?: string;
	selectedKey?: string;
}

interface CaptureSuggestionViewportOptions {
	anchorFallbackKey?: string;
	anchorKey?: string;
	anchorTop?: number;
	containerTop: number;
	scrollTop: number;
	selectedFallbackKey?: string;
	selectedKey?: string;
}

export interface SuggestionViewportIndexes {
	anchorIndex: number;
	selectedIndex: number;
}

export const captureSuggestionViewport = ({
	anchorFallbackKey,
	anchorKey,
	anchorTop,
	containerTop,
	scrollTop,
	selectedFallbackKey,
	selectedKey,
}: CaptureSuggestionViewportOptions): SuggestionViewportSnapshot => ({
	anchorFallbackKey: scrollTop > 0 ? anchorFallbackKey : undefined,
	anchorKey: scrollTop > 0 ? anchorKey : undefined,
	anchorOffset:
		scrollTop > 0 && anchorTop != null ? anchorTop - containerTop : 0,
	fallbackScrollTop: scrollTop,
	selectedFallbackKey,
	selectedKey,
});

export const resolveSuggestionViewportIndexes = (
	snapshot: SuggestionViewportSnapshot,
	keys: string[]
): SuggestionViewportIndexes => {
	let anchorIndex = snapshot.anchorKey
		? keys.indexOf(snapshot.anchorKey)
		: -1;
	if (anchorIndex < 0 && snapshot.anchorFallbackKey) {
		anchorIndex = keys.indexOf(snapshot.anchorFallbackKey);
	}
	let selectedIndex = snapshot.selectedKey
		? keys.indexOf(snapshot.selectedKey)
		: -1;
	if (selectedIndex < 0 && snapshot.selectedFallbackKey) {
		selectedIndex = keys.indexOf(snapshot.selectedFallbackKey);
	}

	return { anchorIndex, selectedIndex };
};

export const resolveSuggestionScrollTop = (
	snapshot: SuggestionViewportSnapshot,
	containerTop: number,
	currentScrollTop: number,
	anchorTop?: number
) =>
	snapshot.anchorKey && anchorTop != null
		? currentScrollTop + (anchorTop - containerTop - snapshot.anchorOffset)
		: snapshot.fallbackScrollTop;
