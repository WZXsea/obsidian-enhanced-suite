import { buildDocumentModel } from './model';
import type { Definition, DocumentModel, Reference } from './types';

export type DefinitionEditErrorCode = 'missing' | 'conflict' | 'invalid';

/** The caller can keep the draft open and show a specific save status. */
export class DefinitionEditError extends Error {
  constructor(public readonly code: DefinitionEditErrorCode, message: string) {
    super(message);
    this.name = 'DefinitionEditError';
  }
}

export interface DefinitionEditResult {
  source: string;
  /** Replacement coordinates refer to the source before this edit. */
  from: number;
  to: number;
  insert: string;
  /** The parsed definition after this edit; use its content for the next conflict check. */
  definition: Definition;
}

interface QuotedLine { text: string; prefix: string; depth: number; }

function unquote(line: string): QuotedLine {
  let offset = 0, depth = 0;
  while (true) {
    const match = /^ {0,3}>[ \t]?/.exec(line.slice(offset));
    if (!match) break;
    offset += match[0].length;
    depth++;
  }
  return { text: line.slice(offset), prefix: line.slice(0, offset), depth };
}

function normalizeNewlines(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

function linePrefix(line: string, depth: number): string | null {
  const quoted = unquote(line);
  if (quoted.depth !== depth || /^\s*$/.test(quoted.text)) return null;
  const indentation = /^(?: {2,}|\t)/.exec(quoted.text);
  if (!indentation) return null;
  const base = indentation[0] === '\t' ? '\t' : indentation[0].slice(0, 4);
  return quoted.prefix + base;
}

function bodyPrefix(prefix: string): string {
  const quoted = unquote(prefix);
  // Native footnotes require four columns for paragraph breaks and block syntax
  // such as lists/fences. Upgrade legacy lazy-continuation spacing when saving;
  // a Tab already provides four columns and preserves its authored style.
  if (/^ {2,3}$/.test(quoted.text)) {
    return prefix + ' '.repeat(4 - quoted.text.length);
  }
  return prefix;
}

function sameReference(before: Reference, after: Reference, from: number, to: number, delta: number): boolean {
  const shift = before.from >= to ? delta : 0;
  return (before.to <= from || before.from >= to)
    && before.kind === after.kind && before.sourceId === after.sourceId
    && before.number === after.number && before.occurrence === after.occurrence
    && after.from === before.from + shift && after.to === before.to + shift;
}

/**
 * A body line is always emitted as a continuation of the existing definition.
 * Verify that Markdown entered in that body cannot capture or create citations
 * outside the replaced block (for example an unfinished comment or fence).
 */
function verifyBoundary(before: DocumentModel, after: DocumentModel, id: string,
  from: number, to: number, insertLength: number, definitionEnd: number): Definition {
  const changed = after.definitions.get(id);
  const delta = insertLength - (to - from);
  if (!changed || changed.from !== from || changed.to !== definitionEnd) {
    throw new DefinitionEditError('invalid', '引用正文的 Markdown 边界需要补全，当前草稿已保留。');
  }
  if (before.definitions.size !== after.definitions.size) {
    throw new DefinitionEditError('invalid', '引用正文的 Markdown 边界需要补全，当前草稿已保留。');
  }
  for (const [otherId, definition] of before.definitions) {
    if (otherId === id) continue;
    const next = after.definitions.get(otherId), shift = definition.from >= to ? delta : 0;
    if (!next || next.content !== definition.content
      || next.from !== definition.from + shift || next.to !== definition.to + shift) {
      throw new DefinitionEditError('invalid', '引用正文的 Markdown 边界需要补全，当前草稿已保留。');
    }
  }
  if (before.references.length !== after.references.length
    || before.references.some((reference, index) => !sameReference(reference, after.references[index], from, to, delta))) {
    throw new DefinitionEditError('invalid', '引用正文的 Markdown 边界需要补全，当前草稿已保留。');
  }
  return changed;
}

/**
 * Replace only the body of one existing standard footnote. The authored marker,
 * quote prefix and first-line whitespace stay intact. Continuation prefixes are
 * retained by line where possible, then follow the existing indentation style.
 */
export function replaceDefinitionContent(source: string, id: string, expectedContent: string,
  nextContent: string): DefinitionEditResult {
  const before = buildDocumentModel(source), definition = before.definitions.get(id);
  if (!definition) throw new DefinitionEditError('missing', '当前引用定义已移除，编辑草稿已保留。');
  if (definition.content !== normalizeNewlines(expectedContent)) {
    throw new DefinitionEditError('conflict', '引用正文已有其他修改，请核对当前正文与编辑草稿。');
  }

  // The model includes CR but excludes LF at the end of a CRLF line. Keep both
  // terminal characters outside the replacement, including for an empty body.
  const from = definition.from;
  const retainedCR = source[definition.to - 1] === '\r';
  const to = definition.to - Number(retainedCR);
  const original = source.slice(from, to);
  const normalized = normalizeNewlines(nextContent);
  if (normalized === definition.content) {
    return { source, from, to, insert: original, definition };
  }

  const lines = original.split('\n').map(line => line.endsWith('\r') ? line.slice(0, -1) : line);
  const first = unquote(lines[0]);
  const marker = /^( {0,3})\[\^([^\]\s]+)\]:[ \t]*/.exec(first.text);
  if (!marker || marker[2] !== id) {
    throw new DefinitionEditError('invalid', '当前引用定义的格式需要核对，编辑草稿已保留。');
  }
  const prefix = first.prefix + marker[0];
  const continuation = lines.slice(1).map(line => linePrefix(line, first.depth)).find(value => value !== null)
    ?? first.prefix + '    ';
  const newline = /\r\n|\n/.exec(original)?.[0] ?? /\r\n|\n/.exec(source)?.[0] ?? '\n';
  const contentLines = normalized.split('\n');
  const renderedLines = contentLines.map((line, index) => {
    if (index === 0) return prefix + line;
    const oldLine = lines[index];
    if (/^\s*$/.test(line)) {
      // Quote markers must stay on blank lines to keep the same quote depth.
      if (oldLine !== undefined) {
        const old = unquote(oldLine);
        if (old.depth === first.depth && /^\s*$/.test(old.text)) return oldLine;
      }
      return first.prefix + line;
    }
    const continued = oldLine === undefined ? continuation : linePrefix(oldLine, first.depth) ?? continuation;
    return bodyPrefix(continued) + line;
  });
  const insert = renderedLines.join(newline);
  let lastContentLine = contentLines.length - 1;
  while (lastContentLine > 0 && /^\s*$/.test(contentLines[lastContentLine])) lastContentLine--;
  const boundaryCR = lastContentLine < renderedLines.length - 1 ? newline === '\r\n' : retainedCR;
  const definitionEnd = from + renderedLines.slice(0, lastContentLine + 1).join(newline).length + Number(boundaryCR);
  const updated = source.slice(0, from) + insert + source.slice(to);
  const nextDefinition = verifyBoundary(before, buildDocumentModel(updated), id, from, to, insert.length, definitionEnd);
  return { source: updated, from, to, insert, definition: nextDefinition };
}
