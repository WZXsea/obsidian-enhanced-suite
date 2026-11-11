import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
const output=await build({entryPoints:[fileURLToPath(new URL('../src/image-controls.ts',import.meta.url))],bundle:true,format:'cjs',write:false});
const module={exports:{}};runInNewContext(output.outputFiles[0].text,{module,exports:module.exports});
const {ImageControls}=module.exports;
class Target{
 listeners=[];
 addEventListener(type,handler,capture){this.listeners.push({type,handler,capture});}
 removeEventListener(type,handler){this.listeners=this.listeners.filter(x=>x.type!==type||x.handler!==handler);}
 fire(type,extra={}){const event={type,target:this,preventDefault(){this.prevented=true;},stopPropagation(){},stopImmediatePropagation(){this.stopped=true;},...extra};for(const x of [...this.listeners])if(x.type===type)x.handler(event);return event;}
}
class Element extends Target{
 constructor(doc,tag){super();this.doc=doc;this.tagName=tag.toUpperCase();this.children=[];this.style={};this.isConnected=true;}
 setAttribute(){} appendChild(child){this.children.push(child);return child;} remove(){this.isConnected=false;}
 contains(target){return this===target||this.children.some(child=>child.contains(target));}
 closest(selector){if(selector==='img'&&this.tagName==='IMG')return this;if(selector==='.markdown-source-view, .markdown-preview-view'&&this.tagName==='IMG')return this;return null;}
 getBoundingClientRect(){return {left:20,right:300,top:60,bottom:160,width:280,height:100};}
}
function fixture(){
 const doc=new Target(),win=new Target();let seq=0;win.timers=new Map();win.innerWidth=400;win.innerHeight=700;
 win.setTimeout=fn=>{win.timers.set(++seq,fn);return seq;};win.clearTimeout=id=>win.timers.delete(id);win.advance=()=>{for(const [id,fn]of [...win.timers]){win.timers.delete(id);fn();}};
 doc.defaultView=win;doc.createElement=tag=>new Element(doc,tag);doc.body=new Element(doc,'body');
 const image=new Element(doc,'img');const controls=new ImageControls(doc,()=>({grouped:true,layout(){},configure(){}}));return {doc,win,image,controls,toolbar:doc.body.children[0]};
}
test('stationary long press reveals controls and consumes only the following image click',()=>{
 const {doc,win,image,controls,toolbar}=fixture();
 doc.fire('pointerdown',{target:image,pointerType:'touch',pointerId:1,clientX:30,clientY:80});win.advance();assert.equal(toolbar.hidden,false);
 doc.fire('pointerout',{target:image,pointerType:'touch'});win.advance();assert.equal(toolbar.hidden,false);
 const click=doc.fire('click',{target:image});assert.equal(click.prevented,true);assert.equal(click.stopped,true);
 assert.equal(doc.fire('click',{target:image}).prevented,undefined);controls.destroy();assert.equal(doc.listeners.length,0);assert.equal(win.timers.size,0);
});
test('vertical scroll, moved finger, second touch, and cancellation retain normal image behavior',()=>{
 for(const kind of ['move','second','cancel','scroll']){
  const {doc,win,image,controls,toolbar}=fixture();
  doc.fire('pointerdown',{target:image,pointerType:'touch',pointerId:1,clientX:30,clientY:80});
  if(kind==='move')doc.fire('pointermove',{target:image,pointerId:1,clientX:31,clientY:140});
  if(kind==='second')doc.fire('pointerdown',{target:image,pointerType:'touch',pointerId:2,clientX:40,clientY:80});
  if(kind==='cancel')doc.fire('pointercancel',{target:image,pointerId:1});
  if(kind==='scroll')doc.fire('scroll',{target:doc});
  win.advance();assert.equal(toolbar.hidden,true,kind);assert.equal(doc.fire('click',{target:image}).prevented,undefined);controls.destroy();
 }
});
test('quick tap and plugin teardown cancel the pending long press',()=>{
 for(const teardown of [false,true]){
  const {doc,win,image,controls,toolbar}=fixture();doc.fire('pointerdown',{target:image,pointerType:'touch',pointerId:1,clientX:30,clientY:80});
  if(teardown)controls.destroy();else doc.fire('pointerup',{target:image,pointerId:1});
  win.advance();assert.equal(toolbar.hidden,true);assert.equal(win.timers.size,0);if(!teardown)controls.destroy();
 }
});
