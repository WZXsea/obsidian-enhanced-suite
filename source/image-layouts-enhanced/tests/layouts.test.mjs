import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['src/layouts.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { getGridDefinition, getMasonryColumnCount, getFocusPlacement, getDominantGridDefinition, getScalableStageDefinition, getMatchingGridDefinition, getBalancedGridDefinition, getStageLayoutLabel, getStageThumbnailOrder, swapStageImage } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

test('g keeps image 0 in the full-height right three-quarter region, with three equal left rows', () => {
  const grid = getGridDefinition('g');
  assert.deepEqual(grid.columnFractions, [1, 3]);
  assert.equal(grid.rows, 3);
  assert.deepEqual(grid.cells[0], { imageIndex: 0, area: 'image-0', row: 1, column: 2, rowSpan: 3, columnSpan: 1 });
  assert.deepEqual(grid.cells.slice(1).map(cell => [cell.imageIndex, cell.row, cell.column, cell.rowSpan]), [[1, 1, 1, 1], [2, 2, 1, 1], [3, 3, 1, 1]]);
});

test('mirrored presets retain the first image as the primary region', () => {
  for (const [left, right, rows] of [['b', 'c', 1], ['d', 'e', 2], ['f', 'g', 3]]) {
    const original = getGridDefinition(left);
    const mirrored = getGridDefinition(right);
    assert.deepEqual(mirrored.columnFractions, [...original.columnFractions].reverse());
    assert.equal(original.cells[0].column, 1);
    assert.equal(mirrored.cells[0].column, 2);
    assert.equal(original.cells[0].rowSpan, rows);
    assert.equal(mirrored.cells[0].rowSpan, rows);
  }
});

test('presets cover their geometry without overlap or image index gaps', () => {
  for (const layout of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'single']) {
    const grid = getGridDefinition(layout);
    const occupied = new Set();
    for (const cell of grid.cells) {
      for (let row = cell.row; row < cell.row + cell.rowSpan; row++) {
        for (let col = cell.column; col < cell.column + cell.columnSpan; col++) {
          assert.ok(row <= grid.rows && col <= grid.columns);
          assert.ok(!occupied.has(`${row}:${col}`), `${layout} overlaps at ${row}:${col}`);
          occupied.add(`${row}:${col}`);
        }
      }
    }
    assert.equal(occupied.size, grid.rows * grid.columns);
    assert.deepEqual(grid.cells.map(cell => cell.imageIndex), Array.from({ length: grid.slots }, (_, index) => index));
  }
});

test('custom rectangles preserve repeated areas and explicit empty cells', () => {
  const grid = getGridDefinition('custom', 'AA.B\nAA.C');
  assert.equal(grid.columns, 4);
  assert.equal(grid.rows, 2);
  assert.equal(grid.slots, 3);
  assert.deepEqual(grid.cells.map(cell => [cell.imageIndex, cell.row, cell.column, cell.rowSpan, cell.columnSpan]), [[0, 1, 1, 2, 2], [1, 1, 4, 1, 1], [2, 2, 4, 1, 1]]);
  assert.match(grid.areas, /image-0 image-0 \. image-1/);
});

test('nonrectangular and unsafe custom grids fall back to complete g geometry', () => {
  for (const input of ['AA\nAB', 'AA\nB', 'A; background:url(x)', '...', '']) {
    const grid = getGridDefinition('custom', input);
    assert.ok(grid.fallbackReason);
    assert.equal(grid.areas, getGridDefinition('g').areas);
    assert.deepEqual(grid.columnFractions, [1, 3]);
  }
});

test('host width controls focus placement and masonry has precisely the supported column counts', () => {
  assert.equal(getFocusPlacement(639), 'bottom');
  assert.equal(getFocusPlacement(640), 'side');
  assert.equal(getFocusPlacement(NaN), 'bottom');
  for (let columns = 2; columns <= 6; columns++) assert.equal(getMasonryColumnCount(`masonry-${columns}`), columns);
  assert.equal(getMasonryColumnCount('masonry-7'), null);
  assert.equal(getGridDefinition('focus'), null);
});

test('inline stages are confined to the six dominant presets and preserve their original geometry', () => {
  for (const layout of ['b', 'c', 'd', 'e', 'f', 'g']) {
    const stage = getDominantGridDefinition(layout);
    assert.deepEqual(stage, getGridDefinition(layout));
    assert.equal(stage.cells[0].imageIndex, 0);
    assert.equal(stage.cells[0].rowSpan, stage.rows);
  }
  for (const layout of ['a', 'h', 'i', 'single', 'custom', 'focus', 'carousel', 'filmstrip', 'masonry-3']) {
    assert.equal(getDominantGridDefinition(layout), null);
  }
});

test('eight-image inline stage swaps into the clicked slot without losing images or source indices', () => {
  const original = getStageThumbnailOrder(8);
  assert.deepEqual(original, [1, 2, 3, 4, 5, 6, 7]);
  const switched = swapStageImage(original, 0, 3);
  assert.deepEqual(switched, [1, 2, 0, 4, 5, 6, 7]);
  assert.deepEqual(original, [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(swapStageImage(switched, 3, 0), original);
  const last = swapStageImage(switched, 3, 7);
  assert.deepEqual([...last, 7].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(getStageThumbnailOrder(8, 3), switched);
});

test('inline stage retains duplicate references as distinct source indices and accepts single-image groups', () => {
  // The renderer passes indices, so identical source URLs retain two independent positions.
  let order = getStageThumbnailOrder(5);
  order = swapStageImage(order, 0, 4);
  assert.deepEqual(order, [1, 2, 3, 0]);
  order = swapStageImage(order, 4, 1);
  assert.deepEqual(order, [4, 2, 3, 0]);
  assert.deepEqual([...order, 1].sort((a, b) => a - b), [0, 1, 2, 3, 4]);
  assert.deepEqual(getStageThumbnailOrder(1), []);
  assert.deepEqual(getStageThumbnailOrder(0), []);
});

test('scalable stages preserve exact 2/3/4 geometry and show all eight images with a merged final side cell', () => {
  for (const [count, left, right] of [[2, 'b', 'c'], [3, 'd', 'e'], [4, 'f', 'g']]) {
    assert.deepEqual(getScalableStageDefinition('left', count), getGridDefinition(left));
    assert.deepEqual(getScalableStageDefinition('right', count), getGridDefinition(right));
    assert.deepEqual(getDominantGridDefinition(left, count), getGridDefinition(left));
    assert.deepEqual(getDominantGridDefinition(right, count), getGridDefinition(right));
  }
  const right = getDominantGridDefinition('stage-right', 8);
  assert.equal(right.slots, 8);
  assert.equal(right.rows, 4);
  assert.deepEqual(right.columnFractions, [1, 1, 3]);
  assert.deepEqual(right.cells[0], { imageIndex: 0, area: 'image-0', row: 1, column: 3, rowSpan: 4, columnSpan: 1 });
  assert.deepEqual(right.cells[7], { imageIndex: 7, area: 'image-7', row: 4, column: 1, rowSpan: 1, columnSpan: 2 });
  assert.deepEqual(getDominantGridDefinition('g', 8), right);
  assert.equal(getStageLayoutLabel('g', 8), '右主图＋7图');
  assert.equal(getStageLayoutLabel('g', 4), '右主图＋三图');
  assert.equal(getStageLayoutLabel('stage-left', 8), '左主图＋7图');
});

test('changing the count in any stored static or custom grid produces exactly all current image regions', () => {
  for (const layout of ['a', 'h', 'i', 'single', 'custom']) {
    const complete = getMatchingGridDefinition(layout, 8, 'AA\nBC');
    assert.equal(complete.slots, 8);
    assert.deepEqual(complete.cells.map(cell => cell.imageIndex), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.equal(getStageLayoutLabel(layout, 8, 'AA\nBC'), '8图网格');
  }
  for (const [layout, count] of [['a', 2], ['h', 3], ['i', 4], ['single', 1]]) {
    assert.deepEqual(getMatchingGridDefinition(layout, count), getGridDefinition(layout));
  }
  assert.deepEqual(getMatchingGridDefinition('custom', 3, 'AA\nBC'), getGridDefinition('custom', 'AA\nBC'));
});

test('large complete stages and balanced grids allocate every region without gaps or overlap', () => {
  for (const count of [1, 2, 3, 4, 5, 7, 8, 12, 53, 60, 101]) {
    for (const grid of [getScalableStageDefinition('left', count), getScalableStageDefinition('right', count), getBalancedGridDefinition(count)]) {
      assert.equal(grid.slots, count);
      const occupied = new Set();
      assert.deepEqual(grid.cells.map(cell => cell.imageIndex), Array.from({ length: count }, (_, index) => index));
      for (const cell of grid.cells) {
        for (let row = cell.row; row < cell.row + cell.rowSpan; row++) {
          for (let column = cell.column; column < cell.column + cell.columnSpan; column++) {
            assert.ok(row <= grid.rows && column <= grid.columns);
            const key = `${row}:${column}`;
            assert.ok(!occupied.has(key), `${count} regions overlap at ${key}`);
            occupied.add(key);
          }
        }
      }
      assert.equal(occupied.size, grid.rows * grid.columns);
    }
  }
});
