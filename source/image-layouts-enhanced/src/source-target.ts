import {parseGroups} from './model';
import {extractImages} from './images';
import type {GalleryGroup} from './types';

export interface GallerySourceTarget {group:GalleryGroup;from:number;to:number}

function legacyStarts(source:string):number[]{
  const starts:number[]=[];
  let position=0,fence:{character:string;length:number}|undefined,comment=false;
  let frontmatter=/^(?:\uFEFF)?---[ \t]*(?:\r?\n|$)/.test(source);
  for(const line of source.split(/(?<=\n)/)){
    const value=line.replace(/\r?\n$/,'');
    if(frontmatter){if(position>0&&/^(?:---|\.\.\.)[ \t]*$/.test(value))frontmatter=false;position+=line.length;continue;}
    if(fence){const close=/^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(value);if(close&&close[1][0]===fence.character&&close[1].length>=fence.length)fence=undefined;position+=line.length;continue;}
    if(comment){if(value.includes('-->'))comment=false;position+=line.length;continue;}
    const open=/^ {0,3}(`{3,}|~{3,})[ \t]*(.*)$/.exec(value);
    if(open){fence={character:open[1][0],length:open[1].length};if(/^image-layout(?:-[\w-]+)?[ \t]*$/.test(open[2]))starts.push(position);}
    else{const start=value.indexOf('<!--');if(start>=0&&!value.includes('-->',start+4))comment=true;}
    position+=line.length;
  }
  return starts;
}

/** Resolve the current occurrence before exposing its raw image references. */
export function resolveGallerySourceTarget(source:string,snapshot:GalleryGroup):GallerySourceTarget|null{
  let group:GalleryGroup|undefined;
  if(snapshot.kind==='comment'){
    const matches=parseGroups(source).filter(candidate=>snapshot.options.id?candidate.options.id===snapshot.options.id:candidate.raw===snapshot.raw);
    if(matches.length===1)group=matches[0];
    else{
      group=matches.find(candidate=>candidate.from===snapshot.from&&candidate.raw===snapshot.raw);
      if(!group){const exact=matches.filter(candidate=>candidate.raw===snapshot.raw);if(exact.length===1)group=exact[0];}
    }
  }else{
    if(snapshot.from<0||!snapshot.raw||snapshot.bodyFrom<snapshot.from||snapshot.bodyTo>snapshot.to)return null;
    const candidates=legacyStarts(source).filter(from=>source.slice(from,from+snapshot.raw.length)===snapshot.raw);
    const from=candidates.includes(snapshot.from)?snapshot.from:candidates.length===1?candidates[0]:undefined;
    if(from!==undefined){const delta=from-snapshot.from;group={...snapshot,from,to:snapshot.to+delta,bodyFrom:snapshot.bodyFrom+delta,bodyTo:snapshot.bodyTo+delta};}
  }
  if(!group)return null;
  const refs=group.kind==='fence'?extractImages(group.body).map(ref=>({...ref,offset:ref.offset+group!.bodyFrom})):
    extractImages(source).filter(ref=>ref.offset>=group!.bodyFrom&&ref.offset+ref.raw.length<=group!.bodyTo);
  const from=refs[0]?.offset??group.bodyFrom;
  const last=refs.at(-1),to=last?last.offset+last.raw.length:group.bodyTo;
  return{group,from,to};
}
