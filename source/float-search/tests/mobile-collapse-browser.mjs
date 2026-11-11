import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import path from 'node:path';
import os from 'node:os';
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const fixturePlugin={name:'public-obsidian-browser-fixture',setup(build){
 build.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',namespace:'fixture'}));
 build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`
  export const ExtraButtonComponent=undefined, Menu=undefined, Setting=undefined, Workspace=undefined, WorkspaceContainer=undefined, WorkspaceLeaf=undefined, WorkspaceSplit=undefined, WorkspaceTabs=undefined, HoverPopover=undefined, MarkdownEditView=undefined,parseLinktext=undefined,PopoverState=undefined,resolveSubpath=undefined;
  export const Component=window.TestComponent, Plugin=window.TestPlugin, Modal=window.TestModal, SuggestModal=window.TestModal,
  PluginSettingTab=window.TestSettingTab, TFile=window.TestFile, TFolder=window.TestFolder,
  Platform={isMobile:true,isAndroidApp:true}, MarkdownRenderer=window.TestMarkdownRenderer,
  Notice=window.TestNotice, Keymap={isModEvent:()=>false},
  debounce=fn=>{fn.cancel=()=>{};return fn;}, addIcon=()=>{},getAllTags=cache=>cache.tags??[],
  parseFrontMatterAliases=fm=>Array.isArray(fm?.aliases)?fm.aliases.filter(x=>typeof x==='string'):typeof fm?.aliases==='string'?[fm.aliases]:[],
  prepareFuzzySearch=window.testSearch, prepareSimpleSearch=window.testSearch,
  renderResults=(el,text)=>{el.textContent=text;}, setIcon=(el,icon)=>{el.dataset.icon=icon;},requireApiVersion=()=>true;
 `}));
}};
const compile=(entry,globalName)=>build({entryPoints:[entry],bundle:true,format:'iife',globalName,platform:'browser',external:['child_process','fs','path'],write:false,plugins:[fixturePlugin],logLevel:'silent'});
const [bundle,preview]=await Promise.all([compile('src/floatSearchIndex.ts','FloatingPlugin'),compile('src/search/mobilePreview.ts','PreviewTools')]);
const browser=await playwright.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
await mkdir('output/playwright',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>:root{--background-primary:#fbfcfe;--background-secondary:#f0f3f8;--background-modifier-border:#dce2ec;--background-modifier-hover:#e6edf8;--interactive-accent:#5278ad;--interactive-accent-rgb:82,120,173;--text-normal:#243047;--text-muted:#63728a;--text-faint:#8190a7;--text-accent:#5278ad;--text-on-accent:white;--safe-area-inset-top:28px;--safe-area-inset-bottom:18px;--size-2-2:4px;--size-4-2:8px;--radius-m:8px;}body{margin:0;font-family:system-ui;color:var(--text-normal)}button,input,select{font:inherit;box-sizing:border-box}button{cursor:pointer}button,select{border:1px solid #dce2ec}.modal-container{position:fixed;inset:0}.prompt-results{overflow:auto}.modal-background{position:absolute;inset:0;background:#22334722}</style><div id="note"><div id="actions"></div></div>`);
 await page.evaluate(()=>{
  document.body.className='is-mobile';
  HTMLElement.prototype.createEl=function(tag,options={}){const el=document.createElement(tag);if(typeof options==='string')el.className=options;else{if(options.cls)el.className=options.cls;if(options.text)el.textContent=options.text;for(const[k,v]of Object.entries(options.attr??{}))el.setAttribute(k,v);}this.appendChild(el);return el;};
  HTMLElement.prototype.createDiv=function(options={}){return this.createEl('div',options)};
  HTMLElement.prototype.createSpan=function(options={}){return this.createEl('span',options)};
  HTMLElement.prototype.empty=function(){this.replaceChildren()};
  HTMLElement.prototype.setText=function(value){this.textContent=value};
  HTMLElement.prototype.addClass=function(...cls){this.classList.add(...cls)};
  HTMLElement.prototype.removeClass=function(...cls){this.classList.remove(...cls)};
  HTMLElement.prototype.toggleClass=function(cls,force){this.classList.toggle(cls,force)};
  HTMLElement.prototype.hasClass=function(cls){return this.classList.contains(cls)};
  HTMLElement.prototype.show=function(){this.style.display=''};
  HTMLElement.prototype.hide=function(){this.style.display='none'};
  window.createDiv=options=>{const el=document.createElement('div');if(typeof options==='string')el.className=options;else{if(options?.cls)el.className=options.cls;if(options?.text)el.textContent=options.text;}return el;};
  window.testSearch=query=>text=>{const i=text.toLowerCase().indexOf(query.toLowerCase());return i<0?null:{score:100,matches:[[i,i+query.length]]};};
  window.TestComponent=class{cleanups=[];children=[];loaded=false;register(fn){this.cleanups.push(fn)}registerDomEvent(target,type,fn,options){target.addEventListener(type,fn,options);this.register(()=>target.removeEventListener(type,fn,options))}addChild(child){this.children.push(child);return child}removeChild(child){this.children=this.children.filter(x=>x!==child);child.unload();return child}load(){this.loaded=true;}unload(){if(this.loaded===false)return;this.loaded=false;this.onunload?.();this.children.splice(0).forEach(c=>c.unload());this.cleanups.splice(0).reverse().forEach(fn=>fn());}};
  window.TestPlugin=class extends window.TestComponent{constructor(app){super();this.app=app;this.loaded=true;this.commands=[];}async loadData(){return{cmdkQuickCreate:false,cmdkRagEnabled:true,cmdkTypoTolerance:false,cmdkSearchHistory:[]}}async saveData(){}registerEvent(ref){this.register(()=>ref.off?.())}addCommand(c){this.commands.push(c)}addRibbonIcon(icon,title,callback){this.ribbon=callback}addSettingTab(){}registerObsidianProtocolHandler(){}};
  window.TestModal=class{constructor(app){this.app=app;this.containerEl=document.createElement('div');this.containerEl.className='modal-container';this.containerEl.createDiv('modal-background');this.modalEl=this.containerEl.createDiv('modal');this.contentEl=this.modalEl.createDiv('modal-content');this.scope={register(){}};}open(){document.body.append(this.containerEl);this.onOpen?.()}close(){this.onClose?.();this.containerEl.remove()}};
  window.TestSettingTab=class{};window.TestFolder=class{};window.TestNotice=class{constructor(text){window.notices.push(text)}};window.notices=[];
  window.TestFile=class{constructor(path,text){this.path=path;this.text=text;this.name=path.split('/').pop();this.basename=this.name.replace(/\.md$/,'');this.extension='md';this.parent={path:path.split('/').slice(0,-1).join('/')};this.stat={mtime:1,ctime:1,size:text.length};}};
  window.renderedComponents=[];
  window.TestMarkdownRenderer={async render(app,text,root,path,component){window.renderedComponents.push(component);for(const line of text.split('\n'))if(line.trim()){const heading=line.match(/^#{1,6}\s+(.*)/);root.createEl(heading?'h2':'p',{text:heading?heading[1]:line});}}};
  const file=new window.TestFile('研究/肾癌空间研究.md','# 肾癌空间研究\n\n## 研究目标\n\n本研究通过空间转录组刻画肾癌微环境。\n\n## 方法\n\n对研究样本进行空间定位。');
  window.file=file;window.opened=[];const handlers=new Map();
  const view={file,containerEl:document.getElementById('note'),addAction(icon,title,callback){const button=document.getElementById('actions').createEl('button',{text:title});button.addEventListener('click',callback);return button;}};
  const leaf={view,openFile:async(f,state)=>{window.opened.push({path:f.path,state})}};
  window.app={workspace:{onLayoutReady:fn=>fn(),getLeavesOfType:()=>[leaf],getMostRecentLeaf:()=>leaf,getLeaf:()=>leaf,on(type,fn){const callbacks=handlers.get(type)??[];callbacks.push(fn);handlers.set(type,callbacks);return{off(){handlers.set(type,(handlers.get(type)??[]).filter(x=>x!==fn))}}},getActiveFile:()=>file},vault:{getFiles:()=>[file],getAbstractFileByPath:path=>path===file.path?file:null,cachedRead:async()=>file.text,on:()=>({})},metadataCache:{getFileCache:()=>({headings:[{heading:'研究目标',level:2,position:{start:{line:2}}}],tags:[]}),on:()=>({})}};
  window.menuItems=[];window.triggerMenu=()=>{const menu={addItem(fn){const item={setTitle(title){this.title=title;return this},setIcon(){return this},onClick(callback){this.callback=callback;window.menuItems.push(this);return this}};fn(item)}};for(const fn of handlers.get('file-menu')??[])fn(menu,file,'pane-more-options',leaf)};
 });
 await page.addStyleTag({content:await readFile('styles.css','utf8')});
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.addScriptTag({content:preview.outputFiles[0].text});

 await page.evaluate(async()=>{
  window.plugin=new window.FloatingPlugin.default(window.app);await window.plugin.onload();window.plugin.openCmdkModal();
  window.injectMatches=(count,key)=>{
   const m=window.plugin.cmdkModal;m.cancelActiveSearch();m.resultWindow.beginQuery(key);
   window.file.text='# 肾癌空间研究\n\n'+Array.from({length:135},(_,i)=>`研究正文第 ${i+1} 行。`).join('\n');
   window.file.stat.size=window.file.text.length;
   const base={file:window.file,nameMatch:null,pathMatch:null};
   const parent={...base,type:'file',score:100};
   const children=Array.from({length:count},(_,i)=>({...base,type:'content',content:`研究正文第 ${i+1} 行。`,contentMatch:null,line:i+2,score:50-i/1000}));
   window.testResults=[parent,...children];m.setSortedSuggestions(m.chooser,window.testResults,false);
  };
 });
 const childCount=()=>page.evaluate(()=>window.plugin.cmdkModal.cmdkResults.filter(r=>r.childOf).length);
 const arrow=()=>page.locator('.float-search-cmdk-disclosure').first();
 for(const count of [1,2,3]){
  await page.evaluate(n=>window.injectMatches(n,`small-${n}`),count);
  assert.equal(await childCount(),0);assert.equal(await arrow().getAttribute('aria-expanded'),'false');
  await arrow().tap();assert.equal(await childCount(),count);assert.equal(await arrow().getAttribute('aria-expanded'),'true');
  await arrow().tap();assert.equal(await childCount(),0);assert.equal(await arrow().getAttribute('aria-expanded'),'false');
  await arrow().tap();assert.equal(await childCount(),count);
 }
 console.log('PASS One/two/three-match mobile groups start fully collapsed and toggle repeatedly');
 await page.evaluate(()=>window.injectMatches(120,'large'));
 assert.equal(await childCount(),0);await arrow().tap();assert.equal(await childCount(),50);
 await page.getByText('继续显示此文件的匹配',{exact:true}).tap();assert.equal(await childCount(),100);
 await page.getByText('继续显示此文件的匹配',{exact:true}).tap();assert.equal(await childCount(),120);
 await arrow().tap();assert.equal(await childCount(),0);await arrow().tap();assert.equal(await childCount(),50);
 console.log('PASS Expanded groups continue by fifty and a new expansion resets their child window');
 await page.evaluate(()=>{
  const m=window.plugin.cmdkModal;const index=m.cmdkResults.findIndex(r=>r.childOf&&r.line===8);
  m.chooser.selectedItem=index;m.chooser.renderSuggestions();
 });
 await arrow().tap();assert.equal(await childCount(),0);
 const selected=await page.evaluate(()=>{const m=window.plugin.cmdkModal;return m.chooser.values[m.chooser.selectedItem].type});assert.equal(selected,'file');
 await page.evaluate(()=>{
  const m=window.plugin.cmdkModal;const stale={...window.testResults[20],childOf:window.file.path};
  m.chooser.values=[stale];m.chooser.selectedItem=0;m.cmdkResults=[stale];
  m.setSortedSuggestions(m.chooser,window.testResults,true);
  for(let i=0;i<4;i++)m.setSortedSuggestions(m.chooser,window.testResults,true);
 });
 assert.equal(await childCount(),0);assert.equal(await arrow().getAttribute('aria-expanded'),'false');
 console.log('PASS Explicit collapse maps selection to its parent and rejects stale asynchronous anchors');
 await arrow().tap();assert.equal(await childCount(),50);
 await page.evaluate(()=>{const m=window.plugin.cmdkModal;m.setSortedSuggestions(m.chooser,window.testResults,true)});
 assert.equal(await childCount(),50);await arrow().tap();assert.equal(await childCount(),0);
 await page.evaluate(()=>window.plugin.cmdkModal.setSearchQuery('研究'));
 await page.waitForFunction(()=>window.plugin.cmdkModal.cmdkSourceResults.some(r=>r.type==='content'));
 assert.equal(await childCount(),0);
 console.log('PASS New query sessions reset expansion while later search batches keep collapsed groups closed');
 await page.setViewportSize({width:1024,height:768});
 await page.evaluate(()=>window.injectMatches(3,'tablet-preview'));
 await page.locator('.float-search-cmdk-result').first().tap();
 await page.locator('.float-search-mobile-preview-content p').first().waitFor();
 const before=await page.evaluate(()=>window.plugin.cmdkModal.mobilePreview.target.line);
 await arrow().tap();assert.equal(await childCount(),3);
 await arrow().tap();assert.equal(await childCount(),0);
 assert.equal(await page.locator('.float-search-mobile-preview').isVisible(),true);
 assert.equal(await page.evaluate(()=>window.plugin.cmdkModal.mobilePreview.target.line),before);
 assert.equal(await page.evaluate(()=>document.activeElement===window.plugin.cmdkModal.mobilePreview.content),true);
 assert.equal(await page.evaluate(()=>window.opened.length),0);
 console.log('PASS Tablet disclosure keeps the preview and reading focus without navigation or IME focus');
 await page.evaluate(()=>{window.plugin.cmdkModal.close();window.plugin.unload()});
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.notices),[]);
}finally{await browser.close()}
