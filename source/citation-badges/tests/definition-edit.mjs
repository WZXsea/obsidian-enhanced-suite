import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from '../../node_modules/esbuild/lib/main.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(path.join(os.tmpdir(), 'citation-badges-definition-edit-'));
let count = 0;
try {
  const output = path.join(temporary, 'definition-edit.mjs');
  await build({ entryPoints: [path.join(root, 'src/definition-edit.ts')], outfile: output,
    bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { replaceDefinitionContent: replace, DefinitionEditError } = await import(pathToFileURL(output).href);
  const test = (name, run) => { run(); count++; console.log(`PASS ${name}`); };
  const errorWith = code => error => error instanceof DefinitionEditError && error.code === code;

  test('Only the definition body changes; repeated authored references and surrounding Unicode stay exact', () => {
    const source = '🧬正文[^a]，再次[^a][^b]\n\n[^a]: 原来源\n[^b]: 其他来源\n\n尾段';
    const result = replace(source, 'a', '原来源', '新的 [来源](https://example.org)');
    assert.equal(result.source, source.replace('原来源', '新的 [来源](https://example.org)'));
    assert.equal(result.source, source.slice(0, result.from) + result.insert + source.slice(result.to));
    assert.equal(result.definition.content, '新的 [来源](https://example.org)');
    assert.equal(result.definition.from, result.from);
  });
  test('Expected content catches concurrent modification before a replacement is constructed', () => {
    assert.throws(() => replace('正文[^a]\n\n[^a]: 新正文', 'a', '旧正文', '我的正文'), errorWith('conflict'));
  });
  test('Missing or fenced definitions keep the draft recoverable through a typed error', () => {
    assert.throws(() => replace('正文[^a]', 'a', '', '新增'), errorWith('missing'));
    assert.throws(() => replace('```md\n[^a]: literal\n```', 'a', 'literal', '新增'), errorWith('missing'));
  });
  test('First-line indentation, named id, colon spacing and Tab spacing remain authored', () => {
    const source = '正文[^smith-2024]\n\n   [^smith-2024]:\t  Author';
    assert.equal(replace(source, 'smith-2024', 'Author', 'Revised').source,
      '正文[^smith-2024]\n\n   [^smith-2024]:\t  Revised');
  });
  test('CRLF is retained at every inserted line and at the boundary before the next definition', () => {
    const source = '正文[^a][^b]\r\n\r\n[^a]: First\r\n  Second\r\n[^b]: Other\r\n';
    const result = replace(source, 'a', 'First\nSecond', 'New\nSecond\nThird');
    assert.equal(result.source, '正文[^a][^b]\r\n\r\n[^a]: New\r\n    Second\r\n    Third\r\n[^b]: Other\r\n');
    assert.equal(result.definition.content, 'New\nSecond\nThird');
    assert.equal(source.slice(result.to, result.to + 2), '\r\n');
  });
  test('Interior blank paragraphs and the following definition survive multiline changes', () => {
    const source = '正文[^a][^b]\n\n[^a]: Old\n\n  Paragraph\n[^b]: Other\n\n尾段';
    const result = replace(source, 'a', 'Old\n\nParagraph', 'New\n\nMore\n\nFinal');
    assert.equal(result.source, '正文[^a][^b]\n\n[^a]: New\n\n    More\n\n    Final\n[^b]: Other\n\n尾段');
    assert.equal(result.definition.content, 'New\n\nMore\n\nFinal');
  });
  test('Continuation indentation follows each authored line, then falls back to its existing style', () => {
    const source = '正文[^a]\n\n[^a]: First\n\tSecond\n    Third';
    assert.equal(replace(source, 'a', 'First\nSecond\nThird', 'One\nTwo\nThree\nFour').source,
      '正文[^a]\n\n[^a]: One\n\tTwo\n    Three\n\tFour');
  });
  test('New multiline definitions use the native four-column continuation base', () => {
    const source = '正文[^a]\n\n [^a]: First\n\n尾段';
    assert.equal(replace(source, 'a', 'First', 'One\nTwo').source, '正文[^a]\n\n [^a]: One\n    Two\n\n尾段');
  });
  test('Nested blockquote prefixes and blank quote lines remain in their original container', () => {
    const source = '> > 正文[^a]\n> >\n> > [^a]: First\n> >   Second\n> >\n> >   Third\n\n外部';
    const result = replace(source, 'a', 'First\nSecond\n\nThird', 'One\nTwo\n\nThree\nFour');
    assert.equal(result.source, '> > 正文[^a]\n> >\n> > [^a]: One\n> >     Two\n> >\n> >     Three\n> >     Four\n\n外部');
    assert.equal(result.definition.content, 'One\nTwo\n\nThree\nFour');
  });
  test('Blockquote Markdown within a new continuation stays within the footnote body', () => {
    const source = '正文[^a][^b]\n\n[^a]: Old\n[^b]: Other';
    const result = replace(source, 'a', 'Old', 'One\n> nested quote [^b]\nFinal');
    assert.equal(result.source, '正文[^a][^b]\n\n[^a]: One\n    > nested quote [^b]\n    Final\n[^b]: Other');
    assert.equal(result.definition.content, 'One\n> nested quote [^b]\nFinal');
    const quoted = '> 正文[^a]\n>\n> [^a]: Old\n\n外部';
    assert.equal(replace(quoted, 'a', 'Old', 'One\n> nested quote').source,
      '> 正文[^a]\n>\n> [^a]: One\n>     > nested quote\n\n外部');
  });
  test('Empty contents retain a legal standard definition and all surrounding separators', () => {
    const source = '正文[^a][^b]\n\n[^a]: Old\n  Second\n\n[^b]: Other';
    const result = replace(source, 'a', 'Old\nSecond', '');
    assert.equal(result.source, '正文[^a][^b]\n\n[^a]: \n\n[^b]: Other');
    assert.equal(result.definition.content, '');
  });
  test('Reference-looking and definition-looking Markdown remain entirely inside the edited body', () => {
    const source = '正文[^a][^b]\n\n[^a]: Old\n[^b]: Other';
    const content = 'See [^b]\n[^new]: embedded definition text\n^[inline source]';
    const result = replace(source, 'a', 'Old', content);
    assert.equal(result.source, '正文[^a][^b]\n\n[^a]: See [^b]\n    [^new]: embedded definition text\n    ^[inline source]\n[^b]: Other');
    assert.equal(result.definition.content, content);
  });
  test('Complete fenced Markdown is accepted while preserving citations beyond the definition', () => {
    const source = '正文[^a][^b]\n\n[^a]: Old\n[^b]: Other\n\n尾段[^b]';
    const content = 'Example\n```md\n[^new]\n```\nFinal';
    assert.equal(replace(source, 'a', 'Old', content).definition.content, content);
  });
  test('Indented code keeps four body columns on save and on a later edit round trip', () => {
    const source = '正文[^a][^b]\n\n[^a]: Old\n[^b]: Other';
    const content = 'First\n\n    const x = 1;\n    [^b]\n\nLast';
    const first = replace(source, 'a', 'Old', content);
    assert.equal(first.definition.content, content);
    assert.equal(first.source, '正文[^a][^b]\n\n[^a]: First\n\n        const x = 1;\n        [^b]\n\n    Last\n[^b]: Other');
    const second = replace(first.source, 'a', first.definition.content, content.replace('1;', '2;'));
    assert.equal(second.definition.content, content.replace('1;', '2;'));
    assert.ok(second.source.includes('\n        const x = 2;\n'));
  });
  test('Nested lists preserve authored body indentation rather than absorbing it into the continuation prefix', () => {
    const source = '正文[^a]\n\n[^a]: First\n    - Parent\n      - Child';
    const result = replace(source, 'a', 'First\n- Parent\n  - Child', 'First\n- Revised\n  - Child');
    assert.equal(result.source, '正文[^a]\n\n[^a]: First\n    - Revised\n      - Child');
    assert.equal(result.definition.content, 'First\n- Revised\n  - Child');
  });
  test('An unfinished Markdown span that captures another definition leaves the current source intact', () => {
    const source = '正文[^a][^b]\n\n[^a]: Old\n[^b]: Other\n\n尾段[^b]';
    assert.throws(() => replace(source, 'a', 'Old', 'Draft %%'), errorWith('invalid'));
    assert.throws(() => replace(source, 'a', 'Old', 'Draft\n```md'), errorWith('invalid'));
  });
  test('No-op edits preserve mixed whitespace, CRLF and final newline byte for byte', () => {
    const source = '正文[^a]\r\n\r\n[^a]:\t Old\r\n\tSecond\r\n\r\n尾段';
    const result = replace(source, 'a', 'Old\nSecond', 'Old\r\nSecond');
    assert.equal(result.source, source);
  });
  test('Serial saves use the returned content and preserve current unrelated edits', () => {
    const source = '正文[^a]\n\n[^a]: Old\n\n尾段';
    const first = replace(source, 'a', 'Old', 'One\nTwo');
    const externallyUpdated = first.source + '\n外部编辑';
    const second = replace(externallyUpdated, 'a', first.definition.content, 'One\nTwo revised');
    assert.equal(second.source, '正文[^a]\n\n[^a]: One\n    Two revised\n\n尾段\n外部编辑');
  });
  test('Trailing blank lines remain source formatting and the parsed result is ready for the next save', () => {
    const source = '正文[^a]\n\n[^a]: Old\n\n尾段';
    const first = replace(source, 'a', 'Old', 'One\n\n');
    assert.equal(first.definition.content, 'One');
    const next = replace(first.source, 'a', first.definition.content, 'Two');
    assert.ok(next.source.includes('[^a]: Two\n'));
    assert.ok(next.source.endsWith('尾段'));
  });
  if (process.env.CITATION_NATIVE_ORACLE === '1') {
    const source = '正文[^a][^b][^c]，再次[^a]\n\n[^a]: Original\n[^b]: Other\n[^c]: Third\n\n尾段';
    const bodies = {
      multiline: 'First\nSecond', interiorBlank: 'First\n\nSecond',
      definitionLooking: 'First\n[^x]: embedded definition\nLast',
      duplicateDefinitionLooking: 'First\n[^b]: Other override\nLast',
      links: '[官网](https://example.org) 与 [[知识页]]\nSecond',
      list: 'First\n- One\n- Two', nestedList: 'First\n- Parent\n  - Child',
      blockquote: 'First\n> Quote\nLast', fence: 'First\n```md\n[^x]\n```\nLast',
      indentedCode: 'First\n\n    const x = 1;\n    [^b]\n\nLast',
      inlineNested: 'First [^b]', empty: '', leadingBlank: '\nSecond'
    };
    const fixtures = [{ name: 'baseline', source }];
    for (const [name, content] of Object.entries(bodies)) {
      fixtures.push({ name, source: replace(source, 'a', 'Original', content).source });
    }
    for (const [name, current] of [['CRLF', source.replace(/\n/g, '\r\n')],
      ['indentedMarker', source.replace('[^a]: Original', '   [^a]:\t Original')]]) {
      fixtures.push({ name, source: replace(current, 'a', 'Original', 'First\n\nSecond').source });
    }
    const first = replace(source, 'a', 'Original', bodies.indentedCode);
    fixtures.push({ name: 'codeRoundTrip', source: replace(first.source, 'a', first.definition.content,
      bodies.indentedCode.replace('1;', '2;')).source });
    // Borrow only the real parser method. A temporary receiver captures its HTML;
    // the active renderer, note, workspace and plugin settings remain untouched.
    const code = `(() => {
      const parser = app.workspace.activeLeaf?.view?.previewMode?.renderer;
      if (typeof parser?.parseSync !== 'function') throw new Error('Native oracle requires an active Markdown view.');
      return JSON.stringify(${JSON.stringify(fixtures)}.map(item => {
        let parsed;
        parser.parseSync.call({text: item.source, parseFinish: (_source, result) => { parsed = result; }});
        const root = document.createElement('div');
        root.innerHTML = parsed.sections.map(section => section.html).join('');
        const notes = [...root.querySelectorAll('.footnotes > ol > li')].map(element => {
          const copy = element.cloneNode(true);
          copy.querySelectorAll('a.footnote-backref').forEach(anchor => anchor.remove());
          return {text: copy.textContent, html: copy.innerHTML};
        });
        return {name: item.name, notes,
          refs: [...root.querySelectorAll('a.footnote-link')].filter(element => !element.closest('.footnotes'))
            .map(element => [element.dataset.footref, element.textContent]),
          outside: [...root.children].filter(element => !element.classList.contains('footnotes'))
            .map(element => element.textContent)};
      }));
    })()`;
    const raw = execFileSync('obsidian', ['eval', `code=${code}`], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    assert.ok(raw.startsWith('=> '), raw);
    const results = JSON.parse(raw.slice(3).trim());
    for (const result of results) {
      assert.deepEqual(result.refs, results[0].refs, `${result.name}: numbered body citations`);
      assert.equal(result.notes.length, 3, `${result.name}: definition count`);
      assert.deepEqual(result.notes.slice(1).map(note => note.text), ['Other', 'Third'], `${result.name}: other definitions`);
      assert.deepEqual(result.outside, results[0].outside, `${result.name}: body boundary`);
      console.log(`PASS Native oracle ${result.name}`);
    }
    const note = name => results.find(result => result.name === name).notes[0];
    assert.ok(note('interiorBlank').html.includes('<p>First</p><p>Second'));
    assert.ok(note('fence').html.includes('<pre><code class="language-md"'));
    assert.ok(note('indentedCode').html.includes('<pre><code'));
    assert.ok(note('codeRoundTrip').html.includes('<pre><code'));
    assert.ok(note('codeRoundTrip').text.includes('const x = 2;'));
    assert.ok(note('nestedList').html.match(/<ul>/g).length === 2);
    assert.ok(note('links').html.includes('class="external-link"'));
    console.log(`\n${results.length} native Obsidian parser fixtures passed.`);
  }
  console.log(`\n${count} definition edit tests passed.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
