import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

async function moduleFrom(path) {
  const bundled = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'node' });
  return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
}
const { groupKey, getEffectiveOptions, getStoredOptions, renameGroupSettings } = await moduleFrom('../src/configuration.ts');
const { parseGroups, normalizeOptions } = await moduleFrom('../src/model.ts');
const commentGroup = (options, eol = '\n') => parseGroups(`<!-- image-layouts: ${JSON.stringify(options)} -->${eol}![[image.png]]${eol}<!-- /image-layouts -->`)[0];

test('legacy full markers migrate to short markers and sidecar without losing any display option', () => {
  const legacy = normalizeOptions({
    id: 'legacy-id', layout: 'focus', fit: 'natural', height: 540, gap: 12, radius: 0,
    caption: 'Figure 1 图注', grid: 'AAA.B\nAAA.C', thumbnails: false, overlay: 'always',
    align: 'center', width: '70%', descriptions: ['区域 A', '区域 B'],
    fromFolder: 'assets/科研图片', sortBy: 'mtime', reverse: true, limit: 23,
  });
  const original = commentGroup(legacy);
  assert.deepEqual(getEffectiveOptions(original, 'Research/旧笔记.md', {}), legacy);
  const stored = getStoredOptions(legacy);
  assert.ok(!Object.hasOwn(stored, 'id'));
  assert.ok(!Object.hasOwn(stored, 'layout'));
  const compact = commentGroup({ layout: legacy.layout, id: legacy.id });
  const restored = getEffectiveOptions(compact, 'Research/旧笔记.md', { [groupKey('Research/旧笔记.md', legacy.id)]: stored });
  assert.deepEqual(restored, legacy);
  assert.equal(original.raw, commentGroup(legacy).raw);
});

test('explicit source values, including defaults and empty arrays, override persisted details', () => {
  const group = commentGroup({ id: 'short', layout: 'a', height: 320, thumbnails: true, descriptions: [], caption: '' }, '\r\n');
  const settings = { [groupKey('a.md', 'short')]: { height: 600, thumbnails: false, descriptions: ['saved'], caption: 'saved caption', fit: 'natural' } };
  const effective = getEffectiveOptions(group, 'a.md', settings);
  assert.equal(effective.layout, 'a');
  assert.equal(effective.id, 'short');
  assert.equal(effective.height, 320);
  assert.equal(effective.thumbnails, true);
  assert.deepEqual(effective.descriptions, []);
  assert.equal(effective.caption, '');
  assert.equal(effective.fit, 'natural');
});

test('same IDs in separate notes remain isolated and JSON tuple keys preserve special characters', () => {
  const group = commentGroup({ id: 'same', layout: 'filmstrip' });
  const settings = { [groupKey('one.md', 'same')]: { height: 450 }, [groupKey('two.md', 'same')]: { height: 720 } };
  assert.equal(getEffectiveOptions(group, 'one.md', settings).height, 450);
  assert.equal(getEffectiveOptions(group, 'two.md', settings).height, 720);
  assert.equal(getEffectiveOptions(group, 'three.md', settings).height, 320);
  const path = '目录/["a,b"]/笔记.md';
  const id = 'x"y';
  assert.deepEqual(JSON.parse(groupKey(path, id)), [path, id]);
});

test('absent sidecar keeps source layout and schema defaults; fences keep their existing options', () => {
  const group = commentGroup({ id: 'short', layout: 'masonry-6' });
  assert.deepEqual(getEffectiveOptions(group, 'note.md', {}), normalizeOptions({ id: 'short', layout: 'masonry-6' }));
  const fence = { ...group, kind: 'fence', options: normalizeOptions({ id: 'short', layout: 'carousel', height: 640 }) };
  assert.strictEqual(getEffectiveOptions(fence, 'note.md', { [groupKey('note.md', 'short')]: { height: 120 } }), fence.options);
});

test('stored options omit all defaults and clone mutable descriptions', () => {
  assert.deepEqual(getStoredOptions(normalizeOptions({ layout: 'custom', id: 'abc' })), {});
  const options = normalizeOptions({ id: 'abc', layout: 'carousel', height: 400, descriptions: ['A'] });
  const stored = getStoredOptions(options);
  assert.deepEqual(stored, { height: 400, descriptions: ['A'] });
  stored.descriptions.push('B');
  assert.deepEqual(options.descriptions, ['A']);
});

test('rename migrates exact paths and descendants while preserving malformed and unrelated prefixes', () => {
  const invalidKeys = ['invalid', '["old.md"]', '[0,"abc"]', '["old.md","abc","extra"]', '{"path":"old.md"}', 'null'];
  const settings = {
    [groupKey('old.md', 'first')]: { height: 500 },
    [groupKey('old.md', 'second')]: { caption: '图注' },
    [groupKey('old.md/subnote.md', 'first')]: { fit: 'cover' },
    [groupKey('old.md-backup/subnote.md', 'first')]: { radius: 12 },
    [groupKey('unrelated.md', 'first')]: { gap: 20 },
    ...Object.fromEntries(invalidKeys.map(key => [key, { height: 300 }])),
  };
  const snapshot = structuredClone(settings);
  const renamed = renameGroupSettings(settings, 'old.md', 'renamed.md');
  assert.deepEqual(settings, snapshot);
  assert.ok(!Object.hasOwn(renamed, groupKey('old.md', 'first')));
  assert.ok(!Object.hasOwn(renamed, groupKey('old.md', 'second')));
  assert.deepEqual(renamed[groupKey('renamed.md', 'first')], { height: 500 });
  assert.deepEqual(renamed[groupKey('renamed.md', 'second')], { caption: '图注' });
  assert.ok(!Object.hasOwn(renamed, groupKey('old.md/subnote.md', 'first')));
  assert.deepEqual(renamed[groupKey('renamed.md/subnote.md', 'first')], { fit: 'cover' });
  assert.deepEqual(renamed[groupKey('old.md-backup/subnote.md', 'first')], { radius: 12 });
  for (const key of invalidKeys) assert.deepEqual(renamed[key], settings[key]);
  assert.deepEqual(renameGroupSettings(settings, 'old.md', 'old.md'), settings);
});

test('folder rename preserves Chinese multilevel suffixes and isolates repeated IDs across notes', () => {
  const oldPath = '课题/空间组学';
  const newPath = '归档/肾癌/空间分析';
  const settings = {
    [groupKey('课题/空间组学/图像.md', 'same')]: { height: 450 },
    [groupKey('课题/空间组学/病例/患者甲/图像.md', 'same')]: { descriptions: ['患者甲'] },
    [groupKey('课题/空间组学备份/图像.md', 'same')]: { gap: 16 },
    [groupKey('课题/空间组学-旧/图像.md', 'same')]: { radius: 12 },
    [groupKey('其他/图像.md', 'same')]: { fit: 'cover' },
  };
  const renamed = renameGroupSettings(settings, oldPath, newPath);
  assert.deepEqual(renamed[groupKey('归档/肾癌/空间分析/图像.md', 'same')], { height: 450 });
  assert.deepEqual(renamed[groupKey('归档/肾癌/空间分析/病例/患者甲/图像.md', 'same')], { descriptions: ['患者甲'] });
  assert.deepEqual(renamed[groupKey('课题/空间组学备份/图像.md', 'same')], { gap: 16 });
  assert.deepEqual(renamed[groupKey('课题/空间组学-旧/图像.md', 'same')], { radius: 12 });
  assert.deepEqual(renamed[groupKey('其他/图像.md', 'same')], { fit: 'cover' });
  assert.equal(Object.keys(renamed).length, Object.keys(settings).length);
  assert.ok(!Object.hasOwn(renamed, groupKey('课题/空间组学/图像.md', 'same')));
  assert.ok(!Object.hasOwn(renamed, groupKey('课题/空间组学/病例/患者甲/图像.md', 'same')));
});

test('a renamed note replaces stale destination settings for its own group ID', () => {
  const settings = { [groupKey('old.md', 'first')]: { height: 500 }, [groupKey('new.md', 'first')]: { height: 300 } };
  assert.deepEqual(renameGroupSettings(settings, 'old.md', 'new.md'), { [groupKey('new.md', 'first')]: { height: 500 } });
});
