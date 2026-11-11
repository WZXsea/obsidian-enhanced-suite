import type {DisplayImage} from './viewer';
export interface MobileSourceImage extends DisplayImage {line:number}
export function sameImageSource(a:string,b:string):boolean {
 try {
  const left=new URL(a),right=new URL(b);
  if(left.href===right.href)return true;
  // Obsidian cache-busting timestamps can differ between Markdown and resource URLs.
  return /^(app:|capacitor:|file:)$/.test(left.protocol)&&left.protocol===right.protocol&&left.host===right.host&&left.pathname===right.pathname;
 } catch {return a===b;}
}
export function pickMobileImageIndex(images:MobileSourceImage[],src:string,line?:number,ordinal=0):number {
 const matches=images.map((image,index)=>({image,index})).filter(item=>sameImageSource(item.image.src,src));
 if(!matches.length)return -1;
 if(line!==undefined&&Number.isFinite(line)){
  const byLine=[...matches].sort((a,b)=>Math.abs(a.image.line-line)-Math.abs(b.image.line-line));
  const exactOccurrence=matches[Math.max(0,Math.min(matches.length-1,ordinal))];
  return Math.abs(exactOccurrence.image.line-line)===Math.abs(byLine[0].image.line-line)?exactOccurrence.index:byLine[0].index;
 }
 return matches[Math.max(0,Math.min(matches.length-1,ordinal))].index;
}
/** Used only when the source note is unavailable (for example a standalone image view). */
export function mobileDomImages(root:HTMLElement,origin:HTMLImageElement):HTMLImageElement[] {
 const images=Array.from(root.querySelectorAll<HTMLImageElement>('img')).filter(img=>{
  if(!img.src||img.closest('.nis-stage,.ilg-popover,.nis-viewer,.ilg-viewer,.ilg-thumbnails,.ilg-stage-thumb-figure,[hidden],[aria-hidden="true"]'))return false;
  const rect=img.getBoundingClientRect();
  return rect.width>0&&rect.height>0;
 });
 if(!images.includes(origin))return [origin];
 return images;
}
export function rotatedImageBounds(width:number,height:number,rotation:number){
 return Math.abs(rotation%180)===90 ? {width:height,height:width} : {width,height};
}
