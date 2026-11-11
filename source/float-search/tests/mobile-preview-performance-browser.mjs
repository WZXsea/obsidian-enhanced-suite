import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import path from 'node:path';
import os from 'node:os';

const require=createRequire(import.meta.url);
let playwright;
try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const baseline=process.argv.includes('--baseline');
const fixturePlugin={name:'preview-public-api-fixture',setup(build){
 build.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',namespace:'fixture'}));
 build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const Component=window.TestComponent,MarkdownRenderer=window.TestRenderer;'}));
}};
const bundle=await build({entryPoints:['src/search/mobilePreview.ts'],bundle:true,format:'iife',globalName:'PreviewTools',platform:'browser',write:false,plugins:[fixturePlugin],logLevel:'silent'});
const browser=await playwright.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
await mkdir('output/playwright',{recursive:true});
const report={mode:baseline?'baseline':'regression',renderer:'controlled public MarkdownRenderer fixture, not native Obsidian render timing',cases:[]};
try{
 const page=await browser.newPage({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px system-ui;margin:0}.host{height:880px;display:flex}.float-search-mobile-preview{display:flex;flex:1;flex-direction:column;min-height:0}.float-search-mobile-preview-content{flex:1;min-height:0;overflow:auto}button{height:44px;min-width:80px}.float-search-mobile-preview-content img{width:48px;height:24px}table{border-collapse:collapse}td{padding:2px;border:1px solid #ddd}</style><main class="host"></main>');
 await page.evaluate(()=>{
  HTMLElement.prototype.createEl=function(tag,options={}){const el=document.createElement(tag);if(typeof options==='string')el.className=options;else{if(options.cls)el.className=options.cls;if(options.text)el.textContent=options.text;for(const[k,v]of Object.entries(options.attr??{}))el.setAttribute(k,v);}this.appendChild(el);return el;};
  HTMLElement.prototype.createDiv=function(options={}){return this.createEl('div',options)};
  HTMLElement.prototype.createSpan=function(options={}){return this.createEl('span',options)};
  window.components=[];window.reads=[];window.renders=[];window.gates=new Map();window.backs=0;window.opens=0;window.dismissals=0;
  window.TestComponent=class{loaded=false;cleanups=[];register(fn){this.cleanups.push(fn)}load(){this.loaded=true;window.components.push(this)}unload(){if(!this.loaded)return;this.loaded=false;this.cleanups.splice(0).reverse().forEach(fn=>fn())}};
  const pause=ms=>new Promise(r=>setTimeout(r,ms));window.pause=pause;
  window.TestRenderer={async render(_app,markdown,root,path,component){
   const started=performance.now(),entry={path,chars:markdown.length,started};window.renders.push(entry);
   const gate=window.gates.get(path);if(gate)await gate.promise;
   await pause(20+markdown.length/150);
   const fragment=document.createDocumentFragment();
   for(const line of markdown.split('\n')){
    if(!line.trim())continue;
    let node;
    if(/^!\[/.test(line)){node=document.createElement('img');node.src='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="24"%3E%3Crect width="48" height="24" fill="%237ba1ba"/%3E%3C/svg%3E';node.alt='研究图';}
    else if(/^\|/.test(line)){node=document.createElement('table');const tr=node.createEl('tr');line.split('|').filter(Boolean).forEach(cell=>tr.createEl('td',{text:cell}));}
    else{node=document.createElement(/^#{1,6}\s/.test(line)?'h2':'p');node.textContent=line.replace(/^#{1,6}\s+/,'');}
    fragment.append(node);
   }
   root.append(fragment);entry.finished=performance.now();
   component.register(()=>{root.dataset.unloaded='true'});
  }};
  window.app={vault:{async cachedRead(file){window.reads.push({path:file.path,mtime:file.stat.mtime});const text=file.text;await pause(file.readDelay??25);return text}}};
  window.makeNote=(length,path)=>{
   const lines=['---','title: 性能验收','tags: [测试]','---','# 空间研究与图表预览'];
   let index=0;const body='通过空间转录组联合组织学方法识别肿瘤细胞与免疫细胞的空间分布。';
   while(lines.join('\n').length<length){lines.push(`## 第${++index}节 研究材料与组织结构`,body+body,`![空间图${index}](https://example.invalid/slow-resource-${index}.png)`,'| 组别 | 样本数 | 信号强度 |','| --- | ---: | ---: |',`| 病例${index} | 12 | 1.35 |`,body,'');}
   const line=Math.floor(lines.length*.6);lines[line]='性能匹配位置：病例区域的空间组织结构需要在预览首屏立即可见。';
   const text=lines.join('\n');return{path,basename:path.split('/').pop().replace(/\.md$/,''),extension:'md',text,stat:{mtime:1,size:text.length},line,content:lines[line]};
  };
 });
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(()=>{window.preview=new window.PreviewTools.MobileSearchPreview(window.app,document.querySelector('.host'),{open(){window.opens++},back(){window.backs++},dismissKeyboard(){window.dismissals++}})});

 for(const size of [52000,125000]){
  const caseResult=await page.evaluate(async size=>{
   const file=window.makeNote(size,`研究/长中文图表-${size}.md`),target={file,line:file.line,content:file.content};window.lastTarget=target;
   const measure=async()=>{
    const start=performance.now(),readCount=window.reads.length,renderCount=window.renders.length;let firstContent=null;
    const record=()=>{if(firstContent===null&&window.preview.content.textContent.includes(target.content))firstContent=performance.now()-start};
    const observer=new MutationObserver(record);observer.observe(window.preview.content,{childList:true,subtree:true,characterData:true});
    const show=window.preview.show(target);record();
    const toolbarReadyMs=[...window.preview.element.querySelectorAll('.fs-preview-back,.fs-preview-open')].every(button=>!button.disabled&&button.getBoundingClientRect().width>0)?performance.now()-start:null;
    await show;await new Promise(requestAnimationFrame);record();const readyMs=performance.now()-start;
    await window.preview.whenFormatted;await new Promise(requestAnimationFrame);record();observer.disconnect();
    return{firstContentMs:firstContent,toolbarReadyMs,readyMs,completeMs:performance.now()-start,reads:window.reads.length-readCount,renders:window.renders.length-renderCount,renderChars:window.renders.slice(renderCount).map(x=>x.chars),elements:window.preview.content.querySelectorAll('*').length};
   };
   const cold=await measure();window.preview.hide();const warm=await measure();
   return{size:file.text.length,lines:file.text.split('\n').length,cold,warm};
  },size);
  report.cases.push({name:'long-note-cold-warm',...caseResult});
  assert.ok(caseResult.cold.firstContentMs!==null,'Selected long-note content must be visible');
  if(!baseline){
   assert.ok(caseResult.cold.renderChars.every(chars=>chars<=18000),'Cold preview should bound rich Markdown work: '+JSON.stringify(caseResult));
   assert.equal(caseResult.warm.reads,0,'Repeated preview should reuse the current file version');
   assert.equal(caseResult.warm.renders,0,'Repeated preview should reuse rendered Markdown');
   assert.ok(caseResult.warm.completeMs<100,'Warm preview should be ready within one or a few frames in controlled fixture');
  }
 }

 const mutation=await page.evaluate(async()=>{
  const target=window.lastTarget,reads=window.reads.length,renders=window.renders.length;
  target.file.text=target.file.text.replace(target.content,'已修改的病例区域结构：缓存应依据文件版本更新。');target.content='已修改的病例区域结构：缓存应依据文件版本更新。';target.file.stat.mtime++;target.file.stat.size=target.file.text.length;
  await window.preview.show(target);await window.preview.whenFormatted;
  return{reads:window.reads.length-reads,renders:window.renders.length-renders,updated:window.preview.content.textContent.includes(target.content)};
 });
 report.cases.push({name:'file-version-invalidates-preview',...mutation});assert.equal(mutation.updated,true);assert.equal(mutation.reads,1);assert.ok(mutation.renders>=1);

 if(!baseline){
  const paging=await page.evaluate(async()=>{
   const before=window.preview.content.textContent,reads=window.reads.length;
   const next=window.preview.element.querySelector('.fs-preview-next');if(!next||next.disabled)return{nextAvailable:false};
   next.click();for(let i=0;i<100&&window.preview.content.textContent===before;i++)await window.pause(10);
   await window.preview.whenFormatted;
   return{nextAvailable:true,changed:window.preview.content.textContent!==before,reads:window.reads.length-reads,previousAvailable:!window.preview.element.querySelector('.fs-preview-previous').disabled};
  });
  report.cases.push({name:'next-fragment-reuses-source-and-retains-navigation',...paging});
  assert.equal(paging.nextAvailable,true);assert.equal(paging.changed,true);assert.equal(paging.reads,0);assert.equal(paging.previousAvailable,true);
 }

 const firstPaint=await page.evaluate(async()=>{
  window.preview.hide();const file=window.makeNote(53000,'研究/慢资源首屏.md'),target={file,line:file.line,content:file.content};let release;
  window.gates.set(file.path,{promise:new Promise(r=>{release=r})});
  const start=performance.now(),show=window.preview.show(target);await window.pause(80);
  const firstVisible=window.preview.content.textContent.includes(file.content),buttons=[...window.preview.element.querySelectorAll('.fs-preview-back,.fs-preview-open')].map(b=>({disabled:b.disabled,width:b.getBoundingClientRect().width}));
  const anchor=window.preview.content.querySelector('.fs-mobile-preview-fragment[data-state="plain"] .is-search-target');
  const area=window.preview.content.getBoundingClientRect(),anchorRect=anchor?.getBoundingClientRect();
  const anchorInView=!!anchorRect&&anchorRect.top>=area.top-1&&anchorRect.bottom<=area.bottom+1;
  const atCheckMs=performance.now()-start;
  const backStart=performance.now();window.preview.element.querySelector('.fs-preview-back').click();const closedAfterBack=!window.preview.visible,backResponseMs=performance.now()-backStart;
  release();await show;await window.preview.whenFormatted;window.gates.delete(file.path);
  return{firstVisible,anchorInView,anchorRect:anchorRect?.toJSON(),contentRect:area.toJSON(),atCheckMs,closedAfterBack,stillClosed:!window.preview.visible,backResponseMs,buttons};
 });
 report.cases.push({name:'slow-renderer-first-content-and-back',...firstPaint});
 if(!baseline)assert.equal(firstPaint.firstVisible,true,'Initial readable context should precede slow Markdown/resources');
 if(!baseline)assert.equal(firstPaint.anchorInView,true,'Plain first content should scroll its exact match into the visible area before slow formatting');
 assert.equal(firstPaint.closedAfterBack,true);assert.equal(firstPaint.stillClosed,true);assert.ok(firstPaint.buttons.every(b=>!b.disabled&&b.width>0));

 const race=await page.evaluate(async()=>{
  const a=window.makeNote(54000,'研究/旧请求A.md'),b=window.makeNote(12000,'研究/新请求B.md');a.readDelay=100;b.readDelay=5;
  a.text=a.text.replace(a.content,'旧请求 A 的唯一正文');a.content='旧请求 A 的唯一正文';a.stat.size=a.text.length;
  b.text=b.text.replace(b.content,'新请求 B 的唯一正文');b.content='新请求 B 的唯一正文';b.stat.size=b.text.length;
  const old=window.preview.show({file:a,line:a.line,content:a.content});await window.pause(10);
  const latest=window.preview.show({file:b,line:b.line,content:b.content});await Promise.all([old,latest]);await window.preview.whenFormatted;
  return{title:window.preview.element.querySelector('h2').textContent,path:window.preview.element.querySelector('.float-search-mobile-preview-path').textContent,latestVisible:window.preview.content.textContent.includes(b.content),oldVisible:window.preview.content.textContent.includes(a.content)};
 });
 report.cases.push({name:'late-request-cannot-overwrite-current-file',...race});assert.ok(race.path.includes('新请求B.md'));assert.equal(race.latestVisible,true);assert.equal(race.oldVisible,false);

 const renderRace=await page.evaluate(async()=>{
  const a=window.makeNote(11000,'研究/慢排版A.md'),b=window.makeNote(10000,'研究/快排版B.md');a.readDelay=b.readDelay=5;
  a.text=a.text.replace(a.content,'迟到排版 A 的唯一正文');a.content='迟到排版 A 的唯一正文';a.stat.size=a.text.length;
  b.text=b.text.replace(b.content,'当前排版 B 的唯一正文');b.content='当前排版 B 的唯一正文';b.stat.size=b.text.length;
  let release;window.gates.set(a.path,{promise:new Promise(r=>{release=r})});
  const old=window.preview.show({file:a,line:a.line,content:a.content});await window.pause(40);const pendingOldFormatting=window.preview.whenFormatted;
  await window.preview.show({file:b,line:b.line,content:b.content});await window.preview.whenFormatted;
  release();await old;await pendingOldFormatting;window.gates.delete(a.path);await window.pause(20);
  return{path:window.preview.element.querySelector('.float-search-mobile-preview-path').textContent,latestVisible:window.preview.content.textContent.includes(b.content),oldVisible:window.preview.content.textContent.includes(a.content)};
 });
 report.cases.push({name:'late-markdown-render-cannot-overwrite-current-file',...renderRace});assert.ok(renderRace.path.includes('快排版B.md'));assert.equal(renderRace.latestVisible,true);assert.equal(renderRace.oldVisible,false);

 if(!baseline){
  const pendingReuse=await page.evaluate(async()=>{
   const file=window.makeNote(18000,'研究/重复点按在途片段.md'),reads=window.reads.length,renders=window.renders.length;let release;
   window.gates.set(file.path,{promise:new Promise(r=>{release=r})});
   const target={file,line:file.line,content:file.content};await window.preview.show(target);await window.pause(40);
   const originalNode=window.preview.content.firstElementChild,originalFormatting=window.preview.whenFormatted;
   await window.preview.show(target);const reusedNode=window.preview.content.firstElementChild===originalNode;
   const reusedFormatting=window.preview.whenFormatted===originalFormatting;
   await window.preview.show({...target,content:file.content.slice(2),matchOffset:2});
   const changedTargetUpdatedNode=window.preview.content.firstElementChild!==originalNode;
   const changedAnchor=window.preview.content.querySelector('.fs-mobile-preview-plain .is-search-target')?.textContent;
   const changedTargetPrecise=changedAnchor===file.content.slice(2);
   const formatting=window.preview.whenFormatted;
   release();await formatting;window.gates.delete(file.path);
   return{reads:window.reads.length-reads,renders:window.renders.length-renders,visible:window.preview.content.textContent.includes(file.content),reusedNode,reusedFormatting,changedTargetUpdatedNode,changedTargetPrecise};
  });
  report.cases.push({name:'same-pending-fragment-reuses-read-and-render-job',...pendingReuse});assert.equal(pendingReuse.reads,1);assert.equal(pendingReuse.renders,1);assert.equal(pendingReuse.visible,true);
  assert.equal(pendingReuse.reusedNode,true,'Repeated identical pending target should preserve the readable DOM');
  assert.equal(pendingReuse.reusedFormatting,true,'Repeated and changed targets within the pending fragment should retain one formatting job');
  assert.equal(pendingReuse.changedTargetUpdatedNode,true);assert.equal(pendingReuse.changedTargetPrecise,true,'Changed target within the fragment should update its exact plain-text anchor');

  const versionRace=await page.evaluate(async()=>{
   const file=window.makeNote(12000,'研究/并行文件版本.md');file.readDelay=100;
   const oldText=file.content,old=window.preview.show({file,line:file.line,content:oldText});await window.pause(10);
   file.text=file.text.replace(oldText,'较新文件版本的唯一匹配正文');file.content='较新文件版本的唯一匹配正文';file.stat.mtime++;file.stat.size=file.text.length;file.readDelay=5;
   const target={file,line:file.line,content:file.content};await window.preview.show(target);await window.preview.whenFormatted;await old;
   const reads=window.reads.length,renders=window.renders.length;await window.preview.show(target);await window.preview.whenFormatted;
   return{latestVisible:window.preview.content.textContent.includes(file.content),oldVisible:window.preview.content.textContent.includes(oldText),repeatReads:window.reads.length-reads,repeatRenders:window.renders.length-renders};
  });
  report.cases.push({name:'late-old-file-version-keeps-new-version-cache',...versionRace});assert.equal(versionRace.latestVisible,true);assert.equal(versionRace.oldVisible,false);assert.equal(versionRace.repeatReads,0);assert.equal(versionRace.repeatRenders,0);
 }
 await page.evaluate(()=>window.preview.destroy());
 assert.equal(await page.evaluate(()=>window.components.every(c=>!c.loaded)),true,'Destroy releases every retained renderer component');
 assert.deepEqual(errors,[]);
 const output=`output/playwright/mobile-preview-performance-${baseline?'baseline':'results'}.json`;
 await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 console.log('PASS Preview timing, bounded work, repeated views, file invalidation, slow resources, stale requests and disposal');
}finally{await browser.close()}
