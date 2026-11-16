export type RemoteImageReader=(url:string)=>Promise<{arrayBuffer:ArrayBuffer;headers:Record<string,string>}>;

/** Read remote bytes through Obsidian so display-only CORS images can be copied. */
export async function copyOriginalImage(image:HTMLImageElement,readRemote:RemoteImageReader):Promise<void> {
 const doc=image.ownerDocument,win=doc.defaultView as Window & typeof globalThis;
 const src=image.currentSrc||image.src;
 let objectUrl:string|undefined;
 try {
  let source=src;
  if(/^https?:\/\//i.test(src)){
   const response=await readRemote(src);
   objectUrl=win.URL.createObjectURL(new win.Blob([response.arrayBuffer],{type:response.headers['content-type']||'application/octet-stream'}));
   source=objectUrl;
  }
  const original=new win.Image();original.crossOrigin='anonymous';original.src=source;await original.decode();
  const canvas=doc.createElement('canvas');canvas.width=original.naturalWidth;canvas.height=original.naturalHeight;
  const context=canvas.getContext('2d');
  if(!context)throw new Error('无法创建图片复制画布');
  // Preserve the full-image command's original pixels, orientation and white background.
  context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(original,0,0);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('PNG 编码失败')),'image/png'));
  await win.navigator.clipboard.write([new win.ClipboardItem({'image/png':blob})]);
 } finally {if(objectUrl)win.URL.revokeObjectURL(objectUrl);}
}
