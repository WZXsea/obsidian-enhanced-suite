import test from 'node:test';
import assert from 'node:assert/strict';
import {copyOriginalImage} from '../src/image-copy';

interface CopyFailure {
 network?:Error;
 decode?:Error;
 encode?:boolean;
 clipboard?:Error;
}

function fixture(src:string,failure:CopyFailure={}){
 const bytes=new Uint8Array([137,80,78,71]).buffer;
 const png=new Blob([bytes],{type:'image/png'});
 const requested:string[]=[],revoked:string[]=[],encodedTypes:Array<string|undefined>=[];
 const blobs:OwnerBlob[]=[],decoded:OwnerImage[]=[],writes:OwnerClipboardItem[][]=[];
 const fills:Array<{color:string;rect:number[]}>=[],draws:Array<{image:unknown;args:number[]}>=[];
 class OwnerBlob {
  constructor(readonly parts:unknown[],readonly options:{type?:string}={}){blobs.push(this);}
 }
 class OwnerImage {
  crossOrigin:string|null=null;
  src='';naturalWidth=1600;naturalHeight=1000;width=320;height=200;
  async decode(){decoded.push(this);if(failure.decode)throw failure.decode;}
 }
 class OwnerClipboardItem {
  constructor(readonly data:Record<string,Blob>){}
 }
 const context={
  fillStyle:'',
  fillRect(...rect:number[]){fills.push({color:this.fillStyle,rect});},
  drawImage(image:unknown,...args:number[]){draws.push({image,args});},
 };
 const canvas={
  width:0,height:0,
  getContext(type:string){assert.equal(type,'2d');return context;},
  toBlob(callback:(value:Blob|null)=>void,type?:string){
   const source=draws.at(-1)?.image as OwnerImage|undefined;
   // Obsidian resource images need anonymous CORS to keep the export canvas origin-clean.
   if(source?.src.startsWith('app://')&&source.crossOrigin!=='anonymous')throw new DOMException('Tainted canvases may not be exported.','SecurityError');
   encodedTypes.push(type);callback(failure.encode?null:png);
  },
 };
 const win={
  Blob:OwnerBlob,Image:OwnerImage,ClipboardItem:OwnerClipboardItem,
  URL:{createObjectURL(blob:OwnerBlob){assert.equal(blob,blobs.at(-1));return 'blob:owner/image';},revokeObjectURL(url:string){revoked.push(url);}},
  navigator:{clipboard:{async write(items:OwnerClipboardItem[]){
   assert.deepEqual(revoked,[],'source bytes remain available until clipboard writing settles');
   writes.push(items);if(failure.clipboard)throw failure.clipboard;
  }}},
 };
 const doc={defaultView:win,createElement(name:string){assert.equal(name,'canvas');return canvas;}};
 const image={src,currentSrc:src,naturalWidth:1600,naturalHeight:1000,width:320,height:200,ownerDocument:doc,style:{transform:'rotate(90deg) scaleX(-1)'}} as unknown as HTMLImageElement;
 let headers:Record<string,string>={'content-type':'image/png'};
 const readRemote=async(url:string)=>{requested.push(url);if(failure.network)throw failure.network;return {arrayBuffer:bytes,headers};};
 return {image,readRemote,requested,revoked,encodedTypes,blobs,decoded,writes,fills,draws,canvas,bytes,png,setHeaders(value:Record<string,string>){headers=value;}};
}

test('HTTP image bytes decode through a blob URL in the image owner window, including absent content type',async()=>{
 for(const [source,headers,type] of [
  ['https://images.example/figure.png',{'content-type':'image/png'},'image/png'],
  ['http://images.example/figure.jpg',{'content-type':'image/jpeg'},'image/jpeg'],
  ['https://images.example/figure',{},'application/octet-stream'],
 ] as const){
  const f=fixture(source);f.setHeaders(headers);
  await copyOriginalImage(f.image,f.readRemote);
  assert.deepEqual(f.requested,[source]);
  assert.equal(f.blobs.length,1);assert.deepEqual(f.blobs[0].parts,[f.bytes]);assert.equal(f.blobs[0].options.type,type);
  assert.equal(f.decoded[0].src,'blob:owner/image');
  assert.deepEqual(f.revoked,['blob:owner/image']);
 }
});

test('local and data images decode directly in their owner window',async()=>{
 for(const source of ['app://local/figure.png','data:image/png;base64,iVBORw==']){
  const f=fixture(source);await copyOriginalImage(f.image,f.readRemote);
  assert.deepEqual(f.requested,[]);assert.deepEqual(f.blobs,[]);assert.deepEqual(f.revoked,[]);
  assert.equal(f.decoded[0].src,source);assert.equal(f.writes.length,1);
 }
});

test('whole-image copy retains original resolution and orientation with a white PNG background',async()=>{
 const f=fixture('app://local/figure.png');await copyOriginalImage(f.image,f.readRemote);
 assert.deepEqual({width:f.canvas.width,height:f.canvas.height},{width:1600,height:1000});
 assert.equal(f.fills.length,1);assert.deepEqual(f.fills[0].rect,[0,0,1600,1000]);
 assert.ok(['#fff','#ffffff','white','rgb(255, 255, 255)'].includes(f.fills[0].color));
 assert.equal(f.draws.length,1);assert.equal(f.draws[0].image,f.decoded[0]);
 assert.ok([[0,0],[0,0,1600,1000]].some(args=>JSON.stringify(args)===JSON.stringify(f.draws[0].args)));
 assert.deepEqual(f.encodedTypes,['image/png']);assert.equal(f.writes.length,1);
 assert.equal(f.writes[0][0].data['image/png'],f.png);
});

test('a remote request error propagates before image decoding or clipboard writing',async()=>{
 const error=new Error('remote bytes unavailable'),f=fixture('https://images.example/figure.png',{network:error});
 await assert.rejects(copyOriginalImage(f.image,f.readRemote),value=>value===error);
 assert.deepEqual(f.decoded,[]);assert.deepEqual(f.writes,[]);assert.deepEqual(f.revoked,[]);
});

test('an image decoding error propagates and releases its remote object URL',async()=>{
 const error=new Error('unsupported image'),f=fixture('https://images.example/figure.png',{decode:error});
 await assert.rejects(copyOriginalImage(f.image,f.readRemote),value=>value===error);
 assert.deepEqual(f.writes,[]);assert.deepEqual(f.revoked,['blob:owner/image']);
});

test('PNG encoding failure leaves the clipboard untouched and releases remote bytes',async()=>{
 const f=fixture('https://images.example/figure.png',{encode:true});
 await assert.rejects(copyOriginalImage(f.image,f.readRemote));
 assert.deepEqual(f.writes,[]);assert.deepEqual(f.revoked,['blob:owner/image']);
});

test('clipboard rejection reaches the caller after releasing the remote object URL',async()=>{
 const error=new Error('clipboard write rejected'),f=fixture('https://images.example/figure.png',{clipboard:error});
 await assert.rejects(copyOriginalImage(f.image,f.readRemote),value=>value===error);
 assert.equal(f.writes.length,1);assert.deepEqual(f.revoked,['blob:owner/image']);
});
