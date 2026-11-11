import {extractImages,type ImageReference} from './images';

interface Context {before:string;after:string;heading:string}
export interface ImageSettingRecord extends Context {
 width:number;
 kind:ImageReference['kind'];
 target:string;
 raw:string;
 imageOrdinal:number;
 occurrence:number;
 count:number;
 sequence:string;
}
export type ImageSettings=Record<string,ImageSettingRecord>;
interface DocumentImages {refs:ImageReference[];contexts:Context[];sequence:string}
const documents=new Map<string,DocumentImages>();
const kinds=new Set(['wiki','markdown','reference','html']);
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const validWidth=(value:unknown):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>=32&&value<=16384;
const nonnegative=(value:unknown):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>=0;
const normalize=(value:string)=>value.replace(/\r\n?/g,'\n').trim();

/** Bounded signatures distinguish image edits without persisting the note body. */
function signature(refs:ImageReference[]):string{
 const text=JSON.stringify(refs.map(ref=>[ref.kind,ref.target,ref.raw]));
 let first=2166136261,second=5381;
 for(let index=0;index<text.length;index++){
  const code=text.charCodeAt(index);first=Math.imul(first^code,16777619);second=Math.imul(second,33)^code;
 }
 return `${refs.length}:${(first>>>0).toString(16).padStart(8,'0')}${(second>>>0).toString(16).padStart(8,'0')}`;
}

function parsed(source:string):DocumentImages{
 const cached=documents.get(source);if(cached)return cached;
 const refs=extractImages(source);
 const headings=Array.from(source.matchAll(/^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*\r?$/gm));
 let headingIndex=-1;
 const contexts=refs.map((ref,index)=>{
  while(headingIndex+1<headings.length&&headings[headingIndex+1].index!<ref.offset)headingIndex++;
  const before=source.slice(index?refs[index-1].offset+refs[index-1].raw.length:0,ref.offset);
  const after=source.slice(ref.offset+ref.raw.length,refs[index+1]?.offset??source.length);
  return{
   before:normalize(before).split('\n').at(-1)!.slice(-160),
   after:normalize(after).split('\n')[0].slice(0,160),
   heading:headingIndex<0?'':normalize(headings[headingIndex][1]).slice(0,128),
  };
 });
 const result={refs,contexts,sequence:signature(refs)};
 if(documents.size>=8)documents.delete(documents.keys().next().value!);
 documents.set(source,result);return result;
}

function keyParts(key:string):[string,string,string]|undefined{
 try{
  const value:unknown=JSON.parse(key);
  if(Array.isArray(value)&&value.length===3&&value.every(part=>typeof part==='string'&&part.length>0))return value as [string,string,string];
 }catch{/* Unrelated or older configuration keys remain stored as received. */}
 return undefined;
}

function validRecord(value:unknown):value is ImageSettingRecord{
 if(!object(value)||typeof value.sequence!=='string')return false;
 const sequence=/^([1-9]\d*):[\da-f]{16}$/.exec(value.sequence);
 return Boolean(sequence)&&validWidth(value.width)&&typeof value.kind==='string'&&kinds.has(value.kind)&&
  typeof value.target==='string'&&value.target.length>0&&typeof value.raw==='string'&&value.raw.length>0&&nonnegative(value.imageOrdinal)&&
  value.imageOrdinal<Number(sequence![1])&&
  nonnegative(value.occurrence)&&nonnegative(value.count)&&value.count>0&&value.occurrence<value.count&&
  value.count<=Number(sequence![1])&&typeof value.before==='string'&&value.before.length<=160&&
  typeof value.after==='string'&&value.after.length<=160&&typeof value.heading==='string'&&value.heading.length<=128;
}

function currentOrdinal(document:DocumentImages,ref:ImageReference):number{
 return document.refs.findIndex(current=>current.offset===ref.offset&&current.raw===ref.raw&&
  current.kind===ref.kind&&current.target===ref.target);
}

function resolve(record:ImageSettingRecord,document:DocumentImages):number|undefined{
 const candidates=document.refs.flatMap((ref,index)=>ref.kind===record.kind&&ref.target===record.target?[index]:[]);
 if(candidates.length===1&&record.count===1)return candidates[0];
 // Context wins over ordinal when identical image references move with their prose.
 const contextual=candidates.filter(index=>{
  const context=document.contexts[index];return context.before===record.before&&context.after===record.after;
 });
 if(record.before||record.after){
  if(contextual.length===1)return contextual[0];
  const headed=contextual.filter(index=>document.contexts[index].heading===record.heading);
  if(record.heading&&headed.length===1)return headed[0];
 }
 if(document.sequence===record.sequence&&candidates.length===record.count&&
  candidates[record.occurrence]===record.imageOrdinal)return record.imageOrdinal;
 return undefined;
}

function recordsFor(settings:ImageSettings,device:string,path:string,document:DocumentImages,ordinal:number):string[]{
 if(!object(settings))return [];
 return Object.entries(settings).flatMap(([key,value])=>{
  const parts=keyParts(key);
  return parts&&parts[0]===path&&parts[1]===device&&validRecord(value)&&resolve(value,document)===ordinal?[key]:[];
 });
}

export function getImageWidth(settings:ImageSettings,device:string,path:string,source:string,ref:ImageReference):number|undefined{
 const document=parsed(source),ordinal=currentOrdinal(document,ref);if(ordinal<0)return;
 const widths=new Set(recordsFor(settings,device,path,document,ordinal).map(key=>settings[key].width));
 return widths.size===1?widths.values().next().value:undefined;
}

/** Explicit adjustments update this occurrence and device while ambiguous records remain recoverable. */
export function setImageWidth(settings:ImageSettings,device:string,path:string,source:string,ref:ImageReference,width:number|null):ImageSettings{
 const base=object(settings)?settings:{};
 if(typeof device!=='string'||!device||typeof path!=='string'||!path)return base;
 if(width!==null&&!validWidth(width))return base;
 const document=parsed(source),ordinal=currentOrdinal(document,ref);if(ordinal<0)return base;
 const matches=recordsFor(base,device,path,document,ordinal);
 if(width===null&&!matches.length)return base;
 const result={...base};for(const key of matches)delete result[key];
 if(width===null)return result;
 const same=document.refs.filter(current=>current.kind===ref.kind&&current.target===ref.target);
 const key=matches[0]??JSON.stringify([path,device,crypto.randomUUID()]);
 result[key]={width,kind:ref.kind,target:ref.target,raw:ref.raw,imageOrdinal:ordinal,
  occurrence:same.findIndex(current=>current.offset===ref.offset),count:same.length,
  sequence:document.sequence,...document.contexts[ordinal]};
 return result;
}

/** Rename the note/folder component only, retaining device and local occurrence identities. */
export function renameImageSettings(settings:ImageSettings,oldPath:string,newPath:string):ImageSettings{
 const result={...(object(settings)?settings:{})};
 if(oldPath===newPath)return result;
 const moves=Object.entries(result).flatMap(([key,value])=>{
  const parts=keyParts(key);
  if(!parts||parts[0]!==oldPath&&!parts[0].startsWith(oldPath+'/'))return [];
  return[{oldKey:key,newKey:JSON.stringify([newPath+parts[0].slice(oldPath.length),parts[1],parts[2]]),value}];
 });
 for(const move of moves)delete result[move.oldKey];
 for(const move of moves)result[move.newKey]=move.value;
 return result;
}
