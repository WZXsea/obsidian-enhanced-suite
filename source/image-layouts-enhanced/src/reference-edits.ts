import {parseGroups, type SourceEdit} from './model';
import {resolveGallerySourceTarget} from './source-target';
import type {GalleryGroup} from './types';

interface LegacyBoundary { closingFrom: number; character: string; length: number; hasMetadata: boolean }

function safeOffset(source: string, offset: number): boolean {
  return Number.isInteger(offset) && offset >= 0 && offset <= source.length &&
    !(offset > 0 && offset < source.length &&
      ((source[offset - 1] === '\r' && source[offset] === '\n') ||
        (/[\uD800-\uDBFF]/.test(source[offset - 1]) && /[\uDC00-\uDFFF]/.test(source[offset]))));
}

/** Verify that the supplied legacy imagesBody excludes its YAML and its closing fence. */
function legacyBoundary(group: GalleryGroup): LegacyBoundary | null {
  const opening = /^ {0,3}(`{3,}|~{3,})[ \t]*image-layout(?:-[\w-]+)?[ \t]*\r?\n/.exec(group.raw);
  if (!opening) return null;
  const character = opening[1][0], length = opening[1].length;
  const close = new RegExp(`^ {0,3}${character}{${length},}[ \\t]*(?:\\r?\\n|$)`, 'gm');
  close.lastIndex = opening[0].length;
  const match = close.exec(group.raw);
  if (!match || group.raw.slice(match.index + match[0].length).trim()) return null;
  const rawBody = group.raw.slice(opening[0].length, match.index);
  const metadata = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/.exec(rawBody);
  const bodyStart = group.from + opening[0].length + (metadata?.[0].length ?? 0);
  const closingFrom = group.from + match.index;
  if (group.bodyFrom < bodyStart || group.bodyTo > closingFrom ||
    group.raw.slice(bodyStart - group.from, group.bodyFrom - group.from).trim() ||
    group.raw.slice(group.bodyTo - group.from, closingFrom - group.from).trim()) return null;
  return {closingFrom, character, length, hasMetadata: Boolean(metadata)};
}

/** Build a local body edit against the latest source, retaining the current marker/configuration. */
export function buildReferenceBodyEdit(source: string, snapshot: GalleryGroup, expectedBody: string, replacementBody: string): SourceEdit | null {
  const target = resolveGallerySourceTarget(source, snapshot);
  if (!target) return null;
  const group = target.group;
  if (!safeOffset(source, group.bodyFrom) || !safeOffset(source, group.bodyTo) ||
    group.bodyFrom > group.bodyTo || group.body !== expectedBody ||
    source.slice(group.bodyFrom, group.bodyTo) !== expectedBody) return null;
  // A body starts on its own line; preserving that boundary retains any preceding YAML.
  if (group.bodyFrom > 0 && source[group.bodyFrom - 1] !== '\n') return null;
  if (/<!--[ \t]*\/?image-layouts(?::|[ \t]*-->)/i.test(replacementBody)) return null;

  const legacy = group.kind === 'fence' ? legacyBoundary(group) : undefined;
  if (group.kind === 'fence' && !legacy) return null;
  const eol = /\r\n|\n/.exec(group.raw)?.[0] ?? /\r\n|\n/.exec(source)?.[0] ?? '\n';
  let insert = replacementBody.replace(/\r\n|\r|\n/g, eol);
  if (legacy) {
    // Inside a legacy code block, a matching closing fence would escape the verified body range.
    const close = new RegExp(`^ {0,3}${legacy.character}{${legacy.length},}[ \\t]*$`, 'm');
    if (close.test(insert.replace(/\r\n/g, '\n'))) return null;
    // A new leading YAML block would become configuration on the next legacy render.
    if (!legacy.hasMetadata && /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/.test(insert)) return null;
  }
  const suffixHasNewline = source[group.bodyTo] === '\n' || source.startsWith('\r\n', group.bodyTo);
  if (insert && !insert.endsWith('\n') && !suffixHasNewline) insert += eol;
  const edit = {from: group.bodyFrom, to: group.bodyTo, insert};
  if (group.kind === 'comment') {
    // Unclosed Markdown fences, HTML comments and raw-code tags can conceal the outer marker.
    const changed = source.slice(0, edit.from) + insert + source.slice(edit.to);
    const next = parseGroups(changed).find(candidate => candidate.from === group.from);
    if (!next || next.bodyFrom !== group.bodyFrom || next.bodyTo !== group.bodyFrom + insert.length ||
      next.to !== group.to + insert.length - (group.bodyTo - group.bodyFrom)) return null;
  }
  return edit;
}
