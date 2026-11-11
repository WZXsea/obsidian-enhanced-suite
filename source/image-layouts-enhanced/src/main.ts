import {
  App, Editor, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownRenderer,
  MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile,
  editorInfoField, editorLivePreviewField, parseYaml,
} from 'obsidian';
import {EditorState, StateField} from '@codemirror/state';
import {Decoration, DecorationSet, EditorView, WidgetType} from '@codemirror/view';
import {DEFAULT_OPTIONS, GalleryGroup, GalleryImage, GalleryOptions, LAYOUT_LABELS, Layout} from './types';
import {normalizeOptions, parseGroups, serializeOpen, updateGroup, unwrapGroup, wrapSelection} from './model';
import {extractImages, getSupplementalMarkdown} from './images';
import {GalleryRenderer} from './renderer';
import {openGalleryImage} from './integration';
import {editLegacyGroup} from './source-edits';
import {resolveGallerySourceTarget} from './source-target';
import {buildReferenceBodyEdit} from './reference-edits';
import {ReferenceEditor} from './reference-editor';
import {GalleryConfiguration} from './gallery-configuration';
import {ImageControls,ImageControlContext} from './image-controls';
import {GalleryGroupPicker} from './group-picker';
import {LayoutPicker} from './layout-picker';
import {closePopover} from './popover';
import {GroupSettings,groupKey,getEffectiveOptions,getStoredOptions,renameGroupSettings} from './configuration';

interface Settings {layout:Layout; fit:GalleryOptions['fit']; height:number; gap:number; radius:number}
const DEFAULT_SETTINGS:Settings={layout:'g',fit:'contain',height:320,gap:8,radius:8};
type Edit={from:number;to:number;insert:string};
const lineOffset=(source:string,line:number)=>{let pos=0;for(let i=0;i<line;i++){const next=source.indexOf('\n',pos);if(next<0)return source.length;pos=next+1;}return pos;};
const shortId=()=>crypto.randomUUID().replace(/-/g,'').slice(0,10);
function minimalHeaderEdit(source:string,group:GalleryGroup,options:Pick<GalleryOptions,'id'|'layout'>):Edit|null{
  const edit=updateGroup(source,group,{});if(!edit)return null;
  const indent=/^ */.exec(source.slice(edit.from,edit.to))?.[0]??'';
  return {...edit,insert:indent+serializeOpen({id:options.id,layout:options.layout})};
}

class GalleryChild extends MarkdownRenderChild {
  renderer?:GalleryRenderer;
  constructor(host:HTMLElement,private plugin:ImageLayoutsEnhanced,private group:GalleryGroup,private path:string,private source:string){super(host);}
  onload(){this.renderer=this.plugin.mount(this.containerEl,this.group,this.path,this.source,this);}
  onunload(){this.renderer?.destroy();this.containerEl.remove();}
}

const widgetChildren=new WeakMap<HTMLElement,GalleryChild>();
class GalleryWidget extends WidgetType {
  constructor(private plugin:ImageLayoutsEnhanced,private group:GalleryGroup,private path:string,private source:string,private revision=plugin.configurationRevision){super();}
  eq(other:GalleryWidget){return this.revision===other.revision&&this.path===other.path&&this.group.from===other.group.from&&this.group.raw===other.group.raw&&this.source===other.source;}
  toDOM(view:EditorView){
    const host=view.dom.ownerDocument.createElement('div');host.className='ilg-host ilg-live';host.contentEditable='false';
    host.dataset.ilgGroupId=this.group.options.id;
    const child=new GalleryChild(host,this.plugin,this.group,this.path,this.source);child.load();widgetChildren.set(host,child);
    return host;
  }
  ignoreEvent(){return true;}
  destroy(host:HTMLElement){widgetChildren.get(host)?.unload();widgetChildren.delete(host);}
}

function decorations(state:EditorState,plugin:ImageLayoutsEnhanced,groups:GalleryGroup[]):DecorationSet{
  if(state.field(editorLivePreviewField,false)!==true)return Decoration.none;
  const path=state.field(editorInfoField,false)?.file?.path??'';
  const source=state.doc.toString();
  const ranges=groups.filter(group=>!state.selection.ranges.some(selection=>selection.empty?selection.from>=group.from&&selection.from<group.to:selection.from<group.to&&selection.to>group.from)).map(group=>
    Decoration.replace({widget:new GalleryWidget(plugin,group,path,source),block:true}).range(group.from,group.to));
  return Decoration.set(ranges,true);
}

export default class ImageLayoutsEnhanced extends Plugin {
  settings:Settings={...DEFAULT_SETTINGS};
  groupSettings:GroupSettings={};
  configurationRevision=0;
  private storageQueue:Promise<void>=Promise.resolve();
  diagnostics={reading:0,live:0,toolkit:0,fallback:0};
  private readingChildren=new Set<MarkdownRenderChild>();
  private hiddenSections=new WeakMap<HTMLElement,{display:string;count:number}>();
  private anchorChildren=new WeakMap<HTMLElement,GalleryChild>();
  private selectedImages=new Map<string,number>();
  private imageControls=new Map<Document,ImageControls>();
  private imageSources=new Map<string,string>();
  private navigationRenderers=new WeakMap<HTMLElement,{path:string;images:GalleryImage[];renderer:GalleryRenderer}>();
  private hostGroups=new WeakMap<HTMLElement,{group:GalleryGroup;path:string;source:string}>();
  private parsedSources=new Map<string,{source:string;groups:GalleryGroup[];refs:ReturnType<typeof extractImages>}>();
  private parsed(source:string,path:string){
    const saved=this.parsedSources.get(path);if(saved?.source===source)return saved;
    const value={source,groups:parseGroups(source),refs:extractImages(source)};
    if(this.parsedSources.size>=16)this.parsedSources.delete(this.parsedSources.keys().next().value!);
    this.parsedSources.set(path,value);return value;
  }
  async onload(){
    try{
      const saved=await this.loadData();
      const options=normalizeOptions(saved);
      this.settings={layout:options.layout,fit:options.fit,height:options.height,gap:options.gap,radius:options.radius};
      if(saved?.groupSettings&&typeof saved.groupSettings==='object'&&!Array.isArray(saved.groupSettings))this.groupSettings={...saved.groupSettings};
    }catch(error){console.error('Image Layouts Enhanced: configuration read',error);new Notice('画廊配置读取遇到问题，当前使用默认显示参数');}
    this.addSettingTab(new GallerySettings(this.app,this));
    this.registerEditorExtension(StateField.define<{groups:GalleryGroup[];decorations:DecorationSet}>({
      create:state=>{const groups=parseGroups(state.doc.toString());return{groups,decorations:decorations(state,this,groups)};},
      update:(previous,transaction)=>{const groups=transaction.docChanged?parseGroups(transaction.state.doc.toString()):previous.groups;return{groups,decorations:decorations(transaction.state,this,groups)};},
      provide:field=>EditorView.decorations.from(field,value=>value.decorations),
    }));
    this.registerMarkdownPostProcessor((el,ctx)=>{this.annotateImages(el,ctx);return this.reading(el,ctx);});
    this.installImageControls();
    this.registerEvent(this.app.workspace.on('layout-change',()=>this.installImageControls()));
    for(const suffix of ['','left','center','right',...Object.keys(LAYOUT_LABELS).filter(name=>!['focus','filmstrip','carousel','custom'].includes(name))]){
      this.registerMarkdownCodeBlockProcessor(suffix?`image-layout-${suffix}`:'image-layout',(source,el,ctx)=>this.legacy(source,el,ctx,suffix));
    }
    this.addCommand({id:'create-gallery',name:'将选中图片组成画廊',editorCallback:editor=>this.insert(editor)});
    this.addCommand({id:'change-layout',name:'当前图片组：选择布局',editorCheckCallback:(checking,editor)=>{
      const group=parseGroups(editor.getValue()).find(g=>editor.posToOffset(editor.getCursor())>=g.from&&editor.posToOffset(editor.getCursor())<=g.to);
      if(!group)return false;if(!checking){const path=this.pathForEditor(editor);if(path)new LayoutPicker(this.app,this.images({...group,options:getEffectiveOptions(group,path,this.groupSettings)},path,editor.getValue()).length,patch=>void this.editFile(path,group,patch).catch(()=>{}),undefined,getEffectiveOptions(group,path,this.groupSettings)).open();}return true;
    }});
    this.addCommand({id:'unwrap-gallery',name:'当前图片组：恢复普通图片',editorCheckCallback:(checking,editor)=>{
      const at=editor.posToOffset(editor.getCursor());const group=parseGroups(editor.getValue()).find(g=>at>=g.from&&at<=g.to);
      if(!group)return false;if(!checking)this.applyEditor(editor,unwrapGroup(editor.getValue(),group));return true;
    }});
    this.addCommand({id:'compact-gallery-markers',name:'精简当前笔记的图片组标记',editorCallback:editor=>void this.compact(editor).catch(()=>{})});
    this.addCommand({id:'insert-template',name:'插入图片组模板',editorCallback:editor=>void this.insertTemplate(editor).catch(()=>{})});
    this.registerEvent(this.app.workspace.on('editor-menu',(menu,editor)=>{
      const from=editor.posToOffset(editor.getCursor('from')),to=editor.posToOffset(editor.getCursor('to'));
      if(extractImages(editor.getValue()).some(ref=>ref.offset>=from&&ref.offset+ref.raw.length<=to))menu.addItem(item=>item.setTitle('将选中图片组成画廊').setIcon('images').onClick(()=>this.insert(editor)));
    }));
    this.registerEvent(this.app.vault.on('rename',(file,oldPath)=>{
      const before=this.groupSettings;const next=renameGroupSettings(before,oldPath,file.path);
      if(JSON.stringify(before)===JSON.stringify(next))return;
      this.groupSettings=next;
      void this.persistSettings().then(()=>this.refreshConfiguration(file.path)).catch(()=>{if(this.groupSettings===next)this.groupSettings=before;});
    }));
  }
  onunload(){for(const [doc,controls] of this.imageControls){closePopover(doc);controls.destroy();}this.imageControls.clear();this.imageSources.clear();for(const child of [...this.readingChildren])child.unload();this.readingChildren.clear();this.parsedSources.clear();this.selectedImages.clear();}
  private trackReading(child:MarkdownRenderChild,ctx:MarkdownPostProcessorContext){
    this.readingChildren.add(child);child.register(()=>this.readingChildren.delete(child));ctx.addChild(child);
  }
  private installImageControls(){
    const documents=new Set<Document>([document,...this.app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view.containerEl.ownerDocument)]);
    for(const [doc,controls]of this.imageControls)if(!documents.has(doc)){closePopover(doc);controls.destroy();this.imageControls.delete(doc);}
    for(const doc of documents)if(!this.imageControls.has(doc))this.imageControls.set(doc,new ImageControls(doc,image=>this.imageContext(image)));
  }
  private imageUrl(src:string,doc:Document){
    try{const url=new URL(src,doc.baseURI);if(url.protocol==='app:'){url.search='';url.hash='';}return url.href;}catch{return src;}
  }
  private sourceForTarget(target:string,path:string){
    if(/^https?:\/\/|^data:image\//i.test(target))return target;
    let decoded=target;try{decoded=decodeURIComponent(target);}catch{}
    const file=this.app.metadataCache.getFirstLinkpathDest(decoded.split('#')[0],path);
    return file?this.app.vault.getResourcePath(file):'';
  }
  private annotateImages(el:HTMLElement,ctx:MarkdownPostProcessorContext){
    if(el.closest('.ilg-host'))return;
    const images=Array.from(el.querySelectorAll<HTMLImageElement>('img')).filter(image=>!image.closest('.ilg-host'));
    const info=ctx.getSectionInfo(el);if(!info)return;
    const from=lineOffset(info.text,info.lineStart),to=lineOffset(info.text,info.lineEnd+1);
    if(!/!\[|<img\b/i.test(info.text.slice(from,to)))return;
    const refs=this.parsed(info.text,ctx.sourcePath).refs.filter(ref=>ref.offset>=from&&ref.offset<to);
    if(!refs.length)return;
    if(this.imageSources.size>=16&&!this.imageSources.has(ctx.sourcePath))this.imageSources.delete(this.imageSources.keys().next().value!);
    this.imageSources.set(ctx.sourcePath,info.text);
    // Native embeds can add their img after postprocessing. Annotating the
    // source section keeps duplicate references distinguishable when it loads.
    if(el.dataset.ilgSectionPath!==ctx.sourcePath)el.dataset.ilgSectionPath=ctx.sourcePath;
    if(el.dataset.ilgSectionFrom!==String(from))el.dataset.ilgSectionFrom=String(from);
    if(el.dataset.ilgSectionTo!==String(to))el.dataset.ilgSectionTo=String(to);
    const used=new Set<number>();
    for(const image of images){
      const ref=refs.find(ref=>!used.has(ref.offset)&&this.imageUrl(this.sourceForTarget(ref.target,ctx.sourcePath),image.ownerDocument)===this.imageUrl(image.currentSrc||image.src,image.ownerDocument));
      if(ref){used.add(ref.offset);image.dataset.ilgSourcePath=ctx.sourcePath;image.dataset.ilgSourceOffset=String(ref.offset);}
    }
  }
  private imageContext(image:HTMLImageElement):ImageControlContext|undefined{
    const view=this.app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).find(view=>view instanceof MarkdownView&&view.containerEl.contains(image)) as MarkdownView|undefined;
    const path=view?.file?.path;if(!view||!path)return;
    const host=image.closest<HTMLElement>('.ilg-host'),mounted=host?this.hostGroups.get(host):undefined;
    if(mounted&&mounted.path!==path)return;
    const source=view.getMode()==='source'?view.editor.getValue():(view as unknown as {data?:string}).data??this.imageSources.get(path)??this.parsedSources.get(path)?.source??mounted?.source;
    if(source===undefined)return;
    const parsed=this.parsed(source,path);
    let group=mounted?.group;
    if(!group){
      const matching=parsed.refs.filter(ref=>this.imageUrl(this.sourceForTarget(ref.target,path),image.ownerDocument)===this.imageUrl(image.currentSrc||image.src,image.ownerDocument));
      let ref=image.dataset.ilgSourcePath===path?matching.find(ref=>ref.offset===Number(image.dataset.ilgSourceOffset)):undefined;
      const section=image.closest<HTMLElement>('[data-ilg-section-path]');
      if(!ref&&section?.dataset.ilgSectionPath===path){
        const candidates=matching.filter(ref=>ref.offset>=Number(section.dataset.ilgSectionFrom)&&ref.offset<Number(section.dataset.ilgSectionTo));
        if(candidates.length===1)ref=candidates[0];
        else if(candidates.length>1){
          const duplicates=Array.from(section.querySelectorAll<HTMLImageElement>('img')).filter(item=>!item.closest('.ilg-host')&&this.imageUrl(item.currentSrc||item.src,item.ownerDocument)===this.imageUrl(image.currentSrc||image.src,image.ownerDocument));
          if(duplicates.length===candidates.length)ref=candidates[duplicates.indexOf(image)];
        }
      }
      if(!ref&&view.getMode()==='source'){
        try{
          const cm=(view.editor as unknown as {cm:EditorView}).cm;
          const pos=cm.posAtDOM(image);const from=source.lastIndexOf('\n',Math.max(0,pos-1))+1;const end=source.indexOf('\n',pos);const to=end<0?source.length:end;
          ref=matching.find(ref=>ref.offset<=pos&&ref.offset+ref.raw.length>=pos)??matching.find(ref=>ref.offset>=from&&ref.offset<=to);
        }catch{}
      }
      if(!ref&&matching.length===1)ref=matching[0];if(!ref)return;
      group=parsed.groups.find(group=>ref!.offset>=group.bodyFrom&&ref!.offset<group.bodyTo);
      if(!group)return{grouped:false,layout:()=>void this.chooseImageGroup(view,path,source,ref!.offset,image).catch(error=>{console.error('Image Layouts Enhanced',error);new Notice('图片布局打开遇到问题，请重试');})};
    }
    const selected=group;
    const guarded=(action:()=>void)=>void this.sameSource(view,path,source).then(valid=>{if(valid)action();});
    return{grouped:true,
      layout:()=>guarded(()=>new LayoutPicker(this.app,this.images({...selected,options:getEffectiveOptions(selected,path,this.groupSettings)},path,source).length,patch=>void this.sameSource(view,path,source).then(valid=>valid?this.editFile(path,selected,patch):undefined).catch(()=>{}),image,getEffectiveOptions(selected,path,this.groupSettings)).open()),
      configure:()=>guarded(()=>new GalleryConfiguration(image,getEffectiveOptions(selected,path,this.groupSettings),patch=>this.editFile(path,selected,patch)).open()),
    };
  }
  private async sameSource(view:MarkdownView,path:string,source:string){
    const attached=this.app.workspace.getLeavesOfType('markdown').some(leaf=>leaf.view===view);
    const current=attached&&view.file?.path===path?(view.getMode()==='source'?view.editor.getValue():await this.app.vault.cachedRead(view.file)):undefined;
    if(current!==source){new Notice('笔记内容已更新，请在当前图片上重新打开布局');return false;}return true;
  }
  private async chooseImageGroup(view:MarkdownView,path:string,source:string,offset:number,anchorEl?:HTMLElement){
    if(!await this.sameSource(view,path,source))return;
    const parsed=this.parsed(source,path),refs=parsed.refs;
    const anchor=refs.findIndex(ref=>ref.offset===offset);if(anchor<0)return;
    const inside=(index:number)=>parsed.groups.some(group=>refs[index].offset>=group.from&&refs[index].offset<group.to);
    const separated=(first:number,last:number)=>{
      const between=source.slice(refs[first].offset+refs[first].raw.length,refs[last].offset);
      return /^ {0,3}#{1,6}\s/m.test(between)||between.split('\n').filter(line=>line.trim()).length>12;
    };
    let first=anchor,last=anchor;
    while(first>0&&anchor-first<10&&!inside(first-1)&&!separated(first-1,first))first--;
    while(last<refs.length-1&&last-anchor<10&&!inside(last+1)&&!separated(last,last+1))last++;
    const nearby=refs.slice(first,last+1);
    const images=nearby.map(ref=>{
      const src=this.sourceForTarget(ref.target,path);
      const alt=ref.kind==='wiki'?ref.alt.split('|').filter(part=>!/^\d+(?:x\d+)?$/.test(part.trim())).join('|'):ref.alt;
      return{src,alt:alt||ref.target.split('/').pop()||'',target:ref.target,line:ref.line,sourceOffset:ref.offset,missing:!src};
    });
    new GalleryGroupPicker(this.app,images,anchor-first,(start,end)=>new LayoutPicker(this.app,end-start+1,patch=>void(async()=>{
      if(!await this.sameSource(view,path,source))return;
      const options=normalizeOptions({...this.settings,id:shortId(),...patch});
      let to=nearby[end].offset+nearby[end].raw.length;
      if(source.startsWith('\r\n',to))to+=2;else if(source[to]==='\n')to++;
      const edit=wrapSelection(source,nearby[start].offset,to,{id:options.id,layout:options.layout});
      if(!edit){new Notice('请在完整图片段落中选择相邻图片');return;}
      await this.storeConfigurations({[groupKey(path,options.id)]:getStoredOptions(options)});
      if(!await this.sameSource(view,path,source))return;
      if(view.getMode()==='source'){
        this.applyEditor(view.editor,edit);view.editor.setCursor(view.editor.offsetToPos(edit.from+edit.insert.length));
      }else{
        const file=view.file!;let changed=false;
        await this.app.vault.process(file,current=>{if(current!==source)return current;changed=true;return current.slice(0,edit.from)+edit.insert+current.slice(edit.to);});
        if(!changed){new Notice('笔记内容已更新，请重新选择图片');return;}
      }
      this.refreshConfiguration(path);
    })().catch(error=>{console.error('Image Layouts Enhanced',error);new Notice('图片布局保存遇到问题，请重试');}),anchorEl,this.settings).open(),anchorEl).open();
  }
  async persistSettings():Promise<void>{
    const snapshot={...this.settings,groupSettings:JSON.parse(JSON.stringify(this.groupSettings)) as GroupSettings};
    const write=this.storageQueue.catch(()=>{}).then(()=>this.saveData(snapshot));this.storageQueue=write;
    try{await write;}catch(error){console.error('Image Layouts Enhanced: configuration write',error);new Notice('画廊配置保存遇到问题，请稍后重试');throw error;}
  }
  private async storeConfigurations(changes:GroupSettings){
    const before=this.groupSettings;const next={...before,...changes};this.groupSettings=next;
    try{await this.persistSettings();}catch(error){if(this.groupSettings===next)this.groupSettings=before;throw error;}
  }
  private pathForEditor(editor:Editor):string|null{
    const view=this.app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).find(view=>view instanceof MarkdownView&&view.editor===editor) as MarkdownView|undefined;
    return view?.file?.path??null;
  }
  private refreshConfiguration(path:string){
    this.configurationRevision++;
    for(const leaf of this.app.workspace.getLeavesOfType('markdown')){
      const view=leaf.view;if(!(view instanceof MarkdownView)||view.file?.path!==path)continue;
      try{
        if(view.getMode()==='source'){
          const cm=(view.editor as unknown as {cm?:{dispatch:(transaction:Record<string,unknown>)=>void}}).cm;cm?.dispatch({});
        }else(view as unknown as {previewMode?:{rerender?:(force:boolean)=>void}}).previewMode?.rerender?.(true);
      }catch(error){console.warn('Image Layouts Enhanced: configuration refresh',error);}
    }
  }
  private async insertTemplate(editor:Editor){
    const path=this.pathForEditor(editor);if(!path){new Notice('请在笔记编辑器中插入图片组');return;}
    const source=editor.getValue(),at=editor.posToOffset(editor.getCursor('to'));
    const options=normalizeOptions({...this.settings,id:shortId(),layout:'filmstrip'});
    const eol=source.includes('\r\n')?'\r\n':'\n';const prefix=at>0&&source[at-1]!=='\n'?eol:'';
    const template=`${prefix}${serializeOpen({id:options.id,layout:options.layout})}${eol}${eol}![[图片1.png]]${eol}${eol}![[图片2.png]]${eol}${eol}<!-- /image-layouts -->${eol}`;
    if(!parseGroups(source.slice(0,at)+template+source.slice(at)).some(group=>group.options.id===options.id)){new Notice('请在图片组和代码区域之外插入模板');return;}
    await this.storeConfigurations({[groupKey(path,options.id)]:getStoredOptions(options)});
    if(editor.getValue()!==source||this.pathForEditor(editor)!==path){new Notice('配置已保存，笔记内容已更新，请重新插入图片组');return;}
    editor.replaceRange(template,editor.offsetToPos(at));this.refreshConfiguration(path);
  }
  private async compact(editor:Editor){
    const path=this.pathForEditor(editor);if(!path){new Notice('请在笔记编辑器中精简图片组标记');return;}
    const source=editor.getValue();const groups=parseGroups(source);const changes:GroupSettings={};const edits:Edit[]=[];const used=new Set<string>();
    for(const group of groups){
      const effective=getEffectiveOptions(group,path,this.groupSettings);
      const id=effective.id&&!used.has(effective.id)?effective.id:shortId();used.add(id);
      const options={...effective,id};changes[groupKey(path,id)]=getStoredOptions(options);
      const edit=minimalHeaderEdit(source,group,options);if(edit&&source.slice(edit.from,edit.to)!==edit.insert)edits.push(edit);
    }
    if(!groups.length){new Notice('当前笔记包含 0 个图片组');return;}
    await this.storeConfigurations(changes);
    if(editor.getValue()!==source||this.pathForEditor(editor)!==path){new Notice('配置已保存，笔记内容已更新，请重新精简标记');return;}
    // Reverse order keeps all earlier source ranges and body bytes unchanged.
    for(const edit of edits.reverse())this.applyEditor(editor,edit);
    this.refreshConfiguration(path);new Notice(`已迁移 ${groups.length} 个图片组配置，精简 ${edits.length} 个标记`);
  }
  private insert(editor:Editor){
    const source=editor.getValue(),from=editor.posToOffset(editor.getCursor('from')),to=editor.posToOffset(editor.getCursor('to'));
    if(!extractImages(source).some(ref=>ref.offset>=from&&ref.offset+ref.raw.length<=to)){new Notice('选中需要组合的图片引用，再执行此命令');return;}
    const path=this.pathForEditor(editor);if(!path){new Notice('请在笔记编辑器中创建图片组');return;}
    new LayoutPicker(this.app,extractImages(source).filter(ref=>ref.offset>=from&&ref.offset+ref.raw.length<=to).length,patch=>void(async()=>{
      if(editor.getValue()!==source||this.pathForEditor(editor)!==path){new Notice('选区已更新，请重新选择图片');return;}
      const options=normalizeOptions({...this.settings,...patch,id:shortId()});
      const edit=wrapSelection(source,from,to,{id:options.id,layout:options.layout});
      if(!edit){new Notice('请选择完整的图片段落，或在现有图片组中切换布局');return;}
      await this.storeConfigurations({[groupKey(path,options.id)]:getStoredOptions(options)});
      if(editor.getValue()!==source||this.pathForEditor(editor)!==path){new Notice('配置已保存，选区已更新，请重新选择图片');return;}
      this.applyEditor(editor,edit);
      const anchor=Math.min(edit.from+edit.insert.length,editor.getValue().length);editor.setCursor(editor.offsetToPos(anchor));this.refreshConfiguration(path);
    })().catch(()=>{})).open();
  }
  private applyEditor(editor:Editor,edit:Edit|null){
    if(!edit){new Notice('图片组已更新，请在当前内容上操作');return;}
    editor.replaceRange(edit.insert,editor.offsetToPos(edit.from),editor.offsetToPos(edit.to));
  }
  private async editFile(path:string,group:GalleryGroup,patch:Partial<GalleryOptions>|'unwrap'){
    const file=this.app.vault.getAbstractFileByPath(path);if(!(file instanceof TFile))throw Error('笔记位置已更新，请重新打开设置');
    const view=this.app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).find(view=>view instanceof MarkdownView&&view.file?.path===path&&view.getMode()==='source') as MarkdownView|undefined;
    const source=view?view.editor.getValue():await this.app.vault.cachedRead(file);
    const parsed=parseGroups(source),current=resolveGallerySourceTarget(source,group)?.group;
    if(!current)throw Error('图片组已更新，请在当前画廊上重新打开设置');
    let edit:Edit|null;
    if(patch==='unwrap')edit=current.kind==='comment'?unwrapGroup(source,current):editLegacyGroup(source,current,'unwrap');
    else{
      const effective=getEffectiveOptions(current,path,this.groupSettings);
      const duplicate=current.kind==='comment'&&parsed.filter(item=>item.options.id===current!.options.id).length>1;
      const id=effective.id&&!duplicate?effective.id:shortId();
      const options=normalizeOptions({...effective,...patch,id});
      await this.storeConfigurations({[groupKey(path,id)]:getStoredOptions(options)});
      edit=current.kind==='comment'?minimalHeaderEdit(source,current,options):editLegacyGroup(source,current,options,true);
    }
    if(!edit)throw Error('图片组已更新，请在当前画廊上重新打开设置');
    try{
      if(view){if(!this.app.workspace.getLeavesOfType('markdown').some(leaf=>leaf.view===view)||view.getMode()!=='source'||view.editor.getValue()!==source||view.file?.path!==path)throw Error('配置已保存，笔记视图已更新，请重新打开设置');this.applyEditor(view.editor,edit);}
      else{
        let changed=false;
        await this.app.vault.process(file,currentSource=>{if(currentSource!==source||file.path!==path||this.app.workspace.getLeavesOfType('markdown').some(leaf=>leaf.view instanceof MarkdownView&&leaf.view.file?.path===path&&leaf.view.getMode()==='source'))return currentSource;changed=true;return currentSource.slice(0,edit!.from)+edit!.insert+currentSource.slice(edit!.to);});
        if(!changed)throw Error('配置已保存，笔记内容已更新，请重新打开设置');
      }
    }catch(error){console.error('Image Layouts Enhanced: source write',error);new Notice('图片组更新遇到问题，请稍后重试');throw error;}
    this.refreshConfiguration(path);
  }
  private async referenceSnapshot(path:string,origin?:HTMLElement){
    const file=this.app.vault.getAbstractFileByPath(path);if(!(file instanceof TFile))throw Error('笔记位置已更新，请重新打开引用');
    const views=this.app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).filter((view):view is MarkdownView=>view instanceof MarkdownView&&view.file?.path===path);
    const originView=views.find(view=>origin&&view.containerEl.contains(origin));
    let editorView=originView?.getMode()==='source'?originView:views.find(view=>view.getMode()==='source');
    if(editorView)return{file,editorView,source:editorView.editor.getValue()};
    const source=await this.app.vault.cachedRead(file);
    editorView=this.app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).find((view):view is MarkdownView=>view instanceof MarkdownView&&view.file?.path===path&&view.getMode()==='source');
    return{file,editorView,source:editorView?editorView.editor.getValue():source};
  }
  private async editReferences(path:string,group:GalleryGroup,origin:HTMLElement,anchor?:HTMLElement){
    const before=await this.referenceSnapshot(path,origin),target=resolveGallerySourceTarget(before.source,group);
    if(!target){new Notice('图片组已更新，请在当前画廊上重新打开引用');return;}
    const snapshot=target.group,expectedBody=snapshot.body;
    const occurrence=parseGroups(before.source).filter(item=>item.options.id===snapshot.options.id).findIndex(item=>item.from===snapshot.from);
    new ReferenceEditor(anchor??origin,expectedBody,async replacement=>{
      const current=await this.referenceSnapshot(path,origin);
      const resolved=resolveGallerySourceTarget(current.source,snapshot);
      if(!resolved)throw Error('图片组已更新，请重新打开编辑');
      if(resolved.group.body!==expectedBody)throw Error('这组内容已在其他窗口更新，请重新打开编辑');
      const edit=buildReferenceBodyEdit(current.source,snapshot,expectedBody,replacement);
      if(!edit)throw Error('引用内容会改变图片组边界，请检查 Markdown 标记');
      if(current.source.slice(edit.from,edit.to)===edit.insert)return;
      if(current.editorView){
        const attached=this.app.workspace.getLeavesOfType('markdown').some(leaf=>leaf.view===current.editorView);
        if(!attached||current.editorView.file?.path!==path||current.editorView.editor.getValue()!==current.source)throw Error('笔记内容已更新，请重新保存');
        this.applyEditor(current.editorView.editor,edit);
      }else{
        let changed=false;
        await this.app.vault.process(current.file,source=>{
          if(this.app.workspace.getLeavesOfType('markdown').some(leaf=>leaf.view instanceof MarkdownView&&leaf.view.file?.path===path&&leaf.view.getMode()==='source'))return source;
          const patch=buildReferenceBodyEdit(source,snapshot,expectedBody,replacement);
          if(!patch||current.file.path!==path)return source;
          changed=true;return source.slice(0,patch.from)+patch.insert+source.slice(patch.to);
        });
        if(!changed)throw Error('这组内容已在其他窗口更新，请重新打开编辑');
      }
      this.refreshConfiguration(path);
    },{draftKey:JSON.stringify([path,snapshot.options.id||snapshot.from,occurrence])}).open();
  }
  images(group:GalleryGroup,path:string,source:string):GalleryImage[]{
    const refs=this.parsed(source,path).refs.filter(ref=>ref.offset>=group.bodyFrom&&ref.offset<group.bodyTo);
    // Legacy fences are masked by the full-document image scanner.
    const extracted=group.kind==='fence'?extractImages(group.body).map(ref=>({...ref,offset:ref.offset+group.bodyFrom,line:ref.line+source.slice(0,group.bodyFrom).split('\n').length-1})):refs;
    const resolve=(target:string)=>{
      if(/^https?:\/\/|^data:image\//i.test(target))return target;
      let decoded=target;try{decoded=decodeURIComponent(target);}catch{}
      const file=this.app.metadataCache.getFirstLinkpathDest(decoded.split('#')[0],path);return file?this.app.vault.getResourcePath(file):'';
    };
    const images=extracted.map((ref,index)=>{
      const alt=ref.kind==='wiki'?ref.alt.split('|').filter(part=>!/^\d+(?:x\d+)?$/.test(part.trim())).join('|'):ref.alt;
      const src=resolve(ref.target);return{src,target:ref.target,alt:group.options.descriptions[index]??alt,line:ref.line,sourceOffset:ref.offset,missing:!src};
    });
    if(group.options.fromFolder){
      const folder=group.options.fromFolder.replace(/^\/+|\/+$/g,'');
      let files=this.app.vault.getFiles().filter(file=>file.parent?.path===folder&&/^(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(file.extension));
      files.sort((a,b)=>group.options.sortBy==='mtime'?a.stat.mtime-b.stat.mtime:a.name.localeCompare(b.name));
      if(group.options.reverse)files.reverse();if(group.options.limit>0)files=files.slice(0,group.options.limit);
      images.push(...files.map(file=>({src:this.app.vault.getResourcePath(file),target:file.path,alt:file.basename,line:group.startLine,sourceOffset:group.bodyFrom,missing:false})));
    }
    return images;
  }
  getSourceImageNavigationLine(source:string,offset:number):number|null {
    return parseGroups(source).find(group=>offset>=group.bodyFrom&&offset<group.bodyTo)?.startLine??null;
  }
  revealSourceImage(path:string,offset:number,container:HTMLElement):HTMLElement|null {
    for(const host of Array.from(container.querySelectorAll<HTMLElement>('.ilg-host'))){
      const mounted=this.navigationRenderers.get(host);if(!mounted||mounted.path!==path)continue;
      const index=mounted.images.findIndex(image=>image.sourceOffset===offset);
      if(index>=0)return mounted.renderer.revealImage(index);
    }
    return null;
  }
  mount(host:HTMLElement,group:GalleryGroup,path:string,source:string,component:MarkdownRenderChild):GalleryRenderer{
    this.hostGroups.set(host,{group,path,source});
    const effective={...group,options:getEffectiveOptions(group,path,this.groupSettings)};
    const images=this.images(effective,path,source);
    const siblings=this.parsed(source,path).groups.filter(item=>item.options.id===group.options.id);
    const occurrence=siblings.findIndex(item=>item.from===group.from);
    const selectionKey=`${path}:${group.options.id||group.from}:${occurrence}`;
    host.dataset.ilgGroupId=group.options.id;host.dataset.ilgLayout=group.options.layout;
    const renderer=new GalleryRenderer(host,images,effective.options,{
      open:(index,origin)=>{const result=openGalleryImage(this.app,images,index,origin,path);this.diagnostics[result]++;},
      change:patch=>void this.editFile(path,group,patch).catch(()=>this.refreshConfiguration(path)),
      edit:anchor=>void this.editReferences(path,group,host,anchor).catch(error=>{console.error('Image Layouts Enhanced: edit references',error);new Notice('图片引用打开遇到问题，请重试');}),unwrap:()=>void this.editFile(path,group,'unwrap').catch(()=>{}),
      pickLayout:anchor=>new LayoutPicker(this.app,images.length,patch=>void this.editFile(path,group,patch).catch(()=>this.refreshConfiguration(path)),anchor,effective.options).open(),
      configure:anchor=>new GalleryConfiguration(anchor??host,effective.options,patch=>this.editFile(path,group,patch)).open(),
      initialIndex:this.selectedImages.get(selectionKey)??0,
      select:index=>{if(this.selectedImages.size>512)this.selectedImages.delete(this.selectedImages.keys().next().value!);this.selectedImages.set(selectionKey,index);},
    });
    this.navigationRenderers.set(host,{path,images,renderer});
    const bodyRefs=this.parsed(source,path).refs.filter(ref=>ref.offset>=group.bodyFrom&&ref.offset<group.bodyTo).map(ref=>({...ref,offset:ref.offset-group.bodyFrom}));
    const supplemental=getSupplementalMarkdown(group.body,group.kind==='comment'?bodyRefs:undefined);
    if(supplemental.trim()){
      const body=host.createDiv('ilg-supplemental');void MarkdownRenderer.render(this.app,supplemental,body,path,component);
    }
    if(host.classList.contains('ilg-live'))this.diagnostics.live++;
    return renderer;
  }
  private async reading(el:HTMLElement,ctx:MarkdownPostProcessorContext){
    if(el.closest('.ilg-host'))return;
    const info=ctx.getSectionInfo(el);if(!info)return;
    const file=this.app.vault.getAbstractFileByPath(ctx.sourcePath);if(!(file instanceof TFile))return;
    const source=info.text;
    if(!source.includes('image-layouts:'))return;
    const groups=this.parsed(source,ctx.sourcePath).groups;if(!groups.length)return;
    for(const group of groups){
      if(info.lineStart<group.startLine||info.lineEnd>group.endLine)continue;
      // Obsidian processes each detached source section before mounting it. The
      // opening comment is its own section and serves as the stable group anchor.
      if(info.lineStart===group.startLine){
        this.anchorChildren.get(el)?.unload();
        const host=el.createDiv('ilg-host ilg-reading');
        const child=new GalleryChild(host,this,group,ctx.sourcePath,source);this.anchorChildren.set(el,child);
        child.register(()=>{if(this.anchorChildren.get(el)===child)this.anchorChildren.delete(el);});
        this.trackReading(child,ctx);this.diagnostics.reading++;continue;
      }
      const state=this.hiddenSections.get(el)??{display:el.style.display,count:0};state.count++;this.hiddenSections.set(el,state);el.style.display='none';
      const hidden=new MarkdownRenderChild(el);hidden.register(()=>{state.count--;if(state.count===0){el.style.display=state.display;this.hiddenSections.delete(el);}});this.trackReading(hidden,ctx);
    }
  }
  private async legacy(body:string,el:HTMLElement,ctx:MarkdownPostProcessorContext,suffix:string){
    let values:Record<string,unknown>={};let imagesBody=body;
    const meta=/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/.exec(body);
    if(meta){try{values=parseYaml(meta[1])??{};imagesBody=body.slice(meta[0].length);}catch{el.setText('布局配置需要有效的 YAML');return;}}
    const aligned=['left','center','right'].includes(suffix);
    const options=normalizeOptions({...values,layout:aligned?'single':suffix||values.layout||this.settings.layout,...aligned?{align:suffix,width:values.width??'50%'}:{}});
    const info=ctx.getSectionInfo(el);
    const file=this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    // Section text is the current editor snapshot, including edits awaiting disk save.
    // A file read is only the display fallback for contexts with no writable range.
    const source=info?.text??(file instanceof TFile?await this.app.vault.cachedRead(file):body);
    const from=info?lineOffset(source,info.lineStart):-1;
    const to=info?lineOffset(source,info.lineEnd+1):-1;
    const bodyFrom=source.indexOf(imagesBody,from);
    const group:GalleryGroup={from,to,bodyFrom:bodyFrom>=0?bodyFrom:0,bodyTo:(bodyFrom>=0?bodyFrom:0)+imagesBody.length,startLine:info?.lineStart??0,endLine:info?.lineEnd??0,body:imagesBody,raw:from>=0?source.slice(from,to):'',options,kind:'fence'};
    const host=el.createDiv('ilg-host ilg-legacy');this.trackReading(new GalleryChild(host,this,group,ctx.sourcePath,source),ctx);
  }
}

class GallerySettings extends PluginSettingTab {
  constructor(app:App,private plugin:ImageLayoutsEnhanced){super(app,plugin);}
  display(){
    this.containerEl.empty();this.containerEl.createEl('h2',{text:'图片画廊'});
    this.containerEl.createEl('p',{text:'选中图片引用，执行“将选中图片组成画廊”。每个图片组保存自己的布局，放大查看优先联动 Image Toolkit。'});
    new Setting(this.containerEl).setName('新图片组默认布局').addDropdown(dropdown=>{for(const [id,label]of Object.entries(LAYOUT_LABELS))dropdown.addOption(id,label);dropdown.setValue(this.plugin.settings.layout).onChange(async value=>{this.plugin.settings.layout=value as Layout;await this.plugin.persistSettings().catch(()=>{});});});
    new Setting(this.containerEl).setName('图片显示方式').setDesc('完整显示适合科研图；填满区域适合照片拼图。').addDropdown(dropdown=>dropdown.addOptions({contain:'完整等比显示',cover:'填满区域',natural:'原始比例'}).setValue(this.plugin.settings.fit).onChange(async value=>{this.plugin.settings.fit=value as GalleryOptions['fit'];await this.plugin.persistSettings().catch(()=>{});}));
    new Setting(this.containerEl).setName('画廊高度').addSlider(slider=>slider.setLimits(180,640,20).setValue(this.plugin.settings.height).setDynamicTooltip().onChange(async value=>{this.plugin.settings.height=value;await this.plugin.persistSettings().catch(()=>{});}));
  }
}
