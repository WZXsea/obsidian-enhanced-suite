import {Notice,requestUrl,setIcon} from 'obsidian';
import {CropImageGeometry,CropPoint,cropFromScreen,cropOutputSize,drawImageCrop,screenPointToImage} from './crop-geometry';
import {PreviewMotion} from './preview-motion';

/** Read the rendered matrix: refresh can reset CSS independently of upstream flags. */
export function previewImageGeometry(image:HTMLImageElement):CropImageGeometry {
 const win=image.ownerDocument.defaultView!;
 const style=win.getComputedStyle(image),rect=image.getBoundingClientRect();
 const matrix=new (win as Window & typeof globalThis).DOMMatrixReadOnly(style.transform==='none'?undefined:style.transform);
 const width=parseFloat(style.width),height=parseFloat(style.height);
 return {naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,
  left:rect.left+rect.width/2-width/2,top:rect.top+rect.height/2-height/2,width,height,
  rotation:Math.atan2(matrix.b,matrix.a)*180/Math.PI,flipY:matrix.a*matrix.d-matrix.b*matrix.c<0};
}

export class DesktopPreviewTools {
 private readonly motion=new PreviewMotion();
 private readonly button:HTMLElement;
 private overlay:HTMLElement|null=null;
 private selection:HTMLElement|null=null;
 private label:HTMLElement|null=null;
 private start:CropPoint|null=null;
 private end:CropPoint|null=null;
 private geometry:CropImageGeometry|null=null;
 private image:HTMLImageElement|null=null;
 private pointer:number|null=null;
 private copying=false;
 private sequence=0;
 private suppressEscape=false;
 private cleanupSelection:(()=>void)|null=null;
 private readonly releaseEscape=(event:KeyboardEvent)=>{
  if(this.suppressEscape&&event.key==='Escape'){this.suppressEscape=false;event.preventDefault();event.stopImmediatePropagation();}
 };
 private readonly exitForToolbar=(event:Event)=>{
  const target=event.target as Element|null;
  if(this.overlay&&target?.closest('.oit-img-footer')&&!target.closest('.toolbar_crop'))this.cancelSelection();
 };
 constructor(private readonly root:HTMLElement,private readonly activeImage:()=>HTMLImageElement|null,private readonly beforeSelection:()=>void){
  const doc=root.ownerDocument;
  this.button=doc.createElement('li');
  this.button.className='toolbar_crop';
  this.button.setAttribute('role','button');this.button.tabIndex=0;
  this.button.setAttribute('title','框选复制：拖动选区，松开后按原图像素复制；Esc 退出');
  this.button.setAttribute('aria-label','框选并复制原像素图片');this.button.setAttribute('aria-pressed','false');
  setIcon(this.button,'scan');
  const toggle=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();if(this.overlay)this.cancelSelection();else this.beginSelection();};
  this.button.addEventListener('click',toggle);
  this.button.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){toggle(event);}});
  root.querySelector('.oit-img-toolbar')?.appendChild(this.button);
  root.addEventListener('click',this.exitForToolbar,true);
  doc.addEventListener('keyup',this.releaseEscape,true);
 }
 open(origin:HTMLImageElement){this.cancelSelection();this.motion.start(origin,this.root);}
 reveal(image:HTMLImageElement){this.cancelSelection();this.motion.reveal(image);}
 close(){this.cancelSelection();this.motion.cancel(this.root);}
 destroy(){this.close();this.button.remove();this.root.removeEventListener('click',this.exitForToolbar,true);this.root.ownerDocument.removeEventListener('keyup',this.releaseEscape,true);}
 private cancelSelection(){
  this.sequence++;this.cleanupSelection?.();this.cleanupSelection=null;
  this.overlay?.remove();this.overlay=this.selection=this.label=null;
  this.start=this.end=this.geometry=this.image=null;this.pointer=null;this.copying=false;
  this.button.setAttribute('aria-pressed','false');this.root.classList.remove('oit-crop-active');
 }
 private beginSelection(){
  const image=this.activeImage();
  if(!image?.complete||!image.naturalWidth){new Notice('图片加载完成后即可框选复制');return;}
  this.motion.cancel(this.root);
  this.beforeSelection();
  this.image=image;this.geometry=previewImageGeometry(image);
  const doc=this.root.ownerDocument,win=doc.defaultView!;
  const overlay=this.overlay=doc.createElement('div');overlay.className='oit-crop-overlay';
  overlay.setAttribute('role','region');overlay.setAttribute('aria-label','拖动框选图片区域，松开鼠标复制，Esc 退出');
  this.selection=doc.createElement('div');this.selection.className='oit-crop-selection';this.selection.hidden=true;
  this.label=doc.createElement('div');this.label.className='oit-crop-label';
  this.label.textContent='拖动框选 · 松开复制原图像素 · Esc 退出';this.label.setAttribute('aria-live','polite');
  overlay.append(this.selection,this.label);this.root.appendChild(overlay);
  this.root.classList.add('oit-crop-active');this.button.setAttribute('aria-pressed','true');
  const stop=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();};
  const point=(event:PointerEvent)=>({x:event.clientX,y:event.clientY});
  overlay.addEventListener('click',stop);
  overlay.addEventListener('wheel',stop,{passive:false});
  overlay.addEventListener('contextmenu',stop);
  overlay.addEventListener('pointerdown',event=>{
   stop(event);if(event.button!==0||this.copying||this.pointer!==null)return;
   this.geometry=previewImageGeometry(image);
   const p=point(event),local=screenPointToImage(p,this.geometry!);
   if(local.x<0||local.y<0||local.x>image.naturalWidth||local.y>image.naturalHeight)return;
   this.start=this.end=p;this.pointer=event.pointerId;overlay.setPointerCapture(event.pointerId);
  });
  overlay.addEventListener('pointermove',event=>{stop(event);if(this.pointer===event.pointerId&&!this.copying){this.end=point(event);this.renderSelection();}});
  overlay.addEventListener('pointerup',event=>{
   stop(event);if(this.pointer!==event.pointerId||this.copying)return;
   this.end=point(event);this.renderSelection();this.pointer=null;
   if(overlay.hasPointerCapture(event.pointerId))overlay.releasePointerCapture(event.pointerId);
   if(this.start&&Math.abs(this.end.x-this.start.x)>=2&&Math.abs(this.end.y-this.start.y)>=2)void this.copySelection();
  });
  overlay.addEventListener('pointercancel',()=>this.cancelSelection());
  overlay.addEventListener('lostpointercapture',()=>{if(this.pointer!==null)this.cancelSelection();});
  const key=(event:KeyboardEvent)=>{
   stop(event);
   if(event.key==='Escape'){this.suppressEscape=true;this.cancelSelection();}
  };
  const keyup=(event:KeyboardEvent)=>stop(event);
  const cancel=()=>this.cancelSelection();
  doc.addEventListener('keydown',key,true);doc.addEventListener('keyup',keyup,true);
  win.addEventListener('blur',cancel);win.addEventListener('resize',cancel);
  this.cleanupSelection=()=>{doc.removeEventListener('keydown',key,true);doc.removeEventListener('keyup',keyup,true);win.removeEventListener('blur',cancel);win.removeEventListener('resize',cancel);};
 }
 private renderSelection(){
  if(!this.start||!this.end||!this.geometry||!this.selection||!this.label||!this.image)return;
  const rect=this.image.getBoundingClientRect();
  const x=Math.max(rect.left,Math.min(this.start.x,this.end.x)),y=Math.max(rect.top,Math.min(this.start.y,this.end.y));
  const right=Math.min(rect.right,Math.max(this.start.x,this.end.x)),bottom=Math.min(rect.bottom,Math.max(this.start.y,this.end.y));
  this.selection.hidden=false;Object.assign(this.selection.style,{left:`${x}px`,top:`${y}px`,width:`${Math.max(0,right-x)}px`,height:`${Math.max(0,bottom-y)}px`});
  const region=cropFromScreen(this.start,this.end,this.geometry);
  if(region){const size=cropOutputSize(region,this.geometry);this.label.textContent=`${size.width} × ${size.height} px · 松开复制 · Esc 退出`;}
 }
 private async copySelection(){
  if(!this.start||!this.end||!this.geometry||!this.image)return;
  const geometry=this.geometry,region=cropFromScreen(this.start,this.end,geometry);
  if(!region)return;
  const sequence=this.sequence,src=this.image.currentSrc||this.image.src;
  const doc=this.root.ownerDocument,win=doc.defaultView as Window & typeof globalThis;
  this.copying=true;this.overlay?.classList.add('is-copying');if(this.label)this.label.textContent='正在复制原像素选区…';
  let objectUrl:string|undefined;
  try {
   let source=src;
   // Obsidian reads remote bytes without canvas CORS restrictions.
   if(/^https?:\/\//i.test(src)){
    const response=await requestUrl(src);
    objectUrl=win.URL.createObjectURL(new Blob([response.arrayBuffer],{type:response.headers['content-type']||'application/octet-stream'}));source=objectUrl;
   }
   const original=new win.Image();original.src=source;await original.decode();
   if(sequence!==this.sequence)return;
   const canvas=drawImageCrop(original,region,geometry,doc);
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG 编码失败')),'image/png'));
   if(sequence!==this.sequence)return;
   await win.navigator.clipboard.write([new win.ClipboardItem({'image/png':blob})]);
   if(sequence!==this.sequence)return;
   const {width,height}=cropOutputSize(region,geometry);this.cancelSelection();new Notice(`已复制原像素选区：${width} × ${height} px`);
  } catch(error){
   if(sequence!==this.sequence)return;
   this.cancelSelection();new Notice(`复制选区时遇到错误：${error instanceof Error?error.message:String(error)}`);
   console.error('Image Toolkit: crop copy',error);
  } finally {if(objectUrl)win.URL.revokeObjectURL(objectUrl);}
 }
}
