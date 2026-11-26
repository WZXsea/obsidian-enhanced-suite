import type {GalleryImage} from './types';
import {getStageThumbnailOrder} from './layouts';

type OrderedImage = GalleryImage & {orderKey:string};
type ImageWithOrderKey = GalleryImage & {orderKey?:string};

/** 按源引用中的出现次序区分同一目标；显示排序后的图片沿用原来的键。 */
export function imageOrderKeys(images:readonly ImageWithOrderKey[]):string[]{
  const occurrences=new Map<string,number>();
  return images.map(image=>{
    const occurrence=occurrences.get(image.target)??0;
    occurrences.set(image.target,occurrence+1);
    return image.orderKey??JSON.stringify([image.target,occurrence]);
  });
}

/** 图片说明和源码位置随图片一起排序，新加入的引用按源序接在末尾。 */
export function orderImages(images:readonly ImageWithOrderKey[],order:readonly string[]):OrderedImage[]{
  const keys=imageOrderKeys(images);
  const available=new Map(images.map((image,index)=>[keys[index],{...image,orderKey:keys[index]}]));
  const sorted:OrderedImage[]=[];
  for(const key of order){
    const image=available.get(key);
    if(image){sorted.push(image);available.delete(key);}
  }
  return [...sorted,...available.values()];
}

/** from/to 以当前显示列表为准，to 表示移出后插入的最终位置。 */
export function moveImageOrder(images:readonly ImageWithOrderKey[],from:number,to:number,visibleOrder?:readonly number[]):string[]{
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=images.length||to>=images.length){
    throw new RangeError('图片排序位置超出当前画廊范围');
  }
  const order=imageOrderKeys(images);
  if(visibleOrder){
    const visible=new Set(visibleOrder);
    if(visible.size!==visibleOrder.length||!visible.has(from)||!visible.has(to)||
      visibleOrder.some(index=>!Number.isInteger(index)||index<0||index>=images.length)){
      throw new RangeError('缩略图排序位置超出当前可见范围');
    }
    const moved=[...visibleOrder],start=moved.indexOf(from),end=moved.indexOf(to);
    const [image]=moved.splice(start,1);moved.splice(end,0,image);
    // 重建后的侧栏采用主图对应的标准槽序；将视觉顺序写回这些槽，主图位置保持原样。
    const slots=visibleOrder.length===images.length-1
      ?getStageThumbnailOrder(images.length,order.findIndex((_key,index)=>!visible.has(index)))
      :order.flatMap((_key,index)=>visible.has(index)?[index]:[]);
    const next=[...order];
    slots.forEach((index,slot)=>{next[index]=order[moved[slot]];});
    return next;
  }
  const [moved]=order.splice(from,1);order.splice(to,0,moved);
  return order;
}
