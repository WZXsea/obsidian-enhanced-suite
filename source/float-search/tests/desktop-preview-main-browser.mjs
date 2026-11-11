import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import os from 'node:os';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const source=await readFile('src/floatSearchIndex.ts','utf8');
const between=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,`Main methods missing: ${start}`);return source.slice(a,b)};
const methods=between('\tprivate readonly onPreviewMouseDown','\tprivate getCmdkChooser()')+
 between('\tprivate invalidatePreviewRequest()','\tprivate ensurePreviewTargetState(')+
 between('\tprivate waitForPreviewPaint()','\n\tonClose()');
const limits=['MIN_CMDK_PREVIEW_SPLIT_RATIO','MAX_CMDK_PREVIEW_SPLIT_RATIO','MIN_CMDK_RESULTS_WIDTH','MIN_CMDK_PREVIEW_WIDTH'].map(name=>source.match(new RegExp(`const ${name} = [^;]+;`))[0]).join('\n');
const bundle=await build({stdin:{contents:`import {DesktopSearchPreview} from './search/desktopPreview';import {LatestPreviewQueue} from './search/latestPreviewQueue';import {animateNavigation as animateNavigationBase,cancelSearchMotion} from './search/searchMotion';function animateNavigation(...args){window.nativeMotions++;return animateNavigationBase(...args)}const Platform={isMobile:false},DEFAULT_SETTINGS={cmdkPreviewSplitRatio:.5};${limits}export class MainPreviewFixture {${methods}}export {DesktopSearchPreview,LatestPreviewQueue};`,resolveDir:path.resolve('src'),loader:'ts'},bundle:true,format:'iife',globalName:'MainPreviewTools',platform:'browser',write:false,logLevel:'silent',plugins:[{name:'public-api-fixture',setup(build){build.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const Component=window.TestComponent,MarkdownRenderer=window.TestRenderer;'}));}}]});
const browser=await playwright.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),report=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent(`<style>body{margin:0;font:14px system-ui}.shell{width:1200px;margin:20px}.body{display:flex;height:760px}.results{flex:0 0 var(--float-search-cmdk-results-width,50%);background:#eee}.row span{display:inline-block;padding:8px}.separator{width:10px;cursor:col-resize;background:#d0d7e2}.preview{flex:1;min-width:0;position:relative}.fs-desktop-native-host{height:100%;overflow:auto}.editor{white-space:pre-wrap;min-height:100%;outline:none}[hidden]{display:none!important}.float-search-fast-preview{position:absolute;inset:0;background:white;display:flex;flex-direction:column}.float-search-mobile-preview-content{overflow:auto;flex:1;min-height:0}</style><main class="shell"><input id="query" value="匹配"><div class="body has-preview"><div class="results"><div class="row"><span class="icon">⌕</span><span class="title">同一结果标题</span><span class="tag">正文</span></div></div><div class="separator" tabindex="0" role="separator"></div><div class="preview"><div class="fs-desktop-native-host"><div class="editor" contenteditable="true" tabindex="0"></div></div></div></div></main>`);
 await page.evaluate(()=>{
  HTMLElement.prototype.createEl=function(tag,options={}){const el=document.createElement(tag);if(typeof options==='string')el.className=options;else{if(options.cls)el.className=options.cls;if(options.text)el.textContent=options.text;for(const[k,v]of Object.entries(options.attr??{}))el.setAttribute(k,v);}this.append(el);return el;};
  HTMLElement.prototype.createDiv=function(options={}){return this.createEl('div',options)};HTMLElement.prototype.createSpan=function(options={}){return this.createEl('span',options)};
  HTMLElement.prototype.addClass=function(...names){this.classList.add(...names)};HTMLElement.prototype.removeClass=function(...names){this.classList.remove(...names)};HTMLElement.prototype.show=function(){this.style.display=''};HTMLElement.prototype.hide=function(){this.style.display='none'};
  window.TestComponent=class{load(){}unload(){}};window.TestRenderer={async render(_app,text,root){for(const line of text.split('\n'))if(line.trim())root.createEl('p',{text:line})}};
  window.gate=()=>{let resolve;const promise=new Promise(yes=>{resolve=yes});return{promise,resolve}};window.readGates=new Map();window.nativeGates=new Map();window.calls=[];window.states=[];window.tasks={};window.saved=[];window.nativeMotions=0;window.fastShows=0;window.hoverTasks=[];
  window.note=name=>{const lines=['# '+name];for(let i=0;i<400;i++)lines.push(`${name} 第${i}段：${'匹配上下文。'.repeat(8)}`,'');const text=lines.join('\n');return{file:{path:`${name}.md`,basename:name,extension:'md',stat:{mtime:1,size:text.length},text},line:301,content:lines[301],matchText:'匹配上下文'};};
 });
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(()=>{
  const owner=window.owner=new MainPreviewTools.MainPreviewFixture(),preview=document.querySelector('.preview'),native=document.querySelector('.fs-desktop-native-host'),editor=document.querySelector('.editor'),query=document.getElementById('query'),separator=document.querySelector('.separator');
  const app={workspace:{activeLeaf:{}},vault:{async cachedRead(file){await window.readGates.get(file.path)?.promise;return file.text}}},leaf={view:{file:undefined}};
  const fast=window.fast=new MainPreviewTools.DesktopSearchPreview(app,preview);
  const show=fast.show.bind(fast);fast.show=(...args)=>{window.fastShows++;return show(...args)};
  Object.assign(owner,{closed:false,isComposing:false,isSortSelectActive:false,previewRequestId:0,previewInteractionGeneration:0,inputEl:query,app,previewEl:preview,bodyEl:document.querySelector('.body'),modalEl:document.querySelector('.shell'),previewResizeHandleEl:separator,desktopNativeHost:native,desktopPreview:fast,nativePreviewQueue:new MainPreviewTools.LatestPreviewQueue(),nativePreviewVersion:'',fileLeaf:leaf,
   fileEmbeddedView:{opening:false,async openFile(file){window.calls.push(file.path);this.opening=true;await window.nativeGates.get(file.path)?.promise;editor.textContent=file.text;leaf.view.file=file;this.opening=false;return leaf}},
   getResultTarget:result=>result,getContentPreviewTarget:result=>result,ensurePreviewPane(){},getResultEphemeralState:result=>({line:result.line}),ensurePreviewTargetState(_leaf,state){window.states.push(state.line)},focusSearchInputAfterAction(){query.focus({preventScroll:true})},activePreviewResizePointerId:null,previewResizeChanged:false,previewSplitRatio:.5,plugin:{settings:{cmdkPreviewSplitRatio:.5},async saveSettings(){window.saved.push(this.settings.cmdkPreviewSplitRatio)}}
  });
  preview.addEventListener('mousedown',owner.onPreviewMouseDown,true);
  document.querySelector('.row').addEventListener('mousemove',()=>{if(window.hoverTarget){const target=window.hoverTarget;window.hoverTasks.push(owner.showPreview({...target,file:{...target.file,stat:{...target.file.stat}}}))}});
  separator.addEventListener('pointerdown',owner.onPreviewResizePointerDown);separator.addEventListener('pointermove',owner.onPreviewResizePointerMove);separator.addEventListener('pointerup',owner.onPreviewResizePointerEnd);separator.addEventListener('lostpointercapture',owner.onPreviewResizeLostPointerCapture);separator.addEventListener('keydown',owner.onPreviewResizeKeyDown);query.focus();
 });

 const moveInsideRow=async()=>{for(const child of ['.icon','.title','.tag','.title']){const box=await page.locator('.row '+child).boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:5})}};
 await page.evaluate(()=>{window.a=window.gate();window.cRead=window.gate();window.cNative=window.gate();window.nativeGates.set('A.md',window.a);window.nativeGates.set('C.md',window.cNative);window.readGates.set('C.md',window.cRead);window.hoverTarget=window.note('A');window.tasks.a=window.owner.showPreview(window.hoverTarget);});
 await page.waitForFunction(()=>window.calls.includes('A.md'));
 await moveInsideRow();
 const inflightHover=await page.evaluate(()=>({fastShows:window.fastShows,nativeLoads:window.calls.length,locations:window.states.length,motions:window.nativeMotions,repeats:window.hoverTasks.length}));
 assert.equal(inflightHover.fastShows,1);assert.equal(inflightHover.nativeLoads,1);assert.equal(inflightHover.locations,0);assert.equal(inflightHover.motions,0);assert.ok(inflightHover.repeats>5);
 await page.evaluate(()=>{window.tasks.b=window.owner.showPreview(window.note('B'))});
 await page.waitForFunction(()=>window.owner.nativePreviewQueue.pending?.key.includes('B.md'));
 await page.evaluate(()=>{window.tasks.c=window.owner.showPreview(window.note('C'));window.a.resolve()});
 await page.evaluate(()=>window.tasks.a);
 const beforeLatestReady=await page.evaluate(()=>({calls:[...window.calls],visible:window.fast.visible,selected:window.fast.content.textContent.includes('C 第150段')}));
 assert.deepEqual(beforeLatestReady.calls,['A.md']);assert.equal(beforeLatestReady.visible,true);assert.equal(beforeLatestReady.selected,true);
 await page.evaluate(()=>window.cRead.resolve());await page.waitForFunction(()=>window.calls.includes('C.md'));
 const beforeHandoff=await page.evaluate(()=>({fastVisible:window.fast.visible,queryFocus:document.activeElement.id==='query',backgroundFile:document.querySelector('.editor').textContent.startsWith('# A')}));
 assert.equal(beforeHandoff.fastVisible,true);assert.equal(beforeHandoff.queryFocus,true);assert.equal(beforeHandoff.backgroundFile,true);
 await page.evaluate(async()=>{window.cNative.resolve();await Promise.all(Object.values(window.tasks))});
 const handoff=await page.evaluate(()=>({calls:[...window.calls],hidden:!window.fast.visible,fullText:document.querySelector('.editor').textContent===window.note('C').file.text,focused:document.activeElement.id==='query',states:[...window.states]}));
 assert.deepEqual(handoff.calls,['A.md','C.md']);assert.equal(handoff.hidden,true);assert.equal(handoff.fullText,true);assert.equal(handoff.focused,true);assert.deepEqual(handoff.states,[301]);report.push({name:'actual-main-coalescing-and-native-handoff',beforeLatestReady,beforeHandoff,handoff});

 await page.waitForTimeout(180);
 await page.evaluate(()=>{window.hoverTarget=window.note('C');document.querySelector('.editor').focus();document.querySelector('.fs-desktop-native-host').scrollTop=320;window.manualScroll=document.querySelector('.fs-desktop-native-host').scrollTop});
 await moveInsideRow();await moveInsideRow();await page.evaluate(()=>Promise.all(window.hoverTasks));
 const readyHover=await page.evaluate(()=>({nativeLoads:window.calls.filter(path=>path==='C.md').length,locations:window.states.length,motions:window.nativeMotions,scroll:document.querySelector('.fs-desktop-native-host').scrollTop,manualScroll:window.manualScroll,editorFocused:document.activeElement===document.querySelector('.editor'),fastShows:window.fastShows,repeats:window.hoverTasks.length}));
 assert.equal(readyHover.nativeLoads,1);assert.equal(readyHover.locations,1);assert.equal(readyHover.motions,1);assert.equal(readyHover.fastShows,3);assert.equal(readyHover.scroll,readyHover.manualScroll);assert.equal(readyHover.scroll,320);assert.equal(readyHover.editorFocused,true);
 report.push({name:'same-row-child-mousemove-preserves-inflight-and-ready-preview',inflightHover,readyHover});

 await page.evaluate(()=>{window.owner.restoreCmdkInputFocus(window.owner.previewRequestId,window.owner.previewInteractionGeneration);window.focusChoice=new Promise(resolve=>setTimeout(()=>{document.querySelector('.editor').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));document.querySelector('.editor').focus();resolve()},70))});
 await page.evaluate(()=>window.focusChoice);await page.waitForTimeout(90);
 const focus=await page.evaluate(()=>({nativeEditorFocused:document.activeElement===document.querySelector('.editor'),generation:window.owner.previewInteractionGeneration}));
 assert.equal(focus.nativeEditorFocused,true);assert.ok(focus.generation>0);report.push({name:'native-editing-intent-survives-120ms-focus-callback',...focus});

 await page.evaluate(()=>{document.getElementById('query').focus();window.owner.restoreCmdkInputFocus(window.owner.previewRequestId,window.owner.previewInteractionGeneration)});
 const separator=page.locator('.separator'),before=await page.locator('.results').boundingBox(),handle=await separator.boundingBox();
 await page.mouse.move(handle.x+handle.width/2,handle.y+50);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+85,handle.y+50,{steps:5});await page.mouse.up();await page.waitForTimeout(150);
 const after=await page.locator('.results').boundingBox();assert.ok(after.width>before.width+50);
 await separator.press('ArrowRight');await page.waitForTimeout(150);
 const resize=await page.evaluate(()=>({ratio:window.owner.previewSplitRatio,saved:window.saved,focused:document.activeElement===document.querySelector('.separator'),ariaValue:document.querySelector('.separator').getAttribute('aria-valuenow'),generation:window.owner.previewInteractionGeneration}));
 assert.equal(resize.focused,true);assert.ok(resize.saved.length>=2);assert.ok(resize.ratio>.55);assert.equal(Number(resize.ariaValue),Math.round(resize.ratio*100));
 await page.setViewportSize({width:700,height:900});await page.evaluate(()=>window.owner.showPreview(window.note('C')));
 const narrow=await page.evaluate(()=>({hidden:document.querySelector('.preview').style.display==='none',fastHidden:!window.fast.visible,hasPreview:document.querySelector('.body').classList.contains('has-preview')}));
 assert.equal(narrow.hidden,true);assert.equal(narrow.fastHidden,true);assert.equal(narrow.hasPreview,false);
 await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>window.owner.showPreview(window.note('C')));
 const wide=await page.evaluate(()=>({visible:document.querySelector('.preview').style.display!=='none',hasPreview:document.querySelector('.body').classList.contains('has-preview'),calls:[...window.calls],focused:document.activeElement.id==='query'}));
 assert.equal(wide.visible,true);assert.equal(wide.hasPreview,true);assert.deepEqual(wide.calls,['A.md','C.md']);assert.equal(wide.focused,true);
 report.push({name:'actual-main-pointer-key-and-viewport-resizing',beforeWidth:before.width,afterWidth:after.width,...resize,narrow,wide});
 await page.evaluate(()=>window.fast.destroy());assert.deepEqual(errors,[]);
 await mkdir('output/playwright',{recursive:true});await writeFile('output/playwright/desktop-preview-main-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));console.log('PASS Actual main preview coalescing, native handoff, focus intent and pointer/key resizing');
}finally{await browser.close()}
