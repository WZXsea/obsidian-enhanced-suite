const DURATION = 160;
const GROUP_DURATION = 220;
export const RESULT_MOTION_END_EVENT='fs-result-motion-end';
const MAX_ROWS = 32;
const MAX_EXITS = 6;
type Direction = 'forward' | 'back' | 'next' | 'previous';
interface GroupExit {key:string;visual:HTMLElement;top:number;height:number;}
interface GroupMotion {key:string;wrapper:HTMLElement;options:ResultMotionOptions;exits:GroupExit[];cleanup:()=>void;}
interface GroupSnapshot {options:ResultMotionOptions;height:number;exits:GroupExit[];}
interface MotionState {animations:Set<Animation>;layer:HTMLElement|null;cleanup?:()=>void;groups?:Map<string,GroupMotion>;}
interface RowSnapshot {key:string;row:HTMLElement;rect:DOMRect;ghost:HTMLElement|null;}
export interface ResultMotionOptions {
 exitingKeys?:ReadonlySet<string>;
 /** The parent row key; child rows carry data-motion-group with the same key. */
 groupKey?:string;
 direction?:'expand'|'collapse';
 /** Optional alternative to data-motion-group, useful for external callers. */
 childKeys?:ReadonlySet<string>;
}
const running = new Map<HTMLElement,MotionState>();

function finish(owner:HTMLElement,state:MotionState){
 if(running.get(owner)!==state||state.animations.size)return;
 state.layer?.remove();state.cleanup?.();running.delete(owner);
 if(state.groups&&owner.isConnected){
  const event=owner.ownerDocument.createEvent('Event');
  event.initEvent(RESULT_MOTION_END_EVENT,false,false);owner.dispatchEvent(event);
 }
}

/** Modal/preview teardown also releases motions owned by descendant containers. */
export function cancelSearchMotion(root:HTMLElement):void{
 for(const [owner,state]of running){
  if(owner!==root&&!root.contains(owner))continue;
  running.delete(owner);state.layer?.remove();state.cleanup?.();
  for(const animation of state.animations)animation.cancel();
  state.animations.clear();
 }
}

function allowsMotion(element:HTMLElement){
 const win=element.ownerDocument.defaultView;
 return !!win&&!win.matchMedia('(prefers-reduced-motion: reduce)').matches&&typeof element.animate==='function'&&element.isConnected;
}

function start(owner:HTMLElement,state:MotionState,element:HTMLElement,frames:Keyframe[],timing:{duration:number;easing:string}={duration:DURATION,easing:'cubic-bezier(.22,.61,.36,1)'},settle?:()=>void){
 try{
  const animation=element.animate(frames,{...timing,fill:'both'});
  state.animations.add(animation);
  const cleanup=()=>{
   if(running.get(owner)!==state)return;
   state.animations.delete(animation);animation.oncancel=null;animation.onfinish=null;settle?.();animation.cancel();finish(owner,state);
  };
  animation.onfinish=cleanup;animation.oncancel=cleanup;
 }catch{settle?.(); /* DOM has already committed; an unavailable animation leaves its final state. */ }
}

function visibleRows(container:HTMLElement){
 const bounds=container.getBoundingClientRect();
 const rows:Array<{key:string;row:HTMLElement;rect:DOMRect}>=[];
 for(const row of Array.from(container.querySelectorAll<HTMLElement>('.suggestion-item[data-result-key],.suggestion-item[data-float-search-key]'))){
  const rect=row.getBoundingClientRect();
  if(rect.width<=0||rect.height<=0||rect.bottom<=bounds.top||rect.top>=bounds.bottom)continue;
  const key=row.dataset.resultKey??row.dataset.floatSearchKey;if(!key)continue;
  rows.push({key,row,rect});if(rows.length>=MAX_ROWS)break;
 }
 return rows;
}

const visualProperties=['display','grid-template-columns','grid-template-rows','grid-column','grid-row','flex-direction','flex-grow','flex-shrink','flex-basis','align-items','justify-content','align-self','justify-self','gap','box-sizing','font-family','font-size','font-weight','line-height','color','background-color','border','border-radius','padding','margin','white-space','text-overflow','overflow','opacity','width','height','min-width','min-height','max-width','max-height','position','top','left','right','bottom'];

/** Frozen visuals carry no original selectors, ids, form controls, or pointer input. */
function visualClone(row:HTMLElement):HTMLElement{
 const clone=row.cloneNode(true) as HTMLElement,win=row.ownerDocument.defaultView;
 if(!win)return clone;
 const sources=[row,...Array.from(row.querySelectorAll<HTMLElement>('*'))];
 const clones=[clone,...Array.from(clone.querySelectorAll<HTMLElement>('*'))];
 clones.forEach((element,index)=>{
  const computed=win.getComputedStyle(sources[index]);
  for(const property of visualProperties)element.style.setProperty(property,computed.getPropertyValue(property));
  for(const name of element.getAttributeNames())if(name!=='style'&&name!=='viewBox'&&name!=='d'&&name!=='fill'&&name!=='stroke'&&name!=='stroke-width')element.removeAttribute(name);
  if(element.matches('button,input,textarea,select,a')){
   const neutral=row.ownerDocument.createElement('span');neutral.style.cssText=element.style.cssText;neutral.append(...Array.from(element.childNodes));element.replaceWith(neutral);
  }
 });
 clone.className='fs-mobile-motion-ghost';clone.setAttribute('aria-hidden','true');clone.setAttribute('inert','');
 clone.style.pointerEvents='none';clone.style.margin='0';clone.style.overflow='hidden';
 return clone;
}

const rowSelector='.suggestion-item[data-result-key],.suggestion-item[data-float-search-key]';
const rowKey=(row:HTMLElement)=>row.dataset.resultKey??row.dataset.floatSearchKey??'';

function groupRows(container:HTMLElement,options:ResultMotionOptions):HTMLElement[]{
 return Array.from(container.querySelectorAll<HTMLElement>(rowSelector)).filter(row=>
  row.dataset.motionGroup===options.groupKey||options.childKeys?.has(rowKey(row))||options.exitingKeys?.has(rowKey(row)));
}

function groupHeight(rows:HTMLElement[],rects:DOMRect[]):number{
 if(!rows.length)return 0;
 const last=rows[rows.length-1];
 const bottomMargin=Number.parseFloat(last.ownerDocument.defaultView?.getComputedStyle(last).marginBottom??'0')||0;
 return rects[rects.length-1].bottom-rects[0].top+bottomMargin;
}

/** Capture every unfinished group before a chooser replaces the entire result DOM. */
function snapshotGroup(container:HTMLElement,options:ResultMotionOptions,bounds:DOMRect,previous?:GroupMotion):GroupSnapshot{
 const rows=groupRows(container,options),rects=rows.map(row=>row.getBoundingClientRect());
 const previousRect=previous?.wrapper.getBoundingClientRect();
 const height=previousRect?.height??groupHeight(rows,rects);
 const top=previousRect?.top??rects[0]?.top??0;
 const exits:GroupExit[]=options.direction==='collapse'?(previous?.exits??[]).map(exit=>({...exit,visual:exit.visual.cloneNode(true) as HTMLElement})):[];
 const known=new Set(exits.map(exit=>exit.key));
 if(options.direction==='collapse')for(let i=0;i<rows.length&&exits.length<MAX_ROWS;i++){
  const rect=rects[i],key=rowKey(rows[i]);
  if(known.has(key)||rect.bottom<=bounds.top||rect.top>=bounds.bottom||rect.top>=top+height)continue;
  if(options.exitingKeys&&!options.exitingKeys.has(key))continue;
  exits.push({key,visual:visualClone(rows[i]),top:rect.top-top,height:rect.height});
 }
 return{options,height,exits};
}

/** All active groups resume from their current height after a shared DOM update. */
function animateGroupChange(container:HTMLElement,update:()=>void,options:ResultMotionOptions):void{
 const previous=running.get(container),bounds=container.getBoundingClientRect(),scrollTop=container.scrollTop;
 if(!allowsMotion(container)||bounds.width<=0||bounds.height<=0){cancelSearchMotion(container);update();return;}
 const snapshots=new Map<string,GroupSnapshot>(),key=options.groupKey??'';
 for(const [activeKey,group]of previous?.groups??[]){
  if(key!==activeKey&&group.wrapper.isConnected&&container.contains(group.wrapper))snapshots.set(activeKey,snapshotGroup(container,group.options,bounds,group));
 }
 const previousGroup=previous?.groups?.get(key);
 snapshots.set(key,snapshotGroup(container,options,bounds,previousGroup?.wrapper.isConnected?previousGroup:undefined));
 cancelSearchMotion(container);
 update();
 if(!container.isConnected)return;
 const previousAnchor=container.style.overflowAnchor;
 container.style.overflowAnchor='none';
 const groups=new Map<string,GroupMotion>();
 const state:MotionState={animations:new Set(),layer:null,groups};
 state.cleanup=()=>{
  for(const group of groups.values())group.cleanup();
  groups.clear();container.style.overflowAnchor=previousAnchor;
 };
 const pending:Array<{group:GroupMotion;oldHeight:number;finalHeight:number}>=[];
 for(const [groupKey,snapshot]of snapshots){
  const groupOptions=snapshot.options,rows=groupRows(container,groupOptions);
  const parent=Array.from(container.querySelectorAll<HTMLElement>(rowSelector)).find(row=>rowKey(row)===groupKey);
  const insertion=rows[0]??parent?.nextSibling,host=rows[0]?.parentElement??parent?.parentElement;
  if(!host)continue;
  const finalHeight=groupHeight(rows,rows.map(row=>row.getBoundingClientRect()));
  if(Math.abs(finalHeight-snapshot.height)<1)continue;
  const wrapper=container.ownerDocument.createElement('div');
  wrapper.className='fs-search-motion-group';wrapper.dataset.motionGroupKey=groupKey;
  Object.assign(wrapper.style,{display:'flow-root',position:'relative',boxSizing:'border-box',height:`${snapshot.height}px`,minHeight:'0',overflow:'hidden',overflowAnchor:'none',flexShrink:'0'});
  if(!rows.length){wrapper.setAttribute('aria-hidden','true');wrapper.setAttribute('inert','');wrapper.style.pointerEvents='none';}
  host.insertBefore(wrapper,insertion??null);
  for(const row of rows)wrapper.append(row);
  const remaining=new Set(rows.map(rowKey));
  const exits=snapshot.exits.filter(exit=>!remaining.has(exit.key));
  for(const exit of exits){
   exit.visual.classList.add('fs-search-motion-exit');
   Object.assign(exit.visual.style,{position:'absolute',left:'0',top:`${exit.top}px`,width:'100%',height:`${exit.height}px`,userSelect:'none'});
   wrapper.append(exit.visual);
  }
  let cleaned=false;
  const cleanup=()=>{
   if(cleaned)return;cleaned=true;
   if(wrapper.isConnected&&container.contains(wrapper)&&wrapper.parentNode){
    for(const row of rows)if(row.parentNode===wrapper)wrapper.parentNode.insertBefore(row,wrapper);
   }
   wrapper.remove();
  };
  const group:GroupMotion={key:groupKey,wrapper,options:groupOptions,exits,cleanup};
  groups.set(groupKey,group);pending.push({group,oldHeight:snapshot.height,finalHeight});
 }
 // Restore only after every group's placeholder has restored the scroll range.
 container.scrollTop=scrollTop;
 running.set(container,state);
 for(const {group,oldHeight,finalHeight}of pending){
  const groupTop=group.wrapper.getBoundingClientRect().top;
  const visibleBoundary=Math.max(0,bounds.bottom-groupTop+44);
  const ease='cubic-bezier(.22,.61,.36,1)';
  let frames:Keyframe[]=[{height:`${oldHeight}px`,easing:ease},{height:`${finalHeight}px`}];
  if(group.options.direction==='collapse'&&oldHeight>Math.max(finalHeight,visibleBoundary)+44){
   const threshold=Math.max(finalHeight,visibleBoundary);
   frames=[{height:`${oldHeight}px`,offset:0,easing:'cubic-bezier(.2,0,.2,1)'},{height:`${threshold}px`,offset:.2,easing:ease},{height:`${finalHeight}px`,offset:1}];
  }else if(group.options.direction==='expand'&&finalHeight>Math.max(oldHeight,visibleBoundary)+44){
   const threshold=Math.max(oldHeight,visibleBoundary);
   frames=[{height:`${oldHeight}px`,offset:0,easing:ease},{height:`${threshold}px`,offset:.8,easing:'cubic-bezier(.2,0,.2,1)'},{height:`${finalHeight}px`,offset:1}];
  }
  start(container,state,group.wrapper,frames,{duration:GROUP_DURATION,easing:'linear'},()=>{
   // Settle this group before removing its animation effect, even while other
   // groups still run. Its final rows keep the same geometry after unwrapping.
   group.cleanup();groups.delete(group.key);
  });
 }
 finish(container,state);
}

/** Update is synchronous; only the previous visible geometry is animated. */
export function animateResultChange(container:HTMLElement,update:()=>void,options:ResultMotionOptions={}):void{
 if(options.groupKey&&options.direction){animateGroupChange(container,update,options);return;}
 cancelSearchMotion(container);
 if(!allowsMotion(container)){update();return;}
 const bounds=container.getBoundingClientRect();
 if(bounds.width<=0||bounds.height<=0){update();return;}
 const before:RowSnapshot[]=visibleRows(container).map(item=>({...item,ghost:null}));
 // The caller already knows a collapsed group's outgoing keys. Expansion passes
 // an empty set, so its geometry-only FLIP path performs no style cloning.
 const exitingKeys=options.exitingKeys;
 const candidates=exitingKeys===undefined?before:before.filter(item=>exitingKeys.has(item.key)).slice(0,MAX_EXITS);
 for(const item of candidates)item.ghost=visualClone(item.row);
 update();
 if(!container.isConnected)return;
 const after=visibleRows(container),old=new Map(before.map(item=>[item.key,item])),kept=new Set(after.map(item=>item.key));
 const state:MotionState={animations:new Set(),layer:null};running.set(container,state);
 for(const item of after){
  const previous=old.get(item.key);
  if(previous){
   const x=previous.rect.left-item.rect.left,y=previous.rect.top-item.rect.top;
   if(Math.abs(x)+Math.abs(y)>1)start(container,state,item.row,[{transform:`translate(${x}px,${y}px)`,opacity:.94},{transform:'translate(0,0)',opacity:1}]);
  }else start(container,state,item.row,[{transform:'translateY(-4px)',opacity:.5},{transform:'translateY(0)',opacity:1}]);
 }
 const removed=before.filter(item=>item.ghost&&!kept.has(item.key)).slice(0,MAX_EXITS);
 if(removed.length){
  const doc=container.ownerDocument,layer=doc.createElement('div'),win=doc.defaultView;
  layer.className='fs-mobile-motion-layer';layer.setAttribute('aria-hidden','true');layer.setAttribute('inert','');
  const modal=container.closest<HTMLElement>('.modal-container');
  const layerIndex=win?Number.parseInt(win.getComputedStyle(modal??container).zIndex)||0:0;
  Object.assign(layer.style,{position:'fixed',left:`${bounds.left}px`,top:`${bounds.top}px`,width:`${bounds.width}px`,height:`${bounds.height}px`,overflow:'hidden',pointerEvents:'none',zIndex:String(Math.max(1000,layerIndex)+1)});
  state.layer=layer;doc.body.append(layer);
  for(const {ghost,rect}of removed){
   if(!ghost)continue;
   Object.assign(ghost.style,{position:'absolute',left:`${rect.left-bounds.left}px`,top:`${rect.top-bounds.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
   layer.append(ghost);start(container,state,ghost,[{transform:'translateY(0)',opacity:.72},{transform:'translateY(-3px)',opacity:0}]);
  }
 }
 finish(container,state);
}

/** Auto-pagination can ignore layout-generated scroll events during a group transition. */
export function isResultMotionActive(container:HTMLElement):boolean{
 const groups=running.get(container)?.groups;
 return !!groups&&Array.from(groups.values()).some(group=>group.wrapper.isConnected);
}

/** Keep the first content readable while the navigation settles into place. */
export function animateNavigation(element:HTMLElement,direction:Direction='forward'):void{
 cancelSearchMotion(element);if(!allowsMotion(element))return;
 const offset=direction==='back'?'translateX(-8px)':direction==='next'?'translateY(6px)':direction==='previous'?'translateY(-6px)':'translateX(8px)';
 const state:MotionState={animations:new Set(),layer:null};running.set(element,state);
 start(element,state,element,[{transform:offset,opacity:.85},{transform:'translate(0,0)',opacity:1}]);
 finish(element,state);
}
