export interface ImagePresentationState {centered:boolean;block:boolean;width?:number;previewing?:boolean}
interface Styles {present:boolean;values:Array<{name:string;value:string;priority:string}>}

/** 本设备的宽度与居中样式仅作用于已解析的正文图片，卸载时恢复原生显示。 */
export class ImagePresentation {
  private readonly images = new Set<HTMLImageElement>();
  private readonly frames = new Set<HTMLElement>();
  private readonly sizedImages = new Map<HTMLImageElement,Styles>();
  private readonly sizedFrames = new Map<HTMLElement,Styles>();
  private readonly observer?: MutationObserver;
  private readonly win: Window | null;
  private frame = 0;
  private destroyed = false;
  private readonly loaded = () => this.refresh();

  constructor(private readonly doc: Document,
    private readonly resolve: (image: HTMLImageElement) => ImagePresentationState | undefined) {
    this.win = doc.defaultView;
    doc.body.classList.add('ilg-local-image-controls');
    const Observer = (this.win as Window & typeof globalThis | null)?.MutationObserver;
    if (Observer) {
      this.observer = new Observer(records => {
        if (records.some(record => {
          if(!record.addedNodes.length&&!record.removedNodes.length)return false;
          const target=record.target as Element;
          if(target.closest?.('.ilg-image-controls,.ilg-image-resize,.ilg-popover,.nis-stage,.nis-viewer,.ilg-viewer'))return false;
          if(target.closest?.('.markdown-preview-view,.markdown-source-view'))return true;
          return [...Array.from(record.addedNodes),...Array.from(record.removedNodes)].some(node=>node.nodeType===1&&
            ((node as Element).matches('img,.markdown-preview-view,.markdown-source-view')||Boolean((node as Element).querySelector('img,.markdown-preview-view,.markdown-source-view'))));
        })) this.refresh();
      });
      this.observer.observe(doc.body, {childList: true, subtree: true});
    }
    doc.addEventListener('load', this.loaded, true);
    this.refresh();
  }

  refresh(): void {
    if (this.destroyed || this.frame) return;
    if (this.win?.requestAnimationFrame) this.frame = this.win.requestAnimationFrame(() => {
      this.frame = 0;
      this.update();
    });
    else this.update();
  }

  private update(): void {
    const images = new Set<HTMLImageElement>();
    const frames = new Set<HTMLElement>();
    const sizedImages = new Set<HTMLImageElement>();
    const sizedFrames = new Set<HTMLElement>();
    for (const image of Array.from(this.doc.querySelectorAll<HTMLImageElement>('.markdown-preview-view img, .markdown-source-view img'))) {
      if (image.closest('.ilg-host,.nis-stage,.nis-viewer,.ilg-viewer,.ilg-popover,.note-cover') ||
        image.classList.contains('cm-widgetBuffer')) continue;
      const state=this.resolve(image);if(!state)continue;
      const frame = image.closest<HTMLElement>('.image-embed');
      if(state.centered){images.add(image);if(frame)frames.add(frame);}
      if(state.previewing){
        if(this.sizedImages.has(image))sizedImages.add(image);
        if(frame&&this.sizedFrames.has(frame))sizedFrames.add(frame);
        continue;
      }
      if(state.width!==undefined){
        sizedImages.add(image);
        if(!this.sizedImages.has(image))this.sizedImages.set(image,this.capture(image,['width','height','max-width','max-height']));
        image.style.setProperty('width',`${state.width}px`,'important');
        image.style.setProperty('height','auto','important');
        image.style.setProperty('max-width','100%','important');
        image.style.setProperty('max-height','none','important');
        if(frame){
          sizedFrames.add(frame);
          if(!this.sizedFrames.has(frame))this.sizedFrames.set(frame,this.capture(frame,['width','height','max-width']));
          frame.style.setProperty('width',state.block?'100%':'auto','important');
          frame.style.setProperty('height','auto','important');
          frame.style.setProperty('max-width','100%','important');
        }
      }
    }
    for(const [image,styles]of this.sizedImages)if(!sizedImages.has(image)){this.restore(image,styles);this.sizedImages.delete(image);}
    for(const [frame,styles]of this.sizedFrames)if(!sizedFrames.has(frame)){this.restore(frame,styles);this.sizedFrames.delete(frame);}
    for (const image of this.images) if (!images.has(image)) {
      image.classList.remove('ilg-note-image');
      delete image.dataset.ilgImageAlign;
    }
    for (const frame of this.frames) if (!frames.has(frame)) frame.classList.remove('ilg-note-image-frame');
    for (const image of images) {
      image.classList.add('ilg-note-image');
      image.dataset.ilgImageAlign = 'center';
    }
    for (const frame of frames) frame.classList.add('ilg-note-image-frame');
    this.images.clear(); images.forEach(image => this.images.add(image));
    this.frames.clear(); frames.forEach(frame => this.frames.add(frame));
  }

  private capture(element:HTMLElement,names:string[]):Styles{
    return{present:element.hasAttribute('style'),values:names.map(name=>({name,value:element.style.getPropertyValue(name),priority:element.style.getPropertyPriority(name)}))};
  }

  private restore(element:HTMLElement,styles:Styles):void{
    for(const item of styles.values){if(item.value)element.style.setProperty(item.name,item.value,item.priority);else element.style.removeProperty(item.name);}
    if(!styles.present&&!element.style.length)element.removeAttribute('style');
  }

  destroy(): void {
    this.destroyed = true;
    this.observer?.disconnect();
    if (this.frame) this.win?.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.doc.removeEventListener('load', this.loaded, true);
    this.doc.body.classList.remove('ilg-local-image-controls');
    for(const [image,styles]of this.sizedImages)this.restore(image,styles);
    for(const [frame,styles]of this.sizedFrames)this.restore(frame,styles);
    this.sizedImages.clear();this.sizedFrames.clear();
    for (const image of this.images) {
      image.classList.remove('ilg-note-image');
      delete image.dataset.ilgImageAlign;
    }
    for (const frame of this.frames) frame.classList.remove('ilg-note-image-frame');
    this.images.clear(); this.frames.clear();
  }
}
