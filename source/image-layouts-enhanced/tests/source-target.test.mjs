import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
async function module(path){const r=await build({entryPoints:[fileURLToPath(new URL(path,import.meta.url))],bundle:true,write:false,format:'esm',platform:'node'});return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);}
const {resolveGallerySourceTarget}=await module('../src/source-target.ts');
const {parseGroups,normalizeOptions}=await module('../src/model.ts');
const wrap=(body,id='gallery')=>`<!-- image-layouts: {"id":"${id}","layout":"g"} -->\n\n${body}\n\n<!-- /image-layouts -->\n`;

test('selects complete native references while retaining markers and outside prose',()=>{
  const first='![[图一.jpg|300]]',last='![图二](photo-2.jpg)',source='前文\n'+wrap(first+'\n\n图注\n\n'+last)+'后文';
  const target=resolveGallerySourceTarget(source,parseGroups(source)[0]);
  assert.equal(source.slice(target.from,target.to),first+'\n\n图注\n\n'+last);
  assert.equal(target.from,source.indexOf(first));assert.equal(target.to,source.indexOf(last)+last.length);
});
test('unique IDs resolve moved UTF16 and CRLF source as well as current image edits',()=>{
  const old=wrap('![[old.png]]'),snapshot=parseGroups(old)[0];
  const source=('新编辑😀\n\n'+old.replace('old.png','新的图.png')).replaceAll('\n','\r\n');
  const target=resolveGallerySourceTarget(source,snapshot);
  assert.equal(source.slice(target.from,target.to),'![[新的图.png]]');assert.equal(target.group.from,source.indexOf('<!--'));
});
test('duplicate IDs relocate an exact distinct group and keep duplicate image occurrences',()=>{
  const a=wrap('![[a.png]]','same'),b=wrap('![[b.png]]\n\n![[b.png]]','same'),before=a+b,snapshot=parseGroups(before)[1];
  const source='前置编辑\n'+before,target=resolveGallerySourceTarget(source,snapshot);
  assert.equal(target.group.body,snapshot.body);assert.equal(source.slice(target.from,target.to),'![[b.png]]\n\n![[b.png]]');
});
test('identical duplicate groups resolve exact position and reject an ambiguous moved snapshot',()=>{
  const same=wrap('![[a.png]]','same'),source=same+same,snapshot=parseGroups(source)[1];
  assert.equal(resolveGallerySourceTarget(source,snapshot).group.from,snapshot.from);
  assert.equal(resolveGallerySourceTarget('前置编辑\n'+source,snapshot),null);
});
test('removed groups retain current source and yield no editing destination',()=>{
  const source=wrap('![[a.png]]'),snapshot=parseGroups(source)[0];
  assert.equal(resolveGallerySourceTarget('![[a.png]]',snapshot),null);
  assert.equal(resolveGallerySourceTarget(source.replace('"gallery"','"other"'),snapshot),null);
});
test('reference-style and HTML images have exact complete selection bounds',()=>{
  const source=wrap('![图注][photo]\n\n<img src="two.png" width="300">')+'\n[photo]: one.png\n',snapshot=parseGroups(source)[0];
  const target=resolveGallerySourceTarget(source,snapshot);
  assert.equal(source.slice(target.from,target.to),'![图注][photo]\n\n<img src="two.png" width="300">');
});
function legacy(raw){const from=0,bodyFrom=raw.indexOf('\n')+1,bodyTo=raw.lastIndexOf('```');return {from,to:raw.length,bodyFrom,bodyTo,body:raw.slice(bodyFrom,bodyTo),raw,options:normalizeOptions({layout:'g'}),startLine:0,endLine:4,kind:'fence'};}
test('legacy fence images remain editable after a preceding source insertion',()=>{
  const raw='```image-layout-g\n![[a.png]]\n\n![B](b.png)\n```\n',snapshot=legacy(raw),source='新增😀\n'+raw;
  const target=resolveGallerySourceTarget(source,snapshot);
  assert.equal(source.slice(target.from,target.to),'![[a.png]]\n\n![B](b.png)');
});
test('legacy examples in other fences, hidden comments and frontmatter remain source examples',()=>{
  const raw='```image-layout-g\n![[a.png]]\n```\n',snapshot=legacy(raw);
  for(const source of ['````markdown\n'+raw+'````\n','<!--\n'+raw+'-->\n','---\nexample: |\n'+raw+'---\n'])assert.equal(resolveGallerySourceTarget(source,snapshot),null);
});
test('a folder-only group exposes its own body rather than selecting surrounding images',()=>{
  const source='![[outside.png]]\n'+wrap('文件夹图注'),snapshot=parseGroups(source)[0];
  const target=resolveGallerySourceTarget(source,snapshot);
  assert.equal(target.from,snapshot.bodyFrom);assert.equal(target.to,snapshot.bodyTo);
});
