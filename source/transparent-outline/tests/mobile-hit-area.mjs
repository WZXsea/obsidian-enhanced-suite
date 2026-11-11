import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
let playwright;
try{playwright=require('playwright');}
catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const project=fileURLToPath(new URL('../',import.meta.url));
const css=await readFile(path.join(project,'styles.css'),'utf8');
const baseline=process.argv.includes('--baseline');
const specificityBaseline=process.argv.includes('--specificity-baseline');
const reportMode=baseline?'baseline':specificityBaseline?'specificity-baseline':'regression';
const report={mode:reportMode,cssSha256:createHash('sha256').update(css).digest('hex'),renderer:'Independent Chromium touch fixture using the actual plugin CSS; native Obsidian gestures remain device acceptance.',cases:[],failures:[]};
const browser=await playwright.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const verify=(name,condition,details)=>{
 report.cases.push({name,...details,passed:Boolean(condition)});
 if(!condition)report.failures.push(name);
};

try{
 for(const viewport of [{width:412,height:915},{width:1024,height:768}]){
  const page=await browser.newPage({viewport,isMobile:true,hasTouch:true});
  const device=viewport.width<600?'phone':'tablet';
  await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>
   :root{--font-interface:system-ui;--font-ui-small:14px;--background-primary:white;--background-secondary:#eee;--text-normal:#222;--text-muted:#555;--text-accent:blue}
   html,body{margin:0;overflow:hidden}#host{position:relative;height:${viewport.height}px}#article{height:100%;overflow:auto;touch-action:pan-y}#article p{height:180px;margin:0;background:linear-gradient(white,#cef)}
   ${css}</style><body class="is-mobile"><div id="host"><article id="article">${'<p>可滚动的正文内容</p>'.repeat(30)}</article><aside class="to-outline" data-mode="hover" data-mobile="true" data-surface="transparent" tabindex="-1"><button class="to-outline-edge">目录</button><div class="to-outline-tools"><button class="to-outline-close">关闭</button></div><div class="to-outline-depth"><div class="to-outline-depth-track"><input class="to-outline-depth-range" type="range"></div></div><nav class="to-outline-list">${Array.from({length:60},(_,i)=>`<div class="to-outline-row" data-level="2"><button class="to-outline-link">第 ${i+1} 个文章标题</button></div>`).join('')}</nav></aside></div></body>`);
  await page.evaluate(()=>{
   window.panel=document.querySelector('.to-outline');
   window.article=document.querySelector('#article');
   window.touchStarts=[];
   // Model the current public open/close state change without touching the live app.
   document.querySelector('.to-outline-edge').onclick=()=>panel.classList.add('is-mobile-open');
   document.querySelector('.to-outline-close').onclick=()=>panel.classList.remove('is-mobile-open');
   document.addEventListener('touchstart',event=>touchStarts.push({target:event.target.className||event.target.id,article:article.contains(event.target),prevented:event.defaultPrevented}),{capture:true,passive:true});
  });
  const reset=async(mode='hover',classes='')=>{
   await page.mouse.move(1,1);
   await page.evaluate(({mode,classes})=>{document.activeElement?.blur();panel.dataset.mode=mode;panel.className=`to-outline ${classes}`;article.scrollTop=0;window.touchStarts=[];},{mode,classes});
  };
  const snapshot=()=>page.evaluate(()=>{
   const r=panel.getBoundingClientRect();
   const points=[{x:r.left+r.width*.25,y:r.top+r.height*.4},{x:r.left+r.width*.75,y:r.top+r.height*.6},{x:r.left+r.width*.5,y:r.bottom-30}];
   return{pointerEvents:getComputedStyle(panel).pointerEvents,hover:panel.matches(':hover'),focusWithin:panel.matches(':focus-within'),open:panel.classList.contains('is-mobile-open'),hits:points.map(p=>{const hit=document.elementFromPoint(p.x,p.y);return{...p,target:hit?.className||hit?.id,article:article.contains(hit)}})};
  });
  const closedCase=async(name,prepare=async()=>{})=>{
   await reset();await prepare();const state=await snapshot();
   verify(`${device}:${name}`,state.pointerEvents==='none'&&state.hits.every(hit=>hit.article),state);
  };
  await closedCase('closed-idle');
  await closedCase('closed-residual-revealed',()=>page.evaluate(()=>panel.classList.add('is-revealed')));
  await closedCase('closed-residual-expanded',()=>page.evaluate(()=>panel.classList.add('is-expanded')));
  await closedCase('closed-parent-focus-within',()=>page.evaluate(()=>panel.focus()));
  await closedCase('closed-sticky-hover',async()=>{
   const edge=await page.locator('.to-outline-edge').boundingBox();
   await page.mouse.move(edge.x+edge.width/2,edge.y+edge.height/2);
   const r=await page.locator('.to-outline').boundingBox();
   await page.mouse.move(r.x+r.width*.5,r.y+r.height*.5);
  });
  await reset('pinned');
  const pinned=await snapshot();
  verify(`${device}:pinned-closed`,pinned.pointerEvents==='none'&&pinned.hits.every(hit=>hit.article),pinned);

  // Trusted touch input establishes which scrolling ancestor receives the gesture.
  const client=await page.context().newCDPSession(page);
  const swipe=async(x,start,end)=>{
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:start}]});
   for(let i=1;i<=14;i++){
    await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:start+(end-start)*i/14}]});
    await page.waitForTimeout(15);
   }
   await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await page.waitForTimeout(700);
  };
  await reset('hover','is-revealed');
  const r=await page.locator('.to-outline').boundingBox();
  const start=r.y+r.height*.75,end=r.y+r.height*.25;
  await swipe(r.x+r.width*.65,start,end);
  const rightSwipe=await page.evaluate(()=>({scrollTop:article.scrollTop,touchStarts}));
  verify(`${device}:closed-right-body-scroll`,rightSwipe.scrollTop>100&&rightSwipe.touchStarts[0]?.article,rightSwipe);
  await reset('hover','is-revealed');
  await swipe(24,start,end);
  const leftSwipe=await page.evaluate(()=>({scrollTop:article.scrollTop,touchStarts}));
  verify(`${device}:closed-left-body-scroll`,leftSwipe.scrollTop>100&&leftSwipe.touchStarts[0]?.article,leftSwipe);

  await reset();
  const edge=await page.locator('.to-outline-edge').boundingBox();
  const edgeHit=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.classList.contains('to-outline-edge'),{x:edge.x+edge.width/2,y:edge.y+edge.height/2});
  await page.locator('.to-outline-edge').tap();
  const opened=await page.evaluate(()=>({open:panel.classList.contains('is-mobile-open'),pointerEvents:getComputedStyle(panel).pointerEvents,listDisplay:getComputedStyle(panel.querySelector('.to-outline-list')).display}));
  verify(`${device}:edge-button-opens-list`,edgeHit&&opened.open&&opened.pointerEvents==='auto'&&opened.listDisplay==='block',{edgeHit,...opened});
  const listRect=await page.locator('.to-outline-list').boundingBox();
  await swipe(listRect.x+listRect.width*.5,listRect.y+listRect.height*.8,listRect.y+listRect.height*.2);
  const listScroll=await page.evaluate(()=>({listScrollTop:panel.querySelector('.to-outline-list').scrollTop,bodyScrollTop:article.scrollTop}));
  verify(`${device}:open-list-scrolls`,listScroll.listScrollTop>100&&listScroll.bodyScrollTop===0,listScroll);
  await page.locator('.to-outline-close').tap();
  const afterClose=await snapshot();
  verify(`${device}:tap-close-restores-body-hit`,afterClose.pointerEvents==='none'&&afterClose.hits.every(hit=>hit.article),afterClose);
  await client.detach();await page.close();
 }
 for(const mobileAttribute of ['false',null]){
  const page=await browser.newPage({viewport:{width:1200,height:800},isMobile:false,hasTouch:false});
  const name=mobileAttribute===null?'legacy-attribute-absent':'data-mobile-false';
  const attribute=mobileAttribute===null?'':`data-mobile="${mobileAttribute}"`;
  await page.setContent(`<style>
   :root{--font-interface:system-ui;--font-ui-small:14px;--background-primary:white;--text-normal:#222;--text-muted:#555;--text-accent:blue}
   body{margin:0}#host{position:relative;height:800px}#article{height:100%;overflow:auto}#article p{height:180px;margin:0}
   ${css}</style><div id="host"><article id="article">${'<p>桌面正文</p>'.repeat(30)}</article><aside class="to-outline" data-mode="hover" ${attribute}><button class="to-outline-edge">目录</button><div class="to-outline-tools">展开层级</div><div class="to-outline-depth"><div class="to-outline-depth-track"><input class="to-outline-depth-range" type="range"></div></div><nav class="to-outline-list"><button class="to-outline-link">文章标题</button></nav></aside></div>`);
  await page.evaluate(()=>{window.enteredPointer=null;document.querySelector('.to-outline-edge').addEventListener('pointerenter',event=>{window.enteredPointer=event.pointerType;});});
  const desktopState=()=>page.evaluate(()=>{
   const panel=document.querySelector('.to-outline'),article=document.querySelector('#article'),list=panel.querySelector('.to-outline-list');
   const r=panel.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
   return{pointerEvents:getComputedStyle(panel).pointerEvents,listVisibility:getComputedStyle(list).visibility,hover:panel.matches(':hover'),focusWithin:panel.matches(':focus-within'),enteredPointer:window.enteredPointer,articleHit:article.contains(hit)};
  });
  await page.mouse.move(10,10);
  const initial=await desktopState();
  verify(`desktop:${name}:closed-body-hit`,initial.pointerEvents==='none'&&initial.articleHit,initial);
  const edge=await page.locator('.to-outline-edge').boundingBox();
  await page.mouse.move(edge.x+edge.width/2,edge.y+edge.height/2);
  await page.waitForTimeout(30);
  const hover=await desktopState();
  verify(`desktop:${name}:mouse-hover-opens`,hover.enteredPointer==='mouse'&&hover.pointerEvents==='auto'&&hover.listVisibility==='visible'&&!hover.articleHit,hover);
  // Escape dismissal wins over active hover and a retained reveal marker.
  await page.evaluate(()=>document.querySelector('.to-outline').classList.add('is-dismissed','is-revealed'));
  const dismissed=await page.evaluate(()=>{
   const panel=document.querySelector('.to-outline');
   return{classes:panel.className,components:['.to-outline-list','.to-outline-tools','.to-outline-depth'].map(selector=>{
    const style=getComputedStyle(panel.querySelector(selector));
    return{selector,visibility:style.visibility,pointerEvents:style.pointerEvents};
   })};
  });
  verify(`desktop:${name}:escape-dismissal-hides-hovered-components`,dismissed.components.every(component=>component.visibility==='hidden'&&component.pointerEvents==='none'),dismissed);
  await page.evaluate(()=>document.querySelector('.to-outline').classList.remove('is-dismissed','is-revealed'));
  await page.mouse.move(10,10);
  await page.locator('.to-outline-edge').focus();
  const focus=await desktopState();
  verify(`desktop:${name}:edge-focus-opens`,focus.focusWithin&&focus.pointerEvents==='auto'&&focus.listVisibility==='visible',focus);
  await page.evaluate(()=>document.activeElement.blur());
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.to-outline-list')).visibility==='hidden',{},{timeout:1500});
  const closed=await desktopState();
  verify(`desktop:${name}:leave-and-blur-restores-body-hit`,closed.pointerEvents==='none'&&closed.articleHit&&closed.listVisibility==='hidden',closed);
  await page.close();
 }
}finally{
 await browser.close();
 const destination=path.join(project,'..','qa','android-outline-scroll-20261112');
 await mkdir(destination,{recursive:true});
 await writeFile(path.join(destination,`${reportMode}.json`),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({mode:report.mode,cases:report.cases.length,failures:report.failures},null,2));
assert.deepEqual(report.failures,[],'Closed mobile outlines must expose the underlying note while their edge button and open list remain interactive.');
