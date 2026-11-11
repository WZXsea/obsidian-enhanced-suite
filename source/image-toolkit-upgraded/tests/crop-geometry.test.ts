import test from 'node:test';
import assert from 'node:assert/strict';
import {cropFromScreen,cropOutputSize,drawImageCrop,imagePointToScreen,screenPointToImage,CropImageGeometry} from '../src/crop-geometry';

const geometry:CropImageGeometry={naturalWidth:4000,naturalHeight:2400,left:100,top:80,width:1000,height:600,rotation:0};

test('a displayed crop uses original pixels regardless of preview zoom',()=>{
  assert.deepEqual(cropFromScreen({x:200,y:130},{x:500,y:330},geometry),{x:400,y:200,width:1200,height:800});
  const zoomed={...geometry,left:-500,top:-300,width:2000,height:1200};
  assert.deepEqual(cropFromScreen({x:-300,y:-200},{x:300,y:200},zoomed),{x:400,y:200,width:1200,height:800});
});

test('reversed drag, fractional edges and out-of-image areas retain exact source bounds',()=>{
  assert.deepEqual(cropFromScreen({x:500.1,y:330.1},{x:200.1,y:130.1},geometry),{x:400,y:200,width:1201,height:801});
  assert.deepEqual(cropFromScreen({x:-100,y:-50},{x:200,y:130},geometry),{x:0,y:0,width:400,height:200});
  assert.deepEqual(cropFromScreen({x:-100,y:-100},{x:2000,y:2000},geometry),{x:0,y:0,width:4000,height:2400});
  assert.equal(cropFromScreen({x:-100,y:-100},{x:0,y:0},geometry),null);
  assert.equal(cropFromScreen({x:200,y:100},{x:200,y:150},geometry),null);
  assert.equal(cropFromScreen({x:200,y:100},{x:250,y:100},geometry),null);
});

test('quarter turns and either mirror map selection back to the same source pixels',()=>{
  for(const rotation of [0,90,180,270,-90,450])for(const flipX of [false,true])for(const flipY of [false,true]){
    const current={...geometry,rotation,flipX,flipY};
    const a=imagePointToScreen({x:400,y:200},current),b=imagePointToScreen({x:1600,y:1000},current);
    assert.deepEqual(cropFromScreen(a,b,current),{x:400,y:200,width:1200,height:800},JSON.stringify({rotation,flipX,flipY}));
    const original=screenPointToImage(a,current);
    assert.ok(Math.abs(original.x-400)<1e-9&&Math.abs(original.y-200)<1e-9);
    assert.deepEqual(cropOutputSize({x:400,y:200,width:1200,height:800},current),Math.abs(rotation/90)%2?{width:800,height:1200}:{width:1200,height:800});
  }
});

test('90 degree crop corresponds to the screen upper-left after rotation',()=>{
  const current={...geometry,rotation:90};
  // Rotated display bounds: x=300..900, y=-120..880.
  assert.deepEqual(cropFromScreen({x:300,y:-120},{x:500,y:180},current),{x:0,y:1600,width:1200,height:800});
});

test('canvas export preserves source extent and applies orientation at native dimensions',()=>{
  const calls:unknown[][]=[];
  const context={imageSmoothingEnabled:true,translate:(...args:number[])=>calls.push(['translate',...args]),transform:(...args:number[])=>calls.push(['transform',...args]),scale:(...args:number[])=>calls.push(['scale',...args]),drawImage:(...args:unknown[])=>calls.push(['drawImage',...args])};
  const canvas={width:0,height:0,getContext:()=>context};
  const doc={createElement:(name:string)=>{assert.equal(name,'canvas');return canvas;}} as unknown as Document;
  const image={ownerDocument:doc} as HTMLImageElement;
  const region={x:400,y:200,width:1200,height:800};
  const result=drawImageCrop(image,region,{...geometry,rotation:90,flipX:true});
  assert.equal(result,canvas);
  assert.deepEqual({width:result.width,height:result.height},{width:800,height:1200});
  assert.equal(context.imageSmoothingEnabled,false);
  assert.deepEqual(calls,[['translate',400,600],['transform',0,1,-1,0,0,0],['scale',-1,1],['drawImage',image,400,200,1200,800,-600,-400,1200,800]]);
});
