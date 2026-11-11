/**
 * Choose the image most recently reached by the reading anchor.
 * `lines` follows source order (ascending, including repeated source lines).
 * The first image remains selected while reading before its source position.
 */
export function pickImageAtLine(lines: number[], line: number): number {
  if (lines.length === 0 || Number.isNaN(line)) return -1;
  // Upper bound: the first image strictly after the anchor. Repeated lines
  // therefore resolve to their last occurrence without changing source order.
  let low = 0;
  let high = lines.length;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (lines[middle] <= line) low = middle + 1;
    else high = middle;
  }
  return Math.max(0, low - 1);
}

/** Select a genuinely visible image using its distance to the reading center. */
export function pickVisibleImage(
  candidates: { index: number; top: number; bottom: number }[],
  viewport: { top: number; bottom: number },
): number {
  if (!Number.isFinite(viewport.top) || !Number.isFinite(viewport.bottom) || viewport.bottom <= viewport.top) return -1;
  const anchor = viewport.top + (viewport.bottom - viewport.top) * 0.5;
  let selected = -1;
  let nearestEdge = Infinity;
  let nearestCenter = Infinity;
  for (const candidate of candidates) {
    const { index, top, bottom } = candidate;
    if (!Number.isInteger(index) || index < 0 || !Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) continue;
    const height = bottom - top;
    const visibleHeight = Math.min(bottom, viewport.bottom) - Math.max(top, viewport.top);
    if (visibleHeight <= 0 || visibleHeight < Math.min(24, height * 0.25)) continue;
    // A candidate covering the anchor has zero edge distance. This favors the
    // current reading region without rewarding a large image's visible area.
    const edgeDistance = Math.max(top - anchor, anchor - bottom, 0);
    const centerDistance = Math.abs((top + bottom) / 2 - anchor);
    if (edgeDistance < nearestEdge || (edgeDistance === nearestEdge && centerDistance < nearestCenter)) {
      selected = index;
      nearestEdge = edgeDistance;
      nearestCenter = centerDistance;
    }
  }
  return selected;
}
