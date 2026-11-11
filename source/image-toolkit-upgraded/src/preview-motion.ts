interface PreviewRect {left:number;top:number;width:number;height:number}
interface MotionState {
 root:HTMLElement;
 source:string;
 origin:PreviewRect|null;
 image?:HTMLImageElement;
 animations:Set<Animation>;
 dispose:Array<()=>void>;
}

/** One opening animation per desktop viewer, owned by the viewer's document. */
export class PreviewMotion {
 private readonly states=new Map<HTMLElement,MotionState>();

 start(origin:HTMLImageElement,root:HTMLElement){
  this.cancel(root);
  const win=root.ownerDocument.defaultView;
  if(!win||win.matchMedia?.('(prefers-reduced-motion: reduce)').matches||typeof root.animate!=='function')return;
  const rect=origin.getBoundingClientRect();
  const visible=origin.isConnected&&rect.width>1&&rect.height>1&&rect.left<win.innerWidth&&rect.top<win.innerHeight&&rect.left+rect.width>0&&rect.top+rect.height>0;
  const state:MotionState={root,source:origin.src,origin:visible?{left:rect.left,top:rect.top,width:rect.width,height:rect.height}:null,animations:new Set(),dispose:[]};
  this.states.set(root,state);
  // 用户开始缩放、旋转或拖动时，立即交还图像 transform 的控制权。
  const interrupt=()=>this.cancel(root);
  root.addEventListener('pointerdown',interrupt,true);
  root.addEventListener('wheel',interrupt,{capture:true,passive:true});
  root.ownerDocument.addEventListener('keydown',interrupt,true);
  state.dispose.push(()=>{
   root.removeEventListener('pointerdown',interrupt,true);
   root.removeEventListener('wheel',interrupt,true);
   root.ownerDocument.removeEventListener('keydown',interrupt,true);
  });
  this.play(state,root,[{backgroundColor:'rgba(0, 0, 0, 0)'},{backgroundColor:win.getComputedStyle(root).backgroundColor}],220);
  const footer=root.querySelector<HTMLElement>('.oit-img-footer');
  if(footer)this.play(state,footer,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],240);
 }

 /** Call after refreshImg has set its final transform and dimensions. */
 reveal(image:HTMLImageElement){
  const root=image.closest<HTMLElement>('.oit-normal');
  const state=root?this.states.get(root):undefined;
  if(!state||state.image===image)return;
  if(image.src!==state.source){this.cancel(state.root);return;}
  state.image=image;
  const show=()=>{
   if(this.states.get(state.root)!==state)return;
   if(!state.root.isConnected||!image.isConnected||image.src!==state.source){this.cancel(state.root);return;}
   const rect=image.getBoundingClientRect();
   if(rect.width<=0||rect.height<=0){this.cancel(state.root);return;}
   const base=image.ownerDocument.defaultView!.getComputedStyle(image).transform;
   const transform=base==='none'?'':base;
   let from=`scale(.96) ${transform}`.trim();
   if(state.origin){
    const source=state.origin;
    const dx=source.left+source.width/2-rect.left-rect.width/2;
    const dy=source.top+source.height/2-rect.top-rect.height/2;
    from=`translate(${dx}px, ${dy}px) scale(${source.width/rect.width}, ${source.height/rect.height}) ${transform}`.trim();
   }
   this.play(state,image,[{opacity:state.origin ? .95 : 0,transform:from,transformOrigin:'center center'},{opacity:1,transform:transform||'none',transformOrigin:'center center'}],280,true);
  };
  if(image.complete&&image.naturalWidth>0){show();return;}
  // 新 src 尚未解码时先隐藏待载图，load 后在同一帧接上动画。
  const visibility=image.style.getPropertyValue('visibility'),priority=image.style.getPropertyPriority('visibility');
  image.style.setProperty('visibility','hidden');
  const restore=()=>{if(visibility)image.style.setProperty('visibility',visibility,priority);else image.style.removeProperty('visibility');};
  const loaded=()=>{restore();image.removeEventListener('load',loaded);image.removeEventListener('error',failed);show();};
  const failed=()=>this.cancel(state.root);
  image.addEventListener('load',loaded);
  image.addEventListener('error',failed);
  state.dispose.push(()=>{image.removeEventListener('load',loaded);image.removeEventListener('error',failed);restore();});
 }

 cancel(root?:HTMLElement){
  for(const [element,state] of this.states){
   if(root&&root!==element)continue;
   this.states.delete(element);
   for(const dispose of state.dispose)dispose();
   for(const animation of state.animations){animation.onfinish=null;animation.cancel();}
   state.animations.clear();
  }
 }

 private play(state:MotionState,element:HTMLElement,keyframes:Keyframe[],duration:number,finish=false){
  const animation=element.animate(keyframes,{duration,easing:'cubic-bezier(.22, .61, .36, 1)'});
  state.animations.add(animation);
  animation.onfinish=()=>{state.animations.delete(animation);if(finish)this.cancel(state.root);};
 }
}
