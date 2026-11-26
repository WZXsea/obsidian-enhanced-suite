import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';

const require=createRequire(import.meta.url);
const project=fileURLToPath(new URL('../',import.meta.url));
const {EditorState,StateEffect,StateField}=require('@codemirror/state');
const editorLivePreviewField=StateField.define({create:()=>true,update:value=>value});
const changePath=StateEffect.define();
const editorInfoField=StateField.define({create:()=>({file:{path:'note.md'}}),update:(value,transaction)=>{
 for(const effect of transaction.effects)if(effect.is(changePath))return {file:{path:effect.value}};
 return value;
}});
class Base {}
class RenderChild {
 constructor(host){this.containerEl=host;this.cleanups=[];}
 register(cleanup){this.cleanups.push(cleanup);}
 load(){this.onload?.();}
 unload(){this.onunload?.();for(const cleanup of this.cleanups.splice(0))cleanup();}
}
const obsidian={Plugin:Base,MarkdownRenderChild:RenderChild,PluginSettingTab:Base,Modal:Base,
 editorLivePreviewField,editorInfoField};
const bundle=await build({stdin:{contents:readFileSync(process.env.GALLERY_SOURCE??new URL('../src/main.ts',import.meta.url),'utf8')+'\nexport {GalleryWidget,decorations,createGalleryField};',resolveDir:project+'src',loader:'ts'},
 bundle:true,format:'cjs',platform:'node',write:false,external:['obsidian','@codemirror/state','@codemirror/view']});
const module={exports:{}};
runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,console,URL,
 require:id=>id==='obsidian'?obsidian:require(id)});
const {default:Plugin,createGalleryField}=module.exports;
const markup=(id='height-test',body='![图](https://images.example/figure.png)')=>`<!-- image-layouts: {"id":"${id}","layout":"g"} -->\n${body}\n<!-- /image-layouts -->`;
const source=`前置正文\n\n${markup()}\n\n后续正文\n`;
const measurements=new WeakMap();

function fixture(text=source,plugin=new Plugin()){
 const observers=[],queue=[];
 class ResizeObserver {
  constructor(callback){this.callback=callback;this.targets=new Set();observers.push(this);}
  observe(host){this.targets.add(host);}
  disconnect(){this.targets.clear();}
  fire(){this.callback([...this.targets].map(target=>({target,contentRect:target.getBoundingClientRect()})));}
 }
 const win={ResizeObserver};
 const doc={defaultView:win,createElement(){
  const host={ownerDocument:doc,dataset:{},isConnected:true,addEventListener(){},removeEventListener(){},
   getBoundingClientRect(){const size=measurements.get(host);return {width:size.width,height:host.isConnected?size.height:0,top:0,bottom:size.height,left:0,right:size.width};},
   remove(){this.isConnected=false;}};
  measurements.set(host,{width:765,height:567.796875});return host;
 }};
 let mounted=0,destroyed=0;
 plugin.mount=(host,group,path,source,_component,context={group,path,source})=>{
  mounted++;plugin.hostGroups.set(host,context);
  plugin.navigationRenderers.set(host,{path,images:plugin.images(group,path,source),renderer:{}});
  return {destroy(){destroyed++;}};
 };
 plugin.app={metadataCache:{getFirstLinkpathDest:()=>null},vault:{getResourcePath:file=>file.path,getFiles:()=>[]}};
 const field=createGalleryField(plugin);
 let state=EditorState.create({doc:text,selection:{anchor:text.length},extensions:[editorLivePreviewField,editorInfoField,field]});
 const view={dom:{ownerDocument:doc},contentDOM:{clientWidth:765,getBoundingClientRect:()=>({width:765})},scrollDOM:{clientWidth:765},
  get state(){return state;},requestMeasure(spec){queue.push(()=>{const value=spec?.read?.(view);spec?.write?.(value,view);});}};
 const widgets=()=>{const result=[];state.field(field).decorations.between(0,state.doc.length,(_from,_to,deco)=>result.push(deco.spec.widget));return result;};
 const flush=()=>{for(let attempts=0;queue.length&&attempts<30;attempts++)queue.shift()();assert.equal(queue.length,0,'gallery measurement must settle');};
 const mount=(widget=widgets()[0],width=765,height=567.796875)=>{const host=widget.toDOM(view);measurements.set(host,{width,height});flush();for(const observer of observers)observer.fire();flush();return host;};
 return {plugin,field,view,observers,queue,widgets,flush,mount,
  get state(){return state;},update(spec){state=state.update(spec).state;return widgets();},
  counts:()=>({mounted,destroyed}),resize(host,width,height){measurements.set(host,{width,height});for(const observer of observers)observer.fire();flush();},
 };
}

test('a measured gallery reports its complete height and retains it after an Enter behind the group',()=>{
 const f=fixture(),first=f.widgets()[0],host=f.mount(first);assert.equal(first.estimatedHeight,567.796875);
 const [next]=f.update({changes:{from:f.state.doc.length,insert:'\n'}});
 assert.equal(first.eq(next),false,'the dispatched view synchronizes its latest source context');
 assert.equal(next.updateDOM(host,f.view),true,'an Enter reuses the mounted gallery');f.flush();
 assert.deepEqual(f.counts(),{mounted:1,destroyed:0});
 assert.equal(f.plugin.hostGroups.get(host).source,f.state.doc.toString());
 assert.equal(next.estimatedHeight,567.796875);
 f.resize(host,765,610);assert.equal(next.estimatedHeight,610,'the reused DOM measures into its current state');
});

test('inserting text before a gallery maps its range without discarding its measured height',()=>{
 const f=fixture(),first=f.widgets()[0],host=f.mount(first);
 const oldOffset=f.plugin.navigationRenderers.get(host).images[0].sourceOffset;
 const oldRange=f.state.field(f.field).groups[0],insert='新增正文\n\n';
 const [next]=f.update({changes:{from:0,insert}}),newRange=f.state.field(f.field).groups[0];
 assert.equal(newRange.from,oldRange.from+insert.length);assert.equal(newRange.to,oldRange.to+insert.length);
 assert.equal(next.updateDOM(host,f.view),true);f.flush();
 assert.equal(f.plugin.hostGroups.get(host).group.from,newRange.from);
 assert.equal(f.plugin.navigationRenderers.get(host).images[0].sourceOffset,oldOffset+insert.length);
 assert.equal(next.estimatedHeight,567.796875);
});

test('an undispatched state branch leaves original positions intact and late widget measurements reach its real successor',()=>{
 const f=fixture(),first=f.widgets()[0],host=f.mount(first),original=f.state;
 const originalRange=original.field(f.field).groups[0],previewText='仅预演的前置正文\n\n';
 const preview=original.update({changes:{from:0,insert:previewText}}).state;
 assert.equal(preview.field(f.field).groups[0].from,originalRange.from+previewText.length);
 assert.equal(original.field(f.field).heights.entries[0].from,originalRange.from);
 assert.equal(f.plugin.hostGroups.get(host).source,source,'an undispatched branch leaves mounted actions on the real source');
 const insert='实际插入\n';
 const [next]=f.update({changes:{from:0,insert}});
 assert.equal(f.state.field(f.field).groups[0].from,originalRange.from+insert.length);
 assert.equal(next.estimatedHeight,567.796875);
 measurements.set(host,{width:765,height:620});first.destroy(host);
 assert.equal(next.estimatedHeight,620,'a retiring DOM still owns the last size of the unchanged gallery');
});

test('duplicate gallery IDs and bodies keep separate height entries when preceding text moves both',()=>{
 const f=fixture(`开头\n\n${markup('repeat')}\n\n正文\n\n${markup('repeat')}\n\n结尾\n`);
 const [first,second]=f.widgets();f.mount(first,765,380);f.mount(second,765,610);
 const next=f.update({changes:{from:0,insert:'新增\n'}});
 assert.deepEqual(next.map(widget=>widget.estimatedHeight),[380,610]);
});

test('layout and image-reference edits invalidate the previous content height',()=>{
 for(const [before,after]of [['"layout":"g"','"layout":"focus"'],['figure.png','changed.png']]){
  const f=fixture(),first=f.widgets()[0],host=f.mount(first);const from=f.state.doc.toString().indexOf(before);
  const [next]=f.update({changes:{from,to:from+before.length,insert:after}});
  assert.notEqual(next.estimatedHeight,567.796875);
  assert.equal(next.updateDOM(host,f.view),false,'changed content rebuilds the gallery');
 }
});

test('an external image-reference definition changes the height signature while group raw text stays equal',()=>{
 const text=`开头\n\n${markup('ref','![图][figure]')}\n\n[figure]: https://images.example/one.png\n`;
 const f=fixture(text),first=f.widgets()[0],host=f.mount(first);const raw=f.state.field(f.field).groups[0].raw;
 const from=text.indexOf('one.png'),[next]=f.update({changes:{from,to:from+'one.png'.length,insert:'two.png'}});
 assert.equal(f.state.field(f.field).groups[0].raw,raw);assert.notEqual(next.estimatedHeight,567.796875);
 assert.equal(next.updateDOM(host,f.view),false,'a resolved reference change rebuilds the gallery');
});

test('a configuration revision invalidates estimates without editing Markdown',()=>{
 const f=fixture(),first=f.widgets()[0];f.mount(first);f.plugin.configurationRevision++;
 const [next]=f.update({});assert.notEqual(next.estimatedHeight,567.796875);assert.equal(f.state.doc.toString(),source);
});

test('independent editor states keep measured gallery heights isolated even for the same plugin and note',()=>{
 const plugin=new Plugin(),first=fixture(source,plugin),second=fixture(source,plugin);
 first.mount();assert.notEqual(second.widgets()[0].estimatedHeight,567.796875);
 second.mount(second.widgets()[0],400,820);
 assert.equal(first.widgets()[0].estimatedHeight,567.796875);assert.equal(second.widgets()[0].estimatedHeight,820);
});

test('switching the editor to another note discards heights associated with its previous path',()=>{
 const f=fixture();f.mount();
 const [next]=f.update({effects:changePath.of('other.md')});
 assert.notEqual(next.estimatedHeight,567.796875);
});

test('width changes record a new height while preserving the previous width measurement',()=>{
 const f=fixture(),widget=f.widgets()[0],host=f.mount(widget);
 f.resize(host,420,800);assert.equal(widget.estimatedHeight,800);
 const heights=f.state.field(f.field).heights;
 heights.width=765;assert.equal(widget.estimatedHeight,567.796875);
 heights.width=420;assert.equal(widget.estimatedHeight,800);
 f.view.scaleX=f.view.scaleY=2;f.resize(host,1530,1135.59375);assert.equal(widget.estimatedHeight,567.796875);
});

test('offscreen widget destruction disconnects its observer and preserves the last measured height',()=>{
 const f=fixture(),widget=f.widgets()[0],host=f.mount(widget);widget.destroy(host);
 assert.ok(f.observers.length>0);assert.ok(f.observers.every(observer=>observer.targets.size===0));
 f.resize(host,765,0);assert.equal(widget.estimatedHeight,567.796875);assert.equal(f.counts().destroyed,1);
 const [next]=f.update({changes:{from:f.state.doc.length,insert:'\n'}});assert.equal(next.estimatedHeight,567.796875);
});

test('a delayed measurement from a destroyed widget leaves the replacement estimate intact',()=>{
 const f=fixture(),widget=f.widgets()[0],host=f.mount(widget);
 measurements.set(host,{width:765,height:999});for(const observer of f.observers)observer.fire();
 const before='"layout":"g"',from=f.state.doc.toString().indexOf(before);
 const [next]=f.update({changes:{from,to:from+before.length,insert:'"layout":"focus"'}}),estimate=next.estimatedHeight;
 widget.destroy(host);f.flush();
 assert.equal(next.estimatedHeight,estimate);assert.notEqual(next.estimatedHeight,999);
 assert.ok(f.observers.every(observer=>observer.targets.size===0));assert.equal(f.counts().destroyed,1);
});
