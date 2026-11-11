import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
import {makeDocument,fire,find,byClass,byField,anchor,flush} from './configuration-dom-fixture.mjs';

const built=await build({entryPoints:['src/gallery-configuration.ts'],bundle:true,write:false,format:'cjs'});
const fallback=makeDocument(),module={exports:{}};
runInNewContext(built.outputFiles[0].text,{module,exports:module.exports,document:fallback,activeDocument:fallback});
const {GalleryConfiguration,getConfigurationPatch}=module.exports;
const defaults={id:'qa',layout:'g',fit:'contain',height:320,gap:8,radius:8,caption:'',grid:'AA\nBC',thumbnails:true,overlay:'never',align:'full',width:'100%',descriptions:[],fromFolder:'',sortBy:'name',reverse:false,limit:0};
const options=patch=>({...defaults,descriptions:[],...patch});
const change=(editor,name,value,type='input')=>{const control=byField(editor.el,name);control.value=value;fire(control,type);return control;};

test('only edited configuration fields are saved, leaving concurrent options intact',async()=>{
  const doc=makeDocument(),source=options();let written;
  const panel=new GalleryConfiguration(anchor(doc),source,async patch=>{written=patch;});panel.open();
  source.gap=14;source.caption='另一处更新的图注';
  change(panel,'height','420');
  assert.equal(byClass(byField(panel.el,'height').parentNode,'ilg-config-value').textContent,'420 px');
  fire(byClass(panel.el,'ilg-config-save'),'click');await flush();
  assert.equal(JSON.stringify(written),JSON.stringify({height:420}));assert.equal(panel.el.isConnected,false);
  assert.equal(source.gap,14);assert.equal(source.caption,'另一处更新的图注');
  assert.equal(JSON.stringify(getConfigurationPatch(options(),options())), '{}');
});

test('fit, sliders, Chinese caption and thumbnail toggle produce one precise patch',async()=>{
  const doc=makeDocument();let patch;
  const panel=new GalleryConfiguration(anchor(doc),options(),async value=>{patch=value;});panel.open();
  const cover=find(panel.el,element=>element.dataset?.fit==='cover');fire(cover,'click');assert.equal(cover.attributes['aria-pressed'],'true');
  change(panel,'gap','12');change(panel,'radius','0');change(panel,'caption','中文图注\n第二行');
  const thumb=byField(panel.el,'thumbnails');thumb.checked=false;fire(thumb,'change');
  fire(byClass(panel.el,'ilg-config-save'),'click');await flush();
  assert.equal(JSON.stringify(patch),JSON.stringify({fit:'cover',gap:12,radius:0,caption:'中文图注\n第二行',thumbnails:false}));
});

test('failed async saving keeps the form and prevents duplicate calls before a successful retry',async()=>{
  const doc=makeDocument();let calls=0,rejectSave;
  const panel=new GalleryConfiguration(anchor(doc),options(),async()=>{calls++;if(calls===1)await new Promise((_,reject)=>rejectSave=reject);});panel.open();
  change(panel,'radius','16');const save=byClass(panel.el,'ilg-config-save');fire(save,'click');fire(save,'click');
  assert.equal(calls,1);assert.equal(save.disabled,true);assert.equal(byField(panel.el,'radius').disabled,true);
  rejectSave(new Error('retry'));await flush();
  assert.equal(panel.el.isConnected,true);assert.equal(byField(panel.el,'radius').value,'16');assert.equal(save.disabled,false);
  assert.equal(byClass(panel.el,'ilg-config-status').classList.contains('is-error'),true);
  fire(save,'click');await flush();assert.equal(calls,2);assert.equal(panel.el.isConnected,false);
});

test('cancel and successful save isolate their click before removing the popover',async()=>{
  const doc=makeDocument();let delegated=0,saves=0;doc.addEventListener('click',()=>delegated++);
  const cancelPanel=new GalleryConfiguration(anchor(doc),options(),async()=>saves++);cancelPanel.open();change(cancelPanel,'height','400');
  fire(byClass(cancelPanel.el,'ilg-config-cancel'),'click');assert.equal(cancelPanel.el.isConnected,false);assert.equal(saves,0);assert.equal(delegated,0);
  const savePanel=new GalleryConfiguration(anchor(doc),options(),async()=>saves++);savePanel.open();change(savePanel,'height','400');
  fire(byClass(savePanel.el,'ilg-config-save'),'click');await flush();assert.equal(savePanel.el.isConnected,false);assert.equal(saves,1);assert.equal(delegated,0);
});

test('IME Escape and Enter preserve local composition while Ctrl+Enter saves afterwards',async()=>{
  const doc=makeDocument();let saves=0,keys=0,inputEvents=0;doc.addEventListener('keydown',()=>keys++);doc.addEventListener('input',()=>inputEvents++);
  const panel=new GalleryConfiguration(anchor(doc),options(),async()=>saves++);panel.open();
  const input=byField(panel.el,'caption');fire(input,'compositionstart');
  const escape=fire(input,'keydown',{key:'Escape',isComposing:true});assert.equal(escape.defaultPrevented,false);assert.equal(panel.el.isConnected,true);
  fire(input,'keydown',{key:'Enter',ctrlKey:true,isComposing:true});assert.equal(saves,0);
  change(panel,'caption','中文');fire(input,'compositionend');fire(input,'keydown',{key:'Enter',ctrlKey:true});await flush();
  assert.equal(saves,1);assert.equal(keys,0);assert.equal(inputEvents,0);assert.equal(panel.el.isConnected,false);
});

test('invalid advanced width and custom geometry retain the editable panel with an inline error',async()=>{
  const doc=makeDocument();let written;
  const panel=new GalleryConfiguration(anchor(doc),options({layout:'custom'}),async patch=>{written=patch;});panel.open();
  change(panel,'width','calc(100%)');fire(byClass(panel.el,'ilg-config-save'),'click');await flush();assert.equal(written,undefined);assert.equal(panel.el.isConnected,true);
  assert.equal(byClass(panel.el,'ilg-config-status').classList.contains('is-error'),true);
  change(panel,'width','70%');change(panel,'grid','AA\nAB');fire(byClass(panel.el,'ilg-config-save'),'click');await flush();assert.equal(written,undefined);assert.equal(panel.el.isConnected,true);
  change(panel,'grid','AB\nCD');change(panel,'overlay','hover','change');change(panel,'align','center','change');
  fire(byClass(panel.el,'ilg-config-save'),'click');await flush();
  assert.equal(JSON.stringify(written),JSON.stringify({overlay:'hover',align:'center',width:'70%',grid:'AB\nCD'}));
});

test('unchanged settings close without writing, and Escape cancels pending edits',async()=>{
  const doc=makeDocument();let calls=0;
  const panel=new GalleryConfiguration(anchor(doc),options(),async()=>calls++);panel.open();fire(byClass(panel.el,'ilg-config-save'),'click');await flush();
  assert.equal(calls,0);assert.equal(panel.el.isConnected,false);
  const edited=new GalleryConfiguration(anchor(doc),options(),async()=>calls++);edited.open();change(edited,'caption','暂存');
  fire(byField(edited.el,'caption'),'keydown',{key:'Escape'});assert.equal(calls,0);assert.equal(edited.el.isConnected,false);
});
