export interface GalleryHeightTarget {from:number;to:number;signature:string}
export interface GalleryHeightEntry extends GalleryHeightTarget {
  width:number;
  height:number;
  sizes:Map<number,number>;
}
interface PositionChanges {mapPos(pos:number,assoc?:number):number}
interface GalleryMetrics {width:number;height:number;sizes:Map<number,number>}
const widthKey=(width:number)=>Math.round(width*2)/2;

/** Each editor field keeps its measured blocks when offscreen DOM is discarded. */
export class GalleryHeightCache {
  entries:GalleryHeightEntry[]=[];
  private path='';
  private viewport={width:0};
  private metrics=new WeakMap<GalleryHeightEntry,GalleryMetrics>();
  get width(){return this.viewport.width;}
  set width(value:number){this.viewport.width=value;}

  fork(path:string,targets:GalleryHeightTarget[],changes?:PositionChanges):GalleryHeightCache {
    const next=new GalleryHeightCache();
    const previous=this.path===path?this.entries:[];
    const available=new Map(previous.map(entry=>[
      JSON.stringify([changes?.mapPos(entry.from,1)??entry.from,changes?.mapPos(entry.to,-1)??entry.to,entry.signature]),entry,
    ]));
    if(this.path===path)next.viewport=this.viewport;
    next.path=path;
    next.entries=targets.map(target=>{
      const key=JSON.stringify([target.from,target.to,target.signature]);
      const previousEntry=available.get(key);available.delete(key);
      const metrics=previousEntry?this.metrics.get(previousEntry)!:{width:0,height:-1,sizes:new Map<number,number>()};
      const entry={...target,get width(){return metrics.width;},get height(){return metrics.height;},get sizes(){return metrics.sizes;}};
      next.metrics.set(entry,metrics);return entry;
    });
    return next;
  }

  reconcile(path:string,targets:GalleryHeightTarget[],changes?:PositionChanges):void {
    const next=this.fork(path,targets,changes);
    this.entries=next.entries;this.path=next.path;this.viewport=next.viewport;this.metrics=next.metrics;
  }

  estimate(entry:GalleryHeightEntry):number {
    return entry.sizes.get(widthKey(this.width))??entry.height;
  }

  record(entry:GalleryHeightEntry,width:number,height:number):boolean {
    if(!this.entries.includes(entry)||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return false;
    const key=widthKey(width),previous=entry.sizes.get(key);
    const changed=this.width!==key||previous===undefined||Math.abs(previous-height)>.1;
    const metrics=this.metrics.get(entry)!;
    this.width=key;metrics.width=width;metrics.height=height;entry.sizes.set(key,height);
    if(entry.sizes.size>4)entry.sizes.delete(entry.sizes.keys().next().value!);
    return changed;
  }
}

interface GalleryMeasureView {
  requestMeasure(request?:{key?:object;read:()=>{width:number;height:number}|undefined;write:(size:{width:number;height:number}|undefined)=>void}):void;
  scaleX?:number;
  scaleY?:number;
}

/** Observe the whole host, including asynchronously rendered supplemental text. */
export function observeGalleryHeight(view:GalleryMeasureView,host:HTMLElement,cache:GalleryHeightCache,entry:GalleryHeightEntry):()=>void {
  let disposed=false;
  const sample=()=>{
    if(disposed||!host.isConnected)return;
    const rect=host.getBoundingClientRect();
    return {width:rect.width/(view.scaleX||1),height:rect.height/(view.scaleY||1)};
  };
  const schedule=()=>{
    if(disposed)return;
    view.requestMeasure({key:host,read:sample,write:size=>{
      if(!disposed&&size&&cache.record(entry,size.width,size.height))view.requestMeasure();
    }});
  };
  const Resize=host.ownerDocument.defaultView?.ResizeObserver;
  const observer=Resize?new Resize(schedule):undefined;
  observer?.observe(host);
  if(!observer){host.addEventListener('load',schedule,true);host.addEventListener('error',schedule,true);}
  schedule();
  return ()=>{
    if(disposed)return;
    const size=sample();if(size)cache.record(entry,size.width,size.height);
    disposed=true;observer?.disconnect();
    host.removeEventListener('load',schedule,true);host.removeEventListener('error',schedule,true);
  };
}
