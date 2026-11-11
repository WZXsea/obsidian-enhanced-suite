import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import path from 'node:path';
import os from 'node:os';
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const bundle=await build({entryPoints:['src/search/mobileMotion.ts'],bundle:true,format:'iife',globalName:'Motion',write:false});
const browser=await playwright.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
await mkdir('output/playwright',{recursive:true});
const checks=[];
try{
 const page=await browser.newPage({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:14px system-ui}#modal{margin:24px 12px}#results{height:280px;overflow:auto;border:1px solid #ddd}.suggestion-item{height:44px;display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;border-bottom:1px solid #eee;box-sizing:border-box;background:white}.suggestion-title{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}button{height:44px;width:44px;border:0;background:transparent}#preview{height:180px;margin-top:20px;background:#eef3fa;overflow:auto}</style><main id="modal"><div id="results"></div><section id="preview"><div id="content">匹配的原文首屏始终可读。</div></section></main>');
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(()=>{
  window.makeRow=key=>{const row=document.createElement('div');row.id=`row-${key}`;row.className='suggestion-item float-search-cmdk-result';row.dataset.resultKey=String(key);row.setAttribute('role','option');row.setAttribute('aria-selected','false');row.innerHTML=`<button class="float-search-cmdk-disclosure" name="arrow-${key}" aria-label="展开">›</button><div class="suggestion-content"><div class="suggestion-title">病例 ${key} 的组织学与空间研究结果</div></div><button class="float-search-cmdk-pin-button" name="pin-${key}">图钉</button>`;row.querySelector('button').onclick=()=>{window.arrowClicks=(window.arrowClicks??0)+1};return row;};
  window.results=document.querySelector('#results');for(let i=0;i<10;i++)window.results.append(window.makeRow(i));
 });

 const collapse=await page.evaluate(()=>{
  let committed=false;const started=performance.now();
  window.Motion.animateMobileResultChange(window.results,()=>{for(const key of [1,2,3])document.querySelector(`#row-${key}`).remove();committed=true;});
  const ghosts=[...document.querySelectorAll('.fs-mobile-motion-ghost')];
  return{committed,elapsedMs:performance.now()-started,realRows:window.results.querySelectorAll('.suggestion-item').length,realArrows:window.results.querySelectorAll('.float-search-cmdk-disclosure').length,
   ghosts:ghosts.length,ghostsSafe:ghosts.every(ghost=>ghost.getAttribute('aria-hidden')==='true'&&ghost.hasAttribute('inert')&&getComputedStyle(ghost).pointerEvents==='none'&&!ghost.querySelector('[id],[name],[role],[data-result-key],.suggestion-item,.float-search-cmdk-result,.float-search-cmdk-disclosure,button,input,textarea,select,a')),
   durations:document.getAnimations().map(a=>a.effect.getTiming().duration)};
 });
 assert.equal(collapse.committed,true);assert.equal(collapse.realRows,7);assert.equal(collapse.realArrows,7);assert.ok(collapse.ghosts>0&&collapse.ghosts<=6);assert.equal(collapse.ghostsSafe,true);assert.ok(collapse.durations.length>0&&collapse.durations.every(ms=>ms===160));
 await page.locator('#row-0 .float-search-cmdk-disclosure').tap();assert.equal(await page.evaluate(()=>window.arrowClicks),1);
 await page.evaluate(()=>{window.results.scrollTop=80});assert.ok(await page.evaluate(()=>window.results.scrollTop)>0);
 checks.push({name:'collapse-sync-dom-and-noninteractive-exit-visuals',...collapse});
 await page.waitForTimeout(220);
 assert.equal(await page.locator('.fs-mobile-motion-layer').count(),0);assert.equal(await page.evaluate(()=>document.getAnimations().length),0);
 checks.push({name:'motion-finishes-without-retained-layer-or-style',passed:true});

 const rapid=await page.evaluate(()=>{
  window.results.scrollTop=0;
  const expand=()=>{for(const key of [3,2,1])window.results.insertBefore(window.makeRow(key),window.results.children[1]);};
  const collapse=()=>{for(const key of [1,2,3])document.querySelector(`#row-${key}`)?.remove();};
  window.Motion.animateMobileResultChange(window.results,expand);
  window.Motion.animateMobileResultChange(window.results,collapse);
  window.Motion.animateMobileResultChange(window.results,expand);
  const finalRows=window.results.querySelectorAll('.suggestion-item').length;
  window.Motion.cancelMobileMotion(document.querySelector('#modal'));
  return{finalRows,ghosts:document.querySelectorAll('.fs-mobile-motion-layer').length,animations:document.getAnimations().length};
 });
 assert.deepEqual(rapid,{finalRows:10,ghosts:0,animations:0});checks.push({name:'rapid-reversal-and-ancestor-cancellation',...rapid});

 const navigation=await page.evaluate(()=>{
  const preview=document.querySelector('#preview'),content=document.querySelector('#content');
  window.Motion.animateMobileNavigation(preview,'forward');const first=preview.getAnimations()[0],frames=first.effect.getKeyframes();
  window.Motion.animateMobileNavigation(preview,'back');const replaced=first.playState==='idle';
  window.Motion.animateMobileNavigation(content,'next');const active=document.getAnimations().length;
  window.Motion.cancelMobileMotion(document.querySelector('#modal'));
  return{initialOpacity:Number(frames[0].opacity),duration:first.effect.getTiming().duration,replaced,active,remaining:document.getAnimations().length,readable:content.textContent.includes('首屏始终可读')};
 });
 assert.equal(navigation.initialOpacity,.85);assert.equal(navigation.duration,160);assert.equal(navigation.replaced,true);assert.equal(navigation.active,2);assert.equal(navigation.remaining,0);assert.equal(navigation.readable,true);checks.push({name:'readable-navigation-and-descendant-cancellation',...navigation});

 await page.emulateMedia({reducedMotion:'reduce'});
 const reduced=await page.evaluate(()=>{
  let updated=false;window.Motion.animateMobileResultChange(window.results,()=>{document.querySelector('#row-1').remove();updated=true});window.Motion.animateMobileNavigation(document.querySelector('#preview'),'previous');
  return{updated,animations:document.getAnimations().length,ghosts:document.querySelectorAll('.fs-mobile-motion-layer').length};
 });
 assert.deepEqual(reduced,{updated:true,animations:0,ghosts:0});checks.push({name:'reduced-motion-keeps-synchronous-updates-without-animation',...reduced});
 await page.emulateMedia({reducedMotion:'no-preference'});
 const unsupported=await page.evaluate(()=>{
  const animate=window.results.animate;window.results.animate=undefined;let called=0;
  window.Motion.animateMobileResultChange(window.results,()=>called++);window.Motion.animateMobileNavigation(window.results,'next');window.results.animate=animate;
  return{called,animations:document.getAnimations().length};
 });
 assert.deepEqual(unsupported,{called:1,animations:0});checks.push({name:'missing-waapi-commits-final-dom-once',...unsupported});

 await page.setViewportSize({width:412,height:1800});
 const performanceReport=await page.evaluate(()=>{
  const original=window.getComputedStyle;let styleReads=0;
  window.getComputedStyle=function(...args){styleReads++;return original.apply(this,args)};
  window.results.style.height='1440px';
  const samples=[];
  try{
   for(const change of ['expand','collapse'])for(const optimized of [false,true])for(let run=0;run<23;run++){
    window.Motion.cancelMobileMotion(document.querySelector('#modal'));window.results.replaceChildren();window.results.scrollTop=0;
    const fragment=document.createDocumentFragment();for(let i=0;i<100;i++)fragment.append(window.makeRow(i));window.results.append(fragment);window.results.getBoundingClientRect();
    styleReads=0;let committed=false;
    const update=()=>{
     if(change==='expand')for(let i=1000;i<1010;i++)window.results.insertBefore(window.makeRow(i),window.results.children[1]);
     else for(let i=1;i<=20;i++)document.querySelector(`#row-${i}`).remove();
     committed=true;
    };
    const options=optimized?{exitingKeys:new Set(change==='expand'?[]:Array.from({length:20},(_,i)=>String(i+1)))}:undefined;
    const started=performance.now();window.Motion.animateMobileResultChange(window.results,update,options);const elapsedMs=performance.now()-started;
    const ghosts=document.querySelectorAll('.fs-mobile-motion-ghost').length;
    if(run>=3)samples.push({change,optimized,elapsedMs,styleReads,ghosts,committed});
   }
  }finally{window.Motion.cancelMobileMotion(document.querySelector('#modal'));window.getComputedStyle=original;}
  const summarize=(change,optimized)=>{
   const group=samples.filter(x=>x.change===change&&x.optimized===optimized),times=group.map(x=>x.elapsedMs).sort((a,b)=>a-b);
   return{change,mode:optimized?'known-exiting-keys':'legacy-default',samples:group.length,rows:100,maxVisibleRows:32,computedStyleCalls:group[0].styleReads,medianMs:times[Math.floor(times.length/2)],p95Ms:times[Math.ceil(times.length*.95)-1],maxGhosts:Math.max(...group.map(x=>x.ghosts)),committed:group.every(x=>x.committed)};
  };
  return['expand','collapse'].flatMap(change=>[summarize(change,false),summarize(change,true)]);
 });
 const legacyExpand=performanceReport.find(x=>x.change==='expand'&&x.mode==='legacy-default'),optimizedExpand=performanceReport.find(x=>x.change==='expand'&&x.mode==='known-exiting-keys');
 const legacyCollapse=performanceReport.find(x=>x.change==='collapse'&&x.mode==='legacy-default'),optimizedCollapse=performanceReport.find(x=>x.change==='collapse'&&x.mode==='known-exiting-keys');
 assert.equal(optimizedExpand.computedStyleCalls,0);assert.equal(optimizedExpand.maxGhosts,0);
 assert.ok(optimizedCollapse.computedStyleCalls<legacyCollapse.computedStyleCalls);assert.ok(optimizedCollapse.maxGhosts>0&&optimizedCollapse.maxGhosts<=6);
 assert.ok(optimizedExpand.medianMs<legacyExpand.medianMs);assert.ok(optimizedCollapse.medianMs<legacyCollapse.medianMs);assert.ok(performanceReport.every(x=>x.committed));
 await writeFile('output/playwright/mobile-motion-performance-results.json',JSON.stringify(performanceReport,null,2)+'\n');
 checks.push({name:'known-exits-limit-cloning-before-synchronous-update',cases:performanceReport});
 assert.deepEqual(errors,[]);
 await writeFile('output/playwright/mobile-motion-results.json',JSON.stringify(checks,null,2)+'\n');console.log(JSON.stringify(checks,null,2));
 console.log('PASS Synchronous collapse, noninteractive ghosts, 160ms cleanup, rapid reversal, navigation, reduced motion, and WAAPI fallback');
}finally{await browser.close()}
