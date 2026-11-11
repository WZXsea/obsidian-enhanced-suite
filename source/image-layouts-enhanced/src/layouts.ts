import { parseCustomGrid } from './model';
import { LAYOUT_LABELS, type Layout } from './types';

export interface GridCell {
  imageIndex: number;
  area: string;
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
}

export interface GridDefinition {
  columns: number;
  rows: number;
  columnFractions: number[];
  areas: string;
  slots: number;
  cells: GridCell[];
  fallbackReason?: string;
}

type GridPreset = { weights: number[]; rows: number[][] };

// Image 0 remains the primary image in mirrored layouts c, e and g.
const PRESETS: Record<string, GridPreset> = {
  a: { weights: [1, 1], rows: [[0, 1]] },
  b: { weights: [2, 1], rows: [[0, 1]] },
  c: { weights: [1, 2], rows: [[1, 0]] },
  d: { weights: [2, 1], rows: [[0, 1], [0, 2]] },
  e: { weights: [1, 2], rows: [[1, 0], [2, 0]] },
  f: { weights: [3, 1], rows: [[0, 1], [0, 2], [0, 3]] },
  g: { weights: [1, 3], rows: [[1, 0], [2, 0], [3, 0]] },
  h: { weights: [1, 1, 1], rows: [[0, 1, 2]] },
  i: { weights: [1, 1, 1, 1], rows: [[0, 1, 2, 3]] },
  single: { weights: [1], rows: [[0]] },
};

function definition(rows: string[][], weights: number[]): GridDefinition {
  const regions = new Map<string, GridCell>();
  rows.forEach((row, y) => row.forEach((area, x) => {
    if (area === '.') return;
    const region = regions.get(area);
    if (region) {
      region.rowSpan = Math.max(region.rowSpan, y + 2 - region.row);
      region.columnSpan = Math.max(region.columnSpan, x + 2 - region.column);
    } else {
      regions.set(area, {
        imageIndex: Number(area.slice('image-'.length)), area,
        row: y + 1, column: x + 1, rowSpan: 1, columnSpan: 1,
      });
    }
  }));
  return {
    columns: weights.length, rows: rows.length, columnFractions: [...weights],
    areas: rows.map(row => `"${row.join(' ')}"`).join(' '), slots: regions.size,
    cells: [...regions.values()].sort((a, b) => a.imageIndex - b.imageIndex),
  };
}

/** Valid custom geometry uses the same strict parser as the source editor. */
export function getGridDefinition(layout: Layout, customGrid = ''): GridDefinition | null {
  if (layout === 'custom') {
    const parsed = parseCustomGrid(customGrid);
    if ('error' in parsed) {
      return { ...getGridDefinition('g')!, fallbackReason: parsed.error };
    }
    const rows = [...parsed.areas.matchAll(/"([^"]+)"/g)].map(match => match[1].split(' '));
    return definition(rows, Array(parsed.columns).fill(1));
  }
  const preset = PRESETS[layout];
  return preset ? definition(preset.rows.map(row => row.map(index => `image-${index}`)), preset.weights) : null;
}

export function getMasonryColumnCount(layout: Layout): number | null {
  const match = /^masonry-([2-6])$/.exec(layout);
  return match ? Number(match[1]) : null;
}

/** Balanced complete grids absorb source-count changes while retaining one region per image. */
export function getBalancedGridDefinition(imageCount: number): GridDefinition {
  const count = Number.isFinite(imageCount) ? Math.max(1, Math.floor(imageCount)) : 1;
  const columns = count <= 3 ? count : Math.ceil(Math.sqrt(count));
  const rows: string[][] = [];
  for (let first = 0; first < count; first += columns) {
    const last = Math.min(first + columns - 1, count - 1);
    rows.push(Array.from({ length: columns }, (_, column) => `image-${Math.min(first + column, last)}`));
  }
  return definition(rows, Array(columns).fill(1));
}

/** Exact presets/custom grids stay untouched; a changed count gets a complete balanced grid. */
export function getMatchingGridDefinition(layout: Layout, imageCount: number, customGrid = ''): GridDefinition {
  const preset = getGridDefinition(layout, customGrid);
  if (preset?.slots === imageCount) return preset;
  const balanced = getBalancedGridDefinition(imageCount);
  return preset?.fallbackReason ? { ...balanced, fallbackReason: preset.fallbackReason } : balanced;
}

/** Every source image gets a region. An odd final side image spans both side columns. */
export function getScalableStageDefinition(direction: 'left' | 'right', imageCount: number): GridDefinition {
  const count = Number.isFinite(imageCount) ? Math.max(1, Math.floor(imageCount)) : 1;
  if (count === 1) return getGridDefinition('single')!;
  if (count <= 4) {
    const presets: Layout[] = direction === 'left' ? ['b', 'd', 'f'] : ['c', 'e', 'g'];
    return getGridDefinition(presets[count - 2])!;
  }
  const sideCount = count - 1;
  const rows: string[][] = [];
  for (let index = 1; index <= sideCount; index += 2) {
    const first = `image-${index}`;
    const second = `image-${Math.min(index + 1, sideCount)}`;
    rows.push(direction === 'left' ? ['image-0', first, second] : [first, second, 'image-0']);
  }
  return definition(rows, direction === 'left' ? [3, 1, 1] : [1, 1, 3]);
}

/** Fixed presets retain exact geometry at their image count; historical mismatches expand fully. */
export function getDominantGridDefinition(layout: Layout, imageCount?: number): GridDefinition | null {
  const direction = ['b', 'd', 'f', 'stage-left'].includes(layout) ? 'left' :
    ['c', 'e', 'g', 'stage-right'].includes(layout) ? 'right' : undefined;
  if (!direction) return null;
  const preset = getGridDefinition(layout);
  if (preset && (imageCount === undefined || imageCount === preset.slots)) return preset;
  return getScalableStageDefinition(direction, imageCount ?? 4);
}

/** Stored preset names remain intact while the UI reports the actual complete composition. */
export function getStageLayoutLabel(layout: Layout, imageCount: number, customGrid = ''): string {
  const grid = getDominantGridDefinition(layout, imageCount);
  if (!grid) {
    const preset = getGridDefinition(layout, customGrid);
    return preset && preset.slots !== imageCount ? `${imageCount}图网格` : LAYOUT_LABELS[layout];
  }
  const preset = getGridDefinition(layout);
  if (preset?.slots === imageCount) return LAYOUT_LABELS[layout];
  if (imageCount <= 1) return '单图';
  const direction = grid.cells[0].column === 1 ? '左' : '右';
  return `${direction}主图＋${imageCount - 1}图`;
}

/** Initial slots match the original collage, including when an active image is restored. */
export function getStageThumbnailOrder(count: number, activeIndex = 0): number[] {
  const order = Array.from({ length: Math.max(0, count - 1) }, (_, index) => index + 1);
  if (activeIndex > 0 && activeIndex < count) order[activeIndex - 1] = 0;
  return order;
}

/** The outgoing primary image takes the incoming thumbnail's slot; source order stays intact. */
export function swapStageImage(order: readonly number[], previous: number, next: number): number[] {
  const slot = order.indexOf(next);
  if (slot < 0 || previous === next) return [...order];
  return order.map((index, position) => position === slot ? previous : index);
}

/** The available note width, including split panes, determines thumbnail placement. */
export function getFocusPlacement(width: number): 'side' | 'bottom' {
  return Number.isFinite(width) && width >= 640 ? 'side' : 'bottom';
}
