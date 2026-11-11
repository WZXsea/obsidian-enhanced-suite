import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const result = await build({ entryPoints: [fileURLToPath(new URL('../src/group-picker.ts', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm' });
const { anchoredRange, extendRange, pickerImageName } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

test('left selection remains an inclusive source range in either direction from the anchor', () => {
  assert.deepEqual(anchoredRange(3, 6, 8), { first: 3, last: 6 });
  assert.deepEqual(anchoredRange(3, 1, 8), { first: 1, last: 3 });
  assert.deepEqual(anchoredRange(3, 3, 8), { first: 3, last: 3 });
});

test('right painting adds visited positions without leaving gaps or dropping earlier images', () => {
  let range = anchoredRange(3, 3, 8);
  for (const target of [5, 7, 2, 5, 0]) range = extendRange(range, target, 8);
  assert.deepEqual(range, { first: 0, last: 7 });
  assert.deepEqual(extendRange({ first: 3, last: 5 }, 4, 8), { first: 3, last: 5 });
});

test('empty and out-of-range inputs produce safe bounds for callers', () => {
  assert.deepEqual(anchoredRange(2, 9, 0), { first: -1, last: -1 });
  assert.deepEqual(anchoredRange(NaN, 100, 4), { first: 0, last: 3 });
  assert.deepEqual(extendRange({ first: -1, last: -1 }, 2, 4), { first: 2, last: 2 });
  assert.deepEqual(extendRange({ first: 0, last: 2 }, -100, 4), { first: 0, last: 2 });
});

test('compact labels omit wiki size metadata while retaining original descriptions', () => {
  assert.equal(pickerImageName({ alt: 'Figure 1|500', target: 'assets/a.png' }), 'Figure 1');
  assert.equal(pickerImageName({ alt: 'Figure 1|500 x 300px|区域A', target: 'assets/a.png' }), 'Figure 1 · 区域A');
  assert.equal(pickerImageName({ alt: '500', target: 'assets/完整图片.png' }), '完整图片.png');
  assert.equal(pickerImageName({ alt: '', target: 'assets/完整图片.png|500' }), '完整图片.png');
});
