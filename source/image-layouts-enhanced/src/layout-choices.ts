import { LAYOUT_LABELS, type Layout } from './types';

export interface LayoutChoice {
  key: string;
  label: string;
  layout: Layout;
  grid?: string;
  preview: string[];
  kind?: 'browse';
}

const fixed: Record<number, Array<{ layout: Layout; preview: string[] }>> = {
  1: [{ layout: 'single', preview: ['A'] }],
  2: [{ layout: 'a', preview: ['AB'] }, { layout: 'b', preview: ['AAB'] }, { layout: 'c', preview: ['BAA'] }],
  3: [{ layout: 'd', preview: ['AAB', 'AAC'] }, { layout: 'e', preview: ['BAA', 'CAA'] }, { layout: 'h', preview: ['ABC'] }],
  4: [{ layout: 'f', preview: ['AAAB', 'AAAC', 'AAAD'] }, { layout: 'g', preview: ['BAAA', 'CAAA', 'DAAA'] }, { layout: 'i', preview: ['ABCD'] }],
};

// Only the first 52 symbols are stored in custom grids. Additional schematic
// symbols allow noncustom layouts to represent every image in larger groups.
function letter(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : index < 52 ? String.fromCharCode(97 + index - 26) : String.fromCharCode(0xe000 + index - 52);
}

function rowLetters(from: number, count: number): string {
  return Array.from({ length: count }, (_, index) => letter(from + index)).join('');
}

function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a; }

/** Every row fills the same width; each source image owns one rectangular area. */
function balancedRows(count: number): { preview: string[]; sizes: number[] } {
  const rows = Math.max(1, Math.round(Math.sqrt(count)));
  const base = Math.floor(count / rows), extra = count % rows;
  const sizes = Array.from({ length: rows }, (_, index) => base + (index >= rows - extra ? 1 : 0));
  const width = sizes.reduce((a, b) => a / gcd(a, b) * b, 1);
  let next = 0;
  const preview = sizes.map(size => Array.from({ length: size }, () => letter(next++).repeat(width / size)).join(''));
  return { preview, sizes };
}

/** For 5+ images the 3-unit primary area sits beside two 1-unit side columns. */
function stagePreview(count: number, right: boolean): string[] {
  if (count < 5) return fixed[count]?.find(item => item.layout === (right ? count === 2 ? 'c' : count === 3 ? 'e' : 'g' : count === 2 ? 'b' : count === 3 ? 'd' : 'f'))?.preview.slice() ?? ['A'];
  const rows: string[] = [];
  for (let index = 1; index < count; index += 2) {
    const first = letter(index), last = index + 1 < count ? letter(index + 1) : first;
    rows.push(right ? first + last + 'AAA' : 'AAA' + first + last);
  }
  return rows;
}

/** Uneven column stacks illustrate masonry without introducing empty positions. */
function masonryPreview(count: number, columns: number): string[] {
  const base = Math.floor(count / columns), extra = count % columns;
  const stacks = Array.from({ length: columns }, (_, index) => base + (index < extra ? 1 : 0));
  const height = Math.max(...stacks);
  let next = 0;
  const cells = stacks.map(size => {
    const rows: string[] = [];
    const unit = Math.floor(height / size), remainder = height % size;
    for (let index = 0; index < size; index++) {
      const token = letter(next++);
      rows.push(...Array(unit + (index < remainder ? 1 : 0)).fill(token));
    }
    return rows;
  });
  return Array.from({ length: height }, (_, row) => cells.map(column => column[row]).join(''));
}

/** Choices describe this exact group size; fixed presets never drop or pad images. */
export function getLayoutChoices(count: number): LayoutChoice[] {
  if (!Number.isFinite(count) || !Number.isInteger(count) || count < 1) return [];
  const choices: LayoutChoice[] = (fixed[count] ?? []).map(item => ({
    key: item.layout, layout: item.layout, label: LAYOUT_LABELS[item.layout], preview: [...item.preview],
  }));
  if (count === 1) return choices;
  if (count >= 5) {
    choices.push(
      { key: 'stage-left', layout: 'stage-left', label: `左主图＋${count - 1}图`, preview: stagePreview(count, false) },
      { key: 'stage-right', layout: 'stage-right', label: `右主图＋${count - 1}图`, preview: stagePreview(count, true) },
    );
  }

  const seen = new Set(choices.map(choice => choice.preview.join('\n')));
  const custom = (key: string, label: string, preview: string[]) => {
    const grid = preview.join('\n');
    if (seen.has(grid)) return;
    seen.add(grid);
    choices.push({ key, label, layout: 'custom', grid, preview: [...preview] });
  };
  // parseCustomGrid accepts A–Z/a–z, so larger sets use complete stage/masonry/browse layouts.
  if (count <= 52) {
    custom('custom-row', `横排 · ${count}图`, [rowLetters(0, count)]);
    if (count === 2) custom('custom-stack', '双图竖排', ['A', 'B']);
    let rows = Math.floor(Math.sqrt(count));
    while (rows > 1 && count % rows !== 0) rows--;
    if (rows > 1) {
      const columns = count / rows;
      custom(`custom-grid-${columns}x${rows}`, `等格 · ${columns}×${rows}`,
        Array.from({ length: rows }, (_, row) => rowLetters(row * columns, columns)));
    }
    const balanced = balancedRows(count);
    custom('custom-balanced', `拼图 · ${balanced.sizes.join('＋')}`, balanced.preview);
    if (count >= 3) {
      const side = balancedRows(count - 1);
      // Rename the side symbols one step forward; A remains the first-seen primary image.
      const sideRows = side.preview.map(row => [...row].map(token => letter(token.charCodeAt(0) >= 97 ? token.charCodeAt(0) - 97 + 27 : token.charCodeAt(0) - 65 + 1)).join(''));
      const primary = 'A'.repeat(sideRows[0].length);
      custom('custom-top', `上主图＋${count - 1}图`, [primary, primary, ...sideRows]);
    }
  }

  for (let columns = 2; columns <= Math.min(6, count); columns++) {
    choices.push({ key: `masonry-${columns}`, layout: `masonry-${columns}` as Layout,
      label: `瀑布流 · ${columns}列／${count}图`, preview: masonryPreview(count, columns) });
  }
  const thumbRow = rowLetters(1, count - 1), primaryRow = 'A'.repeat(thumbRow.length);
  choices.push(
    { key: 'filmstrip', layout: 'filmstrip', label: `横向浏览 · ${count}图`, kind: 'browse', preview: [rowLetters(0, count)] },
    { key: 'carousel', layout: 'carousel', label: `轮播浏览 · ${count}图`, kind: 'browse', preview: [primaryRow, primaryRow, thumbRow] },
    { key: 'focus', layout: 'focus', label: `主图浏览 · ${count}图`, kind: 'browse', preview: stagePreview(count, false) },
  );
  return choices;
}
