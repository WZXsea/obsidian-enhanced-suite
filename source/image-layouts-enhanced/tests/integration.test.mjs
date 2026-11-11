import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const opened = [];
class MarkdownView {
  constructor(path, contains = () => false) { this.file = {path}; this.containerEl = {contains}; }
}
class Modal {
  constructor(app) { this.app = app; }
  open() { opened.push(this); }
  onClose() {}
  close() { this.onClose(); }
}
class Plugin {
  constructor(app) { this.app = app; }
}
const obsidian = {
  MarkdownView, Modal, Plugin, Platform:{isMobile:false},
  debounce: callback => Object.assign(callback, {cancel() {}}),
};
const warnings = [];
async function load(entry) {
  const output = await build({entryPoints:[fileURLToPath(entry)],bundle:true,format:'cjs',platform:'node',external:['obsidian'],write:false});
  const module = {exports:{}};
  runInNewContext(output.outputFiles[0].text, {module,exports:module.exports,require:id => {
    assert.equal(id,'obsidian'); return obsidian;
  },URL,console:{warn:(...args)=>warnings.push(args)}});
  return module.exports;
}
const {openGalleryImage,getToolkitIntegrationStatus} = await load(new URL('../src/integration.ts',import.meta.url));
const {default: NoteImageStage} = await load(new URL('../../image-toolkit-upgraded/src/main.ts',import.meta.url));
const image = (offset,src='https://host/one.png') => ({src,alt:'Figure',target:src,line:offset,sourceOffset:offset});
const origin = src => ({src,isConnected:true,ownerDocument:{baseURI:'app://obsidian/'}});
function appFor(toolkit,leaves=[]) {
  const activated = [];
  return {
    plugins:{getPlugin:id=>id==='obsidian-image-toolkit'?toolkit:undefined},
    workspace:{getLeavesOfType:()=>leaves,getMostRecentLeaf:()=>leaves[0],setActiveLeaf:(...args)=>activated.push(args)},
    activated,
  };
}

test('Toolkit bridge chooses the origin pane and preserves repeated source occurrences with an exact index',()=>{
  const img=origin('https://host/one.png');const calls=[];
  const wrongPane={view:new MarkdownView('article.md')};
  const rightPane={view:new MarkdownView('article.md',node=>node===img)};
  const toolkit={manifest:{version:'1.4.13'},noteImageStage:{imageLayoutBridgeVersion:1,openGallery(...args){calls.push(args);return true;}}};
  const app=appFor(toolkit,[wrongPane,rightPane]);
  const images=[image(10),image(20),image(30)];
  assert.equal(openGalleryImage(app,images,2,img,'article.md'),'toolkit');
  assert.equal(app.activated[0][0],rightPane);
  assert.equal(app.activated[0][1].focus,false);
  assert.equal(calls[0][0].length,3);
  assert.equal(calls[0][1],2);
  assert.equal(calls[0][2],img);
  assert.equal(calls[0][3],'article.md');
  assert.equal(calls[0][0][0].sourceOffset,undefined);
});

test('disabled and incompatible Toolkit use an independent viewer and retain the requested valid image',()=>{
  const images=[{...image(0),missing:true},image(1),image(2,'https://host/two.png')];
  const app=appFor(undefined);
  assert.equal(getToolkitIntegrationStatus(app).reason,'disabled');
  assert.equal(openGalleryImage(app,images,2),'fallback');
  assert.equal(opened.at(-1).images.length,2);
  assert.equal(opened.at(-1).index,1);
  assert.equal(getToolkitIntegrationStatus(appFor({manifest:{version:'1.4.3'},noteImageStage:{imageLayoutBridgeVersion:2}})).reason,'adapter-unavailable');
});

test('missing source pane, detached origin, and stale origin image retain safe fallback',()=>{
  let attempts=0;
  const toolkit={noteImageStage:{imageLayoutBridgeVersion:1,openGallery(){attempts++;return true;}}};
  const app=appFor(toolkit,[{view:new MarkdownView('other.md')}]);
  const img=origin('https://host/one.png');
  assert.equal(openGalleryImage(app,[image(0)],0,img,'article.md'),'fallback');
  assert.equal(openGalleryImage(app,[image(0)],0,{...img,isConnected:false},'other.md'),'fallback');
  assert.equal(openGalleryImage(app,[image(0)],0,origin('https://host/stale.png'),'other.md'),'fallback');
  assert.equal(attempts,0);
});

test('bridge rejection and exceptions preserve the click through the independent viewer',()=>{
  const img=origin('https://host/one.png');const leaf={view:new MarkdownView('article.md',()=>true)};
  for(const openGallery of [()=>false,()=>{throw new Error('shape changed');}]) {
    const app=appFor({noteImageStage:{imageLayoutBridgeVersion:1,openGallery}},[leaf]);
    assert.equal(openGalleryImage(app,[image(0)],0,img,'article.md'),'fallback');
  }
  assert.equal(warnings.length,1);
});

test('Toolkit explicit bridge snapshots only the gallery group and rebuilds its navigation after successful open',()=>{
  const img=origin('https://host/one.png');let clicked=null;let popup=false;let rebuilds=0;
  const app={workspace:{getActiveViewOfType:()=>new MarkdownView('main-window.md'),getLeavesOfType:()=>[{view:new MarkdownView('article.md',node=>node===img)}]}};
  const stage=new NoteImageStage(app);
  stage.host={settings:{},containerFactory:{getContainer:()=>({
    renderContainer:node=>{clicked=node;popup=true;},getLastClickedImgEl:()=>clicked,getActiveImg:()=>({popup}),
    removeGalleryNavbar:()=>rebuilds++,renderGalleryNavbar:()=>rebuilds++,
  })}};
  const images=[image(0),image(1),image(2)];
  assert.equal(stage.imageLayoutBridgeVersion,1);
  assert.equal(stage.openGallery(images,2,img,'article.md'),true);
  assert.equal(stage.galleryContext.index,2);
  assert.equal(stage.galleryContext.images.length,3);
  assert.equal(stage.galleryContext.images[0].sourceOffset,undefined);
  images[0].alt='Edited later';
  assert.equal(stage.galleryContext.images[0].alt,'Figure');
  assert.equal(rebuilds,2);
});

test('Toolkit bridge checks source identity and viewer success, clearing context on viewer errors',()=>{
  const img=origin('https://host/one.png');
  const app={workspace:{getActiveViewOfType:()=>new MarkdownView('main-window.md'),getLeavesOfType:()=>[{view:new MarkdownView('article.md',node=>node===img)}]}};
  const stage=new NoteImageStage(app);
  stage.host={settings:{},containerFactory:{getContainer:()=>({
    renderContainer:()=>{},getLastClickedImgEl:()=>null,getActiveImg:()=>null,
  })}};
  assert.equal(stage.openGallery([image(0)],0,img,'article.md'),false);
  assert.equal(stage.galleryContext,null);
  assert.equal(stage.openGallery([image(0)],0,img,'other.md'),false);
  assert.equal(stage.openGallery([image(0)],-1,img,'article.md'),false);
  stage.host.containerFactory.getContainer=()=>({renderContainer:()=>{throw new Error('closed pane');},getLastClickedImgEl:()=>img,getActiveImg:()=>({popup:true})});
  assert.throws(()=>stage.openGallery([image(0)],0,img,'article.md'),/closed pane/);
  assert.equal(stage.galleryContext,null);
});

test('Toolkit bridge recovers its origin container even while the main window keeps another active note',()=>{
  const img=origin('https://host/one.png');let clicked=null;let recoveries=0;
  const app={workspace:{getActiveViewOfType:()=>new MarkdownView('main-window.md'),getLeavesOfType:()=>[{view:new MarkdownView('article.md',node=>node===img)}]}};
  const stage=new NoteImageStage(app);
  stage.host={settings:{},containerFactory:{getContainer:()=>null},ensureImageContainer:node=>{
    assert.equal(node,img);recoveries++;
    return {renderContainer:node=>clicked=node,getLastClickedImgEl:()=>clicked,getActiveImg:()=>({popup:true})};
  }};
  assert.equal(stage.openGallery([image(0)],0,img,'article.md'),true);
  assert.equal(recoveries,1);
});

const toolkitRoot = new URL('../../image-toolkit-upgraded/',import.meta.url);
const config = readFileSync(new URL('esbuild.config.mjs',toolkitRoot),'utf8').replace(/^import .*$/gm,'');
const outputs = new Map();
await new Function('build','readFileSync','writeFileSync',`return(async()=>{${config}})();`)(
  options => build({...options,entryPoints:options.entryPoints.map(path=>fileURLToPath(new URL(path,toolkitRoot)))}),
  (path,encoding) => readFileSync(new URL(path,toolkitRoot),encoding),
  (path,value) => outputs.set(path,value),
);
const toolkitModule = {exports:{}};
const cancelledIntervals=[];
const cancelledTimeouts=[];
runInNewContext(outputs.get('main.js'),{
  module:toolkitModule,exports:toolkitModule.exports,
  require:id=>id==='crypto'?{randomUUID}:{...obsidian,PluginSettingTab:class{},moment:{locale:()=> 'en'}},
  URL,console,clearInterval:value=>cancelledIntervals.push(value),clearTimeout:value=>cancelledTimeouts.push(value),
});

test('Toolkit generated popout adapter replaces a stale body UUID with a registered container and reuses it',()=>{
  const Toolkit=toolkitModule.exports;const toolkit=new Toolkit({});const events=[];
  toolkit.settings={viewMode:'Normal'};
  toolkit.refreshViewTrigger=doc=>events.push(doc);
  const attributes=new Map([['data-oit-event','previous-plugin-uuid']]);
  const body={classList:{contains:value=>value==='is-popout-window'},getAttribute:key=>attributes.get(key),setAttribute:(key,value)=>attributes.set(key,value)};
  const doc={body};body.ownerDocument=doc;
  const img={isConnected:true,ownerDocument:doc,matchParent:selector=>selector==='body'?body:null};
  const container=toolkit.ensureImageContainer(img);
  assert.equal(container.constructor.name,'NormalContainerView');
  assert.equal(toolkit.containerFactory.getContainer(img),container);
  assert.equal(toolkit.containerFactory.getPopoutContainers().size,1);
  assert.equal(attributes.get('data-oit-event'),'previous-plugin-uuid');
  assert.equal(toolkit.ensureImageContainer(img),container);
  assert.equal(events.length,1);
  assert.equal(events[0],doc);
  assert.ok(toolkit.imageLayoutDocuments.has(doc));
  toolkit.containerFactory.clearAll();toolkit.settings.viewMode='Pin';
  assert.equal(toolkit.ensureImageContainer(img).constructor.name,'PinContainerView');
});

test('Toolkit generated Pin close clears its gallery context while retaining sessions when another pin closes',()=>{
  const Toolkit=toolkitModule.exports;const toolkit=new Toolkit({});
  toolkit.settings={viewMode:'Pin'};toolkit.refreshViewTrigger=()=>{};
  const body={classList:{contains:()=>true},getAttribute:()=> 'pin-popout',setAttribute(){}};
  const doc={body};body.ownerDocument=doc;
  const first={ownerDocument:doc,matchParent:()=>body};
  const other={ownerDocument:doc,matchParent:()=>body};
  const container=toolkit.ensureImageContainer(first);
  const galleryPin={targetOriginalImgEl:first,imgViewEl:{},popup:true,mtime:1,zIndex:1};
  const otherPin={targetOriginalImgEl:other,imgViewEl:{},popup:true,mtime:1,zIndex:2};
  const context={origin:first};toolkit.noteImageStage={galleryContext:context};
  container.imgInfo.oitContainerEl={style:{setProperty(){}}};
  container.imgInfo.imgList=[galleryPin,otherPin];
  container.imgGlobalStatus.activeImg=galleryPin;
  container.renderImgView=()=>{};container.addOrRemoveEvents=()=>{};
  container.closeContainerView({target:body});
  assert.equal(toolkit.noteImageStage.galleryContext,context);
  assert.equal(galleryPin.popup,true);
  container.closeContainerView(null,otherPin);
  assert.equal(toolkit.noteImageStage.galleryContext,context);
  assert.equal(otherPin.popup,false);
  container.closeContainerView();
  assert.equal(toolkit.noteImageStage.galleryContext,null);
  assert.equal(galleryPin.popup,false);
  assert.equal(container.imgGlobalStatus.popup,false);
});

test('Toolkit generated container removal releases keyboard handlers, image events and pending timers in both modes',()=>{
  for(const mode of ['Normal','Pin']) {
    const Toolkit=toolkitModule.exports;const toolkit=new Toolkit({});
    toolkit.settings={viewMode:mode};toolkit.refreshViewTrigger=()=>{};
    const handlers=new Map();const imageEvents=new Set(['mouseenter','mouseleave','mousedown','mouseup','mousewheel']);
    let removed=0;
    const body={classList:{contains:()=>true},getAttribute:()=> `remove-${mode}`,setAttribute(){}};
    const doc={body,addEventListener:(key,handler)=>handlers.set(key,handler),removeEventListener:(key,handler)=>{if(handlers.get(key)===handler)handlers.delete(key);}};body.ownerDocument=doc;
    const img={ownerDocument:doc,matchParent:()=>body,removeAttribute(){}};
    const container=toolkit.ensureImageContainer(img);
    const popupImage={imgViewEl:{removeEventListener:key=>imageEvents.delete(key)},refreshImgInterval:`image-${mode}`};
    container.doc=doc;
    container.lastClickedImgEl=img;
    toolkit.noteImageStage=new NoteImageStage(toolkit.app);
    toolkit.noteImageStage.galleryContext={origin:img};
    container.imgInfo.oitContainerEl={remove(){removed++;},removeEventListener(){}};
    container.imgInfo.imgList=[popupImage];
    container.imgInfo.imgTipTimeout=`tip-${mode}`;
    container.imgGlobalStatus.popup=true;
    container.imgGlobalStatus.clickTimer=`click-${mode}`;
    container.imgGlobalStatus.clickCount=2;
    doc.addEventListener('keydown',container.triggerKeydown);
    doc.addEventListener('keyup',container.triggerKeyup);
    container.removeOitContainerView();
    assert.equal(handlers.size,0);
    assert.equal(imageEvents.size,0);
    assert.equal(removed,1);
    assert.equal(container.imgGlobalStatus.popup,false);
    assert.equal(container.imgGlobalStatus.clickTimer,null);
    assert.equal(container.imgGlobalStatus.clickCount,0);
    assert.equal(container.imgInfo.imgTipTimeout,null);
    assert.equal(popupImage.refreshImgInterval,null);
    assert.ok(cancelledIntervals.includes(`image-${mode}`));
    assert.ok(cancelledTimeouts.includes(`click-${mode}`));
    assert.ok(cancelledTimeouts.includes(`tip-${mode}`));
    assert.equal(toolkit.noteImageStage.galleryContext,null);
    assert.equal(container.imgInfo.imgList.length,0);
    container.removeOitContainerView();
    assert.equal(handlers.size,0);
  }
});


test('Android Toolkit bridge opens native Modal with exact repeated index and cleans up on close',()=>{
 obsidian.Platform.isMobile=true;
 try {
  const img=origin('https://host/one.png');
  const app=appFor(undefined,[{view:new MarkdownView('article.md',node=>node===img)}]);
  const stage=new NoteImageStage(app);stage.host={settings:{}};
  const images=[image(10),image(20),image(30)];
  assert.equal(stage.openGallery(images,2,img,'article.md'),true);
  assert.equal(opened.at(-1).index,2);assert.equal(opened.at(-1).images.length,3);
  assert.equal(stage.galleryContext.index,2);assert.equal(stage.galleryContext.images.length,3);
  // Avoid invoking UI cleanup on the DOM-free Modal stub.
  opened.at(-1).contentEl={empty(){}};
  opened.at(-1).close();assert.equal(stage.galleryContext,null);
 } finally {obsidian.Platform.isMobile=false;}
});


test('mobile plain image uses source order instead of duplicated gallery thumbnails and hidden DOM nodes',async()=>{
 obsidian.Platform.isMobile=true;
 try {
  const img={tagName:'IMG',src:'https://host/repeat.png',alt:'second',isConnected:true,closest:()=>null,getBoundingClientRect:()=>({width:100,height:80})};
  const thumb={...img,closest:()=>({})},hidden={...img,src:'https://host/hidden.png',closest:()=>({})};
  const view=new MarkdownView('article.md',()=>true);view.containerEl.querySelectorAll=()=>[thumb,hidden,img];img.parentElement=view.containerEl;
  view.getMode=()=> 'source';view.editor={getValue:()=> '![](https://host/repeat.png)\n\n![](https://host/other.png)\n\n![](https://host/repeat.png)',cm:{posAtDOM:()=> 5,state:{doc:{lineAt:()=>({number:5})}}}};
  const app=appFor(undefined,[{view}]);const stage=new NoteImageStage(app);stage.host={settings:{}};
  const event={target:img,preventDefault(){this.prevented=true;},stopPropagation(){}};
  assert.equal(stage.openMobileImage(event),true);await Promise.resolve();
  assert.equal(event.prevented,true);assert.equal(opened.at(-1).index,2);assert.equal(opened.at(-1).images.length,3);
  assert.equal(opened.at(-1).images[1].src,'https://host/other.png');
 } finally {obsidian.Platform.isMobile=false;}
});
