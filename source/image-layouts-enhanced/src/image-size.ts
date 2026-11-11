import type {ImageReference} from './images';

/** The image parser masks fences and inline examples; root indented code needs this guard. */
function indentedCode(source:string,offset:number):boolean{
 const start=source.lastIndexOf('\n',Math.max(0,offset-1))+1;
 const end=source.indexOf('\n',start),line=source.slice(start,end<0?source.length:end);
 const content=line.replace(/^(?: {0,3}>[ \t]?)+/,'');
 const indent=/^[ \t]*/.exec(content)![0].replace(/\t/g,'    ').length;
 if(indent<4)return false;
 let listIndent:number|undefined;
 for(const previous of source.slice(0,start).split('\n')){
  const value=previous.replace(/^(?: {0,3}>[ \t]?)+/,'');if(!value.trim())continue;
  const spaces=/^[ \t]*/.exec(value)![0].replace(/\t/g,'    ').length;
  const marker=/^[ \t]*(?:[-+*]|\d+[.)])[ \t]+/.exec(value);
  if(marker&&(spaces<4||listIndent!==undefined&&spaces>=listIndent))listIndent=marker[0].replace(/\t/g,'    ').length;
  else if(listIndent!==undefined&&spaces<listIndent)listIndent=undefined;
 }
 return indent>=(listIndent??0)+4;
}

/** Independent image lines align as blocks; inline images retain their surrounding text flow. */
export function isStandaloneImage(source:string,ref:ImageReference):boolean{
 if(!Number.isInteger(ref.offset)||ref.offset<0||!ref.raw||source.slice(ref.offset,ref.offset+ref.raw.length)!==ref.raw)return false;
 if(/[\r\n]/.test(ref.raw)||indentedCode(source,ref.offset))return false;
 const from=source.lastIndexOf('\n',Math.max(0,ref.offset-1))+1;
 const end=source.indexOf('\n',ref.offset+ref.raw.length),to=end<0?source.length:end;
 return /^(?:[ \t]*(?:>|[-+*](?=[ \t])|\d+[.)](?=[ \t]))[ \t]*)*[ \t]*$/.test(source.slice(from,ref.offset))&&
  /^[ \t\r]*$/.test(source.slice(ref.offset+ref.raw.length,to));
}
