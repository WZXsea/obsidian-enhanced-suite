import {App, Modal, setIcon} from 'obsidian';
import {ImageGestures,attachImageGestures} from './gestures';
import {rotatedImageBounds} from './mobile-images';
export interface DisplayImage {src:string; alt:string}
export class ImageViewer extends Modal {
 private index:number; private rotation=0; private gestures=new ImageGestures(); private disposeGestures?:()=>void;
 private image!:HTMLImageElement; private stage!:HTMLElement; private label!:HTMLElement;private error!:HTMLElement;
 private previous!:HTMLButtonElement;private next!:HTMLButtonElement;private observer?:ResizeObserver;
 constructor(app:App,private images:DisplayImage[],index:number){super(app);this.index=Math.max(0,Math.min(images.length-1,Number.isFinite(index)?Math.trunc(index):0));}
 onOpen(){
  this.modalEl.addClass('nis-viewer'); this.titleEl.setText('图片预览');
  const toolbar=this.contentEl.createDiv('nis-viewer-toolbar');toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','图片查看工具');
  const button=(icon:string,title:string,action:()=>void)=>{const b=toolbar.createEl('button',{attr:{type:'button','aria-label':title,title}});setIcon(b,icon);b.addEventListener('click',action);return b;};
  this.previous=button('chevron-left','上一张',()=>this.change(-1));this.next=button('chevron-right','下一张',()=>this.change(1));
  button('zoom-in','放大',()=>this.zoom(1.25));button('zoom-out','缩小',()=>this.zoom(.8));
  button('maximize','适应窗口',()=>this.reset());button('rotate-cw','旋转',()=>{this.rotation=(this.rotation+90)%360;this.transform();});button('x','关闭图片预览',()=>this.close());
  this.label=toolbar.createSpan('nis-viewer-count');this.label.setAttribute('aria-live','polite');
  this.stage=this.contentEl.createDiv('nis-viewer-stage');this.image=this.stage.createEl('img',{attr:{draggable:'false',decoding:'async'}});
  this.error=this.stage.createDiv({cls:'nis-viewer-error',text:'图片加载失败，可切换其他图片'});this.error.setAttribute('role','status');this.error.hidden=true;
  this.image.addEventListener('error',()=>{this.image.hidden=true;this.error.hidden=false;});
  this.image.addEventListener('load',()=>{this.image.hidden=false;this.error.hidden=true;this.transform();});
  this.stage.setAttribute('aria-label','双指缩放，单指平移，双击恢复');
  this.stage.addEventListener('wheel',e=>{e.preventDefault();if(e.deltaY)this.zoom(e.deltaY<0?1.12:1/1.12);},{passive:false});
  this.stage.addEventListener('dblclick',()=>this.reset());
  this.disposeGestures=attachImageGestures(this.stage,this.gestures,()=>this.transform());
  const Observer=this.stage.ownerDocument.defaultView?.ResizeObserver;
  if(Observer){this.observer=new Observer(()=>this.transform());this.observer.observe(this.stage);}
  this.scope.register([], 'ArrowLeft',()=>{this.change(-1);return false;});this.scope.register([], 'ArrowRight',()=>{this.change(1);return false;});
  this.scope.register([], '+',()=>{this.zoom(1.25);return false;});this.scope.register([], '-',()=>{this.zoom(.8);return false;});this.show();
 }
 private change(delta:number){if(this.images.length<2)return;this.index=(this.index+delta+this.images.length)%this.images.length;this.show();}
 private show(){
  const item=this.images[this.index];this.previous.disabled=this.next.disabled=this.images.length<2;
  this.label.setText(item?`${this.index+1} / ${this.images.length}`:'0 / 0');this.error.hidden=true;this.image.hidden=!item;
  if(item){this.image.src=item.src;this.image.alt=item.alt;}
  this.reset();
 }
 private zoom(factor:number){this.gestures.zoom(factor);this.transform();}
 private reset(){this.gestures.reset();this.rotation=0;this.transform();}
 private transform(){
  const rect=this.stage.getBoundingClientRect(),bounds=rotatedImageBounds(rect.width,rect.height,this.rotation);
  this.image.style.maxWidth=`${bounds.width}px`;this.image.style.maxHeight=`${bounds.height}px`;
  this.image.style.transform=`translate(${this.gestures.x}px,${this.gestures.y}px) rotate(${this.rotation}deg) scale(${this.gestures.scale})`;
 }
 onClose(){this.observer?.disconnect();this.observer=undefined;this.disposeGestures?.();this.disposeGestures=undefined;this.contentEl.empty();}
}
