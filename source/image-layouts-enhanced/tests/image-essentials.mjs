import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {build} from 'esbuild';

const project=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const tools=await build({stdin:{contents:`export {ImageControls} from './src/image-controls'; export {ImagePresentation} from './src/image-presentation'; export {getImageWidth} from './src/image-settings'; export {extractImages} from './src/images';`,resolveDir:project},bundle:true,format:'iife',globalName:'NativeControls',write:false,logLevel:'silent'});
const toolbox={crypto:webcrypto};runInNewContext(tools.outputFiles[0].text,toolbox);
const {extractImages,getImageWidth}=toolbox.NativeControls;
const actualBundle=await readFile(path.join(project,'main.js'),'utf8');
const css=await readFile(path.join(project,'styles.css'),'utf8');
const manifest=JSON.parse(await readFile(path.join(project,'manifest.json'),'utf8'));
class Base {} class MarkdownView {} class TFile {constructor(path){this.path=path;}}
function loadPlugin(){
 const module={exports:{}};
 runInNewContext(actualBundle,{module,exports:module.exports,URL,crypto:webcrypto,console,require:id=>{
  if(id==='obsidian')return{Plugin:Base,MarkdownView,TFile,MarkdownRenderChild:Base,PluginSettingTab:Base,Modal:Base,Notice:Base,Platform:{isMobile:true}};
  if(id==='@codemirror/view')return{WidgetType:Base};
  if(id==='@codemirror/state')return{};
  throw new Error(`移动端加载了额外模块：${id}`);
 }});
 return module.exports.default;
}
const Plugin=loadPlugin();
const checks=[];
const passed=name=>{checks.push({name,passed:true});console.log(`${checks.length}. ${name}：通过`);};
const source='![甲](https://images.example/figure.png?origin=1)\n\n![乙](https://images.example/figure.png?origin=1)\n';
const refs=extractImages(source),groups={'["note.md","legacy"]':{layout:'focus',height:420}};
const store={value:{groupSettings:groups,imageSettings:{}}},instances=[];
function instance(device){
 const plugin=new Plugin(),view=new MarkdownView(),writes=[];
 plugin.deviceId=device;plugin.imageSettings=structuredClone(store.value.imageSettings);
 plugin.groupSettings=structuredClone(store.value.groupSettings);
 view.file=new TFile('note.md');view.getMode=()=> 'source';
 view.editor={getValue:()=>source,replaceRange:()=>writes.push('editor')};
 plugin.app={workspace:{getLeavesOfType:()=>[{view}]},vault:{process:()=>writes.push('process'),modify:()=>writes.push('modify'),append:()=>writes.push('append')}};
 plugin.loadData=async()=>structuredClone(store.value);
 plugin.saveData=async value=>{store.value=JSON.parse(JSON.stringify(value));};
 plugin.refreshImagePresentation=()=>{};
 const item={plugin,view,writes,resize:(index,width)=>plugin.resizeImage(view,'note.md',source,refs[index],width)};
 instances.push(item);return item;
}
const width=(device,index)=>getImageWidth(store.value.imageSettings,device,'note.md',source,refs[index]);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 // 保留平板触摸流程；鼠标拖动单独使用实时预览结构。
 const page=await browser.newPage({viewport:{width:1024,height:768},isMobile:true,hasTouch:true});
 const svg='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#9bb5da"/></svg>');
 await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
 html,body{margin:0;overflow:hidden;font:15px system-ui}#scroller{height:768px;overflow:auto;touch-action:pan-y}
 #note{width:720px;margin:auto}#before{height:150px}#block,#frame{position:relative}.body-copy{height:220px;margin:0}
 .image-resize-corner{display:block;position:absolute;bottom:0;right:0;width:12px;height:12px}
 </style><body><div id="scroller" class="markdown-preview-view"><div id="note"><div id="before"></div><div id="block"><span id="frame" class="image-embed"><img id="image" src="${svg}" style="width:210px;height:105px;opacity:.91"><span class="image-resize-corner"></span></span></div>${'<p class="body-copy">后续正文</p>'.repeat(12)}</div></div></body>`);
 await page.addScriptTag({content:tools.outputFiles[0].text});
 await page.evaluate(()=>{
  window.image=document.querySelector('#image');window.saved=[];window.localWidth=undefined;window.restored=0;
  window.originalStyle=image.style.cssText;
  window.controls=new NativeControls.ImageControls(document,()=>({grouped:false,standalone:true,block:true,layout(){},
   restore:()=>{restored++;localWidth=undefined;presentation.refresh();},
   resize:{save:async width=>{saved.push(width);localWidth=width;presentation.refresh();}},
  }));
  window.presentation=new NativeControls.ImagePresentation(document,img=>img===image?{centered:true,block:true,width:localWidth,previewing:controls.isResizing(image)}:undefined);
 });
 await page.locator('#image').evaluate(image=>image.decode());await page.waitForTimeout(70);
 assert.ok(await page.evaluate(()=>{const a=image.getBoundingClientRect(),b=document.querySelector('#frame').getBoundingClientRect();return image.classList.contains('ilg-note-image')&&Math.abs(a.left+a.width/2-b.left-b.width/2)<1;}));
 passed('独立正文图片居中');

 const mousePage=await browser.newPage({viewport:{width:1024,height:768},isMobile:false,hasTouch:false});
 await mousePage.setContent(`<style>${css}body{margin:0}.cm-scroller{height:600px;overflow:auto}.cm-content{width:765px;margin:0 24px;outline:none}.cm-line{width:765px}.spacer{height:150px}.after{height:2000px}</style>
 <div class="markdown-source-view mod-cm6"><div class="cm-scroller"><div class="cm-content" contenteditable="true"><div class="spacer"></div><div class="cm-line"><span class="image-embed" contenteditable="false"><span class="image-wrapper"><img id="lp-image" src="${svg}" style="width:210px;height:105px"></span></span></div><div class="after"></div></div></div></div>`);
 await mousePage.addScriptTag({content:tools.outputFiles[0].text});
 await mousePage.evaluate(()=>{
  window.image=document.querySelector('#lp-image');window.saved=[];window.localWidth=undefined;window.compensated=false;window.compensationScrolled=false;
  window.scroller=document.querySelector('.cm-scroller');scroller.scrollTop=100;
  scroller.addEventListener('scroll',()=>{if(compensated)compensationScrolled=true;});
  document.querySelector('.cm-content').focus({preventScroll:true});
  window.controls=new NativeControls.ImageControls(document,()=>({grouped:false,standalone:true,block:true,layout(){},resize:{save:async width=>{saved.push(width);localWidth=width;presentation.refresh();}}}));
  window.presentation=new NativeControls.ImagePresentation(document,img=>img===image?{centered:true,block:true,width:localWidth,previewing:controls.isResizing(image)}:undefined);
  window.compensation=new ResizeObserver(()=>{
   if(!compensated&&controls.isResizing(image)&&image.getBoundingClientRect().width>210.5){compensated=true;scroller.scrollTop+=12;}
  });compensation.observe(image);
 });
 await mousePage.locator('#lp-image').evaluate(image=>image.decode());await mousePage.waitForTimeout(70);
 const mouseImage=await mousePage.locator('#lp-image').boundingBox();
 await mousePage.mouse.move(mouseImage.x+10,mouseImage.y+mouseImage.height/2);
 const mouseHandle=await mousePage.locator('.ilg-image-resize:not([hidden]) .ilg-image-resize-handle').boundingBox();
 const mousePoint={x:mouseHandle.x+mouseHandle.width/2,y:mouseHandle.y+mouseHandle.height/2};
 await mousePage.mouse.move(mousePoint.x,mousePoint.y);await mousePage.mouse.down();await mousePage.mouse.move(mousePoint.x+20,mousePoint.y);await mousePage.waitForTimeout(70);
 await mousePage.waitForFunction(()=>window.compensationScrolled,{},{timeout:1000});
 const moving=await mousePage.evaluate(()=>({active:controls.isResizing(image),width:image.getBoundingClientRect().width,compensated,compensationScrolled,scrollTop:scroller.scrollTop}));
 assert.ok(moving.compensated&&moving.compensationScrolled&&moving.scrollTop>100&&moving.active&&moving.width>210,JSON.stringify(moving));
 await mousePage.mouse.up();await mousePage.waitForTimeout(80);
 assert.ok(await mousePage.evaluate(()=>saved.length===1&&saved[0]===250&&Math.abs(image.getBoundingClientRect().width/image.getBoundingClientRect().height-2)<.02));
 await mousePage.evaluate(()=>{compensation.disconnect();controls.destroy();presentation.destroy();});await mousePage.close();
 passed('实时预览滚动补偿后鼠标拖动仅保存一次');

 const handlePoint=async()=>{const r=await page.locator('.ilg-image-resize:not([hidden]) .ilg-image-resize-handle').boundingBox();return{x:r.x+r.width/2,y:r.y+r.height/2};};

 const client=await page.context().newCDPSession(page);
 const touch=(type,point)=>client.send('Input.dispatchTouchEvent',{type,touchPoints:point?[point]:[]});
 await page.evaluate(()=>controls.hide());
 const r=await page.locator('#image').boundingBox();
 await touch('touchStart',{x:r.x+r.width/2,y:r.y+30});await page.waitForTimeout(550);await touch('touchEnd');await page.waitForTimeout(55);
 assert.ok(await page.evaluate(()=>!document.querySelector('.ilg-image-controls').hidden&&restored===0));
 let point=await handlePoint();await touch('touchStart',point);await touch('touchMove',{x:point.x+20,y:point.y});await page.waitForTimeout(45);await touch('touchEnd');await page.waitForTimeout(80);
 await page.locator('[aria-label="恢复笔记中的图片尺寸"]').tap();await page.waitForTimeout(60);
 assert.ok(await page.evaluate(()=>saved.length===1&&saved[0]===250&&restored===1&&Math.abs(image.getBoundingClientRect().width-210)<1));
 passed('平板长按释放、后续拖动和恢复');

 const desktop=instance('desktop');await desktop.resize(0,320);
 const reloaded=instance('desktop');
 assert.equal(getImageWidth(reloaded.plugin.imageSettings,'desktop','note.md',source,refs[0]),320);
 passed('本地尺寸重新加载');

 const tablet=instance('tablet');assert.equal(getImageWidth(tablet.plugin.imageSettings,'tablet','note.md',source,refs[0]),undefined);
 await tablet.resize(0,480);assert.equal(width('desktop',0),320);assert.equal(width('tablet',0),480);
 passed('各设备尺寸独立保存');

 const repeated=instance('desktop');await repeated.resize(1,520);
 assert.equal(width('desktop',0),320);assert.equal(width('desktop',1),520);
 passed('同一URL的不同引用各自保存');

 assert.ok(instances.every(item=>item.writes.length===0&&item.view.editor.getValue()===source));
 assert.equal(source,'![甲](https://images.example/figure.png?origin=1)\n\n![乙](https://images.example/figure.png?origin=1)\n');
 passed('正文和图床URL保持原字节');

 await repeated.resize(0,null);assert.equal(width('desktop',0),undefined);assert.equal(width('desktop',1),520);
 assert.deepEqual(store.value.groupSettings,groups);
 passed('恢复尺寸保留旧画廊配置');

 await touch('touchStart',{x:24,y:650});
 for(let i=1;i<=10;i++){await touch('touchMove',{x:24,y:650-i*12});await page.waitForTimeout(15);}
 await touch('touchEnd');await page.waitForTimeout(700);
 assert.ok(await page.evaluate(()=>document.querySelector('#scroller').scrollTop>50));
 await page.evaluate(()=>{document.querySelector('#scroller').scrollTop=0;});await page.waitForTimeout(70);await page.evaluate(()=>controls.show(image));
 point=await handlePoint();await touch('touchStart',point);await touch('touchMove',{x:point.x+20,y:point.y});await page.waitForTimeout(40);await touch('touchCancel');
 await page.evaluate(()=>{controls.destroy();presentation.destroy();});
 assert.ok(await page.evaluate(()=>saved.length===1&&image.style.cssText===originalStyle&&!document.body.classList.contains('ilg-local-image-controls')&&document.querySelectorAll('.ilg-image-controls,.ilg-image-resize').length===0&&getComputedStyle(document.querySelector('.image-resize-corner')).display!=='none'));
 passed('正文可滚动，取消和卸载释放控件');

 assert.equal(typeof loadPlugin(),'function');
 assert.equal(manifest.isDesktopOnly,false);
 passed('实际发布bundle可在移动环境加载');
 await client.detach();
}finally{await browser.close();}
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
await writeFile(path.join(project,'..','qa','image-native-controls-20261112','essentials-results.json'),JSON.stringify({date,version:manifest.version,total:10,checks,failures:[]},null,2)+'\n');
