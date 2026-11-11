export interface CropPoint { x:number; y:number }
export interface CropRegion { x:number; y:number; width:number; height:number }

/** The untransformed display box, followed by CSS rotate() scaleX() scaleY(). */
export interface CropImageGeometry {
  naturalWidth:number;
  naturalHeight:number;
  left:number;
  top:number;
  width:number;
  height:number;
  rotation:number;
  flipX?:boolean;
  flipY?:boolean;
}

function rotationAxes(rotation:number) {
  const turn=((Math.round(rotation/90)%4)+4)%4;
  return {turn,cos:[1,0,-1,0][turn],sin:[0,1,0,-1][turn]};
}

export function screenPointToImage(point:CropPoint,geometry:CropImageGeometry):CropPoint {
  const {cos,sin}=rotationAxes(geometry.rotation);
  const dx=point.x-geometry.left-geometry.width/2;
  const dy=point.y-geometry.top-geometry.height/2;
  return {
    x:((cos*dx+sin*dy)*(geometry.flipX?-1:1)/geometry.width+.5)*geometry.naturalWidth,
    y:((-sin*dx+cos*dy)*(geometry.flipY?-1:1)/geometry.height+.5)*geometry.naturalHeight,
  };
}

export function imagePointToScreen(point:CropPoint,geometry:CropImageGeometry):CropPoint {
  const {cos,sin}=rotationAxes(geometry.rotation);
  const x=(point.x/geometry.naturalWidth-.5)*geometry.width*(geometry.flipX?-1:1);
  const y=(point.y/geometry.naturalHeight-.5)*geometry.height*(geometry.flipY?-1:1);
  return {x:geometry.left+geometry.width/2+cos*x-sin*y,y:geometry.top+geometry.height/2+sin*x+cos*y};
}

/** Round outwards to source pixels; zoom and devicePixelRatio do not set export size. */
export function cropFromScreen(start:CropPoint,end:CropPoint,geometry:CropImageGeometry):CropRegion|null {
  if(start.x===end.x||start.y===end.y||geometry.width<=0||geometry.height<=0||geometry.naturalWidth<=0||geometry.naturalHeight<=0)return null;
  const a=screenPointToImage(start,geometry),b=screenPointToImage(end,geometry);
  const clamp=(value:number,max:number)=>Math.max(0,Math.min(max,value));
  // Ignore floating point noise at exact pixel boundaries, retaining real partial pixels.
  const x=clamp(Math.floor(Math.min(a.x,b.x)+1e-7),geometry.naturalWidth);
  const y=clamp(Math.floor(Math.min(a.y,b.y)+1e-7),geometry.naturalHeight);
  const right=clamp(Math.ceil(Math.max(a.x,b.x)-1e-7),geometry.naturalWidth);
  const bottom=clamp(Math.ceil(Math.max(a.y,b.y)-1e-7),geometry.naturalHeight);
  return right>x&&bottom>y?{x,y,width:right-x,height:bottom-y}:null;
}

export function cropOutputSize(region:CropRegion,geometry:Pick<CropImageGeometry,'rotation'>) {
  return rotationAxes(geometry.rotation).turn%2?{width:region.height,height:region.width}:{width:region.width,height:region.height};
}

/** Draw the selected source pixels at 1:1 size, retaining the preview's orientation. */
export function drawImageCrop(image:HTMLImageElement,region:CropRegion,geometry:CropImageGeometry,doc=image.ownerDocument):HTMLCanvasElement {
  const canvas=doc.createElement('canvas');
  const size=cropOutputSize(region,geometry);
  canvas.width=size.width;canvas.height=size.height;
  const context=canvas.getContext('2d');
  if(!context)throw new Error('无法创建图片裁剪画布');
  context.imageSmoothingEnabled=false;
  context.translate(canvas.width/2,canvas.height/2);
  const {cos,sin}=rotationAxes(geometry.rotation);
  // Integer rotation matrices keep quarter turns exactly aligned with source pixels.
  context.transform(cos,sin,-sin,cos,0,0);
  context.scale(geometry.flipX?-1:1,geometry.flipY?-1:1);
  context.drawImage(image,region.x,region.y,region.width,region.height,-region.width/2,-region.height/2,region.width,region.height);
  return canvas;
}
