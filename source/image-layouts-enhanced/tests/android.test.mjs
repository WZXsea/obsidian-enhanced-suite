import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';

async function loadGestures(path){
 const output=await build({entryPoints:[fileURLToPath(path)],bundle:true,format:'cjs',write:false});
 const module={exports:{}};runInNewContext(output.outputFiles[0].text,{module,exports:module.exports,URL});return module.exports;
}
for(const name of ['../src/gestures.ts','../../image-toolkit-upgraded/src/gestures.ts']){
 const {ImageGestures,attachImageGestures}=await loadGestures(new URL(name,import.meta.url));
 test(`${name}: pinch keeps focal point stationary and rebases to remaining finger`,()=>{
  const g=new ImageGestures();g.down(1,-50,0);g.down(2,50,0);g.move(1,-100,0);g.move(2,100,0);
  assert.equal(g.scale,2);assert.equal(g.x,0);
  g.up(1);g.move(2,120,15);assert.equal(g.x,20);assert.equal(g.y,15);assert.equal(g.scale,2);
  g.up(2);assert.equal(g.move(2,999,999),false);g.reset();assert.equal(g.scale,1);assert.equal(g.x,0);
 });
 test(`${name}: zoom limits and cancellation retain a valid next gesture`,()=>{
  const g=new ImageGestures();g.zoom(999);assert.equal(g.scale,20);g.zoom(.0001);assert.equal(g.scale,.1);
  g.reset();g.down(2,1,2);g.move(2,11,12);g.up(2);g.down(3,0,0);g.move(3,5,5);assert.equal(g.x,15);assert.equal(g.y,15);
 });
 test(`${name}: pointercancel and viewer disposal release all listeners`,()=>{
  const listeners=new Map(),captures=new Set();let rendered=0;
  const stage={getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k),setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};
  const g=new ImageGestures(),dispose=attachImageGestures(stage,g,()=>rendered++);
  const event=(id,x,y)=>({pointerId:id,button:0,clientX:x,clientY:y,preventDefault(){}});
  listeners.get('pointerdown')(event(1,10,10));listeners.get('pointermove')(event(1,20,30));assert.equal(rendered,1);assert.equal(g.x,10);assert.equal(g.y,20);
  listeners.get('pointercancel')(event(1,20,30));assert.equal(captures.size,0);dispose();assert.equal(listeners.size,0);
 });
 test(`${name}: detached or inactive pointer capture leaves no pending gesture`,()=>{
  const listeners=new Map();
  const stage={getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key),setPointerCapture:()=>{throw new Error('inactive pointer');},hasPointerCapture:()=>false};
  const g=new ImageGestures(),dispose=attachImageGestures(stage,g,()=>{});
  listeners.get('pointerdown')({pointerId:1,button:0,clientX:10,clientY:10,preventDefault(){}});
  assert.equal(g.move(1,20,20),false);dispose();assert.equal(listeners.size,0);
 });
}

test('Android evaluates actual Toolkit bundle with only Obsidian as an allowed module',()=>{
 const bundle=readFileSync(new URL('../../image-toolkit-upgraded/main.js',import.meta.url),'utf8');
 const modules=[];class Plugin{};class PluginSettingTab{};class Modal{};
 const obsidian={Plugin,PluginSettingTab,Modal,Platform:{isMobile:true},moment:{locale:()=> 'en'},getLanguage:()=> 'en',debounce:fn=>fn};
 const module={exports:{}};
 runInNewContext(bundle,{module,exports:module.exports,require:id=>{modules.push(id);assert.equal(id,'obsidian','Android must load without Node/Electron modules');return obsidian;},navigator:{language:'en'},window:{},console});
 assert.equal(typeof module.exports,'function');assert.ok(modules.length>0);
 assert.equal(JSON.parse(readFileSync(new URL('../../image-toolkit-upgraded/manifest.json',import.meta.url))).isDesktopOnly,false);
});

const {pickMobileImageIndex,mobileDomImages,rotatedImageBounds,sameImageSource}=await loadGestures(new URL('../../image-toolkit-upgraded/src/mobile-images.ts',import.meta.url));
test('mobile source order chooses exact repeated source line and retains remote query identities',()=>{
 const images=[{src:'https://host/repeat.png',line:2},{src:'https://host/other.png',line:4},{src:'https://host/repeat.png',line:8}];
 assert.equal(pickMobileImageIndex(images,'https://host/repeat.png',8),2);
 assert.equal(pickMobileImageIndex(images,'https://host/repeat.png',undefined,1),2);
 assert.equal(pickMobileImageIndex([{src:'same',line:2},{src:'same',line:2}],'same',2,1),1);
 assert.equal(pickMobileImageIndex(images,'https://host/missing.png',0),-1);
 assert.equal(sameImageSource('https://host/image?a=1','https://host/image?a=2'),false);
 assert.equal(sameImageSource('app://vault/image.png?t=1','app://vault/image.png?t=2'),true);
});
test('DOM fallback excludes thumbnail/UI/hidden images and retains genuine repeated figures',()=>{
 const image=(src,{ui=false,hidden=false}={})=>({src,alt:'',closest:()=>ui||hidden?{}:null,getBoundingClientRect:()=>({width:100,height:80})});
 const first=image('a'),thumb=image('b',{ui:true}),hidden=image('c',{hidden:true}),last=image('a');
 const root={querySelectorAll:()=>[first,thumb,hidden,last]};
 assert.deepEqual(Array.from(mobileDomImages(root,last)),[first,last]);
 assert.deepEqual(Array.from(mobileDomImages(root,thumb)),[thumb]);
});
test('quarter-turn fitting swaps viewport axes at 360 and 412 pixel phone widths',()=>{
 for(const width of [360,412]){
  const vertical=rotatedImageBounds(width,500,0),horizontal=rotatedImageBounds(width,500,90);
  assert.equal(vertical.width,width);assert.equal(vertical.height,500);assert.equal(horizontal.width,500);assert.equal(horizontal.height,width);
  assert.deepEqual(rotatedImageBounds(width,500,270),horizontal);
 }
});
