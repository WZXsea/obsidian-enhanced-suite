import { AnchoredPopover } from './popover';
import { parseCustomGrid } from './model';
import type { Fit, GalleryOptions } from './types';

const fitLabels: Record<Fit, string> = { contain: '完整', cover: '填满', natural: '原始' };
const fitTitles: Record<Fit, string> = { contain: '完整等比显示', cover: '填满图片区域', natural: '保持原始比例' };
const fields = ['fit', 'height', 'gap', 'radius', 'caption', 'thumbnails', 'overlay', 'align', 'width', 'grid'] as const;
let configurationSequence = 0;

/** Only fields actually changed by this panel are merged into the latest group settings. */
export function getConfigurationPatch(original: GalleryOptions, values: GalleryOptions): Partial<GalleryOptions> {
  return Object.fromEntries(fields.filter(key => original[key] !== values[key]).map(key => [key, values[key]]));
}

/** Compact gallery controls anchored to the existing settings button. */
export class GalleryConfiguration {
  private readonly popover: AnchoredPopover;
  private readonly original: GalleryOptions;
  private readonly values: GalleryOptions;
  private readonly doc: Document;
  private readonly status: HTMLSpanElement;
  private readonly saveButton: HTMLButtonElement;
  private readonly cancelButton: HTMLButtonElement;
  private readonly controls: Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement> = [];
  private readonly fitButtons: HTMLButtonElement[] = [];
  private readonly id = ++configurationSequence;
  private composing = false;
  private saving = false;
  private opened = false;
  private closed = false;

  constructor(private readonly anchor: HTMLElement, options: GalleryOptions,
    private readonly save: (patch: Partial<GalleryOptions>) => Promise<void>) {
    this.original = { ...options, descriptions: [...options.descriptions] };
    this.values = { ...this.original, descriptions: [...this.original.descriptions] };
    this.popover = new AnchoredPopover(anchor, '画廊设置', () => { this.closed = true; });
    this.popover.el.classList.add('ilg-configuration');
    this.doc = this.popover.el.ownerDocument;
    const heading = this.create('div', this.popover.contentEl, 'ilg-config-heading', '画廊设置');
    heading.setAttribute('role', 'heading');
    heading.setAttribute('aria-level', '3');

    const fitRow = this.create('div', this.popover.contentEl, 'ilg-config-fit-row');
    this.create('span', fitRow, 'ilg-config-label', '适配');
    const fitGroup = this.create('div', fitRow, 'ilg-config-fit');
    fitGroup.setAttribute('role', 'group');fitGroup.setAttribute('aria-label', '图片显示方式');
    for (const fit of ['contain', 'cover', 'natural'] as const) {
      const button = this.create('button', fitGroup, 'ilg-config-fit-button', fitLabels[fit]);
      button.type = 'button';button.dataset.fit = fit;button.title = fitTitles[fit];button.setAttribute('aria-label', fitTitles[fit]);
      this.fitButtons.push(button);this.controls.push(button);
      this.popover.listen(button, 'click', event => {
        event.stopPropagation();if(this.saving)return;
        this.values.fit = fit;this.updateFit();this.clearError();
      });
    }
    this.updateFit();
    this.slider('height', '高度', 120, 1200);
    this.slider('gap', '间距', 0, 64);
    this.slider('radius', '圆角', 0, 48);

    const captionField = this.create('div', this.popover.contentEl, 'ilg-config-field ilg-config-caption-field');
    const caption = this.create('textarea', captionField, 'ilg-config-caption');
    caption.dataset.field='caption';
    this.label(captionField, caption, '整组图注', true);
    caption.rows=2;caption.value=this.values.caption;caption.placeholder='为这组图片添加图注';caption.spellcheck=false;caption.dataset.field='caption';
    this.controls.push(caption);
    this.popover.listen(caption, 'input', () => { this.values.caption=caption.value;this.clearError(); });
    this.popover.listen(caption, 'contextmenu', event => event.stopPropagation());

    const thumbLabel = this.create('label', this.popover.contentEl, 'ilg-config-toggle-row');
    this.create('span', thumbLabel, 'ilg-config-label', '缩略图');
    const thumbnails = this.create('input', thumbLabel, 'ilg-config-toggle');
    thumbnails.type='checkbox';thumbnails.checked=this.values.thumbnails;thumbnails.dataset.field='thumbnails';
    thumbnails.setAttribute('role','switch');thumbnails.setAttribute('aria-label','显示缩略图');this.controls.push(thumbnails);
    this.popover.listen(thumbnails,'change',()=>{this.values.thumbnails=thumbnails.checked;this.clearError();});

    const advanced = this.create('details', this.popover.contentEl, 'ilg-config-advanced');
    const summary = this.create('summary', advanced, 'ilg-config-advanced-summary', '高级设置');
    summary.title='图片说明、对齐与宽度';
    const advancedBody=this.create('div',advanced,'ilg-config-advanced-body');
    const paired=this.create('div',advancedBody,'ilg-config-paired');
    this.dropdown(paired,'overlay','图片说明',{never:'图片下方',hover:'悬停叠加',always:'始终叠加'});
    this.dropdown(paired,'align','对齐',{full:'占满宽度',left:'左对齐',center:'居中',right:'右对齐'});
    const widthField=this.create('div',advancedBody,'ilg-config-field');
    const width=this.create('input',widthField,'ilg-config-width');
    width.dataset.field='width';
    this.label(widthField,width,'画廊宽度',true);
    width.type='text';width.value=this.values.width;width.placeholder='70% 或 480px';width.dataset.field='width';this.controls.push(width);
    this.popover.listen(width,'input',()=>{this.values.width=width.value;this.clearError();});
    if(this.values.layout==='custom'){
      const gridField=this.create('div',advancedBody,'ilg-config-field');
      const grid=this.create('textarea',gridField,'ilg-config-custom-grid');
      grid.dataset.field='grid';
      this.label(gridField,grid,'自定义网格',true);
      grid.rows=3;grid.value=this.values.grid;grid.spellcheck=false;grid.dataset.field='grid';grid.placeholder='AA\nBC';
      this.controls.push(grid);
      this.popover.listen(grid,'input',()=>{this.values.grid=grid.value;this.clearError();});
      this.popover.listen(grid,'contextmenu',event=>event.stopPropagation());
    }

    const footer=this.create('div',this.popover.contentEl,'ilg-config-footer');
    this.status=this.create('span',footer,'ilg-config-status');this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');
    this.cancelButton=this.create('button',footer,'ilg-config-cancel','取消');this.cancelButton.type='button';
    this.saveButton=this.create('button',footer,'ilg-config-save mod-cta','保存');this.saveButton.type='button';this.saveButton.title='保存（⌘ / Ctrl + Enter）';
    this.popover.listen(this.cancelButton,'click',event=>{event.stopPropagation();if(!this.saving)this.close();});
    this.popover.listen(this.saveButton,'click',event=>{event.stopPropagation();void this.submit();});

    // The owner window runs before Obsidian's document hotkeys, including popout fields.
    const shortcut:EventListener=event=>{
      const key=event as KeyboardEvent;
      if(!this.containsEvent(event))return;
      if(key.key==='Escape'){
        event.stopImmediatePropagation();
        if(this.isComposing(key))return;
        event.preventDefault();if(!this.saving)this.close();
      }else if(key.key==='Enter'&&(key.ctrlKey||key.metaKey)){
        event.stopImmediatePropagation();
        if(this.isComposing(key))return;
        event.preventDefault();void this.submit();
      }
    };
    if(this.doc.defaultView)this.popover.listen(this.doc.defaultView,'keydown',shortcut,true);
    this.popover.listen(this.doc,'keydown',shortcut,true);
    this.popover.listen(this.popover.el,'keydown',event=>{
      event.stopPropagation();const key=event as KeyboardEvent;
      if(key.key==='Enter'&&(key.ctrlKey||key.metaKey)&&!this.isComposing(key)){event.preventDefault();void this.submit();}
    });
    this.popover.listen(this.popover.el,'compositionstart',event=>{this.composing=true;event.stopPropagation();});
    this.popover.listen(this.popover.el,'compositionend',event=>{this.composing=false;event.stopPropagation();});
    for(const event of ['keyup','beforeinput','input','compositionupdate','paste','cut','copy'])this.popover.listen(this.popover.el,event,event=>event.stopPropagation());
  }

  get el(): HTMLDivElement { return this.popover.el; }
  get contentEl(): HTMLDivElement { return this.popover.contentEl; }

  open(): void {
    if(this.opened||this.closed)return;
    if(!this.anchor.isConnected){this.close();return;}
    this.opened=true;this.popover.open();
    if(!this.closed)this.fitButtons.find(button=>button.dataset.fit===this.values.fit)?.focus({preventScroll:true});
  }
  close(): void { if(this.closed)return;this.closed=true;this.popover.close(); }

  private create<K extends keyof HTMLElementTagNameMap>(tag:K,parent:HTMLElement,className:string,text=''):HTMLElementTagNameMap[K]{
    const element=this.doc.createElement(tag);element.className=className;element.textContent=text;parent.appendChild(element);return element;
  }
  private label(parent:HTMLElement,control:HTMLElement,name:string,prepend=false):void{
    const label=this.doc.createElement('label');label.className='ilg-config-label';label.textContent=name;
    control.id=`ilg-config-${this.id}-${control.dataset.field??parent.className.replace(/\W+/g,'-')}`;
    label.htmlFor=control.id;
    if(prepend)parent.insertBefore(label,control);else parent.appendChild(label);
  }
  private slider(key:'height'|'gap'|'radius',name:string,min:number,max:number):void{
    const field=this.create('div',this.popover.contentEl,'ilg-config-field ilg-config-slider-field');
    const header=this.create('div',field,'ilg-config-slider-header');
    const input=this.create('input',field,'ilg-config-range');input.type='range';input.min=String(min);input.max=String(max);input.step='1';input.value=String(this.values[key]);input.dataset.field=key;
    this.label(header,input,name);this.controls.push(input);
    const value=this.create('span',header,'ilg-config-value');value.setAttribute('aria-hidden','true');
    const update=()=>{
      value.textContent=`${this.values[key]} px`;input.setAttribute('aria-valuetext',value.textContent);
      input.style.setProperty('--ilg-config-progress',`${Math.max(0,Math.min(100,(this.values[key]-min)/(max-min)*100))}%`);
    };update();
    this.popover.listen(input,'input',()=>{const next=Number(input.value);if(Number.isFinite(next)){this.values[key]=Math.round(Math.max(min,Math.min(max,next)));update();this.clearError();}});
    this.popover.listen(input,'pointerdown',()=>field.classList.add('is-adjusting'));
    this.popover.listen(this.doc,'pointerup',()=>field.classList.remove('is-adjusting'),true);
    this.popover.listen(input,'pointercancel',()=>field.classList.remove('is-adjusting'));
  }
  private dropdown<K extends 'overlay'|'align'>(parent:HTMLElement,key:K,name:string,options:Record<GalleryOptions[K],string>):void{
    const field=this.create('div',parent,'ilg-config-field');const select=this.create('select',field,'ilg-config-select');select.dataset.field=key;
    this.label(field,select,name,true);
    Object.entries(options).forEach(([value,label])=>{const option=this.create('option',select,'',String(label));option.value=value;});
    select.value=this.values[key];this.controls.push(select);
    this.popover.listen(select,'change',()=>{this.values[key]=select.value as GalleryOptions[K];this.clearError();});
  }
  private updateFit():void{
    this.fitButtons.forEach(button=>{const selected=button.dataset.fit===this.values.fit;button.classList.toggle('is-selected',selected);button.setAttribute('aria-pressed',String(selected));});
  }
  private containsEvent(event:Event):boolean{return event.composedPath().includes(this.popover.el)||Boolean(event.target&&this.popover.el.contains(event.target as Node));}
  private isComposing(event:KeyboardEvent):boolean{return this.composing||event.isComposing||event.keyCode===229;}
  private clearError():void{if(this.status){this.status.classList.remove('is-error');this.status.textContent='';}}
  private validation():string|undefined{
    if(this.values.width!==this.original.width){
      const match=/^(\d+(?:\.\d+)?)(px|%|rem|em|vw|vh)$/i.exec(this.values.width.trim());
      if(!match||Number(match[1])<=0)return '宽度可填写 70% 或 480px';
      const unit=match[2].toLowerCase(),max=['%','vw','vh'].includes(unit)?100:['rem','em'].includes(unit)?256:4096;
      if(Number(match[1])>max)return `宽度最大为 ${max}${unit}`;
      this.values.width=`${Number(match[1])}${unit}`;
    }
    if(this.values.layout==='custom'&&this.values.grid!==this.original.grid){const parsed=parseCustomGrid(this.values.grid);if('error'in parsed)return parsed.error;}
    return undefined;
  }
  private async submit():Promise<void>{
    if(this.closed||this.saving||this.composing)return;
    const error=this.validation();
    if(error){this.status.textContent=error;this.status.classList.add('is-error');return;}
    const patch=getConfigurationPatch(this.original,this.values);
    if(!Object.keys(patch).length){this.close();return;}
    this.saving=true;this.controls.forEach(control=>control.disabled=true);this.saveButton.disabled=this.cancelButton.disabled=true;
    this.saveButton.textContent='保存中…';this.clearError();
    try{await this.save(patch);this.close();}
    catch(error){if(!this.closed){const reason=error instanceof Error?error.message.slice(0,140):'';this.status.textContent=reason?`保存失败：${reason}`:'保存失败，请重试';this.status.classList.add('is-error');}}
    finally{this.saving=false;if(!this.closed){this.controls.forEach(control=>control.disabled=false);this.saveButton.disabled=this.cancelButton.disabled=false;this.saveButton.textContent='保存';}}
  }
}
