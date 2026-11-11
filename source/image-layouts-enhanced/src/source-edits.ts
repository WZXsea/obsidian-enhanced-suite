import {normalizeOptions,serializeOpen,SourceEdit} from './model';
import type {GalleryGroup,GalleryOptions} from './types';

/** Rewrites exactly one verified code block; embedded/read-only renders have no range. */
export function editLegacyGroup(source:string,group:GalleryGroup,patch:Partial<GalleryOptions>|'unwrap',externalConfiguration=false):SourceEdit|null{
  if(group.kind!=='fence'||group.from<0||group.to<=group.from||group.to>source.length||source.slice(group.from,group.to)!==group.raw)return null;
  const opening=/^ {0,3}(`{3,}|~{3,})[ \t]*image-layout(?:[-\w]*)[ \t]*\r?\n/.exec(group.raw);
  if(!opening)return null;
  const lines=group.raw.slice(opening[0].length).split(/\r?\n/);
  const close=lines.findIndex(line=>{const match=/^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);return!!match&&match[1][0]===opening[1][0]&&match[1].length>=opening[1].length;});
  if(close<0||lines.slice(close+1).some(line=>line!==''))return null;
  if(patch==='unwrap')return{from:group.from,to:group.to,insert:group.body};
  const eol=group.raw.includes('\r\n')?'\r\n':'\n';
  const trailing=group.raw.endsWith('\n')?eol:'';
  const options=normalizeOptions({...group.options,...patch,id:patch.id||group.options.id||crypto.randomUUID().replace(/-/g,'').slice(0,10)});
  const marker=externalConfiguration?serializeOpen({id:options.id,layout:options.layout}):serializeOpen(options);
  return{from:group.from,to:group.to,insert:`${marker}${eol}${group.body.replace(/\r?\n?$/,eol)}<!-- /image-layouts -->${trailing}`};
}
