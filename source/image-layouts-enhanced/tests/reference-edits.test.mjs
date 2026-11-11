import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
async function load(path){const result=await build({entryPoints:[fileURLToPath(new URL(path,import.meta.url))],bundle:true,write:false,format:'esm',platform:'node'});return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);}
const {buildReferenceBodyEdit}=await load('../src/reference-edits.ts');
const {parseGroups,normalizeOptions}=await load('../src/model.ts');
const wrap=(body,id='gallery',layout='g',eol='\n')=>[`<!-- image-layouts: {"id":"${id}","layout":"${layout}"} -->`,body,'<!-- /image-layouts -->',''].join(eol);
const apply=(source,edit)=>source.slice(0,edit.from)+edit.insert+source.slice(edit.to);
function legacy(raw,body,from=0){const bodyFrom=from+raw.indexOf(body);return {kind:'fence',raw,from,to:from+raw.length,body,bodyFrom,bodyTo:bodyFrom+body.length,options:normalizeOptions({layout:'g'}),startLine:0,endLine:8};}

test('replaces the complete native body while keeping all outer bytes and current configuration',()=>{
  const source='前文\n'+wrap('![[a.png|300]]\n图注\n![B][ref]\n[ref]: b.png\n<img src="c.png" width="200">')+'后文\n';
  const snapshot=parseGroups(source)[0];
  const replacement='![[a.png|500]]\n图注😀\n![B][ref]\n[ref]: b.png\n<img src="c.png" width="200">';
  const edit=buildReferenceBodyEdit(source,snapshot,snapshot.body,replacement);assert.ok(edit);
  assert.equal(edit.from,snapshot.bodyFrom);assert.equal(edit.to,snapshot.bodyTo);
  assert.equal(edit.insert,replacement+'\n');
  const changed=apply(source,edit);assert.equal(changed.slice(0,edit.from),source.slice(0,edit.from));
  assert.equal(changed.slice(edit.from+edit.insert.length),source.slice(edit.to));assert.equal(parseGroups(changed).length,1);
});

test('merges edits to preceding prose, following prose, another group and this group header',()=>{
  const original='前文\n'+wrap('![[a.png]]')+wrap('![[other.png]]','other')+'后文';
  const snapshot=parseGroups(original)[0];
  const current=original.replace('前文','新前文😀').replace('后文','新后文').replace('other.png','updated.png').replace('"layout":"g"','"layout":"focus"');
  const edit=buildReferenceBodyEdit(current,snapshot,snapshot.body,'![[new.png]]');assert.ok(edit);
  const changed=apply(current,edit);assert.equal(parseGroups(changed)[0].options.layout,'focus');
  assert.ok(changed.startsWith('新前文😀\n'));assert.ok(changed.endsWith('新后文'));assert.ok(changed.includes('updated.png'));
});

test('concurrent changes to the edited body and removed groups are protected',()=>{
  const original=wrap('![[a.png]]'),snapshot=parseGroups(original)[0];
  assert.equal(buildReferenceBodyEdit(original.replace('a.png','edited.png'),snapshot,snapshot.body,'![[new.png]]'),null);
  assert.equal(buildReferenceBodyEdit('![[a.png]]',snapshot,snapshot.body,'![[new.png]]'),null);
});

test('UTF16 offsets and local CRLF lines remain intact when pasted text uses LF',()=>{
  const source='前文😀\r\n'+wrap('![[图😀.png]]','gallery','g','\r\n')+'后文\r\n';const snapshot=parseGroups(source)[0];
  const edit=buildReferenceBodyEdit(source,snapshot,snapshot.body,'![[新的😀.png]]\n图注\n');assert.ok(edit);
  assert.equal(edit.from,source.indexOf('![[图'));assert.equal(edit.insert,'![[新的😀.png]]\r\n图注\r\n');
  const changed=apply(source,edit);assert.equal(changed.replaceAll('\r\n','').includes('\n'),false);assert.equal(parseGroups(changed)[0].body,edit.insert);
});

test('empty body remains a valid marker pair',()=>{
  const source=wrap('![[a.png]]'),snapshot=parseGroups(source)[0];const edit=buildReferenceBodyEdit(source,snapshot,snapshot.body,'');assert.ok(edit);
  const next=parseGroups(apply(source,edit));assert.equal(next.length,1);assert.equal(next[0].body,'');
});

test('nested opening and closing markers are rejected even in examples',()=>{
  const source=wrap('![[a.png]]'),snapshot=parseGroups(source)[0];
  for(const value of ['<!-- image-layouts: {"layout":"g"} -->','<!-- /image-layouts -->','```html\n<!-- /image-layouts -->\n```']){
    assert.equal(buildReferenceBodyEdit(source,snapshot,snapshot.body,value),null);
  }
});

test('unfinished Markdown and HTML contexts are rejected; balanced examples retain their exact content',()=>{
  const source=wrap('![[a.png]]'),snapshot=parseGroups(source)[0];
  for(const value of ['```markdown\n![[x.png]]','<!-- unfinished','<pre>example'])assert.equal(buildReferenceBodyEdit(source,snapshot,snapshot.body,value),null);
  const replacement='```markdown\n![[example.png]]\n```\n<!-- note -->\n![[real.png]]';
  const edit=buildReferenceBodyEdit(source,snapshot,snapshot.body,replacement);assert.ok(edit);assert.equal(edit.insert,replacement+'\n');
});

test('legacy imagesBody editing preserves YAML, the fence, CRLF and surrounding prose',()=>{
  const body='![[a.png]]\r\n图注\r\n';const raw='````image-layout-g\r\n---\r\nheight: 420\r\ncaption: 保留\r\n---\r\n'+body+'````\r\n';
  const original='前文😀\r\n'+raw+'后文',snapshot=legacy(raw,body,'前文😀\r\n'.length),current='前置新增\r\n'+original;
  const edit=buildReferenceBodyEdit(current,snapshot,body,'![[b.png]]\n新图注');assert.ok(edit);assert.equal(edit.insert,'![[b.png]]\r\n新图注\r\n');
  const changed=apply(current,edit);assert.ok(changed.includes('---\r\nheight: 420\r\ncaption: 保留\r\n---\r\n'));assert.ok(changed.endsWith('````\r\n后文'));
});

test('legacy matching closing fences are rejected while shorter and other-character runs are safe',()=>{
  const body='![[a.png]]\n',raw='~~~~image-layout-g\n'+body+'~~~~\n',snapshot=legacy(raw,body);
  for(const value of ['~~~~','图注\n ~~~~~  \n后续'])assert.equal(buildReferenceBodyEdit(raw,snapshot,body,value),null);
  const edit=buildReferenceBodyEdit(raw,snapshot,body,'~~~\n```\n![[b.png]]');assert.ok(edit);assert.equal(edit.insert,'~~~\n```\n![[b.png]]\n');
});

test('legacy editing cannot consume configuration or reinterpret a new YAML preamble',()=>{
  const body='![[a.png]]\n',raw='```image-layout-g\n---\nheight: 420\n---\n'+body+'```\n';
  const snapshot=legacy(raw,body),wrongBody='---\nheight: 420\n---\n'+body,wrong=legacy(raw,wrongBody);
  assert.equal(buildReferenceBodyEdit(raw,wrong,wrongBody,'![[b.png]]'),null);
  const plain='```image-layout-g\n'+body+'```\n';
  assert.equal(buildReferenceBodyEdit(plain,legacy(plain,body),body,'---\nheight: 800\n---\n![[b.png]]'),null);
  assert.ok(buildReferenceBodyEdit(raw,snapshot,body,'![[b.png]]'));
});

test('a legacy body ending before its original newline retains that newline',()=>{
  const body='![[a.png]]',raw='```image-layout-g\n'+body+'\n```\n',snapshot=legacy(raw,body);
  const edit=buildReferenceBodyEdit(raw,snapshot,body,'![[b.png]]');assert.ok(edit);assert.equal(edit.insert,'![[b.png]]');
  assert.equal(apply(raw,edit),'```image-layout-g\n![[b.png]]\n```\n');
});

test('identical moved duplicates and forged partial legacy ranges are protected',()=>{
  const block=wrap('![[a.png]]','same'),source=block+block,snapshot=parseGroups(source)[1];
  assert.equal(buildReferenceBodyEdit('前置\n'+source,snapshot,snapshot.body,'![[b.png]]'),null);
  const body='图注\n![[a.png]]\n',raw='```image-layout-g\n'+body+'```\n',partial=legacy(raw,'![[a.png]]\n');
  assert.equal(buildReferenceBodyEdit(raw,partial,partial.body,'![[b.png]]'),null);
});
