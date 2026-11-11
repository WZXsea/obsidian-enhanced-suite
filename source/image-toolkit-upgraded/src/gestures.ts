/** Pointer-only pan and pinch model. Coordinates are relative to the image stage centre. */
export class ImageGestures {
  scale = 1; x = 0; y = 0;
  private pointers = new Map<number, {x:number;y:number}>();
  private origin = {x:0,y:0,scale:1,cx:0,cy:0,distance:0};
  down(id:number,x:number,y:number){ this.pointers.set(id,{x,y}); this.rebase(); }
  move(id:number,x:number,y:number){
    if(!this.pointers.has(id))return false;
    this.pointers.set(id,{x,y});
    const {cx,cy,distance}=this.geometry(),base=this.origin;
    const ratio=base.distance>0&&distance>0 ? distance/base.distance : 1;
    this.scale=Math.max(.1,Math.min(20,base.scale*ratio));
    const actual=this.scale/base.scale;
    this.x=cx-(base.cx-base.x)*actual;
    this.y=cy-(base.cy-base.y)*actual;
    return true;
  }
  up(id:number){this.pointers.delete(id);this.rebase();}
  reset(){this.pointers.clear();this.scale=1;this.x=this.y=0;this.rebase();}
  zoom(factor:number){this.scale=Math.max(.1,Math.min(20,this.scale*factor));this.rebase();}
  private geometry(){
    const [a,b]=[...this.pointers.values()];
    if(!a)return {cx:0,cy:0,distance:0};
    return b ? {cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,distance:Math.hypot(a.x-b.x,a.y-b.y)} : {cx:a.x,cy:a.y,distance:0};
  }
  private rebase(){this.origin={x:this.x,y:this.y,scale:this.scale,...this.geometry()};}
}

/** Every listener belongs to this viewer and is released when it closes. */
export function attachImageGestures(stage:HTMLElement,model:ImageGestures,render:()=>void):()=>void {
  const point=(event:PointerEvent)=>{const r=stage.getBoundingClientRect();return {x:event.clientX-r.left-r.width/2,y:event.clientY-r.top-r.height/2};};
  const down=(event:PointerEvent)=>{
    if(event.button!==0)return;
    event.preventDefault();const p=point(event);model.down(event.pointerId,p.x,p.y);
    try { stage.setPointerCapture(event.pointerId); } catch { model.up(event.pointerId); }
  };
  const move=(event:PointerEvent)=>{const p=point(event);if(model.move(event.pointerId,p.x,p.y)){event.preventDefault();render();}};
  const end=(event:PointerEvent)=>{model.up(event.pointerId);if(stage.hasPointerCapture(event.pointerId))stage.releasePointerCapture(event.pointerId);};
  stage.addEventListener('pointerdown',down);stage.addEventListener('pointermove',move);stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);stage.addEventListener('lostpointercapture',end);
  return ()=>{stage.removeEventListener('pointerdown',down);stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerup',end);stage.removeEventListener('pointercancel',end);stage.removeEventListener('lostpointercapture',end);model.reset();};
}
