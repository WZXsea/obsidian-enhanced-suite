import type {ImageReference} from './images';
import {sameImageSource} from './mobile-images';
export interface ImageNavigationBridge {
 getSourceImageNavigationLine?:(source:string,offset:number)=>number|null;
 revealSourceImage?:(path:string,offset:number,container:HTMLElement)=>HTMLElement|null;
}
interface PreviewNavigationView {
 containerEl:HTMLElement;
 previewMode:{applyScroll:(line:number)=>void;renderer?:{getSectionInfo?:(node:HTMLElement)=>{lineStart:number;lineEnd:number}|null}};
}
export function imageOccurrenceTarget(root:HTMLElement,item:ImageReference,src:string,path?:string):HTMLElement|null {
 const images=Array.from(root.querySelectorAll<HTMLImageElement>('img')).filter(img=>!img.closest('.nis-stage,.ilg-host,.ilg-popover')&&sameImageSource(img.currentSrc||img.src,src));
 const exact=images.find(img=>Number(img.dataset.ilgSourceOffset)===item.offset&&(!path||!img.dataset.ilgSourcePath||img.dataset.ilgSourcePath===path));
 if(exact)return exact;
 // A single source section may contain repeated URLs. Exact source annotations win above.
 return null;
}
export function centerImageTarget(target:HTMLElement,scroller:HTMLElement):void {
 const box=target.getBoundingClientRect(),viewport=scroller.getBoundingClientRect();
 const top=scroller.scrollTop+(box.top+box.bottom)/2-(viewport.top+viewport.bottom)/2;
 scroller.scrollTo({top:Math.max(0,top),behavior:'auto'});
}
/** Public line scrolling mounts virtual preview sections; exact occurrence DOM alignment follows. */
export async function navigatePreviewImage(view:PreviewNavigationView,path:string,source:string,item:ImageReference,src:string,bridge?:ImageNavigationBridge,stillCurrent:()=>boolean=()=>true):Promise<boolean> {
 const line=bridge?.getSourceImageNavigationLine?.(source,item.offset)??item.line;
 view.previewMode.applyScroll(line);
 const root=view.containerEl,win=root.ownerDocument.defaultView;
 const wait=()=>new Promise<void>(resolve=>{if(win)win.setTimeout(resolve,40);else resolve();});
 for(let attempt=0;attempt<10;attempt++){
  if(!stillCurrent())return false;
  const scroller=root.querySelector<HTMLElement>('.markdown-preview-view');
  let target=bridge?.revealSourceImage?.(path,item.offset,root)??imageOccurrenceTarget(root,item,src,path);
  if(!target){
   const candidates=Array.from(root.querySelectorAll<HTMLImageElement>('img')).filter(img=>!img.closest('.nis-stage,.ilg-host,.ilg-popover')&&sameImageSource(img.currentSrc||img.src,src));
   const matching=candidates.filter(img=>{try{const info=view.previewMode.renderer?.getSectionInfo?.(img);return info&&info.lineStart<=item.line&&info.lineEnd>=item.line;}catch{return false;}});
   if(matching.length===1)target=matching[0];
  }
  if(target?.isConnected&&scroller){
   const box=target.getBoundingClientRect();
   if(box.width>0&&box.height>0){centerImageTarget(target,scroller);return true;}
  }
  if(attempt<9)await wait();
 }
 // applyScroll already preserved native line positioning when an image remains unloaded.
 return false;
}
