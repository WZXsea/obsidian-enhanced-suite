// Capture/target/bubble fixture for local popover interactions and async saving.
class EventNode {
  constructor(){this.listeners=[];}
  addEventListener(type,callback,options){this.listeners.push({type,callback,capture:typeof options==='boolean'?options:Boolean(options?.capture)});}
  removeEventListener(type,callback,capture){this.listeners=this.listeners.filter(item=>item.type!==type||item.callback!==callback||item.capture!==Boolean(capture));}
}
class Element extends EventNode {
  constructor(doc,tag='div'){
    super();this.ownerDocument=doc;this.tagName=tag.toUpperCase();this.nodeType=1;this.children=[];this.dataset={};this.style={setProperty(name,value){this[name]=value;}};this.attributes={};this.className='';this.value='';
    this.classList={add:(...values)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...values])].join(' ');},remove:value=>{this.className=this.className.split(/\s+/).filter(item=>item!==value).join(' ');},contains:value=>this.className.split(/\s+/).includes(value),toggle:(value,force)=>{const on=force??!this.classList.contains(value);on?this.classList.add(value):this.classList.remove(value);return on;}};
  }
  get isConnected(){return this.parentNode?.isConnected??false;}
  appendChild(child){child.remove();this.children.push(child);child.parentNode=this;return child;}
  append(...children){children.forEach(child=>this.appendChild(child));}
  insertBefore(child,before){child.remove();const index=this.children.indexOf(before);if(index<0)return this.appendChild(child);this.children.splice(index,0,child);child.parentNode=this;return child;}
  remove(){if(this.parentNode?.children)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=undefined;}
  contains(target){return target===this||this.children.some(child=>child.contains(target));}
  setAttribute(name,value){this.attributes[name]=value;}
  focus(){this.ownerDocument.activeElement=this;}
  getBoundingClientRect(){return {left:20,top:20,right:230,bottom:160,width:210,height:140};}
}
export function makeDocument(){
  const doc=new EventNode();doc.nodeType=9;doc.isConnected=true;doc.children=[];doc.createElement=tag=>new Element(doc,tag);
  doc.body=new Element(doc,'body');doc.body.parentNode=doc;doc.children.push(doc.body);doc.documentElement={clientWidth:800,clientHeight:600};
  const win=new EventNode();win.innerWidth=800;win.innerHeight=600;doc.defaultView=win;
  return doc;
}
export function fire(target,type,extra={}){
  const path=[];for(let node=target;node;node=node.parentNode)path.push(node);
  const event={type,target,defaultPrevented:false,stopped:false,immediate:false,composedPath:()=>path,...extra,
    preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;this.immediate=true;}};
  for(const capture of [true,false])for(const node of capture?[...path].reverse():path){
    for(const listener of [...node.listeners]){if(listener.type===type&&listener.capture===capture&&node.listeners.includes(listener))listener.callback(event);if(event.immediate)return event;}
    if(event.stopped)return event;
  }
  return event;
}
export function find(root,predicate){return predicate(root)?root:root.children?.map(child=>find(child,predicate)).find(Boolean);}
export const byClass=(root,name)=>find(root,element=>element.classList?.contains(name));
export const byField=(root,name)=>find(root,element=>element.dataset?.field===name);
export function anchor(doc){const button=new Element(doc,'button');doc.body.append(button);return button;}
export const flush=async()=>{await Promise.resolve();await Promise.resolve();};
