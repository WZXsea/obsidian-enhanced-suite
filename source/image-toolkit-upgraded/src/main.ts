import {MarkdownView,Menu,Notice,Platform,Plugin,TFile,debounce} from 'obsidian';
import {extractImages,ImageReference} from './images';
import {ImageViewer,DisplayImage} from './viewer';
import {pickImageAtLine,pickVisibleImage} from './follow';
import {mobileDomImages,pickMobileImageIndex,sameImageSource} from './mobile-images';
import {attachMobileStageDismiss} from './mobile-stage';
import {navigatePreviewImage,ImageNavigationBridge} from './image-navigation';
import {appendPixelFlower} from './pixel-flower';
import {StageRegistry,isStageRootMounted,canReuseStageRender,pickStageSource,PaneTimers} from './stage-lifecycle';
import {DesktopPreviewTools} from './desktop-preview';
interface DesktopPreviewContainer {
 imgInfo:{oitContainerEl:HTMLElement|null};
 imgGlobalStatus:{dragging:boolean;arrowUp:boolean;arrowDown:boolean;arrowLeft:boolean;arrowRight:boolean};
 getActiveImg:()=>{imgViewEl:HTMLImageElement}|null;
}
interface ImageItem extends ImageReference,DisplayImage { local:TFile|null }
type StageMode='always'|'hover'|'off';
interface ToolkitContainer {
 renderContainer:(img:HTMLImageElement)=>void;
 getLastClickedImgEl?:()=>HTMLImageElement|null;
 getActiveImg?:()=>{popup?:boolean}|null;
 removeGalleryNavbar?:()=>void;
 renderGalleryNavbar?:()=>void;
}
interface ToolkitHost {settings:{noteImageStageMode?:StageMode;noteImageStageWidth?:number};saveSettings:()=>Promise<void>;containerFactory?:{getContainer:(img:HTMLImageElement)=>ToolkitContainer|null};ensureImageContainer?:(img:HTMLImageElement)=>ToolkitContainer|null}
interface ImageLayoutContext {images:DisplayImage[];index:number;origin:HTMLImageElement;sourcePath:string}
export default class NoteImageStage extends Plugin {
 host!:ToolkitHost;
 source:MarkdownView|null=null;
 galleryImages:DisplayImage[]=[];
 readonly imageLayoutBridgeVersion=1;
 galleryContext:ImageLayoutContext|null=null;
 private mobileViewer:ImageViewer|null=null;
 private mobileOpenSequence=0;
 private readonly desktopPreviews=new Map<DesktopPreviewContainer,DesktopPreviewTools>();
 prepareDesktopPreview(container:DesktopPreviewContainer,origin:HTMLImageElement){
  const root=container.imgInfo.oitContainerEl;if(!root?.classList.contains('oit-normal'))return;
  let tools=this.desktopPreviews.get(container);
  if(!tools){tools=new DesktopPreviewTools(root,()=>container.getActiveImg()?.imgViewEl??null,()=>{
   const status=container.imgGlobalStatus;status.dragging=status.arrowUp=status.arrowDown=status.arrowLeft=status.arrowRight=false;
   const image=container.getActiveImg()?.imgViewEl;if(image)image.onmousemove=null;
  });this.desktopPreviews.set(container,tools);}
  tools.open(origin);
 }
 revealDesktopPreview(container:DesktopPreviewContainer,image:HTMLImageElement){this.desktopPreviews.get(container)?.reveal(image);}
 clearDesktopPreview(container:DesktopPreviewContainer,remove=false){
  const tools=this.desktopPreviews.get(container);if(remove){tools?.destroy();this.desktopPreviews.delete(container);}else tools?.close();
 }
 private showMobileViewer(images:DisplayImage[],index:number){
  this.mobileOpenSequence++;
  this.mobileViewer?.close();
  const viewer=this.mobileViewer=new ImageViewer(this.app,images,index);
  const close=viewer.onClose.bind(viewer);
  viewer.onClose=()=>{close();if(this.mobileViewer===viewer){this.mobileViewer=null;this.galleryContext=null;}};
  viewer.open();
 }
 openMobileImage(event:MouseEvent):boolean {
  if(!Platform.isMobile)return false;
  const img=event.target as HTMLImageElement;
  if(img?.tagName!=='IMG'||img.closest('.nis-viewer,.ilg-viewer,.ilg-image-controls,.ilg-popover'))return false;
  event.preventDefault();event.stopPropagation();
  const source=this.app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).find((view):view is MarkdownView=>view instanceof MarkdownView&&view.containerEl.contains(img));
  const sequence=++this.mobileOpenSequence;
  void this.openMobileSourceImage(img,source,sequence);
  return true;
 }
 private async openMobileSourceImage(img:HTMLImageElement,source:MarkdownView|undefined,sequence:number){
  const fallback=()=>{
   const nodes=img.parentElement?mobileDomImages(source?.containerEl??img.parentElement,img):[img];
   this.showMobileViewer(nodes.map(item=>({src:item.src,alt:item.alt})),Math.max(0,nodes.indexOf(img)));
  };
  try {
   const file=source?.file;
   if(!source||!file){fallback();return;}
   const text=source.getMode()==='source'?source.editor.getValue():await this.app.vault.cachedRead(file);
   if(sequence!==this.mobileOpenSequence||!img.isConnected||source.file!==file)return;
   const images=extractImages(text).map(ref=>{
    let target=ref.target,src='';
    if(/^https?:\/\//i.test(target)||/^data:image\//i.test(target))src=target;
    else {
     try{target=decodeURIComponent(target);}catch{}
     target=target.replace(/\\([ ()\[\]])/g,'$1');
     const local=this.app.metadataCache.getFirstLinkpathDest(target.split('#')[0],file.path);
     if(local)src=this.app.vault.getResourcePath(local);
    }
    return {src,alt:ref.alt.replace(/\|\d+(?:x\d+)?$/,''),line:ref.line};
   }).filter(item=>item.src);
   let line:number|undefined;
   if(source.getMode()==='source'){
    const cm=(source.editor as unknown as {cm?:{posAtDOM:(node:Node)=>number;state:{doc:{lineAt:(pos:number)=>{number:number}}}}}).cm;
    try{if(cm)line=cm.state.doc.lineAt(cm.posAtDOM(img)).number-1;}catch{}
   } else {
    const renderer=(source as unknown as {previewMode?:{renderer?:{getSectionInfo?:(node:HTMLElement)=>{lineStart:number}|null}}}).previewMode?.renderer;
    try{line=renderer?.getSectionInfo?.(img)?.lineStart;}catch{}
   }
   const nodes=mobileDomImages(source.containerEl,img);
   const ordinal=nodes.slice(0,nodes.indexOf(img)).filter(item=>sameImageSource(item.src,img.src)).length;
   const index=pickMobileImageIndex(images,img.src,line,ordinal);
   if(index>=0)this.showMobileViewer(images,index);else fallback();
  } catch(error){
   console.warn('Image Toolkit: mobile source image resolution',error);
   if(sequence===this.mobileOpenSequence&&img.isConnected)fallback();
  }
 }
 openGallery(images:DisplayImage[],index:number,origin:HTMLImageElement,sourcePath:string):boolean {
  if(!origin.isConnected||!images.length||!Number.isInteger(index)||index<0||index>=images.length)return false;
  const source=this.app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).find(view=>view instanceof MarkdownView&&view.file?.path===sourcePath&&view.containerEl.contains(origin));
  if(!source)return false;
  if(Platform.isMobile){
   const context={images:images.map(({src,alt})=>({src,alt})),index,origin,sourcePath};
   this.showMobileViewer(context.images,index);this.galleryContext=context;return true;
  }
  const container=this.host.ensureImageContainer?.(origin)??this.host.containerFactory?.getContainer(origin);
  if(typeof container?.renderContainer!=='function'||typeof container.getLastClickedImgEl!=='function'||typeof container.getActiveImg!=='function')return false;
  this.galleryContext={images:images.map(({src,alt})=>({src,alt})),index,origin,sourcePath};
  try {
   container.renderContainer(origin);
   if(container.getLastClickedImgEl()!==origin||!container.getActiveImg()?.popup){this.galleryContext=null;return false;}
   container.removeGalleryNavbar?.();container.renderGalleryNavbar?.();
   return true;
  } catch(error){this.galleryContext=null;throw error;}
 }
 private stage:ImageStage|null=null;
 private readonly viewActions=new Map<MarkdownView,HTMLElement>();
 private jumpSequence=0;
 private readonly stages=new StageRegistry<MarkdownView,ImageStage>(source=>new ImageStage(this,source));
 refresh=debounce(()=>this.refreshStages(),200,true);
 private visibleSources(){return this.app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).filter((view):view is MarkdownView=>{
  if(!(view instanceof MarkdownView)||!view.file||!view.containerEl.isConnected)return false;
  const rect=view.containerEl.getBoundingClientRect();return rect.width>0&&rect.height>0;
 });}
 private refreshStages(){
  const sources=this.visibleSources();
  if(Platform.isMobile){
   for(const [view,action] of this.viewActions)if(!sources.includes(view)){action.remove();this.viewActions.delete(view);}
   for(const view of sources)if(!this.viewActions.has(view)){
    const action=view.addAction('images','图片',()=>{this.source=view;void this.open(view);});action.addClass('nis-images-action');this.viewActions.set(view,action);
   }
  }
  if(this.getMode()==='off'){this.stages.close();this.stage=null;this.galleryImages=[];return;}
  this.source=this.findSource(sources);
  const stages=this.stages.reconcile(sources);this.stage=this.source?stages.get(this.source)??null:null;
  if(!this.source)this.galleryImages=[];
  for(const stage of stages.values())void stage.refresh().catch(error=>console.warn('Note Image Stage: refresh',error));
 }
 recoverStage(source:MarkdownView){if(this.stages.get(source)&&this.visibleSources().includes(source))this.refreshStages();}
 async onload(){
  this.addRibbonIcon('images','文章图片台前导航',()=>void this.open());
  this.addCommand({id:'open',name:'打开文章图片台前导航',callback:()=>void this.open()});
  this.addCommand({id:'hide-image-stage',name:'关闭文章图片台前导航',callback:()=>void this.setMode('off')});
  // Structural changes recover mounted controls immediately, outside the content debounce.
  this.registerEvent(this.app.workspace.on('file-menu',(menu,file,_source,leaf)=>{if(Platform.isMobile&&leaf?.view instanceof MarkdownView&&leaf.view.file===file)menu.addItem(item=>item.setTitle('图片').setIcon('images').onClick(()=>{this.source=leaf.view as MarkdownView;void this.open(this.source);}));}));
  this.registerEvent(this.app.workspace.on('active-leaf-change',()=>this.refreshStages()));
  this.registerEvent(this.app.workspace.on('file-open',()=>this.refreshStages()));
  this.registerEvent(this.app.workspace.on('layout-change',()=>this.refreshStages()));
  this.registerEvent(this.app.workspace.on('editor-change',(_editor,info)=>{if(info instanceof MarkdownView&&this.stages.get(info))this.refresh();}));
  this.registerEvent(this.app.vault.on('modify',file=>{if(this.visibleSources().some(view=>view.file===file))this.refresh();}));
  this.registerEvent(this.app.metadataCache.on('changed',file=>{if(this.visibleSources().some(view=>view.file===file))this.refresh();}));
  this.registerEvent(this.app.vault.on('rename',()=>this.refresh()));
  this.registerEvent(this.app.vault.on('delete',()=>this.refresh()));
  this.app.workspace.onLayoutReady(()=>this.refreshStages());
 }
 onunload(){for(const tools of this.desktopPreviews.values())tools.destroy();this.desktopPreviews.clear();this.jumpSequence++;for(const action of this.viewActions.values())action.remove();this.viewActions.clear();this.mobileOpenSequence++;this.mobileViewer?.close();this.mobileViewer=null;this.galleryContext=null;this.refresh.cancel();this.stages.close();this.stage=null;this.galleryImages=[];}
 private findSource(sources=this.visibleSources()){const recent=this.app.workspace.getMostRecentLeaf()?.view;return pickStageSource(sources,this.app.workspace.getActiveViewOfType(MarkdownView),recent instanceof MarkdownView?recent:null,this.source);}
 async setMode(mode:StageMode){this.host.settings.noteImageStageMode=mode;await this.host.saveSettings();this.refreshStages();}
 async open(originView?:MarkdownView){if(originView)this.app.workspace.setActiveLeaf(originView.leaf,{focus:false});await this.setMode(this.host.settings.noteImageStageMode==='off'?'always':this.host.settings.noteImageStageMode??'always');if(Platform.isMobile){const target=originView??this.source;if(target)this.stages.get(target)?.reveal();}}
 getWidth(){const value=this.host.settings.noteImageStageWidth;return typeof value==='number'&&Number.isFinite(value)?Math.max(120,Math.min(320,Math.round(value))):180;}
 async setWidth(value:number){this.host.settings.noteImageStageWidth=Math.max(120,Math.min(320,Math.round(value)));for(const stage of this.stages.values())stage.setWidth(this.getWidth());await this.host.saveSettings();}
 getMode():StageMode{const mode=this.host.settings.noteImageStageMode??'always';return Platform.isMobile&&mode!=='off'?'hover':mode;}
 async jump(file:TFile,item:ImageReference,originView?:MarkdownView){
  const sequence=++this.jumpSequence;
  let view=originView??this.source;
  if(!view||view.file!==file){const leaf=this.app.workspace.getLeaf(false);await leaf.openFile(file);view=leaf.view instanceof MarkdownView?leaf.view:null;}
  if(!view)return;
  this.source=view;
  // Resolve the exact occurrence again after edits, retaining source-order duplicates.
  const text=view.getMode()==='source'?view.editor.getValue():await this.app.vault.cachedRead(file);
  if(sequence!==this.jumpSequence||view.file!==file)return;
  const refs=extractImages(text);const current=refs.find(r=>r.offset===item.offset&&r.raw===item.raw)??refs.filter(r=>r.raw===item.raw).sort((a,b)=>Math.abs(a.line-item.line)-Math.abs(b.line-item.line))[0];
  if(!current){new Notice('图片引用已更新，请刷新侧栏后定位');return;}
  this.app.workspace.setActiveLeaf(view.leaf,{focus:!Platform.isMobile});
  if(view.getMode()==='source'){
   const pos={line:current.line,ch:0};if(!Platform.isMobile)view.editor.setCursor(pos);view.editor.scrollIntoView({from:pos,to:pos},true);return;
  }
  const plugins=(this.app as unknown as {plugins?:{getPlugin:(id:string)=>ImageNavigationBridge|undefined}}).plugins;
  let target=current.target,src='';
  if(/^https?:\/\//i.test(target)||/^data:image\//i.test(target))src=target;
  else {try{target=decodeURIComponent(target);}catch{}const local=this.app.metadataCache.getFirstLinkpathDest(target.replace(/\\([ ()\[\]])/g,'$1').split('#')[0],file.path);if(local)src=this.app.vault.getResourcePath(local);}
  await navigatePreviewImage(view,file.path,text,current,src,plugins?.getPlugin('image-layouts-enhanced'),()=>sequence===this.jumpSequence&&view!.containerEl.isConnected&&view!.file===file&&view!.getMode()==='preview');

 }
 preview(items:ImageItem[],index:number,img?:HTMLImageElement,originView?:MarkdownView){
  if(originView)this.source=originView;
  this.galleryImages=items;
  if(Platform.isMobile){this.showMobileViewer(items,index);return;}
  // Optional, version-guarded adapter for the user's existing Image Toolkit.
  type Toolkit={containerFactory?:{getContainer:(img:HTMLImageElement)=>{renderContainer?:(img:HTMLImageElement)=>void}|null}};
  const plugins=(this.app as unknown as {plugins:{getPlugin:(id:string)=>Toolkit|undefined}}).plugins;
  const toolkit=plugins?.getPlugin('obsidian-image-toolkit');
  if(img&&this.source?.file){
   try{if(this.openGallery(items,index,img,this.source.file.path))return;}catch(error){console.warn('Note Image Stage: preview bridge fallback',error);}
  }
  if(img&&this.source?.file&&toolkit?.containerFactory){
   try{this.app.workspace.setActiveLeaf(this.source.leaf,{focus:false});const container=this.host.ensureImageContainer?.(img)??toolkit.containerFactory.getContainer(img);if(typeof container?.renderContainer==='function'){container.renderContainer(img);return;}}catch(error){console.warn('Note Image Sidebar: preview adapter fallback',error);}
  }
  new ImageViewer(this.app,items,index).open();
 }
}
class ImageStage {
 private revealRequested=false;
 private sequence=0;private signature='';private root:HTMLElement|null=null;private renderedEmpty=false;private available:ImageItem[]=[];private cancelResize:(()=>void)|null=null;private hoverTimers:PaneTimers|null=null;private disposeInteraction:(()=>void)|null=null;
 constructor(private plugin:NoteImageStage,private readonly source:MarkdownView){}
 reveal(){this.revealRequested=true;this.root?.addClass('is-revealed');}
 close(){this.sequence++;this.disposeInteraction?.();this.disposeInteraction=null;this.clearRevealTimer();this.hoverTimers=null;this.cancelResize?.();this.cancelResize=null;this.root?.remove();this.root=null;this.renderedEmpty=false;this.available=[];if(this.source.containerEl.hasClass('nis-stage-host'))this.source.containerEl.removeClass('nis-stage-host');this.signature='';}
 private clearRevealTimer(){this.hoverTimers?.clear();}
 setWidth(width:number){this.root?.style.setProperty('--nis-stage-width',`${width}px`);const handle=this.root?.querySelector('.nis-stage-resize');handle?.setAttribute('aria-valuenow',String(width));}
 async refresh(){
  const source=this.source;const file=source.file;
  if(!file||!source.containerEl.isConnected||this.plugin.app.vault.getAbstractFileByPath(file.path)!==file){this.close();return;}
  const seq=++this.sequence;
  const text=source.getMode()==='source'?source.editor.getValue():await this.plugin.app.vault.cachedRead(file);
  if(seq!==this.sequence||source.file!==file||!source.containerEl.isConnected)return;
  const sig=file.path+'\n'+text+'\n'+this.plugin.getMode();if(sig===this.signature&&canReuseStageRender(this.root,source.containerEl,this.renderedEmpty)){if(this.plugin.source===source)this.plugin.galleryImages=this.available;return;}this.signature=sig;
  const items:ImageItem[]=extractImages(text).map(ref=>{
   let target=ref.target;let local:TFile|null=null;let src='';
   if(/^https?:\/\//i.test(target)||/^data:image\//i.test(target))src=target;
   else {try{target=decodeURIComponent(target);}catch{}target=target.replace(/\\([ ()\[\]])/g,'$1');local=this.plugin.app.metadataCache.getFirstLinkpathDest(target.split('#')[0],file.path);if(local)src=this.plugin.app.vault.getResourcePath(local);}
   return {...ref,alt:ref.alt.replace(/\|\d+(?:x\d+)?$/,''),src,local};
  });
  const available=this.available=items.filter(i=>i.src);
  this.renderedEmpty=!items.length;
  if(this.plugin.source===source)this.plugin.galleryImages=available;
  this.disposeInteraction?.();this.disposeInteraction=null;this.clearRevealTimer();this.cancelResize?.();this.cancelResize=null;this.root?.remove();if(!items.length){this.root=null;if(source.containerEl.hasClass('nis-stage-host'))source.containerEl.removeClass('nis-stage-host');return;}
  source.containerEl.addClass('nis-stage-host');
  const root=this.root=source.containerEl.createDiv({cls:'nis-stage',attr:{'data-mode':this.plugin.getMode(),'aria-label':'文章图片台前导航'}});
  if(this.revealRequested)root.addClass('is-revealed');
  root.style.setProperty('--nis-stage-width',`${this.plugin.getWidth()}px`);
  const doc=root.ownerDocument,win=doc.defaultView!;
  this.hoverTimers=new PaneTimers(win);
  const mobile=Platform.isMobile;
  const reveal=()=>{this.revealRequested=true;this.clearRevealTimer();root.addClass('is-revealed');};
  const dismiss=()=>{
   this.revealRequested=false;this.clearRevealTimer();this.cancelResize?.();root.removeClass('is-expanded','is-revealed','is-resizing');
   const active=doc.activeElement;if(active instanceof win.HTMLElement&&root.contains(active))active.blur();
  };
  const scheduleDismiss=()=>{
   if(mobile)return;
   if(this.hoverTimers?.has('dismiss')||root.hasClass('is-resizing')||!root.hasClass('is-revealed'))return;
   this.hoverTimers?.schedule('dismiss',dismiss,180);
  };
  root.addEventListener('pointerenter',()=>{if(root.hasClass('is-revealed'))this.clearRevealTimer();});
  root.addEventListener('pointerleave',scheduleDismiss);
  root.addEventListener('focusin',event=>{if((event.target as HTMLElement).matches(':focus-visible'))reveal();});
  root.addEventListener('focusout',event=>{if(!event.relatedTarget||!root.contains(event.relatedTarget as Node))scheduleDismiss();});
  const hotzone=root.createDiv({cls:'nis-stage-hotzone',attr:{tabindex:'0',role:'button','aria-label':'显示文章图片导航'}});
  hotzone.addEventListener('pointerenter',()=>{if(mobile)return;this.clearRevealTimer();this.hoverTimers?.schedule('edge',reveal,120);});
  hotzone.addEventListener('pointerleave',()=>this.hoverTimers?.cancel('edge'));
  hotzone.addEventListener('click',reveal);
  hotzone.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();reveal();}});
  const outsideDown=(event:PointerEvent)=>{
   if(mobile)return;
   const target=event.target as Element;
   const control=target.closest?.('.nis-stage-card,.nis-stage-resize,.nis-stage-hotzone');
   if(!control||!root.contains(control))dismiss();
  };
  const outsideMove=(event:PointerEvent)=>{
   if(mobile)return;
   const target=event.target as Element;
   if(target.closest?.('.collapse-indicator,.cm-fold-indicator,.cm-gutterElement,.heading-collapse-indicator')){dismiss();return;}
   if(!root.hasClass('is-revealed')||root.hasClass('is-resizing'))return;
   const r=root.getBoundingClientRect();
   if(event.clientX<r.left-10||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)scheduleDismiss();
  };
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')dismiss();};
  const visibility=()=>{if(!mobile&&doc.hidden)dismiss();};
  const transientLayout=()=>{if(!mobile)dismiss();};
  const disposeMobileDismiss=mobile?attachMobileStageDismiss(root,dismiss):()=>{};
  doc.addEventListener('pointerdown',outsideDown,true);
  doc.addEventListener('pointermove',outsideMove,true);
  doc.addEventListener('keydown',escape,true);
  doc.addEventListener('visibilitychange',visibility);
  win.addEventListener('blur',transientLayout);
  win.addEventListener('resize',transientLayout);
  let paneRect=source.containerEl.getBoundingClientRect();
  let paneFrame=0;
  const paneObserver=new win.ResizeObserver(()=>{
   const next=source.containerEl.getBoundingClientRect();
   if((Math.abs(next.width-paneRect.width)>1||Math.abs(next.height-paneRect.height)>1)&&!paneFrame){
    paneFrame=win.requestAnimationFrame(()=>{paneFrame=0;if(this.root===root&&!mobile)dismiss();});
   }
   paneRect=next;
  });
  paneObserver.observe(source.containerEl);
  this.disposeInteraction=()=>{
   disposeMobileDismiss();paneObserver.disconnect();
   if(paneFrame){win.cancelAnimationFrame(paneFrame);paneFrame=0;}
   doc.removeEventListener('pointerdown',outsideDown,true);doc.removeEventListener('pointermove',outsideMove,true);
   doc.removeEventListener('keydown',escape,true);doc.removeEventListener('visibilitychange',visibility);
   win.removeEventListener('blur',transientLayout);win.removeEventListener('resize',transientLayout);
  };
  const handle=root.createDiv({cls:'nis-stage-resize',attr:{role:'slider',tabindex:'0','aria-label':'调整图片导航宽度','aria-valuemin':'120','aria-valuemax':'320','aria-valuenow':String(this.plugin.getWidth()),'aria-orientation':'horizontal',title:'左右拖动调整大小'}});
  let drag:{id:number;x:number;width:number;current:number}|null=null;
  this.cancelResize=()=>{if(!drag)return;const {id,width}=drag;drag=null;this.setWidth(width);root.removeClass('is-resizing');if(handle.hasPointerCapture(id))handle.releasePointerCapture(id);};
  handle.addEventListener('pointerdown',event=>{
   if(event.button!==0)return;event.preventDefault();event.stopPropagation();
   drag={id:event.pointerId,x:event.clientX,width:this.plugin.getWidth(),current:this.plugin.getWidth()};
   root.addClass('is-resizing');handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove',event=>{
   if(!drag||event.pointerId!==drag.id)return;
   drag.current=Math.max(120,Math.min(320,Math.round(drag.width+event.clientX-drag.x)));
   this.setWidth(drag.current);
  });
  const finish=(event:PointerEvent,cancel:boolean)=>{
   if(!drag||event.pointerId!==drag.id)return;
   const current=drag.current,initial=drag.width;drag=null;root.removeClass('is-resizing');
   if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
   if(cancel)this.setWidth(initial);else void this.plugin.setWidth(current);
  };
  handle.addEventListener('pointerup',event=>finish(event,false));
  handle.addEventListener('pointercancel',event=>finish(event,true));
  handle.addEventListener('lostpointercapture',()=>{if(drag){this.setWidth(drag.width);drag=null;root.removeClass('is-resizing');}});
  handle.addEventListener('keydown',event=>{
   const delta=event.key==='ArrowRight'?10:event.key==='ArrowLeft'?-10:0;
   if(delta||event.key==='Home'||event.key==='End'){
    event.preventDefault();event.stopPropagation();
    void this.plugin.setWidth(event.key==='Home'?120:event.key==='End'?320:this.plugin.getWidth()+delta);
   }
  });
  const header=root.createDiv('nis-stage-header');header.createSpan({text:'图片'});
  const close=header.createEl('button',{text:'×',attr:{type:'button','aria-label':'收起图片导航',title:'收起图片导航'}});close.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();dismiss();});
  const list=root.createDiv('nis-stage-list');
  const makeBookend=(kind:'start'|'end')=>{
   const space=list.createDiv({cls:`nis-stage-bookend nis-stage-bookend-${kind}`,attr:{'aria-hidden':'true'}});
   const design=space.createDiv('nis-stage-bookend-design');
   design.createSpan({cls:'nis-stage-bookend-mark',text:'· · ·'});
   design.createSpan({cls:'nis-stage-bookend-title',text:kind==='start'?'从这里，读见更多':'读到这里，渐见全貌'});
   appendPixelFlower(design);
   return space;
  };
  const startSpace=makeBookend('start');
  let endSpace:HTMLElement|null=null;
  const updateSpaces=()=>{
   const height=`${Math.max(0,list.clientHeight/2)}px`;
   if(startSpace.style.height!==height)startSpace.style.height=height;
   if(endSpace&&endSpace.style.height!==height)endSpace.style.height=height;
  };
  let followTimer:number|null=null,manualUntil=0,resumeTimer:number|null=null;
  const follow=()=>{
   followTimer=null;if(this.root!==root)return;
   updateSpaces();
   type CM={posAtDOM?:(node:Node,offset:number)=>number;posAtCoords?:(coords:{x:number;y:number})=>number|null;state?:{doc:{lineAt:(pos:number)=>{number:number}}};viewport?:{from:number};scrollDOM?:HTMLElement};
   const cm=(source.editor as unknown as {cm?:CM}).cm;
   let line:number|undefined;
   if(source.getMode()==='source'&&cm?.state){
    const scroller=cm.scrollDOM??source.containerEl.querySelector<HTMLElement>('.cm-scroller');
    if(scroller){const r=scroller.getBoundingClientRect();const pos=cm.posAtCoords?.({x:r.left+r.width*.5,y:r.top+Math.min(r.height*.3,180)})??cm.viewport?.from; if(typeof pos==='number')line=cm.state.doc.lineAt(pos).number-1;}
   }else{
    type Section={start:{line:number};end:{line:number};el:HTMLElement;shown?:boolean};
    const preview=(source as unknown as {previewMode?:{getScroll?:()=>number;renderer?:{sections?:Section[]}}}).previewMode;
    const viewport=source.containerEl.querySelector<HTMLElement>('.markdown-preview-view');
    if(viewport){const r=viewport.getBoundingClientRect(),anchor=r.top+Math.min(r.height*.3,180);
     const section=preview?.renderer?.sections?.find(s=>{if(!s.el.isConnected)return false;const box=s.el.getBoundingClientRect();return box.height>0&&box.top<=anchor&&box.bottom>=anchor;});
     if(section){const box=section.el.getBoundingClientRect();line=section.start.line+Math.max(0,Math.min(1,(anchor-box.top)/box.height))*(section.end.line-section.start.line);}
    }
    if(line===undefined){const scroll=preview?.getScroll?.();if(typeof scroll==='number')line=scroll;}
   }
   const body=source.getMode()==='source'?(cm?.scrollDOM??source.containerEl.querySelector<HTMLElement>('.cm-scroller')):source.containerEl.querySelector<HTMLElement>('.markdown-preview-view');
   const candidates:{index:number;top:number;bottom:number}[]=[];
   let visibleIndex=-1;
   if(body){const viewport=body.getBoundingClientRect();
    for(const img of Array.from(body.querySelectorAll<HTMLImageElement>('img'))){
     if(root.contains(img))continue;const box=img.getBoundingClientRect();
     if(box.width<8||box.height<1||box.bottom<=viewport.top||box.top>=viewport.bottom||box.right<=viewport.left||box.left>=viewport.right)continue;
     const matches=items.map((item,index)=>({item,index})).filter(({item})=>{if(!item.src)return false;try{return new URL(item.src,doc.baseURI).href===img.src;}catch{return item.src===img.src;}});
     if(!matches.length)continue;
     let imageLine=line;
     if(source.getMode()==='source'&&cm?.posAtDOM&&cm.state){try{imageLine=cm.state.doc.lineAt(cm.posAtDOM(img,0)).number-1;}catch{}}
     else{
      const renderer=(source as unknown as {previewMode?:{renderer?:{getSectionInfo?:(el:HTMLElement)=>{lineStart:number}|null}}}).previewMode?.renderer;
      try{imageLine=renderer?.getSectionInfo?.(img)?.lineStart??line;}catch{}
     }
     const match=matches.sort((a,b)=>Math.abs(a.item.line-(imageLine??a.item.line))-Math.abs(b.item.line-(imageLine??b.item.line)))[0];
     candidates.push({index:match.index,top:box.top,bottom:box.bottom});
    }
    visibleIndex=pickVisibleImage(candidates,{top:Math.max(0,viewport.top),bottom:Math.min(win.innerHeight,viewport.bottom)});
   }
   const index=visibleIndex>=0?visibleIndex:line===undefined?-1:pickImageAtLine(items.map(i=>i.line),line);if(index<0)return;
   const cards=list.querySelectorAll<HTMLElement>('.nis-stage-card');const card=cards[index];if(!card)return;
   cards.forEach((c,i)=>{c.toggleClass('is-current',i===index);if(i===index)c.setAttribute('aria-current','true');else c.removeAttribute('aria-current');});
   if(Date.now()<manualUntil||root.hasClass('is-resizing'))return;
   // Scroll only the thumbnail list, retaining the document's position.
   const image=card.querySelector('img'),c=(image??card).getBoundingClientRect(),r=list.getBoundingClientRect();
   const top=Math.max(0,list.scrollTop+(c.top+c.bottom)/2-(r.top+r.bottom)/2);
   if(Math.abs(top-list.scrollTop)>2){
    const reducedMotion=win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    list.scrollTo({top,behavior:reducedMotion||root.matches(':hover')||win.getComputedStyle(list).visibility==='hidden'?'auto':'smooth'});
   }
  };
  const queueFollow=()=>{if(followTimer!==null)return;followTimer=win.setTimeout(follow,80);};
  const pauseFollow=()=>{manualUntil=Date.now()+2500;if(resumeTimer!==null)win.clearTimeout(resumeTimer);resumeTimer=win.setTimeout(queueFollow,2500);};
  root.addEventListener('wheel',pauseFollow,{passive:true});root.addEventListener('pointerdown',pauseFollow);
  const contentScroll=(event:Event)=>{if(event.target instanceof win.Node&&root.contains(event.target))return;queueFollow();};
  source.containerEl.addEventListener('scroll',contentScroll,true);
  source.containerEl.addEventListener('load',contentScroll,true);
  source.containerEl.addEventListener('keyup',queueFollow);
  const observer=new win.MutationObserver(records=>{if(this.root===root&&!isStageRootMounted(root,source.containerEl)){this.plugin.recoverStage(source);return;}if(records.some(r=>!root.contains(r.target)))queueFollow();});
  observer.observe(source.containerEl,{childList:true,subtree:true});
  // Layout writes run in the existing follow timer, outside the observer delivery.
  const sizeObserver=new win.ResizeObserver(queueFollow);sizeObserver.observe(list);
  const disposePrevious=this.disposeInteraction;
  this.disposeInteraction=()=>{disposePrevious?.();observer.disconnect();sizeObserver.disconnect();source.containerEl.removeEventListener('scroll',contentScroll,true);source.containerEl.removeEventListener('load',contentScroll,true);source.containerEl.removeEventListener('keyup',queueFollow);if(followTimer!==null)win.clearTimeout(followTimer);if(resumeTimer!==null)win.clearTimeout(resumeTimer);};
  queueFollow();
  items.forEach((item,index)=>{
   const card=list.createDiv({cls:'nis-stage-card',attr:{'data-source-line':String(item.line),'data-source-index':String(index),'data-source-offset':String(item.offset)}});const button=card.createEl('button',{cls:'nis-image-button',attr:{'aria-label':`${mobile?'定位图片':'放大图片'} ${index+1}：${item.alt||item.target}`}});
   if(item.src){const img=button.createEl('img',{attr:{'data-nis-index':String(available.indexOf(item)),src:item.src,alt:item.alt,loading:'lazy',decoding:'async'}});img.addEventListener('load',queueFollow);sizeObserver.observe(img);img.addEventListener('error',()=>{img.hidden=true;button.createSpan({cls:'nis-error',text:'加载失败'});});}
   else button.createSpan({cls:'nis-error',text:'路径待解析'});
   const caption=card.createDiv('nis-caption');caption.createSpan({text:`${index+1}. ${(item.alt||item.local?.basename||'图片').replace(/\|\d+(?:x\d+)?$/,'')}`});
   button.addEventListener('click',event=>{event.stopPropagation();
    list.querySelectorAll('.is-selected').forEach(c=>c.removeClass('is-selected'));card.addClass('is-selected');
    if(mobile){void this.plugin.jump(file,item,source);return;}
    const selected=available.indexOf(item);if(selected>=0)this.plugin.preview(available,selected,button.querySelector('img')??undefined,source);
   });
   if(mobile){
    const zoom=caption.createEl('button',{text:'↗',cls:'nis-stage-zoom',attr:{type:'button','aria-label':`放大图片 ${index+1}`,title:'放大图片'}});
    zoom.disabled=!item.src;zoom.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const selected=available.indexOf(item);if(selected>=0)this.plugin.preview(available,selected,button.querySelector('img')??undefined,source);});
   }
   card.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();const menu=new Menu();menu.addItem(m=>m.setTitle('跳转到图片位置').setIcon('locate').onClick(()=>void this.plugin.jump(file,item,source)));menu.addItem(m=>m.setTitle('放大显示').setIcon('zoom-in').setDisabled(!item.src).onClick(()=>{const available=items.filter(i=>i.src);this.plugin.preview(available,available.indexOf(item),button.querySelector('img')??undefined,source);}));menu.showAtMouseEvent(event);});
  });
  endSpace=makeBookend('end');updateSpaces();
 }
}
