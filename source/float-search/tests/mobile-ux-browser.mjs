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
 const model=await page.evaluate(()=>window.PreviewTools.mobilePreviewSource('---\ntitle: private metadata\ntags: [test]\n---\n# 正文\n目标正文',5));
 assert.equal(model.markdown,'# 正文\n目标正文');assert.equal(model.start,4);assert.equal(model.selected,5);assert.equal(model.needle,'目标正文');
 console.log('PASS Preview excludes YAML while retaining original source line mapping');

 await page.evaluate(async()=>{window.plugin=new window.FloatingPlugin.default(window.app);await window.plugin.onload()});
 assert.equal(await page.locator('.float-search-mobile-header-action').count(),1);
 await page.locator('.float-search-mobile-header-action').tap();
 await page.locator('.float-search-cmdk').waitFor();
 assert.equal(await page.locator('.float-search-cmdk-filter').allTextContents().then(x=>x.join(',')),'文件,标题,正文');
 assert.equal(await page.evaluate(()=>document.activeElement===window.plugin.cmdkModal.inputEl),true,JSON.stringify(await page.evaluate(()=>({active:document.activeElement?.outerHTML,input:window.plugin.cmdkModal.inputEl.outerHTML,notices:window.notices})),null,2));
 console.log('PASS Header action opens compact Chinese mobile search');
 await page.evaluate(()=>window.plugin.cmdkModal.setSearchQuery('研究'));
 await page.waitForFunction(()=>document.querySelectorAll('.float-search-cmdk-result').length>0);
 const bounds=await page.locator('.prompt.float-search-cmdk').boundingBox();assert.ok(bounds.y>=28);assert.ok(bounds.y+bounds.height<=915-18+1);
 await page.screenshot({path:'output/playwright/mobile-research-results.png'});
 const row=page.locator('.float-search-cmdk-result').first();
 await row.tap();
 await page.locator('.float-search-mobile-preview-content p').first().waitFor();
 assert.equal(await page.evaluate(()=>document.activeElement?.tagName==='INPUT'),false);
 assert.equal(await page.evaluate(()=>window.opened.length),0);
 assert.equal(await page.locator('.float-search-cmdk-body .prompt-results').isVisible(),false);
 const reading=await page.locator('.float-search-mobile-preview-content').boundingBox();assert.ok(reading.height>500,JSON.stringify(reading));
 await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.activeElement?.tagName==='INPUT'),false);
 await page.screenshot({path:'output/playwright/mobile-research-preview.png'});
 console.log('PASS Tap reads an in-modal preview, retains the modal, and dismisses the keyboard');
 await page.locator('.fs-preview-back').click();
 assert.equal(await page.locator('.float-search-cmdk-body .prompt-results').isVisible(),true);
 assert.equal(await page.evaluate(()=>document.activeElement?.tagName==='INPUT'),false);
 await page.locator('.float-search-cmdk-filter').first().tap();
 assert.equal(await page.evaluate(()=>document.activeElement?.tagName==='INPUT'),false);
 await page.locator('.float-search-cmdk-filter').first().tap();
 await page.locator('.float-search-cmdk-typo-toggle').click();
 assert.equal(await page.evaluate(()=>document.activeElement?.tagName==='INPUT'),false);
 console.log('PASS Return, filters and typo controls keep the IME dismissed');
 await page.locator('.prompt-input').click();
 await page.locator('.prompt-input').evaluate(input=>{input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.value='研究';input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));});
 assert.equal(await page.evaluate(()=>window.plugin.cmdkModal.isComposing),false);
 console.log('PASS Explicit input focus and Chinese composition remain available');
 await page.evaluate(()=>window.plugin.cmdkModal.setSearchQuery('研究'));
 await page.locator('.float-search-cmdk-result').first().click();
 await page.locator('.fs-preview-open').click();
 assert.equal(await page.locator('.float-search-cmdk-container').count(),0);
 assert.equal(await page.evaluate(()=>window.opened.length),1);
 console.log('PASS Explicit open navigates only after the preview action');
 await page.evaluate(()=>{window.triggerMenu();window.menuItems.find(item=>item.title==='快速搜索').callback()});
 await page.locator('.float-search-cmdk').waitFor();
 assert.equal(await page.locator('.float-search-cmdk-rag-toggle').count(),0);
 console.log('PASS Note more-menu registers a visible quick-search entry');
 await page.setViewportSize({width:1024,height:768});
 await page.evaluate(()=>window.plugin.cmdkModal.setSearchQuery('研究'));
 await page.locator('.float-search-cmdk-result').first().click();
 await page.locator('.float-search-mobile-preview-content p').first().waitFor();
 const results=await page.locator('.float-search-cmdk-body .prompt-results').boundingBox(),previewBounds=await page.locator('.float-search-mobile-preview').boundingBox();
 assert.ok(results.width>250&&previewBounds.width>400);assert.ok(results.x+results.width<=previewBounds.x+1);
 await page.screenshot({path:'output/playwright/tablet-research-preview.png'});
 console.log('PASS Tablet view provides simultaneous result and reading columns');
 await page.evaluate(()=>window.plugin.cmdkModal.close());
 assert.equal(await page.evaluate(()=>window.renderedComponents.every(c=>c.loaded===false)),true);
 await page.evaluate(()=>window.plugin.unload());
 assert.equal(await page.locator('.float-search-mobile-header-action').count(),0);
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.notices),[]);
 console.log('PASS Closing and unloading release preview components and header entries');
}finally{await browser.close()}
