/** Outside dismissal requires a completed tap. Touch scrolling, capture loss and resizing retain the rail. */
export function attachMobileStageDismiss(root:HTMLElement,dismiss:()=>void):()=>void {
 const doc=root.ownerDocument;
 let tap:{id:number;x:number;y:number}|null=null;const active=new Set<number>();
 const contains=(target:EventTarget|null)=>Boolean(target&&root.contains(target as Node));
 const down=(event:PointerEvent)=>{
  active.add(event.pointerId);
  if(active.size>1){tap=null;return;}
  if(event.button!==0||contains(event.target)){tap=null;return;}
  tap={id:event.pointerId,x:event.clientX,y:event.clientY};
 };
 const move=(event:PointerEvent)=>{if(tap?.id===event.pointerId&&Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>10)tap=null;};
 const up=(event:PointerEvent)=>{
  active.delete(event.pointerId);
  if(tap?.id!==event.pointerId)return;
  const accepted=!contains(event.target)&&Math.hypot(event.clientX-tap.x,event.clientY-tap.y)<=10;tap=null;
  if(accepted)dismiss();
 };
 const cancel=()=>{tap=null;active.clear();};
 doc.addEventListener('pointerdown',down,true);doc.addEventListener('pointermove',move,true);doc.addEventListener('pointerup',up,true);doc.addEventListener('pointercancel',cancel,true);
 return ()=>{cancel();doc.removeEventListener('pointerdown',down,true);doc.removeEventListener('pointermove',move,true);doc.removeEventListener('pointerup',up,true);doc.removeEventListener('pointercancel',cancel,true);};
}
