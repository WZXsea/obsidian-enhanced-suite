import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import os from 'node:os';
import {build} from 'esbuild';

const require=createRequire(import.meta.url);
let playwright;
try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const bundle=await build({entryPoints:['src/search/desktopPreview.ts'],bundle:true,format:'iife',globalName:'DesktopPreviewTools',platform:'browser',write:false,logLevel:'silent',plugins:[{
 name:'desktop-preview-public-api-fixture',setup(build){
  build.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',namespace:'fixture'}));
  build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const Component=window.TestComponent,MarkdownRenderer=window.TestRenderer;'}));
 }
}]});
const browser=await playwright.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={renderer:'controlled public MarkdownRenderer fixture; native integration is tested separately',cases:[]};
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<style>body{margin:0;font:14px system-ui}.native-host{height:800px;width:640px;display:flex}[hidden]{display:none!important}.float-search-fast-preview{display:flex;flex:1;min-height:0;flex-direction:column}.float-search-mobile-preview-content{min-height:0;overflow:auto;flex:1}</style><input id="query" value="匹配"><div class="native-host"></div>');
 await page.evaluate(()=>{
  HTMLElement.prototype.createEl=function(tag,options={}){const el=document.createElement(tag);if(typeof options==='string')el.className=options;else{if(options.cls)el.className=options.cls;if(options.text)el.textContent=options.text;for(const[k,v]of Object.entries(options.attr??{}))el.setAttribute(k,v);}this.append(el);return el;};
  HTMLElement.prototype.createDiv=function(options={}){return this.createEl('div',options)};
  HTMLElement.prototype.createSpan=function(options={}){return this.createEl('span',options)};
  window.pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  window.reads=[];window.renders=[];window.components=[];window.gates=new Map();window.motionCalls=0;
  const animate=HTMLElement.prototype.animate;
  HTMLElement.prototype.animate=function(...args){window.motionCalls++;return animate.apply(this,args)};
  window.TestComponent=class{loaded=false;load(){this.loaded=true;window.components.push(this)}unload(){this.loaded=false}};
  window.TestRenderer={async render(_app,text,root,path){
   window.renders.push({path,chars:text.length});const gate=window.gates.get(path);if(gate)await gate.promise;
   await window.pause(15);
   for(const line of text.split('\n'))if(line.trim())root.createEl(/^#/.test(line)?'h2':'p',{text:line.replace(/^#+\s*/, '')});
  }};
  window.app={vault:{async cachedRead(file){window.reads.push(file.path);const text=file.text;await window.pause(file.delay??5);return text}}};
  window.note=(name,delay=5)=>{
   const lines=['---','title: hidden-metadata','---','# 文档正文'];
   for(let i=0;i<500;i++)lines.push(`段落 ${i}：${'研究材料与匹配上下文。'.repeat(6)}`,'');
   const line=604,text=lines.join('\n');return{path:`研究/${name}.md`,basename:name,extension:'md',text,delay,line,content:lines[line],stat:{mtime:1,size:text.length}};
  };
  window.target=file=>({file,line:file.line,content:file.content,matchText:'匹配上下文'});
  document.getElementById('query').focus();
 });
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(()=>{window.preview=new DesktopPreviewTools.DesktopSearchPreview(window.app,document.querySelector('.native-host'),{read:file=>window.app.vault.cachedRead(file)})});

 const first=await page.evaluate(async()=>{
  const file=window.note('桌面慢排版');let release;window.gates.set(file.path,{promise:new Promise(resolve=>{release=resolve})});window.release=release;window.file=file;
  const start=performance.now();await window.preview.show(window.target(file));await new Promise(requestAnimationFrame);
  const plainReadyMs=performance.now()-start,anchor=window.preview.content.querySelector('.is-search-target'),bounds=window.preview.content.getBoundingClientRect(),rect=anchor?.getBoundingClientRect();
  return{plainReadyMs,readable:window.preview.content.textContent.includes(file.content),metadataHidden:!window.preview.content.textContent.includes('hidden-metadata'),focused:document.activeElement.id==='query',className:window.preview.element.className,hostClass:document.querySelector('.native-host').className,toolbarHidden:window.preview.element.querySelector('.float-search-mobile-preview-toolbar').hidden,navHidden:window.preview.element.querySelector('.fs-preview-context-nav').hidden,motionCalls:window.motionCalls,anchorInView:!!rect&&rect.top>=bounds.top-1&&rect.bottom<=bounds.bottom+1};
 });
 report.cases.push({name:'first-readable-fragment-preserves-desktop-search-focus',...first});
 assert.equal(first.readable,true);assert.equal(first.metadataHidden,true);assert.equal(first.focused,true);assert.equal(first.className,'float-search-fast-preview');assert.equal(first.hostClass,'native-host');assert.equal(first.toolbarHidden,true);assert.equal(first.navHidden,true);assert.equal(first.motionCalls,0);assert.equal(first.anchorInView,true);
 await page.evaluate(async()=>{window.release();await window.preview.whenFormatted;window.gates.delete(window.file.path)});
 assert.ok(await page.evaluate(()=>window.renders.every(render=>render.chars<=4800)),'Desktop rich formatting should retain bounded fragment work');

 const warm=await page.evaluate(async()=>{
  const reads=window.reads.length,renders=window.renders.length;window.preview.hide();await window.preview.show(window.target(window.file));await window.preview.whenFormatted;
  return{reads:window.reads.length-reads,renders:window.renders.length-renders,cacheHit:window.preview.lastTimings.cacheHit,focused:document.activeElement.id==='query'};
 });
 report.cases.push({name:'warm-desktop-preview-reuses-source-and-formatted-fragment',...warm});assert.equal(warm.reads,0);assert.equal(warm.renders,0);assert.equal(warm.cacheHit,true);assert.equal(warm.focused,true);

 const mutation=await page.evaluate(async()=>{
  const file=window.file,reads=window.reads.length,renders=window.renders.length;
  file.text=file.text.replace(file.content,'修改后的桌面匹配上下文');file.content='修改后的桌面匹配上下文';file.stat.mtime++;file.stat.size=file.text.length;
  await window.preview.show(window.target(file));await window.preview.whenFormatted;
  return{reads:window.reads.length-reads,renders:window.renders.length-renders,updated:window.preview.content.textContent.includes(file.content),focused:document.activeElement.id==='query'};
 });
 report.cases.push({name:'file-version-invalidates-desktop-cache',...mutation});assert.equal(mutation.reads,1);assert.equal(mutation.renders,1);assert.equal(mutation.updated,true);assert.equal(mutation.focused,true);

 const readRace=await page.evaluate(async()=>{
  const a=window.note('迟到读取A',80),b=window.note('当前读取B',1);b.text=b.text.replace(b.content,'当前 B 的唯一桌面正文');b.content='当前 B 的唯一桌面正文';b.stat.size=b.text.length;
  const old=window.preview.show(window.target(a));await window.pause(5);await window.preview.show(window.target(b));await old;await window.preview.whenFormatted;
  return{current:window.preview.content.textContent.includes(b.content),path:window.preview.element.querySelector('.float-search-mobile-preview-path').textContent,focused:document.activeElement.id==='query'};
 });
 report.cases.push({name:'late-read-keeps-current-desktop-target',...readRace});assert.equal(readRace.current,true);assert.ok(readRace.path.includes('当前读取B'));assert.equal(readRace.focused,true);

 const handoff=await page.evaluate(async()=>{
  const file=window.note('原生完成后的晚排版');let release;window.gates.set(file.path,{promise:new Promise(resolve=>{release=resolve})});
  await window.preview.show(window.target(file));await window.pause(40);const formatted=window.preview.whenFormatted;
  window.preview.hide();const hiddenAtHandoff=!window.preview.visible;release();await formatted;await window.pause(20);window.gates.delete(file.path);
  return{hiddenAtHandoff,staysHidden:!window.preview.visible,focused:document.activeElement.id==='query'};
 });
 report.cases.push({name:'native-handoff-cancels-pending-formatting',...handoff});assert.equal(handoff.hiddenAtHandoff,true);assert.equal(handoff.staysHidden,true);assert.equal(handoff.focused,true);

 const readHandoff=await page.evaluate(async()=>{
  const file=window.note('原生完成后的晚读取',80),renders=window.renders.length;
  const loading=window.preview.show(window.target(file));window.preview.hide();await loading;
  return{staysHidden:!window.preview.visible,renders:window.renders.length-renders,focused:document.activeElement.id==='query'};
 });
 report.cases.push({name:'native-handoff-keeps-late-read-hidden',...readHandoff});assert.equal(readHandoff.staysHidden,true);assert.equal(readHandoff.renders,0);assert.equal(readHandoff.focused,true);

 const other=await page.evaluate(async()=>{
  const reads=window.reads.length,renders=window.renders.length;await window.preview.show({...window.target(window.file),file:{...window.file,extension:'pdf'}});
  return{hidden:!window.preview.visible,reads:window.reads.length-reads,renders:window.renders.length-renders};
 });
 report.cases.push({name:'non-markdown-uses-native-preview',...other});assert.equal(other.hidden,true);assert.equal(other.reads,0);assert.equal(other.renders,0);

 const dispose=await page.evaluate(async()=>{
  for(let i=0;i<5;i++){await window.preview.show(window.target(window.note(`缓存容量${i}`)));await window.preview.whenFormatted;}
  const retained=window.components.filter(component=>component.loaded).length;window.preview.destroy();
  return{retained,allReleased:window.components.every(component=>!component.loaded),removed:!document.querySelector('.float-search-fast-preview'),focused:document.activeElement.id==='query'};
 });
 report.cases.push({name:'desktop-preview-cache-capacity-and-disposal',...dispose});assert.ok(dispose.retained<=3);assert.equal(dispose.allReleased,true);assert.equal(dispose.removed,true);assert.equal(dispose.focused,true);assert.deepEqual(errors,[]);
 await mkdir('output/playwright',{recursive:true});await writeFile('output/playwright/desktop-preview-results.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));console.log('PASS Desktop bounded preview, search focus, cache, native handoff, late requests and disposal');
}finally{await browser.close()}
