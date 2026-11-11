import test from 'node:test';
import assert from 'node:assert/strict';
import {PreviewMotion} from '../src/preview-motion';

class FakeAnimation {
 onfinish:(()=>void)|null=null;
 cancelled=false;
 cancel(){this.cancelled=true;}
 finish(){this.onfinish?.();}
}
class FakeStyle {
 private values=new Map<string,{value:string;priority:string}>();
 getPropertyValue(name:string){return this.values.get(name)?.value??'';}
 getPropertyPriority(name:string){return this.values.get(name)?.priority??'';}
 setProperty(name:string,value:string,priority=''){this.values.set(name,{value,priority});}
 removeProperty(name:string){this.values.delete(name);}
}
class FakeElement extends EventTarget {
 isConnected=true;
 src='app://fixture.png';
 complete=true;
 naturalWidth=1600;
 style=new FakeStyle();
 transform='none';
 rect={left:300,top:100,width:800,height:600};
 calls:Array<{frames:Keyframe[];options:KeyframeAnimationOptions;animation:FakeAnimation}>=[];
 footer:FakeElement|null=null;
 root:FakeElement|null=null;
 constructor(readonly ownerDocument:EventTarget&{defaultView:unknown}){super();}
 getBoundingClientRect(){return this.rect;}
 querySelector(){return this.footer;}
 closest(){return this.root;}
 animate(frames:Keyframe[],options:KeyframeAnimationOptions){const animation=new FakeAnimation();this.calls.push({frames,options,animation});return animation;}
}
function fixture(reduced=false){
 const document=Object.assign(new EventTarget(),{defaultView:{innerWidth:1400,innerHeight:900,matchMedia:()=>({matches:reduced}),getComputedStyle:(element:FakeElement)=>({backgroundColor:'rgba(0, 0, 0, 0.6)',transform:element.transform})}});
 const root=new FakeElement(document),image=new FakeElement(document),origin=new FakeElement(document),footer=new FakeElement(document);
 root.footer=footer;image.root=root;origin.rect={left:100,top:200,width:200,height:150};
 return {root,image,origin,footer,document,motion:new PreviewMotion()};
}
const el=(value:FakeElement)=>value as unknown as HTMLElement;
const img=(value:FakeElement)=>value as unknown as HTMLImageElement;

test('opening grows from the clicked image and fades its backdrop and toolbar',()=>{
 const f=fixture();f.motion.start(img(f.origin),el(f.root));f.motion.reveal(img(f.image));
 assert.equal(f.root.calls.length,1);assert.equal(f.footer.calls.length,1);assert.equal(f.image.calls.length,1);
 assert.deepEqual(f.root.calls[0].frames,[{backgroundColor:'rgba(0, 0, 0, 0)'},{backgroundColor:'rgba(0, 0, 0, 0.6)'}]);
 assert.equal(f.image.calls[0].frames[0].transform,'translate(-500px, -125px) scale(0.25, 0.25)');
 assert.equal(f.image.calls[0].frames[1].transform,'none');
 f.image.calls[0].animation.finish();assert.equal(f.root.calls[0].animation.cancelled,true);
});

test('reduced motion immediately retains the native viewer with no animation',()=>{
 const f=fixture(true);f.motion.start(img(f.origin),el(f.root));f.motion.reveal(img(f.image));
 assert.equal(f.root.calls.length,0);assert.equal(f.image.calls.length,0);assert.equal(f.footer.calls.length,0);
});

test('an offscreen source uses a gentle fade and leaves the final transform intact',()=>{
 const f=fixture();f.origin.rect.top=-500;f.image.transform='matrix(1, 0, 0, 1, 0, 0)';
 f.motion.start(img(f.origin),el(f.root));f.motion.reveal(img(f.image));
 assert.equal(f.image.calls[0].frames[0].opacity,0);
 assert.equal(f.image.calls[0].frames[0].transform,'scale(.96) matrix(1, 0, 0, 1, 0, 0)');
 assert.equal(f.image.calls[0].frames[1].transform,f.image.transform);
 f.motion.reveal(img(f.image));assert.equal(f.image.calls.length,1);
});

test('late decoding starts the animation on load and cancellation restores visibility',()=>{
 const f=fixture();f.image.complete=false;f.image.naturalWidth=0;
 f.image.style.setProperty('visibility','visible','important');
 f.motion.start(img(f.origin),el(f.root));f.motion.reveal(img(f.image));
 assert.equal(f.image.style.getPropertyValue('visibility'),'hidden');assert.equal(f.image.calls.length,0);
 f.image.complete=true;f.image.naturalWidth=1600;f.image.dispatchEvent(new Event('load'));
 assert.equal(f.image.calls.length,1);assert.equal(f.image.style.getPropertyValue('visibility'),'visible');
 assert.equal(f.image.style.getPropertyPriority('visibility'),'important');
 f.motion.cancel(el(f.root));assert.equal(f.image.calls[0].animation.cancelled,true);
});

test('closing while decoding removes pending work and subsequent images retain native transforms',()=>{
 const f=fixture();f.image.complete=false;f.motion.start(img(f.origin),el(f.root));f.motion.reveal(img(f.image));
 f.motion.cancel(el(f.root));f.image.dispatchEvent(new Event('load'));
 assert.equal(f.image.calls.length,0);assert.equal(f.image.style.getPropertyValue('visibility'),'');
 f.motion.reveal(img(f.image));assert.equal(f.image.calls.length,0);
});

test('zoom, drag and keyboard interactions cancel opening animations',()=>{
 for(const event of ['pointerdown','wheel','keydown']){
  const f=fixture();f.motion.start(img(f.origin),el(f.root));f.motion.reveal(img(f.image));
  (event==='keydown'?f.document:f.root).dispatchEvent(new Event(event));
  assert.equal(f.image.calls[0].animation.cancelled,true,event);
 }
});

test('rapid gallery switching cancels the pending origin transition',()=>{
 const f=fixture();f.motion.start(img(f.origin),el(f.root));f.image.src='app://second.png';f.motion.reveal(img(f.image));
 assert.equal(f.image.calls.length,0);assert.equal(f.root.calls[0].animation.cancelled,true);
});

test('cancellation is scoped to the viewer document and unload clears all windows',()=>{
 const main=fixture(),popout=fixture();
 main.motion.start(img(main.origin),el(main.root));main.motion.reveal(img(main.image));
 main.motion.start(img(popout.origin),el(popout.root));main.motion.reveal(img(popout.image));
 popout.document.dispatchEvent(new Event('keydown'));
 assert.equal(popout.image.calls[0].animation.cancelled,true);assert.equal(main.image.calls[0].animation.cancelled,false);
 main.motion.cancel();assert.equal(main.image.calls[0].animation.cancelled,true);
});
