import { DEFAULT_OPTIONS, type GalleryGroup, type GalleryOptions, type Layout } from './types';

export interface SourceEdit { from: number; to: number; insert: string }
const layouts = new Set<Layout>(['a','b','c','d','e','f','g','h','i','single','masonry-2','masonry-3','masonry-4','masonry-5','masonry-6','carousel','filmstrip','focus','custom','stage-left','stage-right']);
const own = (object: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(object, key);
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const pick = (object: Record<string, unknown>, key: string, alias?: string) => own(object,key) ? object[key] : alias && own(object,alias) ? object[alias] : undefined;
const word = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const text = (value: unknown, fallback: string) => typeof value === 'string' ? value : fallback;
const bool = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^\d+(?:\.\d+)?(?:px)?$/i.test(value.trim()) ? Number(value.trim().replace(/px$/i,'')) : NaN;
  return Number.isFinite(number) ? Math.min(max,Math.max(min,number)) : fallback;
}

function dimension(value: unknown, fallback: string): string {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return `${Math.min(4096,value)}px`;
  if (typeof value !== 'string') return fallback;
  const match = /^(\d+(?:\.\d+)?)(px|%|rem|em|vw|vh)$/i.exec(value.trim());
  if (!match || Number(match[1]) <= 0) return fallback;
  const unit = match[2].toLowerCase();
  const max = ['%','vw','vh'].includes(unit) ? 100 : ['em','rem'].includes(unit) ? 256 : 4096;
  return `${Math.min(max,Number(match[1]))}${unit}`;
}

function normalized(input: unknown, fallback: GalleryOptions): GalleryOptions {
  const object = record(input);
  const layoutInput = word(object.layout).replace(/^legacy-layout-/,'').replace(/^masonry([2-6])$/,'masonry-$1');
  const overlay = word(object.overlay);
  const fit = word(object.fit);
  const align = word(object.align);
  return {
    id: text(object.id,fallback.id),
    layout: layouts.has(layoutInput as Layout) ? layoutInput as Layout : fallback.layout,
    fit: ['cover','contain','natural'].includes(fit) ? fit as GalleryOptions['fit'] : fallback.fit,
    height: bounded(pick(object,'height','carouselHeight'),fallback.height,120,1200),
    gap: bounded(object.gap,fallback.gap,0,64),
    radius: bounded(object.radius,fallback.radius,0,48),
    caption: text(object.caption,fallback.caption),
    grid: text(object.grid,fallback.grid),
    thumbnails: bool(pick(object,'thumbnails','carouselShowThumbnails'),fallback.thumbnails),
    overlay: ['never','hover','always'].includes(overlay) ? overlay as GalleryOptions['overlay'] : typeof object.permanentOverlay === 'boolean' ? object.permanentOverlay ? 'always' : 'hover' : fallback.overlay,
    align: ['left','center','right','full'].includes(align) ? align as GalleryOptions['align'] : fallback.align,
    width: dimension(object.width,fallback.width),
    descriptions: Array.isArray(object.descriptions) ? object.descriptions.map(value => typeof value === 'string' ? value : '') : [...fallback.descriptions],
    fromFolder: text(object.fromFolder,fallback.fromFolder),
    sortBy: ['name','mtime'].includes(word(object.sortBy)) ? word(object.sortBy) as 'name'|'mtime' : fallback.sortBy,
    reverse: bool(object.reverse,fallback.reverse),
    limit: Math.floor(bounded(object.limit,fallback.limit,0,1000)),
  };
}

/** Whitelisted display options are the only values that reach inline CSS. */
export function normalizeOptions(input: unknown, defaults: Partial<GalleryOptions> = {}): GalleryOptions {
  return normalized(input,normalized(defaults,DEFAULT_OPTIONS));
}

interface SourceLine { from: number; to: number; next: number; text: string; index: number }
function lines(source: string): SourceLine[] {
  const result: SourceLine[] = [];
  let from = 0;
  while (from < source.length) {
    const newline = source.indexOf('\n',from);
    const next = newline < 0 ? source.length : newline + 1;
    const to = newline < 0 ? source.length : newline > from && source[newline-1] === '\r' ? newline-1 : newline;
    result.push({from,to,next,text:source.slice(from,to),index:result.length});
    from = next;
  }
  return result;
}

function codeSpanEnd(source: string, from: number, size: number): number {
  const tail = source.slice(from);
  const blockBoundary = /\r?\n[ \t]*\r?\n|\r?\n {0,3}(?:`{3,}|~{3,})/.exec(tail);
  const end = blockBoundary ? from+blockBoundary.index : source.length;
  const runs = /`+/g;
  runs.lastIndex = from;
  let match: RegExpExecArray|null;
  while ((match = runs.exec(source)) && match.index < end) if (match[0].length === size) return match.index+size;
  return 0;
}

/** Marker recognition shares Markdown's frontmatter, fence and comment boundaries. */
export function parseGroups(source: string): GalleryGroup[] {
  const result: GalleryGroup[] = [];
  const sourceLines = lines(source);
  let frontmatter = sourceLines[0] !== undefined && /^(?:\uFEFF)?---[ \t]*$/.test(sourceLines[0].text);
  let comment = false;
  let rawCodeTag: string|undefined;
  let inlineCodeEnd = 0;
  let fence: {char: string; size: number}|undefined;
  let pending: {line: SourceLine; options: GalleryOptions|null; depth: number; invalid: boolean}|undefined;
  for (const line of sourceLines) {
    if (frontmatter) {
      if (line.index > 0 && /^(?:---|\.\.\.)[ \t]*$/.test(line.text)) frontmatter = false;
      continue;
    }
    const fenceMarker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line.text);
    if (fence) {
      if (fenceMarker && fenceMarker[1][0] === fence.char && fenceMarker[1].length >= fence.size && /^[ \t]*$/.test(fenceMarker[2])) fence = undefined;
      continue;
    }
    if (!comment && !rawCodeTag && inlineCodeEnd <= line.from && fenceMarker && !(fenceMarker[1][0] === '`' && fenceMarker[2].includes('`'))) {
      fence = {char:fenceMarker[1][0],size:fenceMarker[1].length};
      continue;
    }
    if (!comment && !rawCodeTag && inlineCodeEnd <= line.from) {
      const opening = /^ {0,3}<!--[ \t]*image-layouts:[ \t]*(.*?)[ \t]*-->[ \t]*$/.exec(line.text);
      const closing = /^ {0,3}<!--[ \t]*\/image-layouts[ \t]*-->[ \t]*$/.test(line.text);
      if (opening) {
        let options: GalleryOptions|null = null;
        try {
          // Raw comment delimiters inside JSON already terminated the HTML comment.
          if (!opening[1].includes('-->') && !opening[1].includes('<!--')) {
            const parsed: unknown = JSON.parse(opening[1]);
            if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) options = normalizeOptions(parsed);
          }
        } catch { /* Malformed marker pairs remain native Markdown. */ }
        if (pending) { pending.depth++; pending.invalid = true; }
        else pending = {line,options,depth:1,invalid:options === null};
        continue;
      }
      if (closing) {
        if (pending) {
          pending.depth--;
          if (pending.depth === 0) {
            if (!pending.invalid && pending.options) {
              result.push({from:pending.line.from,to:line.to,bodyFrom:pending.line.next,bodyTo:line.from,startLine:pending.line.index,endLine:line.index,body:source.slice(pending.line.next,line.from),raw:source.slice(pending.line.from,line.to),options:pending.options,kind:'comment'});
            }
            pending = undefined;
          }
        }
        continue;
      }
    }
    let position = 0;
    while (position < line.text.length) {
      if (rawCodeTag) {
        const closing = new RegExp(`<\\/${rawCodeTag}\\s*>`,'i').exec(line.text.slice(position));
        if (!closing) break;
        position += closing.index+closing[0].length;
        rawCodeTag = undefined;
        continue;
      }
      if (line.from+position < inlineCodeEnd) {
        position = Math.min(line.text.length,inlineCodeEnd-line.from);
        continue;
      }
      if (comment) {
        const end = line.text.indexOf('-->',position);
        if (end < 0) break;
        comment = false;
        position = end + 3;
      } else {
        const token = /<!--|`+|<(pre|code|script|style|textarea)\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(line.text.slice(position));
        if (!token) break;
        const start = position+token.index;
        if (token[0] === '<!--') {comment = true;position = start+4;}
        else if (token[1]) {rawCodeTag = token[1].toLowerCase();position = start+token[0].length;}
        else {
          let slashes = 0;
          for (let cursor = start-1; cursor >= 0 && line.text[cursor] === '\\'; cursor--) slashes++;
          position = start+token[0].length;
          if (slashes%2 === 0) inlineCodeEnd = codeSpanEnd(source,line.from+position,token[0].length);
        }
      }
    }
  }
  return result;
}

export function serializeOpen(options: Partial<GalleryOptions>): string {
  const value=normalizeOptions(options);
  // Keep Markdown readable: persist the selected layout and actual overrides.
  // Defaults remain fixed in the schema, independent of new-group preferences.
  const compact:Record<string,unknown>={layout:value.layout};
  if(value.id)compact.id=value.id;
  for(const key of Object.keys(DEFAULT_OPTIONS) as Array<keyof GalleryOptions>){
    if(key==='id'||key==='layout')continue;
    if(JSON.stringify(value[key])!==JSON.stringify(DEFAULT_OPTIONS[key]))compact[key]=value[key];
  }
  const json = JSON.stringify(compact).replace(/[<>&\u2028\u2029]/g,char => `\\u${char.charCodeAt(0).toString(16).padStart(4,'0')}`);
  return `<!-- image-layouts: ${json} -->`;
}

function validRange(source: string, from: number, to: number): boolean {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > source.length || from > to) return false;
  // Editor offsets are UTF-16, but an edit must keep each surrogate and CRLF pair intact.
  const boundary = (offset: number) => !(offset > 0 && offset < source.length && ((/[\uD800-\uDBFF]/.test(source[offset-1]) && /[\uDC00-\uDFFF]/.test(source[offset])) || (source[offset-1] === '\r' && source[offset] === '\n')));
  return boundary(from) && boundary(to);
}

export function wrapSelection(source: string, from: number, to: number, options: Partial<GalleryOptions>): SourceEdit|null {
  if (!validRange(source,from,to) || from === to || !source.slice(from,to).trim()) return null;
  if (parseGroups(source).some(group => from < group.to && to > group.from)) return null;
  // Wrapping a selection that already contains markers would create ambiguous nesting.
  if (/<!--[ \t]*\/?image-layouts(?::|[ \t]*-->)/.test(source.slice(from,to))) return null;
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const before = from > 0 && source[from-1] !== '\n' ? eol : '';
  const body = source.slice(from,to);
  const bodyEnd = body.endsWith('\n') ? '' : eol;
  // The closing marker owns an inserted newline; existing paragraph spacing
  // must survive an unwrap rather than becoming the marker's line ending.
  const after = to < source.length ? eol : '';
  const insert = `${before}${serializeOpen(options)}${eol}${body}${bodyEnd}<!-- /image-layouts -->${after}`;
  const candidate = source.slice(0,from) + insert + source.slice(to);
  // A successful wrapper must actually become a group in this Markdown context.
  if (!parseGroups(candidate).some(group => group.from === from+before.length && group.body === body+bodyEnd)) return null;
  return {from,to,insert};
}

function currentGroup(source: string, group: GalleryGroup): GalleryGroup|undefined {
  return parseGroups(source).find(candidate => candidate.from === group.from && candidate.to === group.to && candidate.raw === group.raw);
}

export function updateGroup(source: string, group: GalleryGroup, patch: Partial<GalleryOptions>): SourceEdit|null {
  const current = currentGroup(source,group);
  if (!current) return null;
  const firstLineEnd = source.indexOf('\n',current.from);
  const end = firstLineEnd > current.from && source[firstLineEnd-1] === '\r' ? firstLineEnd-1 : firstLineEnd;
  const indent = /^ */.exec(source.slice(current.from,end))?.[0] ?? '';
  return {from:current.from,to:end,insert:indent + serializeOpen(normalizeOptions(patch,current.options))};
}

export function unwrapGroup(source: string, group: GalleryGroup): SourceEdit|null {
  const current = currentGroup(source,group);
  if (!current) return null;
  // Consume the closing marker's own newline; the body's exact newline remains.
  const end = source.startsWith('\r\n',current.to) ? current.to+2 : source[current.to] === '\n' ? current.to+1 : current.to;
  return {from:current.from,to:end,insert:current.body};
}

export function parseCustomGrid(grid: string): {areas: string; columns: number; slots: number}|{error: string} {
  const rows = grid.trim().split(/\r?\n/).map(row => row.replace(/[ \t]/g,'')).filter(Boolean);
  if (!rows.length || !rows[0].length) return {error:'请输入包含字母区域的网格。'};
  const columns = rows[0].length;
  if (rows.length > 64 || columns > 64) return {error:'网格的行列数应在 1 至 64 之间。'};
  if (rows.some(row => row.length !== columns)) return {error:'每行需要包含相同数量的网格单元。'};
  if (rows.some(row => /[^A-Za-z.]/.test(row))) return {error:'网格单元使用英文字母或空位符号 .。'};
  const regions = new Map<string,{top:number;bottom:number;left:number;right:number;count:number}>();
  rows.forEach((row,y) => [...row].forEach((letter,x) => {
    if (letter === '.') return;
    const region = regions.get(letter);
    if (region) {region.bottom = y;region.left = Math.min(region.left,x);region.right = Math.max(region.right,x);region.count++;}
    else regions.set(letter,{top:y,bottom:y,left:x,right:x,count:1});
  }));
  if (!regions.size) return {error:'网格需要至少一个字母区域。'};
  for (const [letter,region] of regions) if ((region.bottom-region.top+1)*(region.right-region.left+1) !== region.count) return {error:`字母 ${letter} 的区域需要组成完整矩形。`};
  const indexes = new Map([...regions.keys()].map((letter,index) => [letter,index]));
  const areas = rows.map(row => `"${[...row].map(letter => letter === '.' ? '.' : `image-${indexes.get(letter)}`).join(' ')}"`).join(' ');
  return {areas,columns,slots:regions.size};
}
