import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import os from 'node:os';

const require=createRequire(import.meta.url);
let playwright;
try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const css=await readFile('styles.css','utf8');
const browser=await playwright.chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
await mkdir('output/playwright',{recursive:true});
const report=[];
try{
 for(const width of [320,360,412,768,1024])for(const theme of ['light','dark'])for(const scale of [1,1.4]){
  const height=width>=760?768:width===412?915:800;
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>
   :root{--background-primary:#fbfcfe;--background-secondary:#edf1f7;--background-secondary-alt:#e6ebf3;--background-modifier-border:#d6deea;--background-modifier-hover:#e7edf7;--interactive-accent:#4c78ad;--interactive-accent-rgb:76,120,173;--text-normal:#253149;--text-muted:#65748a;--text-faint:#78889d;--text-accent:#3d6b9f;--text-on-accent:white;--font-interface:system-ui;--font-ui-small:13px;--font-ui-smaller:11px;--font-medium:500;--font-semibold:600;--safe-area-inset-top:24px;--safe-area-inset-bottom:18px;--size-2-1:2px;--size-2-2:4px;--size-2-3:6px;--size-4-2:8px;--radius-m:8px;--radius-s:5px}
   body.theme-dark{--background-primary:#181c24;--background-secondary:#242b36;--background-secondary-alt:#2b3441;--background-modifier-border:#384353;--background-modifier-hover:#303d50;--text-normal:#e3e9f2;--text-muted:#abb8ca;--text-faint:#8fa0b8;--text-accent:#a8c4ee;--interactive-accent:#7c9fd0;--interactive-accent-rgb:124,159,208}
   *{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui;background:var(--background-secondary);color:var(--text-normal)}button,input,select{font:inherit;box-sizing:border-box;color:inherit}button{cursor:pointer}button,select{border:1px solid var(--background-modifier-border)}.modal-container{position:fixed;inset:0}.prompt-results{overflow:auto}.modal-background{position:absolute;inset:0;background:#24304722}.prompt-input-container{flex:0 1 auto}.suggestion-item.mod-complex{display:flex;flex-wrap:wrap;align-items:flex-start}.suggestion-item .suggestion-content{flex:1 0 auto}.suggestion-flair{white-space:normal}.suggestion-aux{flex-wrap:wrap}svg{width:16px;height:16px}
  </style><div class="modal-container float-search-cmdk-container"><div class="modal-background"></div><div class="modal prompt float-search-cmdk">
   <div class="prompt-input-container"><div class="float-search-cmdk-header"><button class="float-search-cmdk-typo-toggle">容错</button><div class="float-search-cmdk-query-region"><div class="float-search-cmdk-query-shell"><input class="prompt-input" value="空间研究" aria-label="搜索"></div></div><select class="float-search-cmdk-sort-select" aria-label="排序"><option>相关度</option></select><div class="float-search-cmdk-filters"><button class="float-search-cmdk-filter is-active">文件</button><button class="float-search-cmdk-filter is-active">标题</button><button class="float-search-cmdk-filter is-active">正文</button></div></div></div>
   <div class="float-search-cmdk-body${width>=760?' has-mobile-preview':''}"><div class="prompt-results"><div class="float-search-cmdk-result-summary"><span class="float-search-cmdk-result-summary-main">143 项结果</span><span class="float-search-cmdk-result-summary-detail">12 文件 · 已显示 12/12 文件组</span></div></div>${width>=760?'<section class="float-search-mobile-preview"><div class="float-search-mobile-preview-toolbar"><button class="fs-preview-back">返回结果</button><button class="fs-preview-open">打开笔记</button></div><div class="float-search-mobile-preview-heading"><h2>空间转录组研究笔记</h2><div class="float-search-mobile-preview-path">研究笔记/肿瘤微环境/空间转录组.md</div></div><div class="float-search-mobile-preview-content"><h2>研究目的</h2><p>通过空间转录组联合组织学方法，识别肿瘤与免疫细胞的空间分布及组织结构。</p></div></section>':''}</div>
   <button class="float-search-mobile-close" aria-label="关闭搜索">关闭</button></div></div>`);
  await page.evaluate(({theme,scale})=>{
   document.body.className=`is-mobile theme-${theme}`;
   document.documentElement.style.setProperty('--font-ui-small',`${13*scale}px`);
   document.documentElement.style.setProperty('--font-ui-smaller',`${11*scale}px`);
   const results=document.querySelector('.prompt-results');
   const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
   const pin='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10l-2 6 3 4H6l3-4zM12 14v7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
   for(let group=0;group<3;group++){
    const row=document.createElement('div');row.className='suggestion-item mod-complex float-search-cmdk-result is-file-parent has-children'+(group===0?' has-section is-selected':'');row.setAttribute('role','option');
    row.innerHTML=(group===0?'<div class="float-search-cmdk-section">搜索结果</div>':'')+`<button class="float-search-cmdk-disclosure" aria-label="折叠当前文件结果" aria-expanded="true">${icon}</button><div class="suggestion-content"><div class="suggestion-title">${'肾细胞癌空间转录组研究的组织结构与肿瘤微环境分析'.repeat(3)}</div><div class="suggestion-note">${'research-wiki/raw/空间转录组/肿瘤微环境/患者队列/多中心研究/'.repeat(3)}</div></div><div class="suggestion-aux"><span class="float-search-cmdk-match-count">${['61+','128','999+'][group]}</span><button class="float-search-cmdk-pin-button" aria-label="收藏">${pin}</button><span class="suggestion-flair float-search-cmdk-type-badge is-file">文件</span></div>`;
    row.querySelector('button').addEventListener('click',e=>{const b=e.currentTarget;b.setAttribute('aria-expanded',String(b.getAttribute('aria-expanded')!=='true'));window.arrowClicks=(window.arrowClicks??0)+1;});
    results.append(row);
    for(let i=0;i<8;i++){
     const child=document.createElement('div');child.className='suggestion-item mod-complex float-search-cmdk-result is-child is-content';
     child.innerHTML=`<span class="float-search-cmdk-disclosure-spacer"></span><div class="suggestion-content"><div class="suggestion-title">${i===0?'## 研究材料与方法：':'通过空间定位发现：'}${'肿瘤细胞和免疫细胞在不同组织区域的表达程序'.repeat(3)}</div><div class="suggestion-note">第 ${i*11+15} 行</div></div><div class="suggestion-aux"><button class="float-search-cmdk-pin-button" aria-label="收藏">${pin}</button><span class="suggestion-flair float-search-cmdk-type-badge is-content">正文</span></div>`;results.append(child);
    }
   }
  },{theme,scale});
  await page.addStyleTag({content:css});
  const metrics=await page.evaluate(()=>{
   const result=document.querySelector('.prompt-results'),modal=document.querySelector('.float-search-cmdk'),header=document.querySelector('.float-search-cmdk-header');
   const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
   return{viewport:innerWidth,modal:rect(modal),header:rect(header),overflow:result.scrollWidth-result.clientWidth,
    rows:[...result.querySelectorAll('.float-search-cmdk-result')].map(row=>{
     const content=row.querySelector('.suggestion-content'),aux=row.querySelector('.suggestion-aux'),title=row.querySelector('.suggestion-title'),note=row.querySelector('.suggestion-note');
     return{row:rect(row),content:rect(content),aux:rect(aux),title:rect(title),note:rect(note),child:row.classList.contains('is-child'),display:getComputedStyle(row).display,titleOverflow:getComputedStyle(title).textOverflow,titleWhiteSpace:getComputedStyle(title).whiteSpace,ellipsis:title.scrollWidth>title.clientWidth,
      controls:[...aux.children].map(el=>({rect:rect(el),text:el.textContent.trim(),pin:el.matches('button')}))};}),
    touches:[...document.querySelectorAll('.float-search-cmdk-filter,.float-search-cmdk-typo-toggle,.float-search-cmdk-sort-select,.float-search-cmdk-disclosure,.float-search-cmdk-pin-button')].map(rect)};
  });
  const context=`${width}px ${theme} scale=${scale}`;
  assert.ok(metrics.modal.x>=0&&metrics.modal.right<=width+1,context+' modal bounds');
  assert.ok(metrics.header.right<=metrics.modal.right,context+' header bounds');
  assert.ok(metrics.overflow<=1,context+' result horizontal overflow '+metrics.overflow);
  for(const row of metrics.rows){
   assert.equal(row.display,'grid',context+' result grid');
   assert.ok(row.row.height>=44&&row.row.height<=58,context+' row height '+row.row.height);
   assert.ok(row.content.right<=row.aux.x+1,context+' text and aux overlap');
   assert.ok(row.aux.right<=row.row.right+1,context+' aux overflow');
   assert.equal(row.titleOverflow,'ellipsis',context+' ellipsis mode');assert.equal(row.titleWhiteSpace,'nowrap');assert.ok(row.ellipsis,context+' long title truncation');
   const centers=row.controls.map(c=>c.rect.y+c.rect.height/2);assert.ok(Math.max(...centers)-Math.min(...centers)<1,context+' aux wrapped to another line');
  }
  assert.ok(metrics.touches.every(r=>r.width>=43.9&&r.height>=43.9),context+' touch target bounds');
  await page.locator('.float-search-cmdk-disclosure').first().tap();assert.equal(await page.evaluate(()=>window.arrowClicks),1,context+' arrow tap');
  if((width===360&&theme==='light'&&scale===1)||(width===360&&theme==='dark'&&scale===1.4)||(width===1024&&theme==='light'&&scale===1))await page.screenshot({path:`output/playwright/mobile-density-${width}-${theme}-${scale}.png`});
  assert.deepEqual(errors,[],context+' browser errors');
  report.push({width,theme,scale,overflow:metrics.overflow,parentHeight:metrics.rows.find(r=>!r.child).row.height,childHeight:metrics.rows.find(r=>r.child).row.height,auxWidth:metrics.rows[0].aux.width,touchMin:Math.min(...metrics.touches.map(r=>Math.min(r.width,r.height))),passed:true});
  await page.close();
 }
 await writeFile('output/playwright/mobile-density-results.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 console.log('PASS 20 phone/tablet, light/dark, normal/large-font CSS cases; long Chinese text, 61+ counters and 44px taps');
}finally{await browser.close()}
