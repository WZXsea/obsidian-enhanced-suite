import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from '../../node_modules/esbuild/lib/main.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(path.join(os.tmpdir(), 'citation-badges-model-'));
let count = 0;
try {
  const output = path.join(temporary, 'model.mjs');
  await build({ entryPoints: [path.join(root, 'src/model.ts')], outfile: output, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { buildDocumentModel: model, formatNumbers } = await import(pathToFileURL(output).href);
  const test = (name, run) => { run(); count++; console.log(`PASS ${name}`); };
  const summary = source => model(source).references.map(ref => [ref.kind, ref.sourceId, ref.number, ref.occurrence]);
  const defs = '\n\n[^a]: Alpha\n[^b]: Beta\n[^c]: Gamma\n[^d]: Delta\n[^e]: Epsilon\n[^f]: Phi\n[^g]: Seven';

  test('Native oracle: named ids number by first valid appearance, not definition order', () => {
    assert.deepEqual(summary('前[^z][^2][^a]，后[^z]\n\n[^a]: A\n[^z]: Z\n[^2]: Two'), [
      ['standard', 'z', 1, 0], ['standard', '2', 2, 0], ['standard', 'a', 3, 0], ['standard', 'z', 1, 1]
    ]);
  });
  test('Native oracle: numeric authored ids remain separate from display numbers', () => {
    assert.deepEqual(summary('前[^7][^2][^9]，后[^7]\n\n[^2]: Two\n[^7]: Seven\n[^9]: Nine').map(ref => ref.slice(1)), [
      ['7', 1, 0], ['2', 2, 0], ['9', 3, 0], ['7', 1, 1]
    ]);
  });
  test('Native oracle: inline footnotes occupy shared sequence and terminate standard clusters', () => {
    const result = model('前^[Inline first][^z]，中^[Inline second][^a]，后[^z]\n\n[^a]: A\n[^z]: Z');
    assert.deepEqual(result.references.map(ref => [ref.kind, ref.sourceId, ref.number]), [
      ['inline', '[inline0', 1], ['standard', 'z', 2], ['inline', '[inline2', 3], ['standard', 'a', 4], ['standard', 'z', 2]
    ]);
    assert.deepEqual(result.clusters.map(cluster => cluster.label), ['2', '4', '2']);
  });
  test('Native oracle: undefined references occupy no number and break clusters', () => {
    const result = model('[^missing][^b][^missing][^a]' + defs);
    assert.deepEqual(result.references.map(ref => ref.number), [null, 1, null, 2]);
    assert.deepEqual(result.clusters.map(cluster => cluster.label), ['1', '2']);
  });
  test('Repeat references preserve all source occurrences while deduplicating a badge', () => {
    const result = model('[^a][^a][^b] 后[^a]' + defs);
    assert.deepEqual(result.references.map(ref => ref.occurrence), [0, 1, 0, 2]);
    assert.equal(result.clusters[0].members.length, 3);
    assert.equal(result.clusters[0].label, '1,2');
    assert.equal(result.clusters[1].label, '1');
  });
  test('Compression preserves authored order, including out of order/repeated references', () => {
    const result = model('[^a] [^b] [^c] [^d] [^e] [^f] [^g]\n[^a][^b][^c][^g] / [^g][^c][^b][^a]' + defs);
    assert.deepEqual(result.clusters.slice(-2).map(cluster => cluster.label), ['1–3,7', '7,3,2,1']);
    assert.equal(formatNumbers([3, 1, 2, 3, 7]), '3,1,2,7');
    assert.equal(formatNumbers([1, 2, 3, 4, 7, 8]), '1–4,7,8');
    assert.equal(formatNumbers([1, 2], 2), '1–2');
  });
  test('Every whitespace, punctuation, newline and formatting boundary ends a cluster', () => {
    const result = model('[^a] [^b]，[^c]\n[^d]**[^e]**[^f]\t[^g]' + defs);
    assert.equal(result.clusters.length, 7);
    assert.ok(result.clusters.every(cluster => cluster.members.length === 1));
  });
  test('Source offsets stay exact through Unicode, quotes, lists and table cells', () => {
    const source = '🧬中文\n> 引用[^a][^b]\n- 条目[^c]\n| 列 | 文 |\n| -- | -- |\n| 表 | [^d] |' + defs;
    const result = model(source);
    assert.equal(result.references.length, 4);
    for (const ref of result.references) assert.equal(source.slice(ref.from, ref.to), `[^${ref.sourceId}]`);
    assert.equal(result.clusters[0].members.length, 2);
    assert.equal(source.slice(result.clusters[0].from, result.clusters[0].to), '[^a][^b]');
  });
  test('Frontmatter, fenced code, inline code, comments and escaped references stay outside numbering', () => {
    const source = '---\nproperty: "[^a]"\n---\n```md\n[^a]\n```\n~~~\n[^b]\n~~~\n`[^c]` ``a ` [^d]``\n<!-- [^e]\n[^f] -->\n%% [^g] %%\n\\[^a] \\^[inline] 有效[^b]' + defs;
    assert.deepEqual(summary(source), [['standard', 'b', 1, 0]]);
  });
  test('Fence close requires matching character, sufficient length and no info string', () => {
    const source = '````md\n```\n[^a]\n~~~~\n[^b]\n```` bogus\n[^c]\n````\n有效[^d]' + defs;
    assert.deepEqual(summary(source), [['standard', 'd', 1, 0]]);
  });
  test('Quoted/list fences preserve actual reference positions after closing', () => {
    const source = '> ```md\n> [^a]\n> ```\n> 正文[^b]\n- ```\n  [^c]\n  ```\n正文[^d]' + defs;
    assert.deepEqual(summary(source).map(ref => ref[1]), ['b', 'd']);
  });
  test('Unmatched backticks remain literal and allow later valid references', () => {
    assert.deepEqual(summary('未闭合 ` 正文[^a]' + defs), [['standard', 'a', 1, 0]]);
  });
  test('Escaped syntax distinguishes an escaped marker from an escaped backslash', () => {
    assert.deepEqual(summary(String.raw`\[^a] \\[^b]` + defs), [['standard', 'b', 1, 0]]);
  });
  test('Definitions absorb multiline continuation and references in the definition body', () => {
    const source = '正文[^a] 后[^b]\n\n[^a]: 第一行[^g]\n  第二行[^c]\n\n    第三段[^d]\n[^b]: Beta';
    const result = model(source);
    assert.deepEqual(result.references.map(ref => ref.sourceId), ['a', 'b']);
    assert.equal(result.definitions.get('a').content, '第一行[^g]\n第二行[^c]\n\n第三段[^d]');
    assert.equal(source.slice(result.definitions.get('a').from, result.definitions.get('a').to), '[^a]: 第一行[^g]\n  第二行[^c]\n\n    第三段[^d]');
  });
  test('Quoted definitions preserve content and exclude nested reference-looking text', () => {
    const result = model('> 正文[^a]\n>\n> [^a]: First\n>   Second [^b]\n\n[^b]: Beta');
    assert.equal(result.definitions.get('a').content, 'First\nSecond [^b]');
    assert.deepEqual(result.references.map(ref => ref.sourceId), ['a']);
  });
  test('Inline footnotes balance nested brackets and ignore escaped/code-span brackets', () => {
    const result = model('前^[text [nested] \\] code `]` end][^a]' + defs);
    assert.deepEqual(result.references.map(ref => ref.number), [1, 2]);
    assert.equal(result.references[0].kind, 'inline');
    assert.equal(result.references[1].sourceId, 'a');
  });
  test('CRLF source positions and multiline definition content remain consistent', () => {
    const source = '正文[^a]\r\n\r\n[^a]: First\r\n  Second';
    const result = model(source);
    assert.equal(result.definitions.get('a').content, 'First\nSecond');
    assert.equal(source.slice(result.references[0].from, result.references[0].to), '[^a]');
  });
  test('Native continuation preserves body indentation beyond its four base columns', () => {
    const result = model('正文[^a][^b]\n\n[^a]: First\n\n        const x = 1;\n        [^b]\n\n    - Parent\n      - Child\n[^b]: Other');
    assert.equal(result.definitions.get('a').content, 'First\n\n    const x = 1;\n    [^b]\n\n- Parent\n  - Child');
    assert.deepEqual(result.references.map(ref => [ref.sourceId, ref.number]), [['a', 1], ['b', 2]]);
    assert.equal(result.definitions.get('b').content, 'Other');
  });
  test('Legacy 2–3-space lazy continuation and Tab bases remain compatible', () => {
    const result = model('正文[^a]\n\n[^a]: First\n  Two\n   Three\n\tTabbed\n\t\tIndented');
    assert.equal(result.definitions.get('a').content, 'First\nTwo\nThree\nTabbed\n\tIndented');
  });
  test('Native oracle: HTML attributes are excluded while inline HTML body references remain active', () => {
    const source = '<font title="[^a]">正文[^b]</font>\n\n[^a]: A\n[^b]: B';
    assert.deepEqual(summary(source), [['standard', 'b', 1, 0]]);
    const quoted = '<font title="a > [^a]" data-x=\'[^c]\'>正文[^b]</font>' + defs;
    assert.deepEqual(summary(quoted), [['standard', 'b', 1, 0]]);
  });
  test('Native oracle: inline and display math preserve later citation numbering', () => {
    const source = '前 $x[^a]$ 后[^b]\n\n$$\n[^c]\n$$\n\n[^a]: A\n[^b]: B\n[^c]: C';
    assert.deepEqual(summary(source), [['standard', 'b', 1, 0]]);
    assert.deepEqual(summary(String.raw`\$literal[^a] $unclosed[^b]` + defs).map(ref => ref[1]), ['a', 'b']);
    assert.deepEqual(summary('$ x[^a]$ 正文[^b]' + defs).map(ref => ref[1]), ['a', 'b']);
  });
  test('Native oracle: root indented/Tab code is excluded', () => {
    const source = '    [^a]\n\n正文[^b]\n\n\t[^c]\n\n[^a]: A\n[^b]: B\n[^c]: C';
    assert.deepEqual(summary(source), [['standard', 'b', 1, 0]]);
  });
  test('Native oracle: list continuation paragraphs stay active and deeper code is excluded', () => {
    const source = '- 正文[^a]\n\n    续段[^b]\n\n        [^c]\n\n正文[^d]' + defs;
    assert.deepEqual(summary(source).map(ref => [ref[1], ref[2]]), [['a', 1], ['b', 2], ['d', 3]]);
  });
  test('Indentation respects paragraph lazy continuation and nested-list context', () => {
    const source = '正文[^a]\n    lazy[^b]\n\n- list[^c]\n  - nested[^d]\n\n      continued[^e]\n\n        code[^f]\n\n正文[^g]' + defs;
    assert.deepEqual(summary(source).map(ref => ref[1]), ['a', 'b', 'c', 'd', 'e', 'g']);
  });
  test('Definition-only nested refs are left to native footnote rendering after body numbering', () => {
    const result = model('正文[^a]，后[^b]\n\n[^a]: A inside [^c]\n[^b]: B\n[^c]: C');
    assert.deepEqual(result.references.map(ref => [ref.sourceId, ref.number]), [['a', 1], ['b', 2]]);
    assert.equal(result.definitions.get('a').content, 'A inside [^c]');
  });
  test('Large document retains global numbering when early ids recur near the end', () => {
    const body = Array.from({ length: 2500 }, (_, i) => `段落${i}[^id${i}]`).join('\n');
    const definitions = Array.from({ length: 2500 }, (_, i) => `[^id${i}]: Note ${i}`).join('\n');
    const result = model(`${body}\n结束[^id0][^id2499]\n\n${definitions}`);
    assert.equal(result.references.length, 2502);
    assert.deepEqual(result.references.slice(-2).map(ref => ref.number), [1, 2500]);
    assert.equal(result.clusters.at(-1).label, '1,2500');
  });
  console.log(`\n${count} model tests passed.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
