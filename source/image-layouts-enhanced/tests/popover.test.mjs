import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

// A small event tree models capture/target/bubble to exercise document delegation boundaries.
class EventNode {
  constructor() { this.listeners = []; }
  addEventListener(type, handler, options) { this.listeners.push({type,handler,capture: typeof options === 'boolean' ? options : Boolean(options?.capture)}); }
  removeEventListener(type, handler, capture) { this.listeners = this.listeners.filter(item => item.type !== type || item.handler !== handler || item.capture !== Boolean(capture)); }
}
class Element extends EventNode {
  constructor(doc, tag='div', rect={left:0,top:0,width:210,height:140}) {
    super();this.ownerDocument=doc;this.nodeType=1;this.tagName=tag.toUpperCase();this.children=[];this.style={};this.attributes={};this.rect=rect;
  }
  get isConnected() { return this.parentNode?.isConnected ?? false; }
  setAttribute(name,value) { this.attributes[name]=value; }
  appendChild(child) { child.remove();this.children.push(child);child.parentNode=this;return child; }
  remove() { if(this.parentNode?.children)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=undefined; }
  contains(target) { return target===this || this.children.some(child=>child.contains(target)); }
  getBoundingClientRect() { return {...this.rect,right:this.rect.left+this.rect.width,bottom:this.rect.top+this.rect.height}; }
}
function createDocument({timers=false,reducedMotion=false}={}) {
  const doc=new EventNode();doc.nodeType=9;doc.isConnected=true;doc.children=[];
  doc.createElement=tag=>new Element(doc,tag);
  doc.body=new Element(doc,'body');doc.body.parentNode=doc;doc.children.push(doc.body);
  doc.documentElement={clientWidth:400,clientHeight:300};
  const win=new EventNode();win.innerWidth=400;win.innerHeight=300;win.observers=[];
  win.matchMedia=()=>({matches:reducedMotion});
  if(timers){
    let now=0,sequence=0;win.timers=new Map();
    win.setTimeout=(callback,delay)=>{const id=++sequence;win.timers.set(id,{callback,due:now+delay});return id;};
    win.clearTimeout=id=>win.timers.delete(id);
    win.advance=duration=>{now+=duration;for(const [id,item]of [...win.timers])if(item.due<=now){win.timers.delete(id);item.callback();}};
  }
  win.ResizeObserver=class {
    constructor(callback){this.callback=callback;this.disconnected=false;win.observers.push(this);}
    observe(target){this.target=target;}
    disconnect(){this.disconnected=true;}
    fire(){this.callback([]);}
  };
  doc.defaultView=win;
  return doc;
}
function fire(target,type,extra={}) {
  const path=[];for(let item=target;item;item=item.parentNode)path.push(item);
  const event={type,target,defaultPrevented:false,stopped:false,...extra,composedPath:()=>path,
    preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;}};
  for(const node of [...path].reverse()){
    for(const item of [...node.listeners])if(item.type===type&&item.capture)item.handler(event);
    if(event.stopped)return event;
  }
  for(const node of path){
    for(const item of [...node.listeners])if(item.type===type&&!item.capture)item.handler(event);
    if(event.stopped)return event;
  }
  return event;
}
const output=await build({entryPoints:[fileURLToPath(new URL('../src/popover.ts',import.meta.url))],bundle:true,format:'cjs',write:false});
const fallback=createDocument();const module={exports:{}};
runInNewContext(output.outputFiles[0].text,{module,exports:module.exports,activeDocument:fallback,document:fallback});
const {AnchoredPopover,closePopover}=module.exports;
function anchor(doc,rect={left:140,top:40,width:38,height:28}){
  const result=new Element(doc,'button',rect);doc.body.appendChild(result);return result;
}

test('child click handlers run while delegated Toolkit image clicks stay outside the popover',()=>{
  const doc=createDocument();const popover=new AnchoredPopover(anchor(doc),'选择图片');
  const image=doc.createElement('img');popover.contentEl.appendChild(image);
  let selected=0,toolkit=0;
  popover.listen(image,'click',()=>selected++);
  doc.addEventListener('click',()=>toolkit++);
  popover.open();fire(image,'click');
  assert.equal(selected,1);assert.equal(toolkit,0);
  assert.equal(fire(image,'contextmenu').defaultPrevented,true);
  assert.equal(fire(image,'dragstart').defaultPrevented,true);
  let delegatedDrop=0;doc.addEventListener('drop',()=>delegatedDrop++);
  assert.equal(fire(image,'drop').defaultPrevented,true);assert.equal(delegatedDrop,0);
  assert.equal(popover.el.attributes['data-ilg-interactive'],'1');
  popover.close();
});

test('outside pointerdown closes once and removes custom and document listeners',()=>{
  const doc=createDocument();let closed=0;
  const popover=new AnchoredPopover(anchor(doc),'设置',()=>closed++);
  popover.listen(popover.contentEl,'pointerdown',()=>{});
  popover.open();fire(popover.contentEl,'pointerdown');assert.equal(closed,0);
  fire(doc.body,'pointerdown');popover.close();
  assert.equal(closed,1);assert.equal(popover.el.isConnected,false);
  assert.equal(doc.listeners.length,0);assert.equal(doc.defaultView.listeners.length,0);
  assert.equal(popover.contentEl.listeners.length,0);assert.equal(doc.defaultView.observers[0].disconnected,true);
});

test('each owner document retains one popover with independent windows',()=>{
  const firstDoc=createDocument(),secondDoc=createDocument();let firstClosed=0;
  const first=new AnchoredPopover(anchor(firstDoc),'一',()=>firstClosed++);
  const replacement=new AnchoredPopover(anchor(firstDoc),'二');
  const other=new AnchoredPopover(anchor(secondDoc),'三');
  first.open();other.open();replacement.open();
  assert.equal(firstClosed,1);assert.equal(first.el.isConnected,false);
  assert.equal(replacement.el.isConnected,true);assert.equal(other.el.isConnected,true);
  closePopover(firstDoc);assert.equal(replacement.el.isConnected,false);assert.equal(other.el.isConnected,true);
  closePopover(firstDoc);other.close();
});

test('popover chooses above a bottom anchor and clamps at the right viewport edge',()=>{
  const doc=createDocument();const popover=new AnchoredPopover(anchor(doc,{left:390,top:260,width:8,height:20}),'布局');
  popover.open();
  assert.equal(popover.el.style.left,'182px');assert.equal(popover.el.style.top,'114px');
  assert.equal(popover.el.attributes['data-ilg-placement'],'above');assert.ok(popover.el.style.transformOrigin.endsWith(' bottom'));
  popover.close();
});

test('inside scroll stays usable while outside scroll and Escape close the popover',()=>{
  const doc=createDocument();const popover=new AnchoredPopover(anchor(doc),'布局');
  popover.open();fire(popover.contentEl,'scroll');assert.equal(popover.el.isConnected,true);
  fire(doc.body,'scroll');assert.equal(popover.el.isConnected,false);
  const another=new AnchoredPopover(anchor(doc),'设置');another.open();
  assert.equal(fire(another.contentEl,'keydown',{key:'Escape'}).defaultPrevented,true);
  assert.equal(another.el.isConnected,false);
});

test('Escape used by IME composition keeps the editable popover open',()=>{
  const doc=createDocument();const popover=new AnchoredPopover(anchor(doc),'引用');popover.open();
  fire(popover.contentEl,'keydown',{key:'Escape',isComposing:true});assert.equal(popover.el.isConnected,true);
  fire(popover.contentEl,'keydown',{key:'Escape',keyCode:229});assert.equal(popover.el.isConnected,true);
  fire(popover.contentEl,'keydown',{key:'Escape'});assert.equal(popover.el.isConnected,false);
});

test('a sibling thumbnail rail can scroll while the main image popover stays anchored',()=>{
  const doc=createDocument(),source=anchor(doc),rail=new Element(doc);
  doc.body.appendChild(rail);
  const popover=new AnchoredPopover(source,'布局');popover.open();
  fire(rail,'scroll');assert.equal(popover.el.isConnected,true);
  fire(doc.body,'scroll');assert.equal(popover.el.isConnected,false);
});

test('initial ResizeObserver delivery retains the panel and a changed anchor closes it',()=>{
  const doc=createDocument();const source=anchor(doc);const popover=new AnchoredPopover(source,'布局');
  popover.open();const observer=doc.defaultView.observers[0];observer.fire();
  assert.equal(popover.el.isConnected,true);
  source.rect={...source.rect,width:42};observer.fire();
  assert.equal(popover.el.isConnected,false);assert.equal(observer.disconnected,true);
});

test('image anchors place controls at the image upper-right and detached images close early',()=>{
  const doc=createDocument();const image=new Element(doc,'img',{left:30,top:10,width:350,height:250});doc.body.appendChild(image);
  const popover=new AnchoredPopover(image,'布局');popover.open();
  assert.equal(popover.el.style.left,'170px');assert.equal(popover.el.style.top,'46px');popover.close();
  image.remove();let closed=0;const detached=new AnchoredPopover(image,'布局',()=>closed++);detached.open();
  assert.equal(detached.el.isConnected,false);assert.equal(closed,1);assert.equal(doc.listeners.length,0);
});

test('replacement retains its captured button anchor after closing the previous popover',()=>{
  const doc=createDocument();const first=new AnchoredPopover(anchor(doc),'图片');
  const nextAnchor=new Element(doc,'button',{left:15,top:40,width:40,height:20});first.contentEl.appendChild(nextAnchor);first.open();
  const next=new AnchoredPopover(nextAnchor,'布局');next.open();
  assert.equal(first.el.isConnected,false);assert.equal(next.el.isConnected,true);
  assert.equal(next.el.style.left,'15px');assert.equal(next.el.style.top,'66px');next.close();
});

test('animated close immediately ends interaction and draft lifecycle, then removes the passive surface',()=>{
  const doc=createDocument({timers:true});let closed=0;
  const popover=new AnchoredPopover(anchor(doc),'引用',()=>closed++);
  popover.listen(popover.contentEl,'input',()=>{});popover.open();
  assert.equal(popover.el.attributes['data-ilg-phase'],'open');assert.ok(popover.el.style.transformOrigin.endsWith(' top'));
  popover.close();popover.close();
  assert.equal(closed,1);assert.equal(doc.listeners.length,0);assert.equal(doc.defaultView.listeners.length,0);
  assert.equal(popover.contentEl.listeners.length,0);assert.equal(doc.defaultView.observers[0].disconnected,true);
  assert.equal(popover.el.isConnected,true);assert.equal(popover.el.inert,true);
  assert.equal(popover.el.attributes['aria-hidden'],'true');assert.equal(popover.el.style.pointerEvents,'none');
  assert.equal(popover.el.attributes['data-ilg-phase'],'exiting');assert.equal(doc.defaultView.timers.size,1);
  doc.defaultView.advance(119);assert.equal(popover.el.isConnected,true);
  doc.defaultView.advance(1);assert.equal(popover.el.isConnected,false);assert.equal(doc.defaultView.timers.size,0);
});

test('reduced motion closes immediately and schedules no exit timer',()=>{
  const doc=createDocument({timers:true,reducedMotion:true}),popover=new AnchoredPopover(anchor(doc),'设置');
  popover.open();assert.equal(popover.el.attributes['data-ilg-phase'],'open');popover.close();
  assert.equal(popover.el.isConnected,false);assert.equal(doc.defaultView.timers.size,0);
});

test('rapid reopen and plugin cleanup immediately clear every visual exit',()=>{
  const doc=createDocument({timers:true});let closed=0;
  const first=new AnchoredPopover(anchor(doc),'一',()=>closed++);first.open();first.close();
  const second=new AnchoredPopover(anchor(doc),'二',()=>closed++);second.open();
  assert.equal(first.el.isConnected,false);assert.equal(doc.defaultView.timers.size,0);
  const third=new AnchoredPopover(anchor(doc),'三',()=>closed++);third.open();
  assert.equal(second.el.isConnected,false);assert.equal(doc.defaultView.timers.size,0);
  closePopover(doc);closePopover(doc);
  assert.equal(closed,3);assert.equal(third.el.isConnected,false);assert.equal(doc.defaultView.timers.size,0);
  assert.equal(doc.listeners.length,0);assert.equal(doc.defaultView.listeners.length,0);
});

test('closePopover also removes an exit after its active singleton is already released',()=>{
  const doc=createDocument({timers:true}),popover=new AnchoredPopover(anchor(doc),'设置');popover.open();popover.close();
  assert.equal(popover.el.isConnected,true);closePopover(doc);
  assert.equal(popover.el.isConnected,false);assert.equal(doc.defaultView.timers.size,0);
});

test('a replacement opened from onClose never retains the old visual surface or timer',()=>{
  const doc=createDocument({timers:true});let replacement;
  const first=new AnchoredPopover(anchor(doc),'一',()=>{replacement=new AnchoredPopover(anchor(doc),'二');replacement.open();});
  first.open();first.close();assert.equal(first.el.isConnected,false);assert.equal(replacement.el.isConnected,true);
  assert.equal(doc.defaultView.timers.size,0);closePopover(doc);assert.equal(replacement.el.isConnected,false);
});

test('the newest reentrant open wins when a previous close callback opens another panel',()=>{
  const doc=createDocument({timers:true});let reentrant, supersededClosed=0;
  const first=new AnchoredPopover(anchor(doc),'一',()=>{reentrant=new AnchoredPopover(anchor(doc),'回调');reentrant.open();});
  first.open();const superseded=new AnchoredPopover(anchor(doc),'二',()=>supersededClosed++);superseded.open();
  assert.equal(first.el.isConnected,false);assert.equal(superseded.el.isConnected,false);assert.equal(supersededClosed,1);
  assert.equal(reentrant.el.isConnected,true);assert.equal(doc.listeners.length,3);assert.equal(doc.defaultView.listeners.length,2);
  assert.equal(doc.defaultView.timers.size,0);closePopover(doc);assert.equal(reentrant.el.isConnected,false);
});

test('plugin cleanup prevents an onClose callback from opening a new interactive panel',()=>{
  const doc=createDocument({timers:true});let attempted;
  const first=new AnchoredPopover(anchor(doc),'一',()=>{attempted=new AnchoredPopover(anchor(doc),'回调');attempted.open();});
  first.open();closePopover(doc);
  assert.equal(first.el.isConnected,false);assert.equal(attempted.el.isConnected,false);
  assert.equal(doc.listeners.length,0);assert.equal(doc.defaultView.listeners.length,0);assert.equal(doc.defaultView.timers.size,0);
});

test('nested cleanup retains its open guard until the outer cleanup completes',()=>{
  const doc=createDocument({timers:true});let attempted;
  const first=new AnchoredPopover(anchor(doc),'一',()=>{closePopover(doc);attempted=new AnchoredPopover(anchor(doc),'回调');attempted.open();});
  first.open();closePopover(doc);
  assert.equal(first.el.isConnected,false);assert.equal(attempted.el.isConnected,false);
  assert.equal(doc.listeners.length,0);assert.equal(doc.defaultView.timers.size,0);
});

// Advanced controls and inline errors can change intrinsic panel height after opening.
test('expanded contents reposition the panel inside its owner viewport',()=>{
  const doc=createDocument();const source=anchor(doc,{left:140,top:90,width:38,height:28});
  const popover=new AnchoredPopover(source,'设置');popover.open();
  assert.equal(popover.el.style.top,'124px');
  popover.el.rect={...popover.el.rect,height:240};doc.defaultView.observers[0].fire();
  assert.equal(popover.el.style.top,'52px');assert.equal(popover.el.isConnected,true);
  popover.close();
});

test('Android keyboard resize retains editable popover inside the visible viewport',()=>{
 const doc=createDocument();const viewport=new EventNode();
 Object.assign(viewport,{width:360,height:260,offsetLeft:0,offsetTop:180});doc.defaultView.visualViewport=viewport;
 const popover=new AnchoredPopover(anchor(doc,{left:310,top:430,width:38,height:28}),'编辑图片引用');
 popover.open();assert.equal(parseFloat(popover.el.style.top)>=188,true);
 assert.equal(parseFloat(popover.el.style.top)+140<=432,true);
 assert.equal(parseFloat(popover.el.style.left)+210<=352,true);
 viewport.height=180;viewport.fire=()=>{for(const item of viewport.listeners)if(item.type==='resize')item.handler({});};viewport.fire();
 assert.equal(popover.el.isConnected,true);assert.equal(popover.el.style.maxHeight,'164px');
 popover.close();assert.equal(viewport.listeners.length,0);
});
