import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const output = await build({entryPoints:[fileURLToPath(new URL('../src/images.ts',import.meta.url))],bundle:true,format:'esm',platform:'node',write:false});
const {extractImages,getSupplementalMarkdown} = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);

test('images in native comment group remain discoverable with UTF16 positions and duplicate occurrences',()=>{
  const body = '😀 ![[图.png]] ![[图.png|Description]]\r\n![Alt](https://host/image?id=1)\r\n';
  const source = '<!-- image-layouts: {"layout":"filmstrip"} -->\r\n'+body+'<!-- /image-layouts -->';
  const images = extractImages(source);
  assert.equal(images.length,3);
  assert.deepEqual(images.map(i=>i.line),[1,1,2]);
  assert.equal(images[0].offset,source.indexOf('![[图.png]]'));
  for(const image of images)assert.equal(source.slice(image.offset,image.offset+image.raw.length),image.raw);
  assert.equal(images[1].alt,'Description');
});

test('supports nested/escaped/angle Markdown URLs, reference definitions, and HTML attributes',()=>{
  const source = '![Panel [A]](https://host/a(b(c)).png "Caption")\n![Local](<folder/image 1.png>)\n![Ref][fig]\n[fig]: img\\(1\\).webp\n<IMG alt="A &amp; B" src="https://host/image?a=1&amp;b=2">';
  const images = extractImages(source);
  assert.deepEqual(images.map(i=>i.target),['https://host/a(b(c)).png','folder/image 1.png','img(1).webp','https://host/image?a=1&b=2']);
  assert.deepEqual(images.map(i=>i.kind),['markdown','markdown','reference','html']);
  assert.equal(images[3].alt,'A & B');
});

test('ordinary Markdown and visibility boundaries preserve hidden image examples',()=>{
  const source = ['---','cover: ![[cover.png]]','---','```md','![[code.png]]','```','<!-- ![[comment.png]] -->','`![[inline.png]]`','\\![[escaped.png]]','![[paper.pdf]]','![[shown.png]]'].join('\n');
  assert.deepEqual(extractImages(source).map(i=>i.target),['shown.png']);
});

test('supplemental Markdown retains prose, captions, and reference definitions',()=>{
  const body = '![[a.png]] ![B](b.png)\n\nFigure 1: caption with [paper](https://host/paper).\n\nBefore ![C][fig] after.\n[fig]: c.webp';
  assert.equal(getSupplementalMarkdown(body),'Figure 1: caption with [paper](https://host/paper).\n\nBefore  after.\n[fig]: c.webp');
  assert.equal(getSupplementalMarkdown('![[a.png]]\n<img src="b.png">'),'');
  const referenceBody = '![Figure][fig]\nCaption.';
  const known = extractImages(referenceBody+'\n[fig]: outside.png');
  assert.equal(getSupplementalMarkdown(referenceBody,known),'Caption.');
  assert.equal(getSupplementalMarkdown('Caption.',[{...known[0],offset:0}]),'Caption.');
});

test('unfinished images and nonimage attachments keep source prose intact',()=>{
  assert.deepEqual(extractImages('![[unfinished.png\n![bad](bad.png "unfinished)\n![Good](good.png)').map(i=>i.target),['good.png']);
  assert.equal(getSupplementalMarkdown('![[paper.pdf]]\nFigure caption.'),'![[paper.pdf]]\nFigure caption.');
});

test('nested HTML images render while raw code containers retain literal examples',()=>{
  const source = '<figure><div><img src="real.png" alt="Caption"></div><figcaption>Caption</figcaption></figure>\n<pre><code>![[fake.png]]</code></pre>\n<script>const sample = "![A](fake2.png)";</script>\n<code>![[fake3.png]]</code>';
  assert.deepEqual(extractImages(source).map(i=>i.target),['real.png']);
  assert.ok(getSupplementalMarkdown(source).includes('<figcaption>Caption</figcaption>'));
  assert.ok(getSupplementalMarkdown(source).includes('![[fake.png]]'));
});
