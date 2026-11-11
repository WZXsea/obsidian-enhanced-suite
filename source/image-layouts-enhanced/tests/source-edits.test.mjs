import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const load=async path=>{const bundle=await build({entryPoints:[fileURLToPath(new URL(path,import.meta.url))],bundle:true,format:'esm',platform:'node',write:false});return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);};
const {editLegacyGroup}=await load('../src/source-edits.ts');
const {normalizeOptions,parseGroups}=await load('../src/model.ts');
const group=(raw,from=0)=>({kind:'fence',from,to:from+raw.length,raw,body:'![[a.png]]\n',options:normalizeOptions({layout:'g'})});
test('legacy conversion preserves the following paragraph and independent group boundary',()=>{
  for(const eol of ['\n','\r\n']){
    const raw=['```image-layout-g','![[a.png]]','```',''].join(eol);
    const source='Intro'+eol+raw+'Following paragraph'+eol;
    const item=group(raw,('Intro'+eol).length);item.body='![[a.png]]'+eol;
    const edit=editLegacyGroup(source,item,{layout:'focus'});assert.ok(edit);
    const next=source.slice(0,edit.from)+edit.insert+source.slice(edit.to);
    assert.ok(next.endsWith('Following paragraph'+eol));assert.equal(parseGroups(next).length,1);
    assert.equal(parseGroups(next)[0].options.layout,'focus');
  }
});
test('unlocated, stale, unfinished or over-wide legacy ranges retain the source',()=>{
  const raw='```image-layout-g\n![[a.png]]\n```\n';
  assert.equal(editLegacyGroup(raw,{...group(raw),from:-1,to:-1},{}),null);
  assert.equal(editLegacyGroup('changed'+raw,group(raw),{}),null);
  assert.equal(editLegacyGroup(raw+'Important prose',group(raw+'Important prose'),{}),null);
  const broken='```image-layout-g\n![[a.png]]\n';assert.equal(editLegacyGroup(broken,group(broken),{}),null);
});
test('legacy unwrap changes only its own block and retains image source',()=>{
  const raw='~~~image-layout-g\n![[a.png]]\n~~~\n';
  const source=raw+'Footer';const edit=editLegacyGroup(source,group(raw),'unwrap');
  assert.equal(source.slice(0,edit.from)+edit.insert+source.slice(edit.to),'![[a.png]]\nFooter');
});
test('external configuration migration writes only the supplied identity and layout',()=>{
  const raw='```image-layout-g\n![[a.png]]\n```\n';
  const item=group(raw);item.options=normalizeOptions({layout:'g',fit:'cover',height:480});
  const change=editLegacyGroup(raw,item,{id:'a1b2c3d4e5',layout:'focus'},true);
  assert.equal(change.insert.split('\n')[0],'<!-- image-layouts: {"layout":"focus","id":"a1b2c3d4e5"} -->');
  assert.equal(parseGroups(change.insert)[0].body,item.body);
});
