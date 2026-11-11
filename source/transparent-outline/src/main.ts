import { HeadingCache, MarkdownView, Menu, Notice, Platform, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import {mobileKeyboardVisible,mobileQuickActions,mobileQuickBarBottom,outlineDepth,runMobileQuickAction,type MobileQuickAction} from './mobile-actions';
type Mode = 'hover' | 'pinned' | 'off';
type Background = 'auto' | 'transparent' | 'frosted' | 'tinted';
interface Options { mode: Mode; width: number; opacity:number; background:Background; narrowWidth:number; shade:number; blur:number; depth:number;mobileDepth:number }
const DEFAULTS: Options = { mode: 'hover', width: 240, opacity:.74, background:'auto', narrowWidth:900, shade:.82, blur:16, depth:6,mobileDepth:2 };
export default class TransparentOutline extends Plugin {
 override settings: Options = { ...DEFAULTS };
 controllers = new Map<MarkdownView, OutlineController>();
 private mobileControls=new Map<MarkdownView,MobileOutlineControls>();
 private refreshTimer: number | null = null;
 private disposed = false;
 override async onload() {
  const saved = await this.loadData() as Partial<Options> | null;
  this.settings = { mode: ['hover','pinned','off'].includes(saved?.mode ?? '') ? saved!.mode! : 'hover', width: typeof saved?.width === 'number' && Number.isFinite(saved.width) ? Math.max(160,Math.min(360,saved.width)) : 240, opacity:typeof saved?.opacity==='number'&&Number.isFinite(saved.opacity)?Math.max(.35,Math.min(1,saved.opacity)):.74,
   background:['auto','transparent','frosted','tinted'].includes(saved?.background??'')?saved!.background!:'auto',
   narrowWidth:typeof saved?.narrowWidth==='number'&&Number.isFinite(saved.narrowWidth)?Math.max(480,Math.min(1400,saved.narrowWidth)):900,
   shade:typeof saved?.shade==='number'&&Number.isFinite(saved.shade)?Math.max(.45,Math.min(.95,saved.shade)):.82,
   blur:typeof saved?.blur==='number'&&Number.isFinite(saved.blur)?Math.max(4,Math.min(28,saved.blur)):16,
   depth:typeof saved?.depth==='number'&&Number.isFinite(saved.depth)?Math.max(1,Math.min(6,Math.round(saved.depth))):6,
   mobileDepth:typeof saved?.mobileDepth==='number'&&Number.isFinite(saved.mobileDepth)?Math.max(1,Math.min(6,Math.round(saved.mobileDepth))):2 };
  for (const mode of ['hover','pinned','off'] as const) this.addCommand({ id: `mode-${mode}`, name: { hover:'悬停显示大纲',pinned:'常开大纲',off:'关闭大纲' }[mode], callback: () => void this.setMode(mode) });
  this.addCommand({id:'cycle-mode',name:'切换大纲显示方式',callback:()=>void this.setMode(this.settings.mode==='hover'?'pinned':this.settings.mode==='pinned'?'off':'hover')});
  this.addCommand({id:'toggle-current-outline',name:'打开或收起当前文章目录',callback:()=>{const view=this.currentView();if(view)void this.toggleForView(view);}});
  this.addCommand({id:'open-native-outline',name:'打开右侧完整目录',callback:()=>void this.openNativeOutline()});
  this.registerEvent(this.app.workspace.on('file-menu',(menu:Menu,_file, _source,leaf)=>{
   if(!Platform.isMobile)return;
   const view=leaf?.view instanceof MarkdownView?leaf.view:this.currentView();
   if(view)menu.addItem(item=>item.setTitle('打开文章目录').setIcon('list-tree').onClick(()=>void this.openForView(view)));
   menu.addItem(item=>item.setTitle('打开右侧完整目录').setIcon('panel-right').onClick(()=>void this.openNativeOutline()));
  }));
  this.registerEvent(this.app.workspace.on('layout-change',()=>this.scheduleRefresh()));
  this.registerEvent(this.app.workspace.on('active-leaf-change',()=>this.scheduleRefresh()));
  this.registerEvent(this.app.workspace.on('file-open',()=>this.scheduleRefresh()));
  this.registerEvent(this.app.metadataCache.on('changed',()=>this.scheduleRefresh()));
  this.registerEvent(this.app.vault.on('rename',()=>this.scheduleRefresh()));
  this.registerEvent(this.app.vault.on('delete',()=>this.scheduleRefresh()));
  this.addSettingTab(new OutlineSettings(this));
  this.app.workspace.onLayoutReady(()=>{if(!this.disposed)this.refreshAll();});
 }
 scheduleRefresh(){if(this.refreshTimer!==null)window.clearTimeout(this.refreshTimer);this.refreshTimer=window.setTimeout(()=>{this.refreshTimer=null;this.refreshAll();},100);}
 refreshAll(){
  if(this.disposed)return;
  const views = new Set<MarkdownView>();
  this.app.workspace.iterateAllLeaves((leaf:WorkspaceLeaf)=>{if(leaf.view instanceof MarkdownView && leaf.view.file && leaf.view.containerEl.isConnected)views.add(leaf.view);});
  for(const [view,controls] of this.mobileControls)if(!Platform.isMobile||!views.has(view)){controls.destroy();this.mobileControls.delete(view);}
  if(Platform.isMobile)for(const view of views){let controls=this.mobileControls.get(view);if(!controls){controls=new MobileOutlineControls(this,view);this.mobileControls.set(view,controls);}controls.refresh();}
  for(const [view,controller] of this.controllers)if(!views.has(view)||this.settings.mode==='off'){controller.destroy();this.controllers.delete(view);}
  if(this.settings.mode==='off')return;
  for(const view of views){let controller=this.controllers.get(view);if(!controller){controller=new OutlineController(this,view);this.controllers.set(view,controller);}controller.refresh();}
 }
 async setMode(mode:Mode){this.settings.mode=mode;this.refreshAll();await this.saveData(this.settings);}
 private currentView(){return this.app.workspace.getActiveViewOfType(MarkdownView)??(this.app.workspace.getMostRecentLeaf()?.view instanceof MarkdownView?this.app.workspace.getMostRecentLeaf()?.view as MarkdownView:null);}
 async toggleForView(view:MarkdownView){
  if(this.settings.mode==='off')await this.setMode('hover');
  this.refreshAll();
  const controller=this.controllers.get(view);if(!controller)return;
  if(Platform.isMobile)controller.setMobileOpen(!controller.isMobileOpen);
  else await this.setMode(this.settings.mode==='pinned'?'hover':'pinned');
 }
 async openForView(view:MarkdownView){
  if(this.settings.mode==='off')await this.setMode('hover');
  this.refreshAll();
  if(Platform.isMobile)this.controllers.get(view)?.setMobileOpen(true);
  else await this.setMode('pinned');
 }
 updateMobileControls(view:MarkdownView){this.mobileControls.get(view)?.updateState();}
 async openNativeOutline(){
  try{
   const manager=(this.app as unknown as {plugins?:{getPlugin?:(id:string)=>unknown}}).plugins;
   const type=manager?.getPlugin?.('obsidian-quiet-outline')?'quiet-outline':'outline';
   const leaf=this.app.workspace.getLeavesOfType(type).find(item=>item.getRoot()===this.app.workspace.rightSplit)??this.app.workspace.getRightLeaf(false);
   if(!leaf)return undefined;
   try{await leaf.setViewState({type,active:true});}
   catch{await leaf.setViewState({type:'outline',active:true});}
   await this.app.workspace.revealLeaf(leaf);
   return leaf;
  }
  catch{new Notice('在核心插件中启用“大纲”后，可打开右侧原生大纲。');}
  return undefined;
 }
 setDepth(depth:number,persist=true){
  if(Platform.isMobile)this.settings.mobileDepth=Math.max(1,Math.min(6,Math.round(depth)));
  else this.settings.depth=Math.max(1,Math.min(6,Math.round(depth)));
  for(const controller of this.controllers.values())controller.applyDepth();
  if(persist)void this.saveData(this.settings);
 }
 getDepth(){return outlineDepth(this.settings.depth,this.settings.mobileDepth,Platform.isMobile);}
 override onunload(){this.disposed=true;if(this.refreshTimer!==null)window.clearTimeout(this.refreshTimer);for(const controller of this.controllers.values())controller.destroy();this.controllers.clear();for(const controls of this.mobileControls.values())controls.destroy();this.mobileControls.clear();}
}
class MobileOutlineControls {
 readonly bar:HTMLElement;
 private readonly header:HTMLElement;
 private readonly listeners:Array<()=>void>=[];
 private readonly observer:MutationObserver;
 private readonly resizeObserver:ResizeObserver;
 private actionSignature='';
 private layoutHeight:number;
 private layoutWidth:number;
 constructor(private readonly plugin:TransparentOutline,private readonly view:MarkdownView){
  const doc=view.containerEl.ownerDocument,win=doc.defaultView??window;
  view.containerEl.addClass('to-mobile-quick-host');
  this.layoutHeight=win.innerHeight;this.layoutWidth=win.innerWidth;
  this.header=view.addAction('list-tree','目录',()=>void plugin.toggleForView(view));
  this.header.addClass('to-outline-header-action');this.header.setAttribute('aria-label','打开或收起文章目录');this.header.dataset.action='outline';this.header.setText('目录');
  this.bar=view.containerEl.createDiv({cls:'to-mobile-quickbar',attr:{role:'toolbar','aria-label':'文章快捷功能'}});
  const update=()=>this.updateState();
  for(const [target,type] of [[win,'resize'],[win.visualViewport,'resize'],[win.visualViewport,'scroll']] as const){
   if(!target)continue;target.addEventListener(type,update);this.listeners.push(()=>target.removeEventListener(type,update));
  }
  this.observer=new MutationObserver(update);this.observer.observe(doc.body,{childList:true});
  this.resizeObserver=new ResizeObserver(update);this.resizeObserver.observe(view.containerEl);
  for(const element of Array.from(doc.querySelectorAll('.mobile-navbar,.mobile-toolbar,.mobile-toolbar-container,.mobile-toolbar-options-container')))this.resizeObserver.observe(element);
 }
 refresh(){
  const manager=(this.plugin.app as unknown as {plugins?:{getPlugin?:(id:string)=>unknown;plugins?:Record<string,unknown>}}).plugins;
  const loaded=(id:string)=>!!(manager?.getPlugin?.(id)??manager?.plugins?.[id]);
  const actions=mobileQuickActions(loaded('float-search'),loaded('obsidian-image-toolkit'));
  const signature=actions.join(',');
  if(signature!==this.actionSignature){
   this.actionSignature=signature;this.bar.empty();
   const names:Record<MobileQuickAction,string>={search:'搜索',images:'图片',outline:'目录'};
   for(const action of actions){
    const button=this.bar.createEl('button',{text:names[action],cls:`to-mobile-quick-${action}`,attr:{type:'button','aria-label':`打开${names[action]}`,'data-action':action}});
    button.addEventListener('pointerdown',event=>event.preventDefault());
    button.addEventListener('click',event=>{
     event.preventDefault();event.stopPropagation();
     if(action!=='outline')this.plugin.controllers.get(this.view)?.setMobileOpen(false);
     this.plugin.app.workspace.setActiveLeaf(this.view.leaf,{focus:false});
     const execute=(id:string)=>(this.plugin.app as unknown as {commands:{executeCommandById:(id:string)=>boolean}}).commands.executeCommandById(id);
     runMobileQuickAction(action,execute,()=>void this.plugin.toggleForView(this.view));
    });
   }
  }
  this.updateState();
 }
 updateState(){
  const doc=this.bar.ownerDocument,win=doc.defaultView??window;
  if(Math.abs(win.innerWidth-this.layoutWidth)>100){this.layoutWidth=win.innerWidth;this.layoutHeight=win.innerHeight;}
  this.layoutHeight=Math.max(this.layoutHeight,win.innerHeight);
  const keyboard=mobileKeyboardVisible(this.layoutHeight,win.visualViewport?.height??win.innerHeight);
  const modal=!!doc.querySelector('.modal-container');
  this.bar.hidden=keyboard||modal;
  const nativeBars=Array.from(doc.querySelectorAll<HTMLElement>('.mobile-navbar,.mobile-toolbar,.mobile-toolbar-container,.mobile-toolbar-options-container')).filter(element=>{const style=win.getComputedStyle(element);return style.display!=='none'&&style.visibility!=='hidden';}).map(element=>element.getBoundingClientRect());
  const visibleBottom=(win.visualViewport?.offsetTop??0)+(win.visualViewport?.height??win.innerHeight);
  const bottom=`${mobileQuickBarBottom(this.view.containerEl.getBoundingClientRect().bottom,visibleBottom,nativeBars)}px`;
  if(this.view.containerEl.style.getPropertyValue('--to-quickbar-bottom')!==bottom)this.view.containerEl.style.setProperty('--to-quickbar-bottom',bottom);
  const open=this.plugin.controllers.get(this.view)?.isMobileOpen??false;
  this.header.setAttribute('aria-expanded',String(open));
  this.bar.querySelector('.to-mobile-quick-outline')?.setAttribute('aria-pressed',String(open));
 }
 destroy(){this.observer.disconnect();this.resizeObserver.disconnect();this.listeners.forEach(remove=>remove());this.header.remove();this.bar.remove();this.view.containerEl.removeClass('to-mobile-quick-host');this.view.containerEl.style.removeProperty('--to-quickbar-bottom');}
}
export class OutlineController {
 readonly root:HTMLElement;
 readonly list:HTMLElement;
 headings:HeadingCache[]=[];
 activeIndex=-1;
 collapsed=new Set<number>();
 expanded=new Set<number>();
 private depths:number[]=[];
 private rowAnimations=new Map<HTMLElement,Animation>();
 private depthInput:HTMLInputElement;
 private depthLabel:HTMLElement;
 private depthControl:HTMLElement;
 private signature='';
 private filePath='';
 private listeners:Array<()=>void>=[];
 private observer:MutationObserver;
 private resizeObserver:ResizeObserver;
 private themeObserver:MutationObserver;
 private timer:number|null=null;
 private frame:number|null=null;
 private destroyed=false;
 isMobileOpen=false;
 constructor(readonly plugin:TransparentOutline,readonly view:MarkdownView){
  view.containerEl.addClass('to-outline-host');
  this.root=view.containerEl.createDiv({cls:'to-outline',attr:{'aria-label':'文章大纲'}});
  const edge=this.root.createEl('button',{cls:'to-outline-edge',attr:{'aria-label':'显示文章大纲',title:'显示文章大纲'}});
  edge.setText(Platform.isMobile?'目录':'⋮');edge.setAttribute('aria-expanded','false');edge.dataset.action='outline';
  const toolbar=this.root.createDiv('to-outline-tools');
  toolbar.createSpan({cls:'to-outline-caption',text:'展开层级'});
  this.depthLabel=toolbar.createSpan({cls:'to-outline-depth-value'});
  const mode=toolbar.createEl('button',{cls:'to-outline-mode',attr:{'aria-label':'切换悬停或常开',title:'切换悬停或常开'}});mode.setText('◉');
  if(Platform.isMobile){const close=toolbar.createEl('button',{cls:'to-outline-close',text:'关闭',attr:{type:'button','aria-label':'关闭文章目录','data-action':'close-outline'}});this.listen(close,'click',()=>this.setMobileOpen(false));}
  this.depthControl=this.root.createDiv('to-outline-depth');
  const track=this.depthControl.createDiv('to-outline-depth-track');
  track.createDiv('to-outline-depth-fill');
  const stops=track.createDiv('to-outline-depth-stops');
  for(let level=1;level<=6;level++)stops.createSpan({cls:'to-outline-depth-stop',attr:{'data-depth':String(level)}});
  this.depthInput=track.createEl('input',{cls:'to-outline-depth-range',attr:{type:'range',min:'1',max:'6',step:'1','aria-label':'大纲展开层级'}});
  const labels=this.depthControl.createDiv('to-outline-depth-labels');
  for(let level=1;level<=6;level++){
   const button=labels.createEl('button',{text:String(level),attr:{'aria-label':`展开至第 ${level} 层`,title:`展开至第 ${level} 层`}});
   this.listen(button,'click',event=>{if((event as MouseEvent).detail>0)button.blur();plugin.setDepth(level);});
  }
  this.listen(this.depthInput,'input',()=>plugin.setDepth(Number(this.depthInput.value),false));
  this.listen(this.depthInput,'change',()=>void plugin.saveData(plugin.settings));
  this.listen(this.depthInput,'pointerdown',()=>{this.clearTimer();this.root.addClass('is-adjusting');this.root.addClass('is-revealed');});
  this.listen(this.depthInput,'pointerup',event=>{this.root.removeClass('is-adjusting');if((event as PointerEvent).pointerType!=='')this.depthInput.blur();if(!Platform.isMobile&&!this.root.matches(':hover'))this.root.removeClass('is-revealed');});
  this.listen(this.depthInput,'pointercancel',()=>{this.root.removeClass('is-adjusting');if(!Platform.isMobile)this.root.removeClass('is-revealed');});
  this.list=this.root.createEl('nav',{cls:'to-outline-list',attr:{'aria-label':'标题导航'}});
  this.listen(mode,'click',event=>{if((event as MouseEvent).detail>0)mode.blur();void plugin.setMode(plugin.settings.mode==='hover'?'pinned':'hover');});
  this.listen(edge,'click',event=>{if((event as MouseEvent).detail>0)edge.blur();if(Platform.isMobile)this.setMobileOpen(!this.isMobileOpen);else void plugin.setMode(plugin.settings.mode==='hover'?'pinned':'hover');});
  this.listen(this.root,'pointerenter',()=>{if(Platform.isMobile)return;this.clearTimer();this.root.removeClass('is-dismissed');this.root.addClass('is-revealed');});
  this.listen(this.root,'pointerleave',()=>{if(Platform.isMobile||this.root.classList.contains('is-adjusting'))return;this.clearTimer();this.root.removeClass('is-dismissed');this.timer=window.setTimeout(()=>{this.root.removeClass('is-revealed');this.timer=null;},180);});
  this.listen(this.root,'keydown',(event)=>{if((event as KeyboardEvent).key==='Escape'){if(Platform.isMobile)this.setMobileOpen(false);else{this.clearTimer();this.root.removeClass('is-expanded');this.root.removeClass('is-revealed');this.root.addClass('is-dismissed');}(event.target as HTMLElement).blur();}});
  if(Platform.isMobile){
   const outside=(event:Event)=>{const target=event.target as Element|null;if(this.isMobileOpen&&target&&!this.root.contains(target)&&!target.closest('.to-mobile-quickbar,.to-outline-header-action'))this.setMobileOpen(false);};
   const doc=this.root.ownerDocument;doc.addEventListener('pointerdown',outside,true);this.listeners.push(()=>doc.removeEventListener('pointerdown',outside,true));
  }
  this.listen(view.containerEl,'scroll',()=>this.scheduleActive(),true);
  this.listen(view.containerEl,'keyup',()=>this.scheduleActive());
  this.listen(view.containerEl,'mouseup',()=>this.scheduleActive());
  this.observer=new MutationObserver(records=>{if(records.some(r=>!this.root.contains(r.target)))this.scheduleActive();});
  this.observer.observe(view.containerEl,{childList:true,subtree:true});
  this.resizeObserver=new ResizeObserver(()=>{this.updateAppearance();this.scheduleActive();});this.resizeObserver.observe(view.containerEl);
  this.themeObserver=new MutationObserver(()=>this.updateAppearance());this.themeObserver.observe(this.root.ownerDocument.body,{attributes:true,attributeFilter:['class']});
 }
 private listen(el:HTMLElement,type:string,handler:(event:Event)=>void,capture=false){el.addEventListener(type,handler,capture);this.listeners.push(()=>el.removeEventListener(type,handler,capture));}
 private clearTimer(){if(this.timer!==null){window.clearTimeout(this.timer);this.timer=null;}}
 setMobileOpen(open:boolean){
  this.clearTimer();this.isMobileOpen=open;this.root.toggleClass('is-mobile-open',open);this.root.removeClass('is-dismissed');
  this.root.querySelector('.to-outline-edge')?.setAttribute('aria-expanded',String(open));
  this.plugin.updateMobileControls(this.view);
 }
 refresh(){
  if(this.destroyed)return;
  const file=this.view.file;if(!file)return;
  const headings=this.plugin.app.metadataCache.getFileCache(file)?.headings??[];
  const sig=file.path+'\n'+JSON.stringify(headings.map(h=>[h.heading,h.level,h.position.start.line]));
  if(Platform.isMobile&&this.root.dataset.mode!==this.plugin.settings.mode)this.setMobileOpen(this.plugin.settings.mode==='pinned');
  this.root.dataset.mode=this.plugin.settings.mode;this.root.dataset.mobile=String(Platform.isMobile);this.root.style.setProperty('--to-width',`${this.plugin.settings.width}px`);this.root.style.setProperty('--to-opacity',String(this.plugin.settings.opacity));
  this.updateAppearance();
  this.root.querySelector('.to-outline-mode')?.setAttribute('aria-pressed',String(this.plugin.settings.mode==='pinned'));
  if(sig!==this.signature){
   this.collapsed.clear();this.expanded.clear();
   if(file.path!==this.filePath){this.activeIndex=-1;this.list.scrollTop=0;}
   this.filePath=file.path;this.signature=sig;this.headings=headings;this.render();
  }
  this.syncDepthControl();
  this.scheduleActive();
 }
 updateAppearance(){
  if(this.destroyed)return;
  const settings=this.plugin.settings;
  const scroller=this.view.getMode()==='source'?this.view.containerEl.querySelector<HTMLElement>('.cm-scroller'):this.view.containerEl.querySelector<HTMLElement>('.markdown-preview-view');
  const gutter=scroller?Math.max(15,scroller.offsetWidth-scroller.clientWidth):15;
  this.root.style.setProperty('--to-scrollbar-gutter',`${gutter}px`);
  if(this.view.containerEl.getBoundingClientRect().width===0)this.settleAnimations();
  this.root.dataset.background=settings.background;
  const dark=this.root.ownerDocument.body.classList.contains('theme-dark');
  this.root.dataset.surface=settings.background==='auto'?(dark||this.view.containerEl.getBoundingClientRect().width<settings.narrowWidth?'frosted':'transparent'):settings.background;
  this.root.style.setProperty('--to-shade',`${settings.shade*100}%`);
  this.root.style.setProperty('--to-blur',`${settings.blur}px`);
 }
 private syncDepthControl(){
  const depth=this.plugin.getDepth();
  this.depthInput.value=String(depth);
  this.depthInput.setAttribute('aria-valuetext',depth===6?'展开全部层级':`展开至第 ${depth} 层`);
  this.depthLabel.setText(depth===6?'全部':`${depth} 层`);
  this.depthControl.style.setProperty('--to-depth-progress',`${(depth-1)*20}%`);
  this.depthControl.querySelectorAll<HTMLElement>('[data-depth]').forEach(el=>{const value=Number(el.dataset.depth);el.toggleClass('is-selected',value===depth);el.toggleClass('is-passed',value<depth);});
  this.depthControl.querySelectorAll('button').forEach((button,index)=>button.setAttribute('aria-pressed',String(index+1===depth)));
 }
 applyDepth(){this.collapsed.clear();this.expanded.clear();this.syncDepthControl();this.applyVisibility();this.paintActive();}
 private folded(index:number){return this.collapsed.has(index)||(this.depths[index]>=this.plugin.getDepth()&&!this.expanded.has(index));}
 render(){
  for(const animation of this.rowAnimations.values())animation.cancel();this.rowAnimations.clear();
  const scroll=this.list.scrollTop;this.list.empty();
  if(!this.headings.length)this.list.createDiv({cls:'to-outline-empty',text:'当前文章暂无标题'});
  const parents:number[]=[];this.depths=[];
  this.headings.forEach((heading,index)=>{
   while(parents.length&&this.headings[parents[parents.length-1]].level>=heading.level)parents.pop();
   this.depths[index]=parents.length+1;parents.push(index);
   const row=this.list.createDiv({cls:'to-outline-row',attr:{'data-index':String(index),'data-level':String(heading.level)}});
   row.style.setProperty('--to-level',String(this.depths[index]-1));
   const child=this.headings[index+1]?.level>heading.level;
   if(child){const toggle=row.createEl('button',{cls:'to-outline-fold',text:'›',attr:{'aria-label':`折叠或展开 ${heading.heading}`,'aria-expanded':String(!this.collapsed.has(index))}});toggle.addEventListener('click',event=>{if(event.detail>0)toggle.blur();if(this.folded(index)){this.collapsed.delete(index);this.expanded.add(index);}else{this.collapsed.add(index);this.expanded.delete(index);}this.applyVisibility();this.paintActive();});}
   else row.createSpan('to-outline-fold-space');
   const link=row.createEl('button',{cls:'to-outline-link',text:heading.heading,attr:{title:heading.heading,'aria-label':`H${heading.level} ${heading.heading}`}});
   link.addEventListener('click',event=>{if(event.detail>0)link.blur();this.jump(index);});
  });
  this.applyVisibility(false);this.paintActive();this.list.scrollTop=scroll;
 }
 private settleAnimations(){
  for(const [row,animation] of this.rowAnimations){animation.cancel();row.hidden=row.dataset.collapsed==='true';row.removeClass('is-animating');}
  this.rowAnimations.clear();
 }
 private applyVisibility(animate=true){
  const parents:number[]=[];
  const changes:Array<{row:HTMLElement;hidden:boolean;height:number;opacity:string;marginTop:string;marginBottom:string;transform:string}>=[];
  const motion=animate&&!this.root.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches&&this.root.getBoundingClientRect().width>0&&getComputedStyle(this.list).visibility==='visible';
  // Read the current visual state before cancelling, so rapid reversals continue smoothly.
  this.headings.forEach((h,i)=>{
   while(parents.length&&this.headings[parents[parents.length-1]].level>=h.level)parents.pop();
   const row=this.list.children[i] as HTMLElement|undefined;
   if(row){
    const hidden=parents.some(p=>this.folded(p));
    const toggle=row.querySelector('.to-outline-fold');if(toggle){toggle.setText('›');toggle.setAttribute('aria-expanded',String(!this.folded(i)));}
    if(row.dataset.collapsed!==String(hidden)){
     const style=getComputedStyle(row);
     changes.push({row,hidden,height:row.hidden?0:row.getBoundingClientRect().height,opacity:row.hidden?'0':style.opacity,marginTop:row.hidden?'0px':style.marginTop,marginBottom:row.hidden?'0px':style.marginBottom,transform:row.hidden?'translateY(-3px)':style.transform});
    }
   }
   parents.push(i);
  });
  // Batch writes and natural-size reads to keep large outlines responsive.
  for(const change of changes){
   const {row,hidden}=change;this.rowAnimations.get(row)?.cancel();this.rowAnimations.delete(row);row.removeClass('is-animating');
   row.dataset.collapsed=String(hidden);row.inert=hidden;row.setAttribute('aria-hidden',String(hidden));
   row.hidden=motion?false:hidden;
  }
  if(!motion){this.settleAnimations();return;}
  const natural=changes.map(({row})=>{const style=getComputedStyle(row);return {height:row.getBoundingClientRect().height,marginTop:style.marginTop,marginBottom:style.marginBottom};});
  changes.forEach((change,index)=>{
   const {row,hidden}=change;
   if(typeof row.animate!=='function'){row.hidden=hidden;return;}
   const end=natural[index];
   const animation=row.animate([
    {height:`${change.height}px`,opacity:change.opacity,marginTop:change.marginTop,marginBottom:change.marginBottom,transform:change.transform},
    {height:hidden?'0px':`${end.height}px`,opacity:hidden?0:1,marginTop:hidden?'0px':end.marginTop,marginBottom:hidden?'0px':end.marginBottom,transform:hidden?'translateY(-3px)':'translateY(0)'}
   ],{duration:hidden?220:280,easing:'cubic-bezier(0.22, 0.61, 0.36, 1)',fill:'both'});
   row.addClass('is-animating');this.rowAnimations.set(row,animation);
   animation.onfinish=()=>{
    if(this.destroyed||this.rowAnimations.get(row)!==animation)return;
    row.hidden=hidden;row.removeClass('is-animating');this.rowAnimations.delete(row);animation.cancel();
   };
  });
 }

 jump(index:number){
  const heading=this.headings[index];if(!heading||this.view.file?.path!==this.filePath)return;
  this.plugin.app.workspace.setActiveLeaf(this.view.leaf,{focus:!Platform.isMobile});
  this.view.leaf.setEphemeralState({line:heading.position.start.line});
  if(this.view.getMode()==='source'){const pos={line:heading.position.start.line,ch:0};this.view.editor.setCursor(pos);this.view.editor.scrollIntoView({from:pos,to:pos},true);if(Platform.isMobile)this.view.editor.blur();}
  this.activeIndex=index;this.paintActive(true);
 }
 scheduleActive(){if(this.destroyed||this.frame!==null)return;this.frame=window.requestAnimationFrame(()=>{this.frame=null;this.updateActive();});}
 updateActive(){
  if(this.destroyed||!this.headings.length)return;
  const previous=this.activeIndex;
  let line:number|null=null;
  if(this.view.getMode()==='source'){
   // Version-guarded CM6 geometry adapter; cursor remains the public-API fallback.
   type CM={scrollDOM:HTMLElement;documentTop:number;lineBlockAtHeight:(height:number)=>{from:number};state:{doc:{lineAt:(position:number)=>{number:number}}}};
   const cm=(this.view.editor as unknown as {cm?:CM}).cm;
   try{if(cm?.scrollDOM&&typeof cm.lineBlockAtHeight==='function')line=cm.state.doc.lineAt(cm.lineBlockAtHeight(cm.scrollDOM.getBoundingClientRect().top-cm.documentTop+48).from).number-1;}catch{}
   line??=this.view.editor.getCursor().line;
  } else {
   // Preview rendering is virtualized; associate sections with source lines, never DOM indices.
   type Section={el?:HTMLElement;start?:{line?:number};lineStart?:number};
   const mode=(this.view as unknown as {previewMode?:{renderer?:{sections?:Section[]}}}).previewMode;
   const area=this.view.containerEl.querySelector('.markdown-preview-view');
   const sections=mode?.renderer?.sections;
   if(area&&Array.isArray(sections)){
    const top=area.getBoundingClientRect().top+64;
    for(const section of sections){const start=section.start?.line??section.lineStart;const rect=section.el?.getBoundingClientRect();if(section.el?.isConnected&&rect&&rect.height>0&&typeof start==='number'&&rect.top<=top)line=Math.max(line??0,start);}
   }
  }
  if(line!==null){let active=0;this.headings.forEach((h,i)=>{if(h.position.start.line<=line!)active=i;});this.activeIndex=active;}
  this.paintActive(previous!==this.activeIndex);
 }
 private paintActive(reveal=false){this.list.querySelectorAll<HTMLElement>('.to-outline-row').forEach((row,i)=>{row.toggleClass('is-active',i===this.activeIndex);const link=row.querySelector('button.to-outline-link');if(i===this.activeIndex)link?.setAttribute('aria-current','location');else link?.removeAttribute('aria-current');});
  if(reveal){let row=this.list.children[this.activeIndex] as HTMLElement|undefined;while(row&&(row.hidden||row.dataset.collapsed==='true'))row=row.previousElementSibling as HTMLElement|undefined;if(row){const rect=row.getBoundingClientRect(),area=this.list.getBoundingClientRect();if(rect.top<area.top)this.list.scrollTop+=rect.top-area.top;else if(rect.bottom>area.bottom)this.list.scrollTop+=rect.bottom-area.bottom;}}
 }
 destroy(){this.destroyed=true;for(const animation of this.rowAnimations.values())animation.cancel();this.rowAnimations.clear();this.clearTimer();if(this.frame!==null)window.cancelAnimationFrame(this.frame);this.frame=null;this.observer.disconnect();this.resizeObserver.disconnect();this.themeObserver.disconnect();this.listeners.forEach(remove=>remove());this.listeners=[];this.root.remove();this.view.containerEl.removeClass('to-outline-host');}
}
class OutlineSettings extends PluginSettingTab {
 constructor(private plugin:TransparentOutline){super(plugin.app,plugin);}
 override display(){this.containerEl.empty();new Setting(this.containerEl).setName('显示方式').addDropdown(dropdown=>dropdown.addOption('hover','悬停').addOption('pinned','常开').addOption('off','关闭').setValue(this.plugin.settings.mode).onChange(value=>this.plugin.setMode(value as Mode)));
 new Setting(this.containerEl).setName('背景效果').setDesc('自动模式在夜间使用增强磨玻璃；浅色模式依据文章栏宽度启用。').addDropdown(dropdown=>dropdown.addOption('auto','窄窗口自动磨玻璃').addOption('transparent','纯透明').addOption('frosted','始终磨玻璃').addOption('tinted','半透明底色').setValue(this.plugin.settings.background).onChange(async value=>{this.plugin.settings.background=value as Background;this.plugin.refreshAll();await this.plugin.saveData(this.plugin.settings);}));
 new Setting(this.containerEl).setName('自动启用宽度').setDesc('当前文章栏宽度低于此值时启用，单位 px。').addSlider(slider=>slider.setLimits(480,1400,20).setValue(this.plugin.settings.narrowWidth).setDynamicTooltip().onChange(async value=>{this.plugin.settings.narrowWidth=value;this.plugin.refreshAll();await this.plugin.saveData(this.plugin.settings);}));
 new Setting(this.containerEl).setName('背景遮蔽强度').setDesc('深色增加 10 个百分点，最高 98%；浅色增加 6 个百分点，最高 95%。').addSlider(slider=>slider.setLimits(.45,.95,.05).setValue(this.plugin.settings.shade).setDynamicTooltip().onChange(async value=>{this.plugin.settings.shade=value;this.plugin.refreshAll();await this.plugin.saveData(this.plugin.settings);}));
 new Setting(this.containerEl).setName('磨玻璃模糊半径').setDesc('单位 px；夜间增加 8px。').addSlider(slider=>slider.setLimits(4,28,2).setValue(this.plugin.settings.blur).setDynamicTooltip().onChange(async value=>{this.plugin.settings.blur=value;this.plugin.refreshAll();await this.plugin.saveData(this.plugin.settings);}));
 new Setting(this.containerEl).setName('文字透明度').addSlider(slider=>slider.setLimits(.35,1,.05).setValue(this.plugin.settings.opacity).setDynamicTooltip().onChange(async value=>{this.plugin.settings.opacity=value;this.plugin.refreshAll();await this.plugin.saveData(this.plugin.settings);}));
 new Setting(this.containerEl).setName('大纲宽度').setDesc('160–360 px').addSlider(slider=>slider.setLimits(160,360,10).setValue(this.plugin.settings.width).setDynamicTooltip().onChange(async value=>{this.plugin.settings.width=value;this.plugin.refreshAll();await this.plugin.saveData(this.plugin.settings);}));}
}
