import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import path from 'node:path';
import os from 'node:os';
const require=createRequire(import.meta.url);
let playwright;
try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const bundle=await build({stdin:{contents:'export * from "./src/search/searchMotion"; export {animateMobileResultChange,animateMobileNavigation,cancelMobileMotion} from "./src/search/mobileMotion";',resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'iife',globalName:'SharedMotion',write:false});
const browser=await playwright.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
await mkdir('output/playwright',{recursive:true});
const checks=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.setContent(`<style>:root{--background-primary:#fbfcfe;--background-secondary:#eef2f8;--background-modifier-border:#dbe2ed;--background-modifier-hover:#e4ebf5;--interactive-accent:#527bad;--interactive-accent-rgb:82,123,173;--text-normal:#273348;--text-muted:#64738a;--text-faint:#8290a5;--font-interface:system-ui;--font-ui-small:13px;--font-ui-smaller:11px;--size-2-2:4px;--size-2-3:6px;--size-4-2:8px;--radius-m:8px;--radius-s:5px}body{margin:0;background:var(--background-secondary);color:var(--text-normal);font:14px system-ui}body.theme-dark{--background-primary:#1d222b;--background-secondary:#272e39;--background-modifier-border:#394351;--text-normal:#e1e8f2;--text-muted:#adbcd0}.modal-container{position:fixed;inset:20px}.float-search-cmdk{padding:12px;background:var(--background-primary)}input{height:38px;margin-bottom:10px;width:80%}button{font:inherit}#results .suggestion-item{min-height:44px;height:44px;padding:0 4px}.float-search-cmdk-body{height:600px;max-height:600px}.float-search-cmdk-preview{min-width:480px}#native-button{margin:24px}p{margin:0 0 18px}</style>
 <div class="modal-container"><main class="float-search-cmdk"><input id="query" value="空间研究" aria-label="搜索"><div class="float-search-cmdk-body has-preview"><div id="results" class="prompt-results"><div class="suggestion-item float-search-cmdk-result is-selected" data-result-key="parent"><button id="toggle" class="float-search-cmdk-disclosure" aria-expanded="false">›</button><div class="suggestion-content"><div class="suggestion-title">空间研究的分组结果</div></div></div><div class="suggestion-item float-search-cmdk-result" data-result-key="last"><span></span><div class="suggestion-content">下一篇文章</div></div></div><aside class="float-search-cmdk-preview"><div class="fs-desktop-native-host"><button id="native-button">原生预览内容</button></div><section class="float-search-fast-preview" hidden><div class="float-search-mobile-preview-toolbar"><button>返回结果</button><button>打开笔记</button></div><div class="float-search-mobile-preview-heading"><h2>重复标题</h2></div><div class="float-search-mobile-preview-content markdown-rendered" contenteditable="false"><p>桌面快速预览优先显示当前匹配的原文片段。</p></div><div class="fs-preview-context-nav"><button>向前阅读</button><button>继续阅读</button></div></section></aside></div></main></div>`);
 await page.addStyleTag({content:await readFile('styles.css','utf8')});
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(()=>{
  window.expanded=false;window.nativeClicks=0;document.querySelector('#native-button').onclick=()=>window.nativeClicks++;
  document.querySelector('#toggle').onclick=()=>{
   const list=document.querySelector('#results'),exits=new Set(window.expanded?['a','b','c']:[]);
   window.SharedMotion.animateResultChange(list,()=>{
    if(window.expanded)list.querySelectorAll('[data-child]').forEach(row=>row.remove());
    else for(const key of ['a','b','c']){const row=document.createElement('div');row.className='suggestion-item float-search-cmdk-result is-child';row.dataset.resultKey=key;row.dataset.child='true';row.innerHTML='<span></span><div class="suggestion-content"><div class="suggestion-title">子结果 '+key+' 的原文</div></div>';list.insertBefore(row,list.lastElementChild);}
    window.expanded=!window.expanded;document.querySelector('#toggle').setAttribute('aria-expanded',String(window.expanded));
   },{exitingKeys:exits});
  };
 });
 await page.locator('#toggle').click();assert.equal(await page.locator('[data-child]').count(),3);
 assert.ok(await page.evaluate(()=>document.getAnimations().some(a=>a.effect.getTiming().duration===160)));
 await page.waitForTimeout(210);
 await page.locator('#toggle').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('[data-child]').count(),0);
 const collapsed=await page.evaluate(()=>({animations:document.getAnimations().length,ghosts:document.querySelectorAll('.fs-mobile-motion-ghost').length,focused:document.activeElement.id}));
 assert.ok(collapsed.animations>0);assert.ok(collapsed.ghosts>0);assert.equal(collapsed.focused,'toggle');
 checks.push({name:'desktop-pointer-expand-and-keyboard-collapse',...collapsed});
 await page.waitForTimeout(210);

 const alias=await page.evaluate(()=>{
  const motion=window.SharedMotion,preview=document.querySelector('.float-search-fast-preview'),root=document.querySelector('.modal-container');preview.hidden=false;
  motion.animateNavigation(preview);motion.cancelMobileMotion(root);const currentCancelled=document.getAnimations().length===0;
  motion.animateMobileNavigation(preview,'back');motion.cancelSearchMotion(root);const legacyCancelled=document.getAnimations().length===0;
  return{sameFunction:motion.animateNavigation===motion.animateMobileNavigation,currentCancelled,legacyCancelled};
 });
 assert.deepEqual(alias,{sameFunction:true,currentCancelled:true,legacyCancelled:true});checks.push({name:'desktop-and-mobile-aliases-share-one-teardown-registry',...alias});

 for(const theme of ['light','dark']){
  await page.evaluate(theme=>{
   document.body.className=`theme-${theme}`;const content=document.querySelector('.float-search-mobile-preview-content');
   content.replaceChildren();for(let i=0;i<60;i++){const p=document.createElement('p');p.textContent='第 '+i+' 段：通过空间转录组研究识别肿瘤与免疫细胞的空间组织结构。';content.append(p);}
   document.querySelector('#query').focus();document.querySelector('.float-search-fast-preview').hidden=false;
   window.SharedMotion.animateNavigation(content);
  },theme);
  const shell=await page.evaluate(()=>{
   const host=document.querySelector('.float-search-cmdk-preview'),fast=document.querySelector('.float-search-fast-preview'),content=fast.querySelector('.float-search-mobile-preview-content');
   const h=host.getBoundingClientRect(),f=fast.getBoundingClientRect();content.scrollTop=100;
   return{host:{width:h.width,height:h.height},fast:{width:f.width,height:f.height},readOnly:content.getAttribute('contenteditable')==='false',scrollable:content.scrollHeight>content.clientHeight&&content.scrollTop>0,focus:document.activeElement.id,hiddenControls:[...fast.querySelectorAll('.float-search-mobile-preview-toolbar,.float-search-mobile-preview-heading,.fs-preview-context-nav')].every(el=>getComputedStyle(el).display==='none'),selectedShadow:getComputedStyle(document.querySelector('.suggestion-item.is-selected')).boxShadow};
  });
  assert.ok(Math.abs(shell.host.width-shell.fast.width)<=1&&Math.abs(shell.host.height-shell.fast.height)<=1);assert.equal(shell.readOnly,true);assert.equal(shell.scrollable,true);assert.equal(shell.focus,'query');assert.equal(shell.hiddenControls,true);assert.equal(shell.selectedShadow,'none');
  checks.push({name:`desktop-${theme}-fast-read-only-overlay`,...shell});
 }
 await page.evaluate(()=>{window.SharedMotion.cancelSearchMotion(document.querySelector('.modal-container'));document.querySelector('.float-search-fast-preview').hidden=true;});
 assert.equal(await page.locator('.float-search-fast-preview').isVisible(),false);
 await page.locator('#native-button').click();assert.equal(await page.evaluate(()=>window.nativeClicks),1);checks.push({name:'native-preview-handoff-releases-overlay-input',passed:true});

 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('#toggle').focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('[data-child]').count(),3);assert.equal(await page.evaluate(()=>document.getAnimations().length),0);assert.equal(await page.locator('.fs-mobile-motion-layer').count(),0);
 await page.evaluate(()=>window.SharedMotion.animateNavigation(document.querySelector('.fs-desktop-native-host')));assert.equal(await page.evaluate(()=>document.getAnimations().length),0);
 checks.push({name:'desktop-reduced-motion-keeps-keyboard-and-final-layout',passed:true});
 assert.deepEqual(errors,[]);await writeFile('output/playwright/desktop-motion-results.json',JSON.stringify(checks,null,2)+'\n');console.log(JSON.stringify(checks,null,2));
 console.log('PASS Desktop pointer/keyboard motion, cross-platform aliases, fast preview focus/layout, native handoff and reduced motion');
}finally{await browser.close()}
