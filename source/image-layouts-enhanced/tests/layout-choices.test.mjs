import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

async function sourceModule(path) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { getLayoutChoices } = await sourceModule('../src/layout-choices.ts');
const { parseCustomGrid } = await sourceModule('../src/model.ts');
const presets = new Set(['single', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);

test('fixed presets are offered only for their exact image counts', () => {
  const expected = { 2: ['a', 'b', 'c'], 3: ['d', 'e', 'h'], 4: ['f', 'g', 'i'], 5: [], 8: [], 9: [] };
  for (const [count, layouts] of Object.entries(expected)) {
    const choices = getLayoutChoices(Number(count));
    assert.deepEqual(choices.filter(choice => presets.has(choice.layout)).map(choice => choice.layout), layouts);
    assert.equal(new Set(choices.map(choice => choice.key)).size, choices.length);
  }
  assert.deepEqual(getLayoutChoices(1).map(choice => choice.layout), ['single']);
});

test('2, 3, 4, 5, 8 and 9 image choices each depict every image exactly once as a rectangular region', () => {
  for (const count of [2, 3, 4, 5, 8, 9]) for (const choice of getLayoutChoices(count)) {
    const preview = choice.preview.join('\n');
    const parsed = parseCustomGrid(preview);
    assert.ok(!('error' in parsed), `${count}/${choice.key}: ${parsed.error}`);
    assert.equal(parsed.slots, count, `${count}/${choice.key} drops or pads a region`);
    assert.ok(!preview.includes('.'));
    if (choice.grid) {
      assert.equal(choice.grid, preview);
      const firstSeen = [...new Set(choice.grid.replace(/\n/g, ''))];
      assert.deepEqual(firstSeen, Array.from({ length: count }, (_, index) => String.fromCharCode(65 + index)));
    }
  }
});

test('eight-image stages have the primary A at 3-unit width and seven complete side regions', () => {
  const choices = getLayoutChoices(8);
  assert.deepEqual(choices.find(choice => choice.key === 'stage-left').preview, ['AAABC', 'AAADE', 'AAAFG', 'AAAHH']);
  assert.deepEqual(choices.find(choice => choice.key === 'stage-right').preview, ['BCAAA', 'DEAAA', 'FGAAA', 'HHAAA']);
  for (const key of ['stage-left', 'stage-right']) {
    const choice = choices.find(choice => choice.key === key);
    assert.equal(choice.label, `${key === 'stage-left' ? '左' : '右'}主图＋7图`);
    assert.equal(choice.grid, undefined);
  }
});

test('custom choices remain valid up to the parser symbol bound and larger groups keep complete modes', () => {
  for (let count = 2; count <= 52; count++) for (const choice of getLayoutChoices(count).filter(choice => choice.layout === 'custom')) {
    const parsed = parseCustomGrid(choice.grid);
    assert.ok(!('error' in parsed), `${count}/${choice.key}: ${parsed.error}`);
    assert.equal(parsed.slots, count);
    assert.deepEqual([...new Set(choice.grid.replace(/\n/g, ''))], 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.slice(0, count).split(''));
  }
  const large = getLayoutChoices(60);
  assert.ok(large.every(choice => choice.layout !== 'custom'));
  assert.ok(large.some(choice => choice.layout === 'stage-left'));
  assert.ok(large.some(choice => choice.layout === 'masonry-6'));
  for (const choice of large) assert.equal(new Set(choice.preview.join('')).size, 60);
});

test('browse modes are explicitly separate and state their exact group sizes', () => {
  for (const count of [2, 3, 4, 5, 8, 9]) {
    const modes = getLayoutChoices(count).filter(choice => choice.kind === 'browse');
    assert.deepEqual(modes.map(choice => choice.layout), ['filmstrip', 'carousel', 'focus']);
    assert.ok(modes.every(choice => choice.label.includes(`${count}图`)));
    const masonry = getLayoutChoices(count).filter(choice => choice.layout.startsWith('masonry'));
    assert.equal(masonry.length, Math.min(6, count) - 1);
  }
  for (const count of [0, -1, NaN, Infinity, 2.5]) assert.deepEqual(getLayoutChoices(count), []);
});
