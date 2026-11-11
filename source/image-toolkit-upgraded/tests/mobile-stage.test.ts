import test from 'node:test';
import assert from 'node:assert/strict';
import {attachMobileStageDismiss} from '../src/mobile-stage';
import {navigatePreviewImage} from '../src/image-navigation';
import {extractImages} from '../src/images';
function fixture(){
 const listeners=new Map<string,Function>();let dismissed=0;
 const inside={},outside={};
 const doc={addEventListener:(type:string,fn:Function)=>listeners.set(type,fn),removeEventListener:(type:string)=>listeners.delete(type)};
 const root={ownerDocument:doc,contains:(node:unknown)=>node===inside} as unknown as HTMLElement;
 const dispose=attachMobileStageDismiss(root,()=>dismissed++);
 const fire=(type:string,target:unknown,x=0,y=0,id=1)=>listeners.get(type)?.({pointerId:id,button:0,target,clientX:x,clientY:y});
 return {inside,outside,fire,dispose,listeners,get dismissed(){return dismissed;}};
}
test('mobile rail keeps internal card and blank-list touch scrolling open',()=>{
 const f=fixture();f.fire('pointerdown',f.inside,10,20);f.fire('pointermove',f.inside,12,170);f.fire('pointercancel',f.inside,12,170);f.fire('pointerup',f.outside,12,170);
 assert.equal(f.dismissed,0);f.dispose();assert.equal(f.listeners.size,0);
});
test('outside page swipes and canceled taps retain mobile rail while a completed outside tap closes once',()=>{
 const f=fixture();f.fire('pointerdown',f.outside,10,20);f.fire('pointermove',f.outside,10,100);f.fire('pointerup',f.outside,10,100);assert.equal(f.dismissed,0);
 f.fire('pointerdown',f.outside);f.fire('pointercancel',f.outside);f.fire('pointerup',f.outside);assert.equal(f.dismissed,0);
 f.fire('pointerdown',f.outside,20,30);f.fire('pointerup',f.outside,22,31);assert.equal(f.dismissed,1);
 f.fire('pointerup',f.outside);assert.equal(f.dismissed,1);f.dispose();
});
test('preview image navigation preserves native reading scroll and exact repeated gallery occurrence',async()=>{
 const source='![](https://host/a.png)\n\n<!-- image-layouts: {"id":"group","layout":"focus"} -->\n![](https://host/a.png)\n![](https://host/b.png)\n![](https://host/a.png)\n<!-- /image-layouts -->';
 const refs=extractImages(source),last=refs[3],lines:number[]=[],offsets:number[]=[];let selected=-1,scrolled=-1;
 const target={isConnected:true,getBoundingClientRect:()=>({top:450,bottom:750,width:300,height:300})};
 const scroller={scrollTop:100,getBoundingClientRect:()=>({top:100,bottom:700}),scrollTo:({top}:{top:number})=>scrolled=top};
 const root={ownerDocument:{defaultView:{setTimeout:(fn:()=>void)=>fn()}},querySelector:()=>scroller,querySelectorAll:()=>[]} as unknown as HTMLElement;
 const view={containerEl:root,previewMode:{applyScroll:(line:number)=>lines.push(line)}};
 const ok=await navigatePreviewImage(view,'note.md',source,last,'https://host/a.png',{
  getSourceImageNavigationLine:()=>2,
  revealSourceImage:(_path,offset)=>{offsets.push(offset);selected=refs.slice(1).findIndex(ref=>ref.offset===offset);return target as unknown as HTMLElement;},
 });
 assert.equal(ok,true);assert.deepEqual(lines,[2]);assert.deepEqual(offsets,[last.offset]);assert.equal(selected,2);assert.equal(scrolled,300);
});
test('virtual preview waits for exact occurrence DOM and stops after a newer navigation request',async()=>{
 const item=extractImages('![](https://host/a.png)')[0];let active=false,attempts=0,scrolled=0;
 const scroller={scrollTop:0,getBoundingClientRect:()=>({top:0,bottom:600}),scrollTo:()=>scrolled++};
 const image={dataset:{ilgSourceOffset:'0'},src:'https://host/a.png',closest:()=>null,isConnected:true,getBoundingClientRect:()=>({top:800,bottom:1000,width:100,height:200})};
 const root={ownerDocument:{defaultView:{setTimeout:(fn:()=>void)=>{active=true;fn();}}},querySelector:()=>scroller,querySelectorAll:()=>{attempts++;return active?[image]:[];}} as unknown as HTMLElement;
 const view={containerEl:root,previewMode:{applyScroll(){}}};
 assert.equal(await navigatePreviewImage(view,'note.md','',item,image.src),true);assert.ok(attempts>1);assert.equal(scrolled,1);
 assert.equal(await navigatePreviewImage(view,'note.md','',item,image.src,undefined,()=>false),false);assert.equal(scrolled,1);
});


test('two-finger gestures outside or across the rail retain its open state',()=>{
 const f=fixture();f.fire('pointerdown',f.outside,10,20,1);f.fire('pointerdown',f.outside,20,30,2);f.fire('pointerup',f.outside,20,30,2);f.fire('pointerup',f.outside,10,20,1);assert.equal(f.dismissed,0);
 f.fire('pointerdown',f.outside,10,20,1);f.fire('pointerdown',f.inside,20,30,2);f.fire('pointerup',f.inside,20,30,2);f.fire('pointerup',f.outside,10,20,1);assert.equal(f.dismissed,0);f.dispose();
});
