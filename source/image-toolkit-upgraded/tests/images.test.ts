import test from 'node:test';
import assert from 'node:assert/strict';
import { extractImages } from '../src/images';

test('preserves occurrences, exact source positions and source order', () => {
  const text = '# Title\n![first](images/a.png)\nText ![[images/a.png|300]]\n';
  const result = extractImages(text);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(({ target, line, kind }) => ({ target, line, kind })), [
    { target: 'images/a.png', line: 1, kind: 'markdown' },
    { target: 'images/a.png', line: 2, kind: 'wiki' },
  ]);
  for (const entry of result) assert.equal(text.slice(entry.offset, entry.offset + entry.raw.length), entry.raw);
});

test('supports nested parentheses, escaped characters, angle destinations and titles', () => {
  const result = extractImages('![panel [A]](https://host/panel(a(b)).png "Caption")\n![B](<local folder/b.png> \'Title\')\n![C](img\\(1\\).png)');
  assert.deepEqual(result.map(({ target, alt }) => ({ target, alt })), [
    { target: 'https://host/panel(a(b)).png', alt: 'panel [A]' },
    { target: 'local folder/b.png', alt: 'B' },
    { target: 'img(1).png', alt: 'C' },
  ]);
});

test('supports full, collapsed and shortcut references and uses first definition', () => {
  const text = '![Caption][ FIG  A ]\n![Same][]\n![shortcut]\n[fig a]: <asset/a.PNG> "title"\n[same]: https://host/image?id=1\n[shortcut]: image.webp\n[fig a]: wrong.png';
  assert.deepEqual(extractImages(text).map(({ target, kind }) => ({ target, kind })), [
    { target: 'asset/a.PNG', kind: 'reference' },
    { target: 'https://host/image?id=1', kind: 'reference' },
    { target: 'image.webp', kind: 'reference' },
  ]);
});

test('excludes frontmatter, fences, multiline inline code, comments and escaped embeds', () => {
  const text = [
    '---', 'cover: ![[cover.png]]', '---',
    '```md', '![hidden](code.png)', '````',
    '~~~', '<img src="hidden.jpg">', '~~~',
    '`![[inline.png]]`', '`` code\n![hidden](multiline.png) ``',
    '<!-- ![[comment.png]]\n![hidden](comment2.png) -->',
    '\\![[escaped.png]]', '![visible](visible.png)',
  ].join('\n');
  const result = extractImages(text);
  assert.deepEqual(result.map(entry => entry.target), ['visible.png']);
  assert.equal(result[0].line, 15);
});

test('matches quoted/unquoted HTML attributes and decodes URL entities', () => {
  const result = extractImages('<IMG alt="A &amp; B" src="https://host/image?a=1&amp;b=2">\n<img src=local.svg alt=figure />');
  assert.deepEqual(result.map(({ target, alt, kind }) => ({ target, alt, kind })), [
    { target: 'https://host/image?a=1&b=2', alt: 'A & B', kind: 'html' },
    { target: 'local.svg', alt: 'figure', kind: 'html' },
  ]);
});

test('accepts image extensions and remote endpoints, excludes other local attachments', () => {
  const text = '![[paper.pdf]]\n![[sheet.xlsx]]\n![[photo.JPG|Photo]]\n![remote](https://host/render?id=1)\n![svg](folder/a.svg#fragment)\n![encoded](image%2Ewebp)';
  assert.deepEqual(extractImages(text).map(entry => entry.target), ['photo.JPG', 'https://host/render?id=1', 'folder/a.svg#fragment', 'image%2Ewebp']);
});

test('retains images indented inside lists and handles CRLF offsets', () => {
  const text = '- Figure\r\n    ![[a.png]]\r\n- ![second](b.gif)';
  assert.deepEqual(extractImages(text).map(({ line, offset }) => ({ line, offset })), [{ line: 1, offset: 14 }, { line: 2, offset: 28 }]);
});

test('handles unfinished inputs without producing spurious images', () => {
  assert.deepEqual(extractImages('![[unfinished.png\n![bad](image.png "unfinished)\n![good](good.png)').map(entry => entry.target), ['good.png']);
  assert.deepEqual(extractImages('![bad](file.pdf)\n![]()\n![good](good.png)').map(entry => entry.target), ['good.png']);
  assert.deepEqual(extractImages('![[unfinished.png\n![[good.png]]').map(entry => entry.target), ['good.png']);
});
