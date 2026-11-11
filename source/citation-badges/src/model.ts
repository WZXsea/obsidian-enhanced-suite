import type { Cluster, Definition, DocumentModel, Reference } from './types';

interface Line { from: number; to: number; text: string; }
interface QuotedLine { text: string; offset: number; depth: number; }

function linesOf(source: string): Line[] {
  const lines: Line[] = [];
  let from = 0;
  for (const text of source.split('\n')) {
    const clean = text.endsWith('\r') ? text.slice(0, -1) : text;
    lines.push({ from, to: from + text.length, text: clean });
    from += text.length + 1;
  }
  return lines;
}

function unquote(text: string): QuotedLine {
  let offset = 0, depth = 0;
  while (true) {
    const match = /^ {0,3}>[ \t]?/.exec(text.slice(offset));
    if (!match) break;
    offset += match[0].length;
    depth++;
  }
  return { text: text.slice(offset), offset, depth };
}

function escaped(source: string, at: number): boolean {
  let count = 0;
  while (at > 0 && source[--at] === '\\') count++;
  return count % 2 === 1;
}

function maskRange(mask: Uint8Array, from: number, to: number): void {
  mask.fill(1, Math.max(0, from), Math.min(mask.length, to));
}

/** Hide block syntax before scanning inline syntax. Offsets always refer to the original source. */
function maskBlocks(lines: Line[], mask: Uint8Array): void {
  const first = lines[0]?.text.replace(/^\uFEFF/, '');
  if (first === '---') {
    const end = lines.findIndex((line, index) => index > 0 && /^(?:---|\.\.\.)\s*$/.test(line.text));
    if (end >= 0) maskRange(mask, 0, lines[end].to + 1);
  }
  let fence: { char: string; length: number } | null = null;
  for (const line of lines) {
    if (mask[line.from]) continue;
    const text = unquote(line.text).text;
    // Allow nested-list indentation. Literal indented code is also excluded below.
    const match = /^[ \t]*(?:[-+*][ \t]+|\d+[.)][ \t]+)?(`{3,}|~{3,})(.*)$/.exec(text);
    if (fence) {
      maskRange(mask, line.from, line.to + 1);
      if (match && match[1][0] === fence.char && match[1].length >= fence.length && /^\s*$/.test(match[2])) fence = null;
    } else if (match && (match[1][0] !== '`' || !match[2].includes('`'))) {
      fence = { char: match[1][0], length: match[1].length };
      maskRange(mask, line.from, line.to + 1);
    }
  }
}

function maskComments(source: string, mask: Uint8Array): void {
  for (let at = 0; at < source.length; at++) {
    if (mask[at] || escaped(source, at)) continue;
    const opening = source.startsWith('<!--', at) ? '<!--' : source.startsWith('%%', at) ? '%%' : null;
    if (!opening) continue;
    const closing = opening === '<!--' ? '-->' : '%%';
    let end = source.indexOf(closing, at + opening.length);
    while (end >= 0 && (mask[end] || escaped(source, end))) end = source.indexOf(closing, end + closing.length);
    const to = end < 0 ? source.length : end + closing.length;
    maskRange(mask, at, to);
    at = to - 1;
  }
}

function maskCodeSpans(source: string, mask: Uint8Array): void {
  for (let at = 0; at < source.length; at++) {
    if (mask[at] || source[at] !== '`' || escaped(source, at)) continue;
    let runEnd = at + 1;
    while (source[runEnd] === '`') runEnd++;
    const length = runEnd - at;
    let end = runEnd;
    while (end < source.length) {
      if (mask[end]) { end++; continue; }
      if (source[end] !== '`') { end++; continue; }
      let closeEnd = end + 1;
      while (source[closeEnd] === '`') closeEnd++;
      if (closeEnd - end === length) {
        maskRange(mask, at, closeEnd);
        at = closeEnd - 1;
        break;
      }
      end = closeEnd;
    }
    if (end >= source.length) at = runEnd - 1; // Unmatched backticks remain literal Markdown.
  }
}

function indentation(text: string): { columns: number; offset: number } {
  let columns = 0, offset = 0;
  while (text[offset] === ' ' || text[offset] === '\t') {
    columns = text[offset] === '\t' ? columns + 4 - columns % 4 : columns + 1;
    offset++;
  }
  return { columns, offset };
}

/** List continuation indentation belongs to the list; four additional columns introduce code. */
function maskIndentedCode(lines: Line[], mask: Uint8Array): void {
  let listIndents: number[] = [], quoteDepth = 0, blank = true, paragraph = false, inCode = false;
  for (const line of lines) {
    const q = unquote(line.text);
    if (q.depth !== quoteDepth) { listIndents = []; blank = true; paragraph = false; inCode = false; quoteDepth = q.depth; }
    if (/^\s*$/.test(q.text)) { blank = true; paragraph = false; continue; }
    if (mask[line.from + q.offset + indentation(q.text).offset]) { blank = true; paragraph = false; inCode = false; continue; }
    const indent = indentation(q.text);
    const marker = /^(?:[-+*]|\d+[.)])([ \t]+)/.exec(q.text.slice(indent.offset));
    if (marker && !inCode) {
      while (listIndents.length && indent.columns < listIndents[listIndents.length - 1]) listIndents.pop();
      listIndents.push(indent.columns + marker[0].length);
      blank = false; paragraph = true; continue;
    }
    // A dedented paragraph after a blank line leaves the list. Lazy continuation stays in it.
    if (blank && indent.columns < (listIndents[listIndents.length - 1] ?? 0)) {
      while (listIndents.length && indent.columns < listIndents[listIndents.length - 1]) listIndents.pop();
    }
    const base = listIndents[listIndents.length - 1] ?? 0;
    if (indent.columns - base >= 4 && (blank || !paragraph || inCode)) {
      maskRange(mask, line.from, line.to + 1);
      inCode = true; paragraph = false; blank = false;
    } else {
      inCode = false;
      paragraph = !/^ {0,3}(?:#{1,6}[ \t]|(?:[-*_][ \t]*){3,}$)/.test(q.text);
      blank = false;
    }
  }
}

function maskHtmlTags(source: string, mask: Uint8Array): void {
  for (let at = 0; at < source.length; at++) {
    if (mask[at] || escaped(source, at) || source[at] !== '<' || !/^<(?:\/?[A-Za-z][A-Za-z0-9-]*(?=[\s/>])|![A-Za-z])/.test(source.slice(at))) continue;
    let quote = '', end = at + 1;
    for (; end < source.length; end++) {
      const char = source[end];
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    if (end < source.length) { maskRange(mask, at, end + 1); at = end; }
  }
}

function maskMath(source: string, mask: Uint8Array): void {
  for (let at = 0; at < source.length; at++) {
    if (mask[at] || source[at] !== '$' || escaped(source, at)) continue;
    const display = source[at + 1] === '$';
    const length = display ? 2 : 1;
    if (!display && /\s/.test(source[at + 1] ?? ' ')) continue;
    let end = at + length;
    for (; end < source.length; end++) {
      if (!display && (source[end] === '\n' || (source[end] === '$' && source[end + 1] === '$'))) break;
      if (mask[end] || source[end] !== '$' || escaped(source, end)) continue;
      if (display ? source[end + 1] === '$' : !/\s/.test(source[end - 1]) && !/\d/.test(source[end + 1] ?? '')) {
        maskRange(mask, at, end + length); at = end + length - 1; break;
      }
    }
  }
}

function readDefinitions(lines: Line[], mask: Uint8Array): Map<string, Definition> {
  const definitions = new Map<string, Definition>();
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index], quoted = unquote(line.text);
    const match = /^ {0,3}\[\^([^\]\s]+)\]:[ \t]*(.*)$/.exec(quoted.text);
    if (!match) continue;
    const marker = line.from + quoted.offset + quoted.text.indexOf('[^');
    if (mask[marker]) continue;
    const content = [match[2]];
    let last = index;
    for (let next = index + 1; next < lines.length; next++) {
      const candidate = lines[next], q = unquote(candidate.text);
      if (q.depth !== quoted.depth) break;
      if (/^\s*$/.test(q.text)) {
        // A blank line belongs to this definition only when followed by another continuation.
        let after = next + 1;
        while (after < lines.length && /^\s*$/.test(unquote(lines[after].text).text)) after++;
        const following = lines[after] && unquote(lines[after].text);
        if (!following || following.depth !== quoted.depth || !/^(?: {2,}|\t)/.test(following.text)) break;
        content.push(''); last = next; continue;
      }
      const continuation = /^( {2,}|\t)(.*)$/.exec(q.text);
      if (!continuation) break;
      // Native footnotes consume four base columns; further indentation belongs
      // to the body (nested lists or indented code). Retain older 2–3-space lazy
      // continuation paragraphs and one-Tab continuation prefixes.
      content.push(continuation[1] === '\t' ? continuation[2] : continuation[1].slice(4) + continuation[2]);
      last = next;
    }
    const definition: Definition = { id: match[1], from: line.from, to: lines[last].to, content: content.join('\n') };
    if (!definitions.has(definition.id)) definitions.set(definition.id, definition);
    maskRange(mask, line.from, lines[last].to + 1);
    index = last;
  }
  return definitions;
}

function closingBracket(source: string, opening: number, mask: Uint8Array): number {
  let depth = 1;
  for (let at = opening + 1; at < source.length; at++) {
    if (mask[at] || escaped(source, at)) continue;
    if (source[at] === '[') depth++;
    else if (source[at] === ']' && --depth === 0) return at;
    if (source[at] === '\n' && /^\s*\n/.test(source.slice(at + 1))) return -1;
  }
  return -1;
}

/** Preserve citation order; compression applies only to ascending runs in that order. */
export function formatNumbers(numbers: number[], minRun = 3): string {
  const unique = [...new Set(numbers.filter(number => Number.isInteger(number) && number > 0))];
  const threshold = Math.max(2, Math.floor(minRun));
  const parts: string[] = [];
  for (let start = 0; start < unique.length;) {
    let end = start + 1;
    while (end < unique.length && unique[end] === unique[end - 1] + 1) end++;
    if (end - start >= threshold) parts.push(`${unique[start]}–${unique[end - 1]}`);
    else parts.push(...unique.slice(start, end).map(String));
    start = end;
  }
  return parts.join(',');
}

export function buildDocumentModel(source: string): DocumentModel {
  const lines = linesOf(source), mask = new Uint8Array(source.length);
  maskBlocks(lines, mask);
  maskComments(source, mask);
  maskIndentedCode(lines, mask);
  maskCodeSpans(source, mask);
  maskHtmlTags(source, mask);
  maskMath(source, mask);
  const definitions = readDefinitions(lines, mask);
  const references: Reference[] = [];
  const numbers = new Map<string, number>(), occurrences = new Map<string, number>();
  let nextNumber = 1;
  for (let at = 0; at < source.length; at++) {
    if (mask[at] || escaped(source, at)) continue;
    if (source.startsWith('^[', at)) {
      const end = closingBracket(source, at + 1, mask);
      if (end < 0) continue;
      const number = nextNumber++;
      references.push({ kind: 'inline', sourceId: `[inline${number - 1}`, from: at, to: end + 1, number, occurrence: 0,
        definition: null, content: source.slice(at + 2, end) });
      at = end; continue;
    }
    if (!source.startsWith('[^', at)) continue;
    const match = /^\[\^([^\]\s]+)\]/.exec(source.slice(at));
    if (!match || escaped(source, at + 2)) continue;
    const id = match[1], to = at + match[0].length;
    if (source[to] === ':' || mask.subarray(at, to).some(Boolean)) continue;
    const definition = definitions.get(id) ?? null;
    let number: number | null = null;
    if (definition) {
      number = numbers.get(id) ?? nextNumber++;
      numbers.set(id, number);
    }
    const occurrence = occurrences.get(id) ?? 0;
    occurrences.set(id, occurrence + 1);
    references.push({ kind: 'standard', sourceId: id, from: at, to, number, occurrence, definition, content: definition?.content ?? '' });
    at = to - 1;
  }
  const clusters: Cluster[] = [];
  let current: Cluster | null = null;
  for (const reference of references) {
    if (reference.kind !== 'standard' || reference.number === null) { current = null; continue; }
    if (!current || current.to !== reference.from) {
      current = { from: reference.from, to: reference.to, members: [], numbers: [], label: '' };
      clusters.push(current);
    }
    current.members.push(reference);
    current.to = reference.to;
    if (!current.numbers.includes(reference.number)) current.numbers.push(reference.number);
  }
  for (const cluster of clusters) cluster.label = formatNumbers(cluster.numbers);
  return { source, definitions, references, clusters };
}
