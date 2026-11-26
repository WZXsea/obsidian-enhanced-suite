import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';

const built=await build({entryPoints:['src/order.ts'],bundle:true,write:false,format:'cjs'});
const module={exports:{}};
runInNewContext(built.outputFiles[0].text,{module,exports:module.exports});
const {imageOrderKeys,orderImages,moveImageOrder}=module.exports;
const layoutsBuilt=await build({entryPoints:['src/layouts.ts'],bundle:true,write:false,format:'cjs'});
const layouts={exports:{}};
runInNewContext(layoutsBuilt.outputFiles[0].text,{module:layouts,exports:layouts.exports});
const {getStageThumbnailOrder}=layouts.exports;
const image=(target,sourceOffset,alt=target)=>({src:`https://images.example/${target}`,target,alt,line:sourceOffset/10,sourceOffset});
const source=()=>[image('a.png',10,'图甲'),image('b.png',20,'图乙'),image('c.png',30,'图丙')];
const plain=value=>JSON.parse(JSON.stringify(value));
const targets=images=>images.map(image=>image.target);

test('source order receives stable reference keys while input objects stay unchanged',()=>{
  const images=source(),before=JSON.stringify(images),ordered=orderImages(images,[]);
  assert.deepEqual(plain(imageOrderKeys(images)),['["a.png",0]','["b.png",0]','["c.png",0]']);
  assert.deepEqual(plain(targets(ordered)),['a.png','b.png','c.png']);
  assert.equal(JSON.stringify(images),before);assert.notEqual(ordered[0],images[0]);
});

test('a thumbnail can move forward, backward or remain at its current position',()=>{
  const images=orderImages(source(),[]);
  const forward=orderImages(source(),moveImageOrder(images,0,2));
  assert.deepEqual(plain(targets(forward)),['b.png','c.png','a.png']);
  const backward=orderImages(source(),moveImageOrder(forward,2,0));
  assert.deepEqual(plain(targets(backward)),['a.png','b.png','c.png']);
  assert.deepEqual(plain(moveImageOrder(images,1,1)),plain(imageOrderKeys(images)));
});

test('duplicate image URLs retain their independent captions and positions through repeated moves',()=>{
  const raw=[image('repeat.png',10,'第一次'),image('other.png',20,'其他'),image('repeat.png',30,'第二次')];
  const moved=orderImages(raw,moveImageOrder(orderImages(raw,[]),2,0));
  assert.deepEqual(plain(moved.map(({alt,sourceOffset})=>({alt,sourceOffset}))),[
    {alt:'第二次',sourceOffset:30},{alt:'第一次',sourceOffset:10},{alt:'其他',sourceOffset:20},
  ]);
  const again=orderImages(raw,moveImageOrder(moved,0,1));
  assert.deepEqual(plain(again.map(image=>image.alt)),['第一次','第二次','其他']);
});

test('new references append in source order and removed or repeated saved keys are skipped',()=>{
  const first=orderImages(source(),[]),saved=moveImageOrder(first,2,0);
  const raw=[image('a.png',10),image('new-one.png',15),image('c.png',30),image('new-two.png',35)];
  const restored=orderImages(raw,[...saved,saved[0],'["missing.png",0]']);
  assert.deepEqual(plain(targets(restored)),['c.png','a.png','new-one.png','new-two.png']);
  assert.equal(restored.length,raw.length);
});

test('serializing the configuration and recreating images restores the exact displayed order',()=>{
  const first=orderImages(source(),[]),saved=JSON.parse(JSON.stringify({imageOrder:moveImageOrder(first,1,0)}));
  const restored=orderImages(source(),saved.imageOrder);
  assert.deepEqual(plain(targets(restored)),['b.png','a.png','c.png']);
  assert.deepEqual(plain(restored.map(image=>image.alt)),['图乙','图甲','图丙']);
  assert.deepEqual(plain(imageOrderKeys(restored)),saved.imageOrder);
});

test('preceding source edits and folder images with shared offsets retain stable ordering',()=>{
  const raw=[image('repeat.png',10),image('repeat.png',30),image('folder/a.png',0),image('folder/b.png',0)];
  const saved=moveImageOrder(orderImages(raw,[]),3,0);
  const shifted=raw.map(item=>({...item,line:item.line+5,sourceOffset:item.sourceOffset+50}));
  const restored=orderImages(shifted,saved);
  assert.deepEqual(plain(targets(restored)),['folder/b.png','repeat.png','repeat.png','folder/a.png']);
  assert.deepEqual(plain(restored.map(image=>image.sourceOffset)),[50,60,80,50]);
});

test('invalid indexes raise a range error and preserve the current list',()=>{
  const images=orderImages(source(),[]),before=JSON.stringify(images);
  for(const [from,to]of [[-1,0],[0,-1],[3,0],[0,3],[0.5,1],[1,NaN],[Infinity,0]]){
    assert.throws(()=>moveImageOrder(images,from,to),error=>error.name==='RangeError');
  }
  assert.throws(()=>moveImageOrder([],0,0),error=>error.name==='RangeError');
  assert.equal(JSON.stringify(images),before);
});

test('swapped stage thumbnails reorder by their visual slots while retaining the main image slot',()=>{
  const images=orderImages([...source(),image('d.png',40)],[]),visible=[1,0,3];
  const sidebar=list=>getStageThumbnailOrder(list.length,2).map(index=>list[index].target);
  const first=orderImages(images,moveImageOrder(images,0,1,visible));
  assert.deepEqual(plain(sidebar(first)),['a.png','b.png','d.png']);
  const second=orderImages(images,moveImageOrder(images,3,1,visible));
  assert.deepEqual(plain(sidebar(second)),['d.png','b.png','a.png']);
  assert.deepEqual(plain(targets(second)),['b.png','d.png','c.png','a.png']);
  assert.equal(second[2].orderKey,images[2].orderKey);
  const full=orderImages(images,moveImageOrder(images,3,1,[0,1,2,3]));
  assert.deepEqual(plain(targets(full)),['a.png','d.png','b.png','c.png']);
  for(const invalid of [[1,1,3],[1,0,4],[1,0,2.5],[1,0],[0,3]]){
    assert.throws(()=>moveImageOrder(images,3,1,invalid),error=>error.name==='RangeError');
  }
  assert.deepEqual(visible,[1,0,3]);
});
