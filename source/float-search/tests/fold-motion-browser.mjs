import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import path from 'node:path';
import os from 'node:os';
const require=createRequire(import.meta.url);let playwright;
try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const baseline=process.argv.includes('--baseline'),mode=baseline?'baseline':'results',output='output/playwright';
await mkdir(output,{recursive:true});
const bundle=baseline?await readFile(`${output}/fold-motion-baseline-bundle.js`,'utf8'):(await build({entryPoints:['src/search/searchMotion.ts'],bundle:true,format:'iife',globalName:'FoldMotion',write:false,logLevel:'silent'})).outputFiles[0].text;
const browser=await playwright.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),report={mode,times:[0,16,50,100,150,220,260],cases:[]};
try{
 const page=await browser.newPage({viewport:{width:760,height:720}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<style>body{margin:0;padding:24px;font:14px system-ui;background:#edf1f7;color:#25374d}#modal{width:388px}#results{height:440px;overflow:auto;border:1px solid #a8b5c6;background:white;overflow-anchor:none}.suggestion-item{height:44px;margin-bottom:var(--row-gap,0px);box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:0 8px;border-bottom:1px solid #e4e9ef;background:white;flex-shrink:0}.header{background:#dce7f5;font-weight:600}.child{padding-left:28px;color:#57677d}button{height:36px;width:30px;border:0;background:transparent}.title{white-space:nowrap}h1{font-size:18px;margin:0 0 12px}</style><h1>展开与收起连续几何验收</h1><main id="modal"><div id="results"></div></main>');
 await page.addScriptTag({content:bundle});
 await page.evaluate(()=>{
  window.list=document.getElementById('results');window.clicks=0;window.ends=[];
  window.list.addEventListener('fs-result-motion-end',()=>window.ends.push({active:window.FoldMotion.isResultMotionActive?.(window.list),wrappers:window.list.querySelectorAll('.fs-search-motion-group').length}));
  window.row=(key,label,kind='header')=>{const row=document.createElement('div');row.className=`suggestion-item ${kind}`;row.dataset.resultKey=key;if(kind==='child')row.dataset.motionGroup='group';row.innerHTML=`<button type="button">›</button><span class="title">${label}</span>`;row.querySelector('button').onclick=()=>window.clicks++;return row};
  window.render=(expanded)=>{
   const config=window.config,fragment=document.createDocumentFragment();
   for(let i=0;i<config.prefix;i++)fragment.append(window.row(`prefix-${i}`,`PREFIX_${i}`));
   fragment.append(window.row('group','GROUP_HEADER'));
   for(let i=0;i<(expanded?config.count:config.limit);i++)fragment.append(window.row(`child-${i}`,`CHILD_${i}`,'child'));
   fragment.append(window.row('next','NEXT_GROUP'));
   for(let i=0;i<config.tail;i++)fragment.append(window.row(`tail-${i}`,`TAIL_${i}`));
   window.list.replaceChildren(fragment);window.expanded=expanded;
  };
  window.setup=config=>{window.FoldMotion.cancelSearchMotion(document.getElementById('modal'));window.ends=[];window.config={prefix:0,tail:8,...config};window.list.style.setProperty('--row-gap',`${config.margin??0}px`);window.render(config.initial);window.list.scrollTop=config.nearBottom?window.list.scrollHeight-window.list.clientHeight:0;};
  window.change=expanded=>{
   const exitingKeys=new Set();if(!expanded)for(let i=window.config.limit;i<window.config.count;i++)exitingKeys.add(`child-${i}`);
   const childKeys=new Set(Array.from({length:window.config.count},(_,i)=>`child-${i}`));let committed=false;
   window.FoldMotion.animateResultChange(window.list,()=>{window.render(expanded);committed=true},{groupKey:'group',direction:expanded?'expand':'collapse',childKeys,exitingKeys});
   return{committed,semanticChildren:window.list.querySelectorAll('.suggestion-item.child').length};
  };
  window.clipRect=(element,rect)=>{
   let top=Math.max(0,rect.top),bottom=Math.min(innerHeight,rect.bottom),opacity=1;
   for(let parent=element;parent;parent=parent.parentElement){const style=getComputedStyle(parent);opacity*=Number(style.opacity);if(style.visibility==='hidden'||style.display==='none')opacity=0;if(/hidden|clip|auto|scroll/.test(style.overflowY)){const bounds=parent.getBoundingClientRect();top=Math.max(top,bounds.top);bottom=Math.min(bottom,bounds.bottom);}}
   return{top,bottom,opacity,visible:bottom-top>1&&opacity>.03};
  };
  window.capture=()=>{
   const next=window.list.querySelector('[data-result-key="next"]'),nextRect=next.getBoundingClientRect(),bounds=window.list.getBoundingClientRect();
   const headers=[...window.list.querySelectorAll('.header')].map(row=>window.clipRect(row,row.getBoundingClientRect())).filter(rect=>rect.visible);
   const visuals=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let text;
   while(text=walker.nextNode())if(/^CHILD_\d+$/.test(text.textContent)&&!text.parentElement.closest('.suggestion-item[data-result-key]')){
    let row=text.parentElement;while(row.parentElement&&row.getBoundingClientRect().height<40)row=row.parentElement;
    const rect=window.clipRect(row,row.getBoundingClientRect());if(rect.visible)visuals.push(rect);
   }
   const overlap=visuals.reduce((total,visual)=>total+headers.filter(header=>Math.min(header.bottom,visual.bottom)-Math.max(header.top,visual.top)>1).length,0);
   const exits=[...document.querySelectorAll('.fs-mobile-motion-ghost,.fs-search-motion-exit')];
   const visualSafe=exits.every(element=>element.closest('[inert]')&&element.closest('[aria-hidden="true"]')&&getComputedStyle(element).pointerEvents==='none'&&!element.querySelector('button,input,textarea,select,a,[data-result-key]'));
   return{nextY:nextRect.top,nextVisible:nextRect.bottom>bounds.top&&nextRect.top<bounds.bottom,scrollTop:window.list.scrollTop,scrollHeight:window.list.scrollHeight,overlap,visualSafe,visualCount:visuals.length,semanticChildren:window.list.querySelectorAll('.suggestion-item.child').length,wrappers:document.querySelectorAll('.fs-search-motion-group,.fs-mobile-motion-layer').length,animations:document.getAnimations().length};
  };
  window.sample=async config=>{
   window.setup(config);const before=window.capture(),start=performance.now(),commit=window.change(!config.initial),samples=[];
   for(const target of [0,16,50,100,150,220,260]){const wait=target-(performance.now()-start);if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));samples.push({time:target,elapsed:performance.now()-start,...window.capture()});}
   const last=samples.at(-1),expected=window.list.getBoundingClientRect().top+1+(window.config.prefix+1+(window.expanded?window.config.count:window.config.limit))*(44+(window.config.margin??0))-window.list.scrollTop;
   const sign=window.expanded?1:-1,monotonic=samples.every((sample,index)=>index===0||(sample.nextY-samples[index-1].nextY)*sign>=-1);
   const firstJump=Math.abs(samples[0].nextY-before.nextY),finalError=Math.abs(last.nextY-expected),maxOverlap=Math.max(...samples.map(sample=>sample.overlap));
   const button=window.list.querySelector('[data-result-key="next"] button'),clicks=window.clicks;button.click();
   return{config,before,commit,samples,firstJump,monotonic,finalError,maxOverlap,clickable:window.clicks===clicks+1,endEvents:[...window.ends]};
  };
 });

 const matrix=[
  {name:'mobile-small-expand',initial:false,count:5,limit:0},
  {name:'mobile-small-collapse',initial:true,count:5,limit:0},
  {name:'desktop-small-expand',initial:false,count:8,limit:3,margin:1},
  {name:'desktop-small-collapse',initial:true,count:8,limit:3,margin:1},
  {name:'mobile-50-expand',initial:false,count:50,limit:0},
  {name:'desktop-100-expand',initial:false,count:100,limit:3},
  {name:'mobile-50-collapse',initial:true,count:50,limit:0},
  {name:'desktop-100-collapse',initial:true,count:100,limit:3},
  {name:'mobile-50-bottom-collapse',initial:true,count:50,limit:0,prefix:8,tail:2,nearBottom:true},
  {name:'desktop-100-bottom-collapse',initial:true,count:100,limit:3,prefix:8,tail:2,nearBottom:true},
 ];
 for(const config of matrix){const result=await page.evaluate(config=>window.sample(config),config);report.cases.push(result);}

 const reversal=await page.evaluate(async()=>{
  window.setup({name:'rapid-reversal',initial:true,count:50,limit:0});window.change(false);await new Promise(resolve=>setTimeout(resolve,50));const before=window.capture();window.change(true);const after=window.capture();await new Promise(resolve=>setTimeout(resolve,50));const secondBefore=window.capture();window.change(false);const secondAfter=window.capture();await new Promise(resolve=>setTimeout(resolve,260));return{before,after,secondBefore,secondAfter,final:window.capture(),firstJump:Math.abs(after.nextY-before.nextY),secondJump:Math.abs(secondAfter.nextY-secondBefore.nextY),endEvents:[...window.ends]};
 });report.reversal=reversal;
 const crossGroups=[];
 for(const initialB of [false,true])crossGroups.push(await page.evaluate(async initialB=>{
  window.FoldMotion.cancelSearchMotion(document.getElementById('modal'));window.list.style.height='600px';window.list.style.setProperty('--row-gap','0px');window.list.scrollTop=0;
  const state={a:false,b:initialB},counts={a:8,b:4};
  const render=()=>{const fragment=document.createDocumentFragment();for(const name of ['a','b']){const key=`group-${name}`,parent=window.row(key,`GROUP_${name.toUpperCase()}`);if(name==='b')parent.querySelector('button').onclick=()=>change('b',!state.b);fragment.append(parent);for(let i=0;i<(state[name]?counts[name]:0);i++){const row=window.row(`${name}-child-${i}`,`${name.toUpperCase()}_CHILD_${i}`,'child');row.dataset.motionGroup=key;fragment.append(row);}}fragment.append(window.row('cross-next','CROSS_NEXT'));window.list.replaceChildren(fragment)};
  let click;
  const change=(name,expanded)=>{const parent=window.list.querySelector('[data-result-key="group-b"]'),before=parent.getBoundingClientRect(),bounds=window.list.getBoundingClientRect(),button=parent.querySelector('button'),buttonRect=button.getBoundingClientRect(),hit=document.elementFromPoint(buttonRect.left+buttonRect.width/2,buttonRect.top+buttonRect.height/2);const childKeys=new Set(Array.from({length:counts[name]},(_,i)=>`${name}-child-${i}`)),exitingKeys=expanded?new Set():childKeys;window.FoldMotion.animateResultChange(window.list,()=>{state[name]=expanded;render()},{groupKey:`group-${name}`,direction:expanded?'expand':'collapse',childKeys,exitingKeys});if(name==='b')click={beforeY:before.top,afterY:window.list.querySelector('[data-result-key="group-b"]').getBoundingClientRect().top,visibleAtClick:before.top>=bounds.top&&before.bottom<=bounds.bottom,pointerReachable:hit===button||button.contains(hit)}};
  render();change('a',true);await new Promise(resolve=>setTimeout(resolve,80));const started=performance.now();window.list.querySelector('[data-result-key="group-b"] button').click();const samples=[];
  for(const time of [0,16,50,100,150,220,260]){const wait=time-(performance.now()-started);if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));samples.push({time,parentY:window.list.querySelector('[data-result-key="group-b"]').getBoundingClientRect().top,nextY:window.list.querySelector('[data-result-key="cross-next"]').getBoundingClientRect().top,scrollTop:window.list.scrollTop});}
  const result={initialB,...click,jump:Math.abs(click.afterY-click.beforeY),finishJump:Math.abs(samples.at(-1).parentY-samples.at(-2).parentY),samples,finalChildren:window.list.querySelectorAll('[data-motion-group="group-b"]').length,wrappers:window.list.querySelectorAll('.fs-search-motion-group').length};window.list.style.height='440px';return result;
 },initialB));report.crossGroups=crossGroups;
 const close=await page.evaluate(()=>{window.setup({initial:true,count:50,limit:0});window.change(false);const parent=document.getElementById('modal');window.FoldMotion.cancelSearchMotion(parent);parent.remove();const result={...window.capture(),detached:!parent.isConnected,endEvents:[...window.ends]};document.body.append(parent);return result});report.close=close;
 await page.emulateMedia({reducedMotion:'reduce'});
 const reduced=await page.evaluate(()=>{window.setup({initial:true,count:50,limit:0});const commit=window.change(false);return{commit,...window.capture()}});report.reduced=reduced;await page.emulateMedia({reducedMotion:'no-preference'});

 const unsupported=await page.evaluate(()=>{window.setup({initial:true,count:50,limit:0});const animate=window.list.animate;window.list.animate=undefined;const commit=window.change(false),result={commit,...window.capture(),endEvents:[...window.ends]};window.list.animate=animate;return result});report.unsupported=unsupported;

 // Freeze CSS animation time only for reproducible screenshots; metrics above run in real time.
 await page.evaluate(()=>{window.setup({initial:true,count:5,limit:0});window.change(false);window.frameAnimations=document.getAnimations();for(const animation of window.frameAnimations){animation.pause();animation.currentTime=0}});
 for(const time of [0,16,50,100,150,220]){await page.evaluate(time=>{for(const animation of window.frameAnimations)animation.currentTime=time},time);await page.screenshot({path:`${output}/fold-motion-${mode}-frame-${time}.png`,animations:'allow'});}
 await page.evaluate(()=>window.FoldMotion.cancelSearchMotion(document.getElementById('modal')));
 report.failures=report.cases.flatMap(result=>[
  ...(result.firstJump>2?[`${result.config.name}: first-frame jump ${result.firstJump.toFixed(2)}px`]:[]),
  ...(!result.monotonic?[`${result.config.name}: non-monotonic next row`]:[]),
  ...(result.maxOverlap>0?[`${result.config.name}: outgoing/header overlaps ${result.maxOverlap}`]:[]),
  ...(result.finalError>1?[`${result.config.name}: final geometry error ${result.finalError}`]:[]),
 ]);
 for(const result of crossGroups){if(result.jump>2)report.failures.push(`cross-group-${result.initialB?'collapse':'expand'}: parent anchor jump ${result.jump.toFixed(2)}px`);if(result.finishJump>2)report.failures.push(`cross-group-${result.initialB?'collapse':'expand'}: cleanup anchor jump ${result.finishJump.toFixed(2)}px`);}
 await writeFile(`${output}/fold-motion-${mode}.json`,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({mode,cases:report.cases.map(({config,firstJump,monotonic,maxOverlap,finalError})=>({name:config.name,firstJump,monotonic,maxOverlap,finalError})),reversal:{firstJump:reversal.firstJump,secondJump:reversal.secondJump},failures:report.failures},null,2));
 if(!baseline){
  assert.deepEqual(report.failures,[]);
  for(const result of report.cases){assert.equal(result.commit.committed,true);assert.equal(result.commit.semanticChildren,result.config.initial?result.config.limit:result.config.count);assert.equal(result.clickable,true);assert.ok(result.samples.every(sample=>sample.visualSafe));assert.equal(result.samples.at(-1).wrappers,0);assert.equal(result.samples.at(-1).animations,0);assert.deepEqual(result.endEvents,[{active:false,wrappers:0}]);}
  assert.ok(reversal.firstJump<=2&&reversal.secondJump<=2,'Rapid reversal must continue from current visual geometry');assert.equal(reversal.final.semanticChildren,0);assert.equal(reversal.final.wrappers,0);assert.equal(reversal.final.animations,0);assert.deepEqual(reversal.endEvents,[{active:false,wrappers:0}]);
  for(const result of crossGroups){assert.equal(result.visibleAtClick,true);assert.equal(result.pointerReachable,true);assert.equal(result.finalChildren,result.initialB?0:4);assert.equal(result.wrappers,0);}
  assert.equal(close.wrappers,0);assert.equal(close.animations,0);assert.equal(close.semanticChildren,0);assert.equal(close.detached,true);assert.deepEqual(close.endEvents,[]);assert.equal(reduced.commit.committed,true);assert.equal(reduced.wrappers,0);assert.equal(reduced.animations,0);assert.equal(unsupported.commit.committed,true);assert.equal(unsupported.semanticChildren,0);assert.equal(unsupported.wrappers,0);assert.equal(unsupported.animations,0);assert.deepEqual(unsupported.endEvents,[]);assert.deepEqual(errors,[]);
 }
 console.log(`PASS Fold motion ${mode}: sampled geometry, overlap, long lists, reversals, closing and reduced motion`);
}finally{await browser.close()}
