// Image parsing adapted from the local Note Image Sidebar project by weizixun.
export interface ImageReference {
  target: string;
  alt: string;
  kind: 'markdown' | 'wiki' | 'reference' | 'html';
  /** Zero-based source line, suitable for Editor.setCursor(). */
  line: number;
  offset: number;
  raw: string;
}

const IMAGE_EXTENSION = /\.(?:avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|tiff?|webp)$/i;
const unescapeMarkdown = (value: string) => value.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, '$1');
const normalizeLabel = (value: string) => unescapeMarkdown(value).trim().replace(/\s+/g, ' ').toLowerCase();
const decodeEntities = (value: string) => value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
  const names: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
  if (entity[1] !== '#') return names[entity.toLowerCase()] ?? entity;
  const code = entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
});

/** HTTP images can use extensionless endpoints; local embeds must be image files. */
function isImage(target: string): boolean {
  if (/^(?:https?:\/\/|data:image\/)/i.test(target)) return true;
  let path = target.split(/[?#]/, 1)[0];
  try { path = decodeURIComponent(path); } catch { /* Preserve malformed literal paths. */ }
  return IMAGE_EXTENSION.test(path);
}

function visibleSource(text: string): string {
  const chars = text.split('');
  const hide = (start: number, end: number) => {
    for (let i = start; i < end; i++) if (chars[i] !== '\n' && chars[i] !== '\r') chars[i] = ' ';
  };
  const frontmatter = /^(?:\uFEFF)?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
  if (frontmatter) hide(0, frontmatter[0].length);
  for (const match of text.matchAll(/<!--[\s\S]*?(?:-->|$)/g)) hide(match.index!, match.index! + match[0].length);
  let fence: { char: string; size: number } | undefined;
  let offset = 0;
  for (const line of text.split(/(?<=\n)/)) {
    const available = chars.slice(offset, offset + line.length).join('');
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)/.exec(available);
    if (fence) {
      hide(offset, offset + line.length);
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.size && /^\s*$/.test(marker[2])) fence = undefined;
    } else if (marker && !(marker[1][0] === '`' && marker[2].includes('`'))) {
      fence = { char: marker[1][0], size: marker[1].length };
      hide(offset, offset + line.length);
    }
    offset += line.length;
  }
  let source = chars.join('');
  // Raw HTML code/text containers preserve their contents as examples, like fences.
  for (const match of source.matchAll(/<(pre|code|script|style|textarea)\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?(?:<\/\1\s*>|$)/gi)) hide(match.index!,match.index!+match[0].length);
  source = chars.join('');
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== '`' || escaped(source, i)) continue;
    let end = i;
    while (source[end] === '`') end++;
    const size = end - i;
    let closing = end;
    while ((closing = source.indexOf('`'.repeat(size), closing)) >= 0) {
      if (source[closing - 1] !== '`' && source[closing + size] !== '`') break;
      closing += size;
    }
    if (closing >= 0) { hide(i, closing + size); i = closing + size - 1; }
    else i = end - 1;
  }
  source = chars.join('');
  return source;
}

function escaped(text: string, index: number): boolean {
  let slashes = 0;
  while (index > 0 && text[--index] === '\\') slashes++;
  return slashes % 2 === 1;
}

function closingBracket(text: string, start: number): number {
  let depth = 1;
  for (let i = start; i < text.length; i++) {
    if (escaped(text, i)) continue;
    if (text[i] === '[') depth++;
    if (text[i] === ']' && --depth === 0) return i;
  }
  return -1;
}

function destination(text: string, start: number): { target: string; end: number } | undefined {
  let i = start;
  while (/\s/.test(text[i] ?? '') && i < text.length) i++;
  const first = i;
  let target: string;
  if (text[i] === '<') {
    i++;
    const pathStart = i;
    while (i < text.length && (text[i] !== '>' || escaped(text, i)) && text[i] !== '\n') i++;
    if (text[i] !== '>') return;
    target = text.slice(pathStart, i++);
  } else {
    let depth = 0;
    while (i < text.length) {
      if (!escaped(text, i)) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')') { if (depth === 0) break; depth--; }
        else if (/\s/.test(text[i]) && depth === 0) break;
      }
      i++;
    }
    if (i === first) return;
    target = text.slice(first, i);
  }
  return { target: unescapeMarkdown(target), end: i };
}

export function extractImages(text: string): ImageReference[] {
  const source = visibleSource(text);
  const refs = new Map<string, string>();
  for (const match of source.matchAll(/^ {0,3}\[/gm)) {
    const start = match.index! + match[0].length;
    const bracket = closingBracket(source, start);
    if (bracket < 0 || source[bracket + 1] !== ':' || /[\r\n]/.test(source.slice(start, bracket))) continue;
    const end = source.indexOf('\n', bracket);
    const parsed = destination(source.slice(bracket + 2, end < 0 ? source.length : end), 0);
    const label = normalizeLabel(source.slice(start, bracket));
    if (parsed && !refs.has(label)) refs.set(label, parsed.target);
  }
  const results: ImageReference[] = [];
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);
  const add = (offset: number, end: number, target: string, alt: string, kind: ImageReference['kind']) => {
    if (!isImage(target)) return;
    let low = 0, high = lineStarts.length;
    while (low + 1 < high) { const mid = (low + high) >>> 1; if (lineStarts[mid] <= offset) low = mid; else high = mid; }
    results.push({ target, alt, kind, line: low, offset, raw: text.slice(offset, end) });
  };
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '<' && /^<img\b/i.test(source.slice(i))) {
      const tag = /^<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(source.slice(i));
      if (!tag) continue;
      const attributes = new Map<string, string>();
      for (const attr of tag[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attributes.set(attr[1].toLowerCase(), decodeEntities(attr[2] ?? attr[3] ?? attr[4]));
      if (attributes.has('src')) add(i, i + tag[0].length, attributes.get('src')!, attributes.get('alt') ?? '', 'html');
      i += tag[0].length - 1;
      continue;
    }
    if (source[i] !== '!' || source[i + 1] !== '[' || escaped(source, i)) continue;
    if (source[i + 2] === '[') {
      const end = source.indexOf(']]', i + 3);
      if (end < 0 || /[\r\n]/.test(source.slice(i + 3, end))) continue;
      const [target, ...aliases] = text.slice(i + 3, end).split('|');
      add(i, end + 2, target.trim(), aliases.join('|'), 'wiki');
      i = end + 1;
      continue;
    }
    const bracket = closingBracket(source, i + 2);
    if (bracket < 0) continue;
    const alt = unescapeMarkdown(text.slice(i + 2, bracket));
    let end = bracket + 1;
    if (source[end] === '(') {
      const parsed = destination(source, end + 1);
      if (!parsed) continue;
      end = parsed.end;
      while (/\s/.test(source[end] ?? '') && end < source.length) end++;
      if (/['"(]/.test(source[end] ?? '')) {
        const quote = source[end++] === '(' ? ')' : source[end - 1];
        while (end < source.length && (source[end] !== quote || escaped(source, end))) end++;
        if (source[end] !== quote) continue;
        end++;
        while (/\s/.test(source[end] ?? '') && end < source.length) end++;
      }
      if (source[end] !== ')') continue;
      add(i, end + 1, parsed.target, alt, 'markdown');
      i = end;
    } else {
      let label = alt;
      if (source[end] === '[') {
        const labelEnd = closingBracket(source, end + 1);
        if (labelEnd < 0) continue;
        label = source.slice(end + 1, labelEnd) || alt;
        end = labelEnd + 1;
      }
      const target = refs.get(normalizeLabel(label));
      if (target) { add(i, end, target, alt, 'reference'); i = end - 1; }
    }
  }
  return results;
}

/** Render captions and surrounding prose independently from image layout cells. */
export function getSupplementalMarkdown(body: string, knownReferences?: readonly ImageReference[]): string {
  let output = body;
  const references = knownReferences ?? extractImages(body);
  const unique = new Map<number,ImageReference>();
  for (const image of references) {
    if (Number.isInteger(image.offset) && image.offset >= 0 && image.raw.length > 0 && body.slice(image.offset,image.offset+image.raw.length) === image.raw) unique.set(image.offset,image);
  }
  for (const image of [...unique.values()].sort((a,b) => b.offset-a.offset)) output = output.slice(0,image.offset) + output.slice(image.offset+image.raw.length);
  return output.trim();
}
