import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';

class EventNode {
  constructor(){this.listeners=[];}
  addEventListener(type,callback,options){this.listeners.push({type,callback,capture:typeof options==='boolean'?options:Boolean(options?.capture)});}
  removeEventListener(type,callback,capture){this.listeners=this.listeners.filter(item=>item.type!==type||item.callback!==callback||item.capture!==Boolean(capture));}
}
class Element extends EventNode {
  constructor(doc,tag='div'){
    super();this.ownerDocument=doc;this.tagName=tag.toUpperCase();this.nodeType=1;this.children=[];this.style={};this.attributes={};this.className='';this.value='';
    this.classList={add:(...values)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...values])].join(' ');},remove:value=>{this.className=this.className.split(/\s+/).filter(item=>item!==value).join(' ');},contains:value=>this.className.split(/\s+/).includes(value)};
  }
  get isConnected(){return this.parentNode?.isConnected??false;}
  appendChild(child){child.remove();this.children.push(child);child.parentNode=this;return child;}
  append(...children){children.forEach(child=>this.appendChild(child));}
  remove(){if(this.parentNode?.children)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=undefined;}
  contains(target){return target===this||this.children.some(child=>child.contains(target));}
  setAttribute(name,value){this.attributes[name]=value;}
  focus(){this.ownerDocument.activeElement=this;}
  getBoundingClientRect(){return {left:20,top:20,right:230,bottom:160,width:210,height:140};}
}
function makeDocument(){
  const doc=new EventNode();doc.nodeType=9;doc.isConnected=true;doc.children=[];doc.createElement=tag=>new Element(doc,tag);
  doc.body=new Element(doc,'body');doc.body.parentNode=doc;doc.children.push(doc.body);doc.documentElement={clientWidth:800,clientHeight:600};
  const win=new EventNode();win.innerWidth=800;win.innerHeight=600;doc.defaultView=win;
  return doc;
}
function fire(target,type,extra={}){
  const path=[];for(let node=target;node;node=node.parentNode)path.push(node);
  const event={type,target,defaultPrevented:false,stopped:false,immediate:false,composedPath:()=>path,...extra,
    preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;this.immediate=true;}};
  for(const capture of [true,false]){
    for(const node of capture?[...path].reverse():path){
      for(const listener of [...node.listeners]){
        if(listener.type===type&&listener.capture===capture&&node.listeners.includes(listener))listener.callback(event);
        if(event.immediate)return event;
      }
      if(event.stopped)return event;
    }
  }
  return event;
}
function find(root,name){return root.classList?.contains(name)?root:root.children?.map(child=>find(child,name)).find(Boolean);}
function anchor(doc){const button=new Element(doc,'button');doc.body.append(button);return button;}
const built=await build({entryPoints:['src/reference-editor.ts'],bundle:true,write:false,format:'cjs'});
const fallback=makeDocument(),module={exports:{}};
runInNewContext(built.outputFiles[0].text,{module,exports:module.exports,document:fallback,activeDocument:fallback});
const {ReferenceEditor}=module.exports;
const flush=async()=>{await Promise.resolve();await Promise.resolve();};

test('a failed async save preserves editing, prevents duplicates and retries without leaving the note',async()=>{
  const doc=makeDocument();let calls=0,rejectSave;
  const editor=new ReferenceEditor(anchor(doc),'![[原图.png]]\n',async()=>{calls++;if(calls===1)await new Promise((_,reject)=>rejectSave=reject);},{draftKey:'test'});
  editor.open();const input=find(editor.el,'ilg-reference-input'),save=find(editor.el,'ilg-reference-save');
  input.value='![[新图.png]]\n中文图注\n';fire(input,'input');fire(save,'click');fire(save,'click');
  assert.equal(calls,1);assert.equal(save.disabled,true);assert.equal(input.readOnly,true);
  rejectSave(new Error('source changed'));await flush();
  assert.equal(editor.el.isConnected,true);assert.equal(input.value,'![[新图.png]]\n中文图注\n');assert.equal(save.disabled,false);
  assert.equal(find(editor.el,'ilg-reference-status').classList.contains('is-error'),true);
  fire(save,'click');await flush();assert.equal(calls,2);assert.equal(editor.el.isConnected,false);
});

test('automatic outside close restores a same-source draft while explicit Escape discards it',()=>{
  const doc=makeDocument(),source='![[图.png]]\n';
  const first=new ReferenceEditor(anchor(doc),source,async()=>{},{draftKey:'group'});first.open();
  const input=find(first.el,'ilg-reference-input');input.value='![[图.png]]\n待保存图注';fire(input,'input');fire(doc.body,'pointerdown');
  const recovered=new ReferenceEditor(anchor(doc),source,async()=>{},{draftKey:'group'});recovered.open();
  assert.equal(find(recovered.el,'ilg-reference-input').value,'![[图.png]]\n待保存图注');
  assert.equal(find(recovered.el,'ilg-reference-status').textContent,'已恢复草稿');
  fire(find(recovered.el,'ilg-reference-input'),'keydown',{key:'Escape'});assert.equal(recovered.el.isConnected,false);
  const clean=new ReferenceEditor(anchor(doc),source,async()=>{},{draftKey:'group'});clean.open();
  assert.equal(find(clean.el,'ilg-reference-input').value,source);clean.close();
});

test('cancel isolates its click before removing the panel and its root listeners',()=>{
  const doc=makeDocument();let delegated=0;doc.addEventListener('click',()=>delegated++);
  const editor=new ReferenceEditor(anchor(doc),'![[图.png]]',async()=>{});editor.open();
  fire(find(editor.el,'ilg-reference-cancel'),'click');
  assert.equal(editor.el.isConnected,false);assert.equal(delegated,0);
});

test('Chinese composition keeps Escape and Ctrl+Enter local without cancelling or submitting',async()=>{
  const doc=makeDocument();let saves=0,delegatedInput=0,delegatedKeys=0;
  doc.addEventListener('input',()=>delegatedInput++);doc.addEventListener('keydown',()=>delegatedKeys++);
  const editor=new ReferenceEditor(anchor(doc),'![[图.png]]',async()=>{saves++;});editor.open();
  const input=find(editor.el,'ilg-reference-input');fire(input,'compositionstart');
  const escape=fire(input,'keydown',{key:'Escape',isComposing:true});assert.equal(escape.defaultPrevented,false);assert.equal(editor.el.isConnected,true);
  fire(input,'keydown',{key:'Enter',ctrlKey:true,isComposing:true});assert.equal(saves,0);
  input.value='![[图.png]]\n中文\n粘贴换行';fire(input,'input');fire(input,'compositionend');
  assert.equal(delegatedInput,0);assert.equal(delegatedKeys,0);
  fire(input,'keydown',{key:'Enter',metaKey:true});await flush();assert.equal(saves,1);assert.equal(editor.el.isConnected,false);
});

test('changed source does not inherit old content and successful CRLF saves preserve native line endings',async()=>{
  const doc=makeDocument(),initial='![[甲.png]]\r\n',changed='![[乙.png]]\r\n';
  const first=new ReferenceEditor(anchor(doc),initial,async()=>{},{draftKey:'group'});first.open();
  find(first.el,'ilg-reference-input').value='![[甲.png]]\n旧草稿';fire(find(first.el,'ilg-reference-input'),'input');first.close();
  let written;
  const next=new ReferenceEditor(anchor(doc),changed,async body=>{written=body;},{draftKey:'group'});next.open();
  const input=find(next.el,'ilg-reference-input');assert.equal(input.value,'![[乙.png]]\n');
  input.value='![[乙.png]]\n新图注\n';fire(input,'input');fire(find(next.el,'ilg-reference-save'),'click');await flush();
  assert.equal(written,'![[乙.png]]\r\n新图注\r\n');
});

test('a save completing after automatic close clears its draft while retaining a newer independent draft',async()=>{
  const doc=makeDocument(),source='![[图.png]]';let resolveSave;
  const first=new ReferenceEditor(anchor(doc),source,async()=>await new Promise(resolve=>resolveSave=resolve),{draftKey:'group'});first.open();
  find(first.el,'ilg-reference-input').value='![[图.png]]\n第一份';fire(find(first.el,'ilg-reference-input'),'input');
  fire(find(first.el,'ilg-reference-save'),'click');first.close();
  const newer=new ReferenceEditor(anchor(doc),source,async()=>{},{draftKey:'group'});newer.open();
  find(newer.el,'ilg-reference-input').value='![[图.png]]\n更新的草稿';fire(find(newer.el,'ilg-reference-input'),'input');
  resolveSave();await flush();newer.close();
  const reopened=new ReferenceEditor(anchor(doc),source,async()=>{},{draftKey:'group'});reopened.open();
  assert.equal(find(reopened.el,'ilg-reference-input').value,'![[图.png]]\n更新的草稿');reopened.close();
});

test('the per-document session cache is bounded to 64 group drafts',()=>{
  const doc=makeDocument(),source='![[图.png]]';
  for(let index=0;index<65;index++){
    const editor=new ReferenceEditor(anchor(doc),source,async()=>{},{draftKey:String(index)});editor.open();
    const input=find(editor.el,'ilg-reference-input');input.value=source+'\n'+index;fire(input,'input');editor.close();
  }
  const old=new ReferenceEditor(anchor(doc),source,async()=>{},{draftKey:'0'});old.open();assert.equal(find(old.el,'ilg-reference-input').value,source);old.close();
  const latest=new ReferenceEditor(anchor(doc),source,async()=>{},{draftKey:'64'});latest.open();assert.equal(find(latest.el,'ilg-reference-input').value,source+'\n64');latest.close();
});
