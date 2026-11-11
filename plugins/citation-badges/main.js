"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => CitationBadgesPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/editor.ts
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");
var import_obsidian = require("obsidian");
var refreshComposition = import_state.StateEffect.define();
function editorPath(view) {
  var _a, _b, _c;
  const info = view.state.field(import_obsidian.editorInfoField, false);
  const path = (_c = (_b = (_a = info == null ? void 0 : info.file) == null ? void 0 : _a.path) != null ? _b : info == null ? void 0 : info.path) != null ? _c : "";
  return view.dom.closest(".citation-inline-editor") ? `__citation-inline__/${path}` : path;
}
function widgetIdentity(cluster, path) {
  return JSON.stringify([
    path,
    cluster.from,
    cluster.to,
    cluster.label,
    cluster.numbers,
    cluster.members.map((member) => [
      member.kind,
      member.sourceId,
      member.from,
      member.to,
      member.number,
      member.occurrence,
      member.content,
      member.definition && [
        member.definition.id,
        member.definition.from,
        member.definition.to,
        member.definition.content
      ]
    ])
  ]);
}
var BadgeLifecycle = class {
  constructor(bridge) {
    this.bridge = bridge;
    __publicField(this, "elements", /* @__PURE__ */ new Set());
  }
  mount(cluster, path, view) {
    const element = this.bridge.createBadge(cluster, path, view);
    this.elements.add(element);
    return element;
  }
  dispose(element) {
    if (this.elements.delete(element)) this.bridge.disposeBadge(element);
  }
  destroy() {
    for (const element of [...this.elements]) this.dispose(element);
  }
};
var CitationWidget = class extends import_view.WidgetType {
  constructor(cluster, path, lifecycle) {
    super();
    this.cluster = cluster;
    this.path = path;
    this.lifecycle = lifecycle;
    __publicField(this, "identity");
    this.identity = widgetIdentity(cluster, path);
  }
  eq(other) {
    return this.lifecycle === other.lifecycle && this.identity === other.identity;
  }
  toDOM(view) {
    return this.lifecycle.mount(this.cluster, this.path, view);
  }
  ignoreEvent() {
    return true;
  }
  destroy(element) {
    this.lifecycle.dispose(element);
  }
};
function citationEditorExtension(bridge) {
  return import_view.ViewPlugin.fromClass(class {
    constructor(view) {
      __publicField(this, "decorations", import_view.Decoration.none);
      __publicField(this, "lifecycle", new BadgeLifecycle(bridge));
      __publicField(this, "model");
      __publicField(this, "path");
      __publicField(this, "composing", false);
      __publicField(this, "timer");
      __publicField(this, "disposed", false);
      this.path = editorPath(view);
      this.model = bridge.model(view.state.doc.toString(), this.path);
      this.decorations = this.build(view);
    }
    update(update) {
      const nextPath = editorPath(update.view);
      const pathChanged = nextPath !== this.path;
      if (update.docChanged || pathChanged) {
        this.path = nextPath;
        this.model = bridge.model(update.state.doc.toString(), this.path);
      }
      const modeChanged = update.startState.field(import_obsidian.editorLivePreviewField, false) !== update.state.field(import_obsidian.editorLivePreviewField, false);
      const compositionChanged = update.transactions.some((transaction) => transaction.effects.some((effect) => effect.is(refreshComposition)));
      if (update.docChanged || pathChanged || update.selectionSet || update.viewportChanged || modeChanged || compositionChanged) this.decorations = this.build(update.view);
    }
    build(view) {
      if (view.dom.closest(".citation-inline-editor")) return import_view.Decoration.none;
      if (view.state.field(import_obsidian.editorLivePreviewField, false) !== true) return import_view.Decoration.none;
      const ranges = view.state.selection.ranges;
      const compositionLines = this.composing || view.compositionStarted || view.composing ? ranges.map((range) => ({
        from: view.state.doc.lineAt(range.from).from,
        to: view.state.doc.lineAt(range.to).to
      })) : [];
      const decorations = [];
      for (const cluster of this.model.clusters) {
        if (this.model.source.slice(cluster.from, cluster.to).includes("\n")) continue;
        if (ranges.some((range) => range.from <= cluster.to && range.to >= cluster.from)) continue;
        if (compositionLines.some((line) => line.from <= cluster.to && line.to >= cluster.from)) continue;
        if (!view.visibleRanges.some((range) => range.from < cluster.to && range.to > cluster.from)) continue;
        decorations.push(import_view.Decoration.replace({
          widget: new CitationWidget(cluster, this.path, this.lifecycle),
          inclusive: false
        }).range(cluster.from, cluster.to));
      }
      return import_view.Decoration.set(decorations, true);
    }
    compositionStart(view) {
      this.composing = true;
      this.scheduleRefresh(view, 0, false);
    }
    compositionEnd(view) {
      this.scheduleRefresh(view, 60, true);
    }
    scheduleRefresh(view, delay, endComposition) {
      if (this.timer !== void 0) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.timer = void 0;
        if (this.disposed) return;
        if (endComposition) this.composing = false;
        view.dispatch({ effects: refreshComposition.of(null) });
      }, delay);
    }
    destroy() {
      this.disposed = true;
      if (this.timer !== void 0) clearTimeout(this.timer);
      this.lifecycle.destroy();
    }
  }, {
    decorations: (value) => value.decorations,
    eventObservers: {
      compositionstart(_event, view) {
        this.compositionStart(view);
      },
      compositionend(_event, view) {
        this.compositionEnd(view);
      }
    }
  });
}

// src/model.ts
function linesOf(source) {
  const lines = [];
  let from = 0;
  for (const text of source.split("\n")) {
    const clean = text.endsWith("\r") ? text.slice(0, -1) : text;
    lines.push({ from, to: from + text.length, text: clean });
    from += text.length + 1;
  }
  return lines;
}
function unquote(text) {
  let offset = 0, depth = 0;
  while (true) {
    const match = /^ {0,3}>[ \t]?/.exec(text.slice(offset));
    if (!match) break;
    offset += match[0].length;
    depth++;
  }
  return { text: text.slice(offset), offset, depth };
}
function escaped(source, at) {
  let count = 0;
  while (at > 0 && source[--at] === "\\") count++;
  return count % 2 === 1;
}
function maskRange(mask, from, to) {
  mask.fill(1, Math.max(0, from), Math.min(mask.length, to));
}
function maskBlocks(lines, mask) {
  var _a;
  const first = (_a = lines[0]) == null ? void 0 : _a.text.replace(/^\uFEFF/, "");
  if (first === "---") {
    const end = lines.findIndex((line, index) => index > 0 && /^(?:---|\.\.\.)\s*$/.test(line.text));
    if (end >= 0) maskRange(mask, 0, lines[end].to + 1);
  }
  let fence = null;
  for (const line of lines) {
    if (mask[line.from]) continue;
    const text = unquote(line.text).text;
    const match = /^[ \t]*(?:[-+*][ \t]+|\d+[.)][ \t]+)?(`{3,}|~{3,})(.*)$/.exec(text);
    if (fence) {
      maskRange(mask, line.from, line.to + 1);
      if (match && match[1][0] === fence.char && match[1].length >= fence.length && /^\s*$/.test(match[2])) fence = null;
    } else if (match && (match[1][0] !== "`" || !match[2].includes("`"))) {
      fence = { char: match[1][0], length: match[1].length };
      maskRange(mask, line.from, line.to + 1);
    }
  }
}
function maskComments(source, mask) {
  for (let at = 0; at < source.length; at++) {
    if (mask[at] || escaped(source, at)) continue;
    const opening = source.startsWith("<!--", at) ? "<!--" : source.startsWith("%%", at) ? "%%" : null;
    if (!opening) continue;
    const closing = opening === "<!--" ? "-->" : "%%";
    let end = source.indexOf(closing, at + opening.length);
    while (end >= 0 && (mask[end] || escaped(source, end))) end = source.indexOf(closing, end + closing.length);
    const to = end < 0 ? source.length : end + closing.length;
    maskRange(mask, at, to);
    at = to - 1;
  }
}
function maskCodeSpans(source, mask) {
  for (let at = 0; at < source.length; at++) {
    if (mask[at] || source[at] !== "`" || escaped(source, at)) continue;
    let runEnd = at + 1;
    while (source[runEnd] === "`") runEnd++;
    const length = runEnd - at;
    let end = runEnd;
    while (end < source.length) {
      if (mask[end]) {
        end++;
        continue;
      }
      if (source[end] !== "`") {
        end++;
        continue;
      }
      let closeEnd = end + 1;
      while (source[closeEnd] === "`") closeEnd++;
      if (closeEnd - end === length) {
        maskRange(mask, at, closeEnd);
        at = closeEnd - 1;
        break;
      }
      end = closeEnd;
    }
    if (end >= source.length) at = runEnd - 1;
  }
}
function indentation(text) {
  let columns = 0, offset = 0;
  while (text[offset] === " " || text[offset] === "	") {
    columns = text[offset] === "	" ? columns + 4 - columns % 4 : columns + 1;
    offset++;
  }
  return { columns, offset };
}
function maskIndentedCode(lines, mask) {
  var _a, _b;
  let listIndents = [], quoteDepth = 0, blank = true, paragraph = false, inCode = false;
  for (const line of lines) {
    const q = unquote(line.text);
    if (q.depth !== quoteDepth) {
      listIndents = [];
      blank = true;
      paragraph = false;
      inCode = false;
      quoteDepth = q.depth;
    }
    if (/^\s*$/.test(q.text)) {
      blank = true;
      paragraph = false;
      continue;
    }
    if (mask[line.from + q.offset + indentation(q.text).offset]) {
      blank = true;
      paragraph = false;
      inCode = false;
      continue;
    }
    const indent = indentation(q.text);
    const marker = /^(?:[-+*]|\d+[.)])([ \t]+)/.exec(q.text.slice(indent.offset));
    if (marker && !inCode) {
      while (listIndents.length && indent.columns < listIndents[listIndents.length - 1]) listIndents.pop();
      listIndents.push(indent.columns + marker[0].length);
      blank = false;
      paragraph = true;
      continue;
    }
    if (blank && indent.columns < ((_a = listIndents[listIndents.length - 1]) != null ? _a : 0)) {
      while (listIndents.length && indent.columns < listIndents[listIndents.length - 1]) listIndents.pop();
    }
    const base = (_b = listIndents[listIndents.length - 1]) != null ? _b : 0;
    if (indent.columns - base >= 4 && (blank || !paragraph || inCode)) {
      maskRange(mask, line.from, line.to + 1);
      inCode = true;
      paragraph = false;
      blank = false;
    } else {
      inCode = false;
      paragraph = !/^ {0,3}(?:#{1,6}[ \t]|(?:[-*_][ \t]*){3,}$)/.test(q.text);
      blank = false;
    }
  }
}
function maskHtmlTags(source, mask) {
  for (let at = 0; at < source.length; at++) {
    if (mask[at] || escaped(source, at) || source[at] !== "<" || !/^<(?:\/?[A-Za-z][A-Za-z0-9-]*(?=[\s/>])|![A-Za-z])/.test(source.slice(at))) continue;
    let quote = "", end = at + 1;
    for (; end < source.length; end++) {
      const char = source[end];
      if (quote) {
        if (char === quote) quote = "";
      } else if (char === '"' || char === "'") quote = char;
      else if (char === ">") break;
    }
    if (end < source.length) {
      maskRange(mask, at, end + 1);
      at = end;
    }
  }
}
function maskMath(source, mask) {
  var _a, _b;
  for (let at = 0; at < source.length; at++) {
    if (mask[at] || source[at] !== "$" || escaped(source, at)) continue;
    const display = source[at + 1] === "$";
    const length = display ? 2 : 1;
    if (!display && /\s/.test((_a = source[at + 1]) != null ? _a : " ")) continue;
    let end = at + length;
    for (; end < source.length; end++) {
      if (!display && (source[end] === "\n" || source[end] === "$" && source[end + 1] === "$")) break;
      if (mask[end] || source[end] !== "$" || escaped(source, end)) continue;
      if (display ? source[end + 1] === "$" : !/\s/.test(source[end - 1]) && !/\d/.test((_b = source[end + 1]) != null ? _b : "")) {
        maskRange(mask, at, end + length);
        at = end + length - 1;
        break;
      }
    }
  }
}
function readDefinitions(lines, mask) {
  const definitions = /* @__PURE__ */ new Map();
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index], quoted = unquote(line.text);
    const match = /^ {0,3}\[\^([^\]\s]+)\]:[ \t]*(.*)$/.exec(quoted.text);
    if (!match) continue;
    const marker = line.from + quoted.offset + quoted.text.indexOf("[^");
    if (mask[marker]) continue;
    const content = [match[2]];
    let last = index;
    for (let next = index + 1; next < lines.length; next++) {
      const candidate = lines[next], q = unquote(candidate.text);
      if (q.depth !== quoted.depth) break;
      if (/^\s*$/.test(q.text)) {
        let after = next + 1;
        while (after < lines.length && /^\s*$/.test(unquote(lines[after].text).text)) after++;
        const following = lines[after] && unquote(lines[after].text);
        if (!following || following.depth !== quoted.depth || !/^(?: {2,}|\t)/.test(following.text)) break;
        content.push("");
        last = next;
        continue;
      }
      const continuation = /^( {2,}|\t)(.*)$/.exec(q.text);
      if (!continuation) break;
      content.push(continuation[1] === "	" ? continuation[2] : continuation[1].slice(4) + continuation[2]);
      last = next;
    }
    const definition = { id: match[1], from: line.from, to: lines[last].to, content: content.join("\n") };
    if (!definitions.has(definition.id)) definitions.set(definition.id, definition);
    maskRange(mask, line.from, lines[last].to + 1);
    index = last;
  }
  return definitions;
}
function closingBracket(source, opening, mask) {
  let depth = 1;
  for (let at = opening + 1; at < source.length; at++) {
    if (mask[at] || escaped(source, at)) continue;
    if (source[at] === "[") depth++;
    else if (source[at] === "]" && --depth === 0) return at;
    if (source[at] === "\n" && /^\s*\n/.test(source.slice(at + 1))) return -1;
  }
  return -1;
}
function formatNumbers(numbers, minRun = 3) {
  const unique = [...new Set(numbers.filter((number) => Number.isInteger(number) && number > 0))];
  const threshold = Math.max(2, Math.floor(minRun));
  const parts = [];
  for (let start = 0; start < unique.length; ) {
    let end = start + 1;
    while (end < unique.length && unique[end] === unique[end - 1] + 1) end++;
    if (end - start >= threshold) parts.push(`${unique[start]}\u2013${unique[end - 1]}`);
    else parts.push(...unique.slice(start, end).map(String));
    start = end;
  }
  return parts.join(",");
}
function buildDocumentModel(source) {
  var _a, _b, _c, _d;
  const lines = linesOf(source), mask = new Uint8Array(source.length);
  maskBlocks(lines, mask);
  maskComments(source, mask);
  maskIndentedCode(lines, mask);
  maskCodeSpans(source, mask);
  maskHtmlTags(source, mask);
  maskMath(source, mask);
  const definitions = readDefinitions(lines, mask);
  const references = [];
  const numbers = /* @__PURE__ */ new Map(), occurrences = /* @__PURE__ */ new Map();
  let nextNumber = 1;
  for (let at = 0; at < source.length; at++) {
    if (mask[at] || escaped(source, at)) continue;
    if (source.startsWith("^[", at)) {
      const end = closingBracket(source, at + 1, mask);
      if (end < 0) continue;
      const number2 = nextNumber++;
      references.push({
        kind: "inline",
        sourceId: `[inline${number2 - 1}`,
        from: at,
        to: end + 1,
        number: number2,
        occurrence: 0,
        definition: null,
        content: source.slice(at + 2, end)
      });
      at = end;
      continue;
    }
    if (!source.startsWith("[^", at)) continue;
    const match = /^\[\^([^\]\s]+)\]/.exec(source.slice(at));
    if (!match || escaped(source, at + 2)) continue;
    const id = match[1], to = at + match[0].length;
    if (source[to] === ":" || mask.subarray(at, to).some(Boolean)) continue;
    const definition = (_a = definitions.get(id)) != null ? _a : null;
    let number = null;
    if (definition) {
      number = (_b = numbers.get(id)) != null ? _b : nextNumber++;
      numbers.set(id, number);
    }
    const occurrence = (_c = occurrences.get(id)) != null ? _c : 0;
    occurrences.set(id, occurrence + 1);
    references.push({ kind: "standard", sourceId: id, from: at, to, number, occurrence, definition, content: (_d = definition == null ? void 0 : definition.content) != null ? _d : "" });
    at = to - 1;
  }
  const clusters = [];
  let current = null;
  for (const reference of references) {
    if (reference.kind !== "standard" || reference.number === null) {
      current = null;
      continue;
    }
    if (!current || current.to !== reference.from) {
      current = { from: reference.from, to: reference.to, members: [], numbers: [], label: "" };
      clusters.push(current);
    }
    current.members.push(reference);
    current.to = reference.to;
    if (!current.numbers.includes(reference.number)) current.numbers.push(reference.number);
  }
  for (const cluster of clusters) cluster.label = formatNumbers(cluster.numbers);
  return { source, definitions, references, clusters };
}

// src/callout.ts
function prepareCallout(model, from, to) {
  const clusters = model.clusters.filter((cluster) => cluster.from >= from && cluster.to <= to);
  let source = model.source.slice(from, to);
  for (let index = clusters.length - 1; index >= 0; index--) {
    const cluster = clusters[index];
    source = source.slice(0, cluster.from - from) + `<span data-citation-callout="${index}"></span>` + source.slice(cluster.to - from);
  }
  return { source, clusters };
}

// src/definition-edit.ts
var DefinitionEditError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "DefinitionEditError";
  }
};
function unquote2(line) {
  let offset = 0, depth = 0;
  while (true) {
    const match = /^ {0,3}>[ \t]?/.exec(line.slice(offset));
    if (!match) break;
    offset += match[0].length;
    depth++;
  }
  return { text: line.slice(offset), prefix: line.slice(0, offset), depth };
}
function normalizeNewlines(content) {
  return content.replace(/\r\n?/g, "\n");
}
function linePrefix(line, depth) {
  const quoted = unquote2(line);
  if (quoted.depth !== depth || /^\s*$/.test(quoted.text)) return null;
  const indentation2 = /^(?: {2,}|\t)/.exec(quoted.text);
  if (!indentation2) return null;
  const base = indentation2[0] === "	" ? "	" : indentation2[0].slice(0, 4);
  return quoted.prefix + base;
}
function bodyPrefix(prefix) {
  const quoted = unquote2(prefix);
  if (/^ {2,3}$/.test(quoted.text)) {
    return prefix + " ".repeat(4 - quoted.text.length);
  }
  return prefix;
}
function sameReference(before, after, from, to, delta) {
  const shift = before.from >= to ? delta : 0;
  return (before.to <= from || before.from >= to) && before.kind === after.kind && before.sourceId === after.sourceId && before.number === after.number && before.occurrence === after.occurrence && after.from === before.from + shift && after.to === before.to + shift;
}
function verifyBoundary(before, after, id, from, to, insertLength, definitionEnd) {
  const changed = after.definitions.get(id);
  const delta = insertLength - (to - from);
  if (!changed || changed.from !== from || changed.to !== definitionEnd) {
    throw new DefinitionEditError("invalid", "\u5F15\u7528\u6B63\u6587\u7684 Markdown \u8FB9\u754C\u9700\u8981\u8865\u5168\uFF0C\u5F53\u524D\u8349\u7A3F\u5DF2\u4FDD\u7559\u3002");
  }
  if (before.definitions.size !== after.definitions.size) {
    throw new DefinitionEditError("invalid", "\u5F15\u7528\u6B63\u6587\u7684 Markdown \u8FB9\u754C\u9700\u8981\u8865\u5168\uFF0C\u5F53\u524D\u8349\u7A3F\u5DF2\u4FDD\u7559\u3002");
  }
  for (const [otherId, definition] of before.definitions) {
    if (otherId === id) continue;
    const next = after.definitions.get(otherId), shift = definition.from >= to ? delta : 0;
    if (!next || next.content !== definition.content || next.from !== definition.from + shift || next.to !== definition.to + shift) {
      throw new DefinitionEditError("invalid", "\u5F15\u7528\u6B63\u6587\u7684 Markdown \u8FB9\u754C\u9700\u8981\u8865\u5168\uFF0C\u5F53\u524D\u8349\u7A3F\u5DF2\u4FDD\u7559\u3002");
    }
  }
  if (before.references.length !== after.references.length || before.references.some((reference, index) => !sameReference(reference, after.references[index], from, to, delta))) {
    throw new DefinitionEditError("invalid", "\u5F15\u7528\u6B63\u6587\u7684 Markdown \u8FB9\u754C\u9700\u8981\u8865\u5168\uFF0C\u5F53\u524D\u8349\u7A3F\u5DF2\u4FDD\u7559\u3002");
  }
  return changed;
}
function replaceDefinitionContent(source, id, expectedContent, nextContent) {
  var _a, _b, _c, _d, _e;
  const before = buildDocumentModel(source), definition = before.definitions.get(id);
  if (!definition) throw new DefinitionEditError("missing", "\u5F53\u524D\u5F15\u7528\u5B9A\u4E49\u5DF2\u79FB\u9664\uFF0C\u7F16\u8F91\u8349\u7A3F\u5DF2\u4FDD\u7559\u3002");
  if (definition.content !== normalizeNewlines(expectedContent)) {
    throw new DefinitionEditError("conflict", "\u5F15\u7528\u6B63\u6587\u5DF2\u6709\u5176\u4ED6\u4FEE\u6539\uFF0C\u8BF7\u6838\u5BF9\u5F53\u524D\u6B63\u6587\u4E0E\u7F16\u8F91\u8349\u7A3F\u3002");
  }
  const from = definition.from;
  const retainedCR = source[definition.to - 1] === "\r";
  const to = definition.to - Number(retainedCR);
  const original = source.slice(from, to);
  const normalized = normalizeNewlines(nextContent);
  if (normalized === definition.content) {
    return { source, from, to, insert: original, definition };
  }
  const lines = original.split("\n").map((line) => line.endsWith("\r") ? line.slice(0, -1) : line);
  const first = unquote2(lines[0]);
  const marker = /^( {0,3})\[\^([^\]\s]+)\]:[ \t]*/.exec(first.text);
  if (!marker || marker[2] !== id) {
    throw new DefinitionEditError("invalid", "\u5F53\u524D\u5F15\u7528\u5B9A\u4E49\u7684\u683C\u5F0F\u9700\u8981\u6838\u5BF9\uFF0C\u7F16\u8F91\u8349\u7A3F\u5DF2\u4FDD\u7559\u3002");
  }
  const prefix = first.prefix + marker[0];
  const continuation = (_a = lines.slice(1).map((line) => linePrefix(line, first.depth)).find((value) => value !== null)) != null ? _a : first.prefix + "    ";
  const newline = (_e = (_d = (_b = /\r\n|\n/.exec(original)) == null ? void 0 : _b[0]) != null ? _d : (_c = /\r\n|\n/.exec(source)) == null ? void 0 : _c[0]) != null ? _e : "\n";
  const contentLines = normalized.split("\n");
  const renderedLines = contentLines.map((line, index) => {
    var _a2;
    if (index === 0) return prefix + line;
    const oldLine = lines[index];
    if (/^\s*$/.test(line)) {
      if (oldLine !== void 0) {
        const old = unquote2(oldLine);
        if (old.depth === first.depth && /^\s*$/.test(old.text)) return oldLine;
      }
      return first.prefix + line;
    }
    const continued = oldLine === void 0 ? continuation : (_a2 = linePrefix(oldLine, first.depth)) != null ? _a2 : continuation;
    return bodyPrefix(continued) + line;
  });
  const insert = renderedLines.join(newline);
  let lastContentLine = contentLines.length - 1;
  while (lastContentLine > 0 && /^\s*$/.test(contentLines[lastContentLine])) lastContentLine--;
  const boundaryCR = lastContentLine < renderedLines.length - 1 ? newline === "\r\n" : retainedCR;
  const definitionEnd = from + renderedLines.slice(0, lastContentLine + 1).join(newline).length + Number(boundaryCR);
  const updated = source.slice(0, from) + insert + source.slice(to);
  const nextDefinition = verifyBoundary(before, buildDocumentModel(updated), id, from, to, insert.length, definitionEnd);
  return { source: updated, from, to, insert, definition: nextDefinition };
}

// src/popup-editor.ts
var import_obsidian4 = require("obsidian");

// src/embedded-editor.ts
var import_state2 = require("@codemirror/state");
var import_view2 = require("@codemirror/view");
var import_obsidian2 = require("obsidian");
var constructors = /* @__PURE__ */ new WeakMap();
var owners = /* @__PURE__ */ new WeakMap();
var editorAdapters = /* @__PURE__ */ new WeakMap();
var modeAdapters = /* @__PURE__ */ new WeakMap();
function adapterForOwner(current) {
  if (!current || current instanceof import_obsidian2.MarkdownView) return void 0;
  const direct = owners.get(current);
  if (direct) return direct;
  const editor = current.editor;
  const editorAdapter = editor ? editorAdapters.get(editor) : void 0;
  if (editorAdapter) return editorAdapter;
  const mode = current.editMode;
  return mode && typeof mode === "object" ? modeAdapters.get(mode) : void 0;
}
function findScrollableConstructor(mode) {
  if (!mode || typeof mode !== "object") return null;
  let prototype = Object.getPrototypeOf(mode);
  while (prototype && prototype !== Object.prototype) {
    if (Object.prototype.hasOwnProperty.call(prototype, "getScroll") && Object.prototype.hasOwnProperty.call(prototype, "handleScroll") && typeof prototype.getDynamicExtensions === "function" && typeof prototype.set === "function") {
      return prototype.constructor;
    }
    prototype = Object.getPrototypeOf(prototype);
  }
  return null;
}
function resolveConstructor(app, document2) {
  var _a, _b, _c, _d;
  const cached = constructors.get(app);
  if (cached) return cached;
  for (const leaf of app.workspace.getLeavesOfType("markdown")) {
    const found = findScrollableConstructor(leaf.view.editMode);
    if (found) {
      constructors.set(app, found);
      return found;
    }
  }
  const creator = (_b = (_a = app.embedRegistry) == null ? void 0 : _a.embedByExtension) == null ? void 0 : _b.md;
  if (!creator) throw new Error("\u5F53\u524D Obsidian \u7684\u539F\u751F Markdown \u7F16\u8F91\u5668\u6B63\u5728\u521D\u59CB\u5316\u3002");
  const container = document2.createElement("div");
  let embed;
  try {
    embed = creator({ app, containerEl: container }, null, "");
    embed.editable = true;
    embed.showEditor();
    const found = findScrollableConstructor(embed.editMode);
    if (!found) throw new Error("\u5F53\u524D Obsidian \u7684\u539F\u751F Markdown \u7F16\u8F91\u5668\u9700\u8981\u91CD\u65B0\u521D\u59CB\u5316\u3002");
    constructors.set(app, found);
    return found;
  } finally {
    (_c = embed == null ? void 0 : embed.editMode) == null ? void 0 : _c.destroy();
    (_d = embed == null ? void 0 : embed.editMode) == null ? void 0 : _d.unload();
    embed == null ? void 0 : embed.unload();
    container.remove();
  }
}
function editorApp(app) {
  const vault = new Proxy(app.vault, {
    get(target, property, receiver) {
      if (property === "getConfig") return (name) => {
        if (["showLineNumber", "showIndentGuide", "foldHeading", "foldIndent"].includes(name)) return false;
        if (name === "propertiesInDocument") return "hidden";
        if (name === "livePreview") return true;
        return target.getConfig(name);
      };
      return Reflect.get(target, property, receiver);
    }
  });
  return new Proxy(app, {
    get(target, property, receiver) {
      return property === "vault" ? vault : Reflect.get(target, property, receiver);
    }
  });
}
var EmbeddedMarkdownEditor = class {
  constructor(app, container, options) {
    this.app = app;
    this.options = options;
    __publicField(this, "element");
    __publicField(this, "cm");
    __publicField(this, "mode");
    __publicField(this, "owner");
    __publicField(this, "scope");
    __publicField(this, "previousActiveEditor");
    __publicField(this, "editable", false);
    __publicField(this, "setting", true);
    __publicField(this, "alive", true);
    __publicField(this, "composing", false);
    __publicField(this, "scopePushed", false);
    __publicField(this, "compositionTimer", null);
    __publicField(this, "layoutFrame", null);
    this.previousActiveEditor = this.rootActiveEditor(app.workspace.activeEditor);
    this.scope = new import_obsidian2.Scope(app.scope);
    const file = app.vault.getAbstractFileByPath(options.path);
    const owner = this.owner = {
      app,
      file: file && "extension" in file ? file : null,
      path: options.path,
      scope: this.scope,
      citationBadgeEmbeddedEditor: true,
      getMode: () => "source",
      getHoverSource: () => "editor",
      syncScroll: () => {
      },
      onMarkdownScroll: () => {
      },
      showSearch: () => {
      },
      toggleMode: () => {
      }
    };
    owners.set(owner, this);
    const adapter = this;
    const Base = resolveConstructor(app, container.ownerDocument);
    class CitationEditor extends Base {
      getDynamicExtensions() {
        var _a;
        this.sourceMode = false;
        return [
          import_view2.EditorView.contentAttributes.of({
            contenteditable: String(adapter.editable),
            "aria-readonly": String(!adapter.editable),
            "aria-label": (_a = options.label) != null ? _a : "\u5F15\u7528\u6B63\u6587",
            "aria-multiline": "true",
            role: "textbox"
          }),
          ...super.getDynamicExtensions(),
          import_view2.EditorView.editable.of(adapter.editable),
          import_state2.EditorState.readOnly.of(!adapter.editable)
        ];
      }
      onUpdate(update, changed) {
        var _a;
        if (!adapter.alive) return;
        if (!adapter.setting && adapter.editable && ((_a = this.cm) == null ? void 0 : _a.hasFocus)) super.onUpdate(update, changed);
        if (!adapter.setting && update.docChanged) options.onChange(update.state.doc.toString());
        adapter.scheduleLayout();
      }
      updateBottomPadding() {
      }
    }
    const mode = this.mode = new CitationEditor(editorApp(app), container, owner);
    this.cm = mode.cm;
    this.element = mode.editorEl;
    owner.editMode = mode;
    owner.editor = mode.editor;
    editorAdapters.set(mode.editor, this);
    modeAdapters.set(mode, this);
    this.element.classList.add("citation-native-editor", "citation-editor-readonly");
    mode.sourceMode = false;
    const suggestions = mode.editorSuggest;
    mode.editorSuggest = new Proxy(suggestions, {
      get(target, property, receiver) {
        if (property === "close" || property === "reposition") return () => {
          if (adapter.ownsSuggestion() || app.workspace.activeEditor === owner || mode.cm.hasFocus) {
            target[property].call(target);
          }
        };
        if (property === "trigger") return (...args) => {
          if (adapter.editable && mode.cm.hasFocus) target.trigger(...args);
        };
        return Reflect.get(target, property, receiver);
      }
    });
    mode.load();
    mode.registerDomEvent(this.cm.contentDOM, "focus", () => this.handleFocus(), { capture: true });
    mode.registerDomEvent(this.cm.contentDOM, "blur", () => this.blurred(), { capture: true });
    mode.registerDomEvent(this.cm.contentDOM, "compositionstart", () => {
      this.composing = true;
    });
    mode.registerDomEvent(this.cm.contentDOM, "compositionend", () => {
      this.composing = false;
      const win = this.element.ownerDocument.defaultView;
      if (win) this.compositionTimer = win.setTimeout(() => {
        this.compositionTimer = null;
        if (this.alive) options.onChange(this.getValue());
      }, 0);
    });
    mode.set(options.value, true);
    this.setting = false;
    this.scheduleLayout();
  }
  get focused() {
    return this.cm.hasFocus;
  }
  get isComposing() {
    return this.composing || this.cm.composing;
  }
  getValue() {
    return this.cm.state.doc.toString();
  }
  setValue(value) {
    if (!this.alive || value === this.getValue()) return;
    this.setting = true;
    try {
      this.mode.set(value, true);
    } finally {
      this.setting = false;
    }
    this.scheduleLayout();
  }
  setEditable(editable) {
    if (!this.alive || this.editable === editable) return;
    if (!editable && this.cm.hasFocus) this.blur();
    this.editable = editable;
    this.element.classList.toggle("citation-editor-readonly", !editable);
    this.mode.sourceMode = false;
    this.mode.updateOptions();
    this.scheduleLayout();
  }
  focus() {
    if (!this.alive) return;
    this.setEditable(true);
    this.cm.focus();
  }
  focusAtCoords(x, y) {
    var _a;
    if (!this.alive) return;
    const position = (_a = this.cm.posAtCoords({ x, y }, false)) != null ? _a : this.cm.state.selection.main.head;
    this.focus();
    this.cm.dispatch({ selection: import_state2.EditorSelection.single(position), userEvent: "select.pointer" });
  }
  blur() {
    if (this.alive) this.cm.contentDOM.blur();
  }
  ownsTarget(target) {
    var _a, _b;
    if (!target || !("nodeType" in target)) return false;
    const node = target;
    if (this.element.contains(node)) return true;
    const current = this.mode.editorSuggest.currentSuggest;
    const suggestions = (_b = (_a = current == null ? void 0 : current.suggestEl) == null ? void 0 : _a.closest(".suggestion-container")) != null ? _b : current == null ? void 0 : current.suggestEl;
    return this.ownsSuggestion() && !!(suggestions == null ? void 0 : suggestions.contains(node));
  }
  destroy() {
    if (!this.alive) return;
    this.alive = false;
    const win = this.element.ownerDocument.defaultView;
    if (this.compositionTimer !== null) win == null ? void 0 : win.clearTimeout(this.compositionTimer);
    if (this.layoutFrame !== null) win == null ? void 0 : win.cancelAnimationFrame(this.layoutFrame);
    if (this.cm.hasFocus) this.cm.contentDOM.blur();
    this.popScope();
    this.restoreActiveEditor();
    this.mode.unload();
    this.mode.destroy();
    this.element.remove();
    this.restoreDisposedEditor();
    queueMicrotask(() => this.restoreDisposedEditor());
  }
  ownsSuggestion() {
    var _a, _b;
    return ((_b = (_a = this.mode.editorSuggest.currentSuggest) == null ? void 0 : _a.context) == null ? void 0 : _b.editor) === this.mode.editor;
  }
  handleFocus() {
    var _a, _b;
    if (!this.alive || !this.editable) return;
    if (this.app.workspace.activeEditor !== this.owner) {
      this.previousActiveEditor = this.rootActiveEditor(this.app.workspace.activeEditor);
    }
    this.app.workspace.activeEditor = this.owner;
    if (!this.scopePushed) {
      this.app.keymap.pushScope(this.scope);
      this.scopePushed = true;
    }
    (_b = (_a = this.options).onFocus) == null ? void 0 : _b.call(_a);
  }
  blurred() {
    var _a, _b;
    this.popScope();
    if (!this.alive) return;
    (_b = (_a = this.options).onBlur) == null ? void 0 : _b.call(_a);
    queueMicrotask(() => {
      if (!this.ownsTarget(this.element.ownerDocument.activeElement)) this.restoreActiveEditor();
    });
  }
  popScope() {
    if (this.scopePushed) {
      this.app.keymap.popScope(this.scope);
      this.scopePushed = false;
    }
  }
  rootActiveEditor(current) {
    const visited = /* @__PURE__ */ new Set();
    while (current) {
      const adapter = adapterForOwner(current);
      if (!adapter) return current;
      if (visited.has(current)) return null;
      visited.add(current);
      current = adapter.previousActiveEditor;
    }
    return null;
  }
  restoreActiveEditor() {
    if (adapterForOwner(this.app.workspace.activeEditor) !== this) return;
    let previous = this.previousActiveEditor;
    const visited = /* @__PURE__ */ new Set();
    while (previous) {
      if (previous === this.owner || visited.has(previous)) {
        previous = null;
        break;
      }
      visited.add(previous);
      const adapter = adapterForOwner(previous);
      if (!adapter || adapter.alive) break;
      previous = adapter.previousActiveEditor;
    }
    this.setActiveEditorBaseline(previous);
  }
  restoreDisposedEditor() {
    const current = this.app.workspace.activeEditor;
    const adapter = adapterForOwner(current);
    if (adapter && !adapter.alive) {
      this.setActiveEditorBaseline(adapter.rootActiveEditor(adapter.previousActiveEditor));
    }
  }
  setActiveEditorBaseline(previous) {
    this.app.workspace.activeEditor = previous instanceof import_obsidian2.MarkdownView ? null : previous;
  }
  scheduleLayout() {
    var _a;
    if (!this.alive || this.layoutFrame !== null) return;
    const win = (_a = this.element) == null ? void 0 : _a.ownerDocument.defaultView;
    if (win) this.layoutFrame = win.requestAnimationFrame(() => {
      var _a2, _b;
      this.layoutFrame = null;
      if (this.alive) {
        this.cm.requestMeasure();
        (_b = (_a2 = this.options).onLayout) == null ? void 0 : _b.call(_a2);
      }
    });
  }
};
function createEmbeddedEditor(app, container, options) {
  return new EmbeddedMarkdownEditor(app, container, options);
}

// src/mobile-editor.ts
var import_obsidian3 = require("obsidian");

// src/mobile.ts
function popupPlacement(viewport, anchor, contentHeight, editing) {
  const margin = Math.min(12, viewport.width / 4, viewport.height / 4);
  const availableWidth = Math.max(1, viewport.width - margin * 2);
  const width = Math.min(420, availableWidth);
  const maxHeight = Math.max(1, Math.min(editing ? 560 : 360, viewport.height - margin * 2));
  const height = Math.min(contentHeight, maxHeight);
  const left = Math.max(viewport.left + margin, Math.min(anchor.left - 12, viewport.left + viewport.width - width - margin));
  const below = anchor.bottom + 8;
  const top = below + height <= viewport.top + viewport.height - margin ? Math.max(viewport.top + margin, below) : Math.max(viewport.top + margin, Math.min(anchor.top - height - 8, viewport.top + viewport.height - height - margin));
  const side = top < anchor.top ? "above" : "below";
  return { width, maxHeight, height, left, top, side };
}
var TouchTap = class {
  constructor() {
    __publicField(this, "start", null);
    __publicField(this, "moved", false);
    __publicField(this, "active", /* @__PURE__ */ new Set());
  }
  begin(id, x, y) {
    if (this.active.has(id)) this.active.clear();
    if (this.active.size === 0) {
      this.start = { id, x, y };
      this.moved = false;
    } else if (!this.active.has(id)) this.moved = true;
    this.active.add(id);
  }
  move(id, x, y) {
    var _a;
    if (((_a = this.start) == null ? void 0 : _a.id) === id && Math.hypot(x - this.start.x, y - this.start.y) > 10) this.moved = true;
  }
  end(id) {
    var _a;
    this.active.delete(id);
    if (((_a = this.start) == null ? void 0 : _a.id) === id) this.start = null;
  }
  cancel() {
    this.moved = true;
    this.start = null;
    this.active.clear();
  }
  get suppressed() {
    return this.moved;
  }
};

// src/mobile-editor.ts
var MobileContentEditor = class {
  constructor(app, container, options, component, makeComponent) {
    this.app = app;
    this.container = container;
    this.options = options;
    this.component = component;
    this.makeComponent = makeComponent;
    __publicField(this, "preview");
    __publicField(this, "input");
    __publicField(this, "toggle");
    __publicField(this, "composing", false);
    __publicField(this, "alive", true);
    __publicField(this, "rendering", 0);
    __publicField(this, "renderChild", null);
    var _a;
    container.classList.add("citation-mobile-editor");
    this.toggle = container.createEl("button", { text: "\u7F16\u8F91\u6B63\u6587", cls: "citation-mobile-edit", attr: { type: "button" } });
    this.preview = container.createDiv({ cls: "citation-mobile-preview markdown-rendered" });
    this.input = container.createEl("textarea", { cls: "citation-mobile-input", attr: {
      "aria-label": (_a = options.label) != null ? _a : "\u5F15\u7528\u6B63\u6587",
      rows: "3",
      spellcheck: "true"
    } });
    this.input.value = options.value;
    this.input.hidden = true;
    const tap = new TouchTap();
    component.registerDomEvent(container, "pointerdown", (event) => tap.begin(event.pointerId, event.clientX, event.clientY), { passive: true });
    component.registerDomEvent(container, "pointermove", (event) => tap.move(event.pointerId, event.clientX, event.clientY), { passive: true });
    component.registerDomEvent(container, "pointerup", (event) => tap.end(event.pointerId));
    component.registerDomEvent(container, "pointercancel", () => tap.cancel());
    component.registerDomEvent(container, "click", (event) => {
      if (tap.suppressed && event.detail !== 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    component.registerDomEvent(this.preview, "click", (event) => {
      var _a2;
      const target = event.target;
      if (target.closest("a,button,.external-link,.internal-link")) return;
      (_a2 = options.onFocus) == null ? void 0 : _a2.call(options);
      this.focus();
    });
    component.registerDomEvent(this.toggle, "click", () => {
      var _a2;
      if (this.input.hidden) {
        (_a2 = options.onFocus) == null ? void 0 : _a2.call(options);
        this.setEditable(true);
        this.focus();
      } else {
        this.blur();
        this.setEditable(false);
      }
    });
    component.registerDomEvent(this.input, "input", () => {
      options.onChange(this.input.value);
      this.resize();
    });
    component.registerDomEvent(this.input, "compositionstart", () => {
      this.composing = true;
    });
    component.registerDomEvent(this.input, "compositionend", () => {
      this.composing = false;
      options.onChange(this.input.value);
    });
    component.registerDomEvent(this.input, "focus", () => {
      var _a2;
      return (_a2 = options.onFocus) == null ? void 0 : _a2.call(options);
    });
    component.registerDomEvent(this.input, "blur", () => {
      var _a2;
      return (_a2 = options.onBlur) == null ? void 0 : _a2.call(options);
    });
    void this.render();
  }
  get focused() {
    return this.container.ownerDocument.activeElement === this.input;
  }
  get isComposing() {
    return this.composing;
  }
  getValue() {
    return this.input.value;
  }
  setValue(value) {
    this.input.value = value;
    this.resize();
    void this.render();
  }
  setEditable(editable) {
    var _a, _b;
    this.input.hidden = !editable;
    this.preview.hidden = editable;
    this.toggle.textContent = editable ? "\u9884\u89C8\u6B63\u6587" : "\u7F16\u8F91\u6B63\u6587";
    this.toggle.setAttribute("aria-expanded", String(editable));
    if (editable) this.resize();
    else void this.render();
    (_b = (_a = this.options).onLayout) == null ? void 0 : _b.call(_a);
  }
  focus() {
    this.setEditable(true);
    this.input.focus({ preventScroll: true });
  }
  focusAtCoords(_x, _y) {
    this.focus();
  }
  blur() {
    this.input.blur();
  }
  ownsTarget(target) {
    return !!target && "nodeType" in target && this.container.contains(target);
  }
  destroy() {
    this.alive = false;
    this.rendering++;
    if (this.renderChild) this.component.removeChild(this.renderChild);
    this.renderChild = null;
    this.container.empty();
  }
  resize() {
    var _a, _b;
    this.input.style.height = "auto";
    this.input.style.height = `${Math.max(96, this.input.scrollHeight)}px`;
    (_b = (_a = this.options).onLayout) == null ? void 0 : _b.call(_a);
  }
  async render() {
    var _a, _b;
    const serial = ++this.rendering;
    const root = this.container.ownerDocument.createElement("div");
    const child = this.component.addChild(this.makeComponent());
    try {
      await import_obsidian3.MarkdownRenderer.render(this.app, this.input.value, root, this.options.path, child);
      if (!this.alive || serial !== this.rendering) {
        this.component.removeChild(child);
        return;
      }
      if (this.renderChild) this.component.removeChild(this.renderChild);
      this.renderChild = child;
      this.preview.replaceChildren(root);
      (_b = (_a = this.options).onLayout) == null ? void 0 : _b.call(_a);
    } catch (e) {
      this.component.removeChild(child);
      if (this.alive && serial === this.rendering) this.preview.textContent = this.input.value;
    }
  }
};

// src/popup-editor.ts
var PopupContentEditor = class {
  constructor(container, content, number, component, bridge) {
    this.bridge = bridge;
    __publicField(this, "native");
    __publicField(this, "host");
    __publicField(this, "meta");
    __publicField(this, "status");
    __publicField(this, "reload");
    __publicField(this, "expected");
    __publicField(this, "draft");
    __publicField(this, "savedDraft");
    __publicField(this, "saving", null);
    __publicField(this, "saveTimer", null);
    __publicField(this, "composing", false);
    __publicField(this, "alive", true);
    __publicField(this, "editing", false);
    this.expected = this.draft = this.savedDraft = content;
    container.classList.add("citation-editable-content");
    this.host = container.createDiv({ cls: "citation-inline-editor" });
    this.meta = container.createDiv({ cls: "citation-edit-status" });
    this.meta.hidden = true;
    this.status = this.meta.createEl("span", { attr: { role: "status", "aria-live": "polite" } });
    this.reload = this.meta.createEl("button", { text: "\u91CD\u65B0\u8F7D\u5165", attr: { type: "button" } });
    this.reload.hidden = true;
    const options = {
      value: content,
      path: bridge.path,
      label: `\u7F16\u8F91\u811A\u6CE8 ${number} \u7684\u6B63\u6587`,
      onChange: (value) => this.changed(value),
      onFocus: () => {
        if (this.alive) bridge.requestEditing();
      },
      onLayout: () => bridge.changed()
    };
    this.native = import_obsidian4.Platform.isMobile ? new MobileContentEditor(bridge.app, this.host, options, component, () => new import_obsidian4.Component()) : createEmbeddedEditor(bridge.app, this.host, options);
    this.native.setEditable(false);
    component.registerDomEvent(this.host, "mousedown", (event) => {
      if (event.button !== 0 || this.editing) return;
      if (import_obsidian4.Platform.isMobile) return;
      const target = event.target;
      if (target.closest("a,button,.cm-link,.external-link,.cm-hmd-external-link,.cm-hmd-internal-link")) return;
      this.bridge.requestEditing();
    }, true);
    component.registerDomEvent(this.host, "compositionstart", () => {
      this.composing = true;
      if (this.saveTimer !== null) {
        window.clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
    }, true);
    component.registerDomEvent(this.host, "compositionend", () => {
      this.composing = false;
      window.setTimeout(() => {
        if (this.alive) this.changed(this.native.getValue(), true);
      }, 0);
    }, true);
    component.registerDomEvent(this.host.ownerDocument, "visibilitychange", () => {
      if (this.host.ownerDocument.hidden) void this.flush().catch(() => {
      });
    });
    component.registerDomEvent(this.reload, "click", () => {
      void this.reloadContent();
    });
    component.register(() => this.destroy());
  }
  get dirty() {
    return this.draft !== this.savedDraft;
  }
  get focused() {
    return this.native.focused;
  }
  ownsTarget(target) {
    return this.host.contains(target) || this.native.ownsTarget(target);
  }
  setEditing(editing, focus = false) {
    this.editing = editing;
    this.native.setEditable(editing);
    if (!editing) this.native.blur();
    if (focus && editing) this.native.focus();
    this.bridge.changed();
  }
  changed(value, committed = false) {
    var _a;
    if (!this.alive) return;
    const changed = this.draft !== value;
    this.draft = value;
    if (changed || committed) this.clearStatus();
    this.bridge.changed();
    if (!changed && !committed) return;
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (this.composing || ((_a = this.native) == null ? void 0 : _a.isComposing) || !this.dirty) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      if (!this.composing && !this.native.isComposing) void this.flush(false).catch(() => {
      });
    }, 150);
  }
  async flush(finishComposition = true) {
    if (this.composing || this.native.isComposing) {
      if (!finishComposition) return;
      this.native.blur();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
    this.draft = this.native.getValue();
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.saving) {
      await this.saving;
      if (this.dirty) return this.flush(finishComposition);
      return;
    }
    const save = async () => {
      while (this.dirty) {
        if (!finishComposition && (this.composing || this.native.isComposing)) return;
        const submitted = this.draft;
        const canonical = await this.bridge.save(this.expected, submitted);
        this.expected = canonical;
        this.savedDraft = submitted;
      }
      if (this.alive) {
        this.clearStatus();
        this.bridge.changed();
      }
    };
    this.saving = save().catch((error) => {
      if (this.alive) {
        this.status.textContent = error instanceof DefinitionEditError ? error.message : "\u4FDD\u5B58\u6682\u7F13\uFF0C\u7F16\u8F91\u5185\u5BB9\u5DF2\u4FDD\u7559\u3002";
        this.reload.hidden = !(error instanceof DefinitionEditError && error.code === "conflict");
        this.meta.hidden = false;
        this.bridge.changed();
      }
      throw error;
    });
    try {
      await this.saving;
    } finally {
      this.saving = null;
    }
  }
  async reloadContent() {
    try {
      const content = await this.bridge.read();
      if (!this.alive) return;
      if (this.saveTimer !== null) {
        window.clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      this.expected = this.draft = this.savedDraft = content;
      this.native.setValue(content);
      this.clearStatus();
      this.bridge.changed();
    } catch (e) {
      if (this.alive) {
        this.status.textContent = "\u5F53\u524D\u6B63\u6587\u6B63\u5728\u66F4\u65B0\uFF0C\u7F16\u8F91\u5185\u5BB9\u5DF2\u4FDD\u7559\u3002";
        this.meta.hidden = false;
        this.bridge.changed();
      }
    }
  }
  clearStatus() {
    this.meta.hidden = true;
    this.status.textContent = "";
    this.reload.hidden = true;
  }
  destroy() {
    this.alive = false;
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.native.destroy();
  }
};

// src/navigation.ts
var import_view3 = require("@codemirror/view");
var editorRequests = /* @__PURE__ */ new WeakMap();
var trailingSpace = /* @__PURE__ */ new WeakMap();
function visibleBounds(scroller) {
  var _a;
  const window2 = scroller.ownerDocument.defaultView;
  const rect = scroller.getBoundingClientRect();
  const contentTop = rect.top + scroller.clientTop;
  let top = Math.max(0, contentTop);
  let bottom = Math.min((_a = window2 == null ? void 0 : window2.innerHeight) != null ? _a : rect.bottom, contentTop + scroller.clientHeight);
  for (let parent = scroller.parentElement; parent; parent = parent.parentElement) {
    const style = window2 == null ? void 0 : window2.getComputedStyle(parent);
    if (!style || !/(auto|scroll|hidden|clip)/.test(style.overflowY)) continue;
    const outer = parent.getBoundingClientRect();
    top = Math.max(top, outer.top + parent.clientTop);
    bottom = Math.min(bottom, outer.top + parent.clientTop + parent.clientHeight);
  }
  return { top, bottom };
}
function reserveTrailingSpace(scroller, content, extra) {
  var _a, _b;
  if (extra < 1) return;
  (_a = trailingSpace.get(scroller)) == null ? void 0 : _a();
  const doc = scroller.ownerDocument;
  const window2 = doc.defaultView;
  const original = content.style.getPropertyValue("padding-bottom");
  const priority = content.style.getPropertyPriority("padding-bottom");
  const base = parseFloat((_b = window2 == null ? void 0 : window2.getComputedStyle(content).paddingBottom) != null ? _b : "0") || 0;
  const padding = `${base + Math.ceil(extra) + 2}px`;
  content.style.setProperty("padding-bottom", padding);
  let disposed = false;
  const restore = () => {
    if (disposed) return;
    disposed = true;
    if (content.style.getPropertyValue("padding-bottom") === padding) {
      if (original) content.style.setProperty("padding-bottom", original, priority);
      else content.style.removeProperty("padding-bottom");
    }
    doc.removeEventListener("pointerdown", restore, true);
    doc.removeEventListener("keydown", restore, true);
    doc.removeEventListener("wheel", restore, true);
    window2 == null ? void 0 : window2.removeEventListener("pagehide", restore);
    observer == null ? void 0 : observer.disconnect();
    trailingSpace.delete(scroller);
  };
  const observer = window2 && new window2.MutationObserver(() => {
    if (!scroller.isConnected || !content.isConnected) restore();
  });
  observer == null ? void 0 : observer.observe(doc.body, { childList: true, subtree: true });
  doc.addEventListener("pointerdown", restore, true);
  doc.addEventListener("keydown", restore, true);
  doc.addEventListener("wheel", restore, { capture: true, passive: true });
  window2 == null ? void 0 : window2.addEventListener("pagehide", restore);
  trailingSpace.set(scroller, restore);
}
function correction(scroller, targetCenter) {
  const { top, bottom } = visibleBounds(scroller);
  if (bottom <= top) return 0;
  return targetCenter - (top + bottom) / 2;
}
function centerEditorPosition(view, position) {
  var _a;
  const window2 = view.dom.ownerDocument.defaultView;
  if (!window2 || !view.dom.isConnected) return;
  (_a = trailingSpace.get(view.scrollDOM)) == null ? void 0 : _a();
  const pos = Math.max(0, Math.min(position, view.state.doc.length));
  const doc = view.state.doc;
  const request = {};
  editorRequests.set(view, request);
  view.dispatch({ effects: import_view3.EditorView.scrollIntoView(pos, { y: "center" }) });
  const measure = (attempt) => window2.requestAnimationFrame(() => {
    if (!view.dom.isConnected || editorRequests.get(view) !== request || view.state.doc !== doc) return;
    view.requestMeasure({
      key: request,
      read: () => {
        var _a2, _b;
        if (!view.dom.isConnected || editorRequests.get(view) !== request || view.state.doc !== doc) return null;
        const rect = view.coordsAtPos(pos);
        if (!rect) return null;
        let delta = correction(view.scrollDOM, (rect.top + rect.bottom) / 2);
        let topMargin = 0, bottomMargin = 0;
        for (const source of view.state.facet(import_view3.EditorView.scrollMargins)) {
          const margins = source(view);
          topMargin = Math.max(topMargin, (_a2 = margins == null ? void 0 : margins.top) != null ? _a2 : 0);
          bottomMargin = Math.max(bottomMargin, (_b = margins == null ? void 0 : margins.bottom) != null ? _b : 0);
        }
        delta -= (topMargin - bottomMargin) / 2;
        const desired = view.scrollDOM.scrollTop + delta;
        const missing = desired - (view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight);
        return { delta, missing };
      },
      write: (measured) => {
        if (!view.dom.isConnected || editorRequests.get(view) !== request || view.state.doc !== doc) return;
        if (!measured) {
          if (attempt < 2) measure(attempt + 1);
          return;
        }
        if (measured.missing > 1) reserveTrailingSpace(view.scrollDOM, view.contentDOM, measured.missing);
        if (Math.abs(measured.delta) > 1) view.scrollDOM.scrollTop += measured.delta;
        if (attempt < 2 && (measured.missing > 1 || Math.abs(measured.delta) > 1)) measure(attempt + 1);
      }
    });
  });
  measure(0);
}
function editorView(value) {
  var _a;
  if (!value || typeof value !== "object") return false;
  const candidate = value;
  return !!candidate.dom && !!candidate.scrollDOM && !!((_a = candidate.state) == null ? void 0 : _a.doc) && typeof candidate.state.facet === "function" && typeof candidate.dispatch === "function" && typeof candidate.requestMeasure === "function" && typeof candidate.coordsAtPos === "function";
}
async function centerMarkdownPosition(view, position) {
  const point = view.editor.offsetToPos(position);
  view.editor.setCursor(point);
  const cm = view.editor.cm;
  if (editorView(cm) && cm.dom.isConnected) centerEditorPosition(cm, position);
  else view.editor.scrollIntoView({ from: point, to: point }, true);
}
function centerRenderedTarget(target) {
  var _a;
  const window2 = target.ownerDocument.defaultView;
  if (!window2 || !target.isConnected) return;
  let scroller = target.parentElement;
  while (scroller) {
    const style = window2.getComputedStyle(scroller);
    if (/(auto|scroll)/.test(style.overflowY) && scroller.clientHeight > 0) break;
    scroller = scroller.parentElement;
  }
  if (!scroller) return;
  const pane = scroller;
  (_a = trailingSpace.get(pane)) == null ? void 0 : _a();
  const move = () => {
    var _a2;
    if (!target.isConnected || !pane.isConnected) return;
    const rect = target.getBoundingClientRect();
    if (rect.height <= 0) return;
    const delta = correction(pane, (rect.top + rect.bottom) / 2);
    const missing = pane.scrollTop + delta - (pane.scrollHeight - pane.clientHeight);
    const content = (_a2 = pane.querySelector(":scope > .markdown-preview-sizer")) != null ? _a2 : pane;
    if (missing > 1) reserveTrailingSpace(pane, content, missing);
    pane.scrollTop += delta;
  };
  move();
  window2.requestAnimationFrame(move);
}

// src/main.ts
var defaults = { scale: 0.71, tint: 10, radius: 3 };
function referenceKey(reference) {
  return `${reference.sourceId}:${reference.occurrence}`;
}
function sameCluster(first, second) {
  return first.members.map(referenceKey).join("|") === second.members.map(referenceKey).join("|");
}
function popupOpeningFrames(side) {
  return [
    { opacity: 0, transform: `translateY(${side === "above" ? 4 : -4}px) scale(0.94)` },
    { opacity: 1, transform: "translateY(0) scale(1)" }
  ];
}
var CitationBadgesPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", { ...defaults });
    __publicField(this, "models", /* @__PURE__ */ new Map());
    __publicField(this, "badges", /* @__PURE__ */ new Map());
    __publicField(this, "readingRestores", /* @__PURE__ */ new Map());
    __publicField(this, "alive", true);
    __publicField(this, "popup", null);
    __publicField(this, "hoverTimer", null);
    __publicField(this, "closeTimer", null);
    __publicField(this, "manualMounts", /* @__PURE__ */ new Map());
    __publicField(this, "refreshTimer", null);
    __publicField(this, "calloutRenders", /* @__PURE__ */ new WeakMap());
    __publicField(this, "popupSerial", 0);
    __publicField(this, "popupRequest", 0);
    __publicField(this, "writes", /* @__PURE__ */ new Map());
    __publicField(this, "returnLocation", null);
  }
  async onload() {
    this.register(() => {
      this.alive = false;
    });
    this.settings = { ...defaults, ...await this.loadData() };
    if (!this.alive) return;
    this.applySettings();
    this.registerEditorExtension(citationEditorExtension({
      model: (source, path) => this.model(source, path),
      createBadge: (cluster, path, view) => this.createBadge(cluster, path, view),
      disposeBadge: (element) => this.disposeBadge(element)
    }));
    this.registerMarkdownPostProcessor((element, context) => this.processRendered(element, context));
    this.addSettingTab(new BadgeSettingTab(this.app, this));
    this.registerEvent(this.app.workspace.on("layout-change", () => {
      var _a, _b, _c;
      if (!((_a = this.popup) == null ? void 0 : _a.editing)) void this.closePopup(false);
      else (_c = (_b = this.popup).place) == null ? void 0 : _c.call(_b);
      this.scheduleReadingRefresh();
    }));
    this.registerEvent(this.app.workspace.on("file-open", () => this.scheduleReadingRefresh()));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      var _a;
      if (file instanceof import_obsidian5.TFile && file.extension === "md") {
        this.models.delete(file.path);
        if (((_a = this.popup) == null ? void 0 : _a.state.path) === file.path && !this.popup.editing) void this.closePopup(false);
        this.scheduleReadingRefresh();
      }
    }));
    this.registerEvent(this.app.vault.on("rename", () => {
      this.models.clear();
      void this.closePopup(false);
      [...this.readingRestores.keys()].forEach((element) => this.disposeBadge(element));
      this.scheduleReadingRefresh();
    }));
    this.addCommand({ id: "refresh-citation-badges", name: "\u5237\u65B0\u5F53\u524D\u5F15\u7528\u5FBD\u6807", callback: () => this.scheduleReadingRefresh() });
    this.addCommand({ id: "return-to-citation", name: "\u8FD4\u56DE\u6700\u8FD1\u5F15\u7528\u4F4D\u7F6E", callback: () => {
      void this.returnToCitation();
    } });
    this.register(() => {
      this.clearTimers();
      if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
      void this.closePopup(false, true);
      [...this.badges.keys()].forEach((element) => this.disposeBadge(element));
      this.manualMounts.clear();
      this.models.clear();
      document.body.style.removeProperty("--citation-scale");
      document.body.style.removeProperty("--citation-tint");
      document.body.style.removeProperty("--citation-radius");
    });
    this.app.workspace.onLayoutReady(() => this.scheduleReadingRefresh());
  }
  model(source, path) {
    const cached = this.models.get(path);
    if ((cached == null ? void 0 : cached.source) === source) return cached;
    const model = buildDocumentModel(source);
    this.models.set(path, model);
    if (this.models.size > 12) this.models.delete(this.models.keys().next().value);
    return model;
  }
  createBadge(cluster, path, view, native) {
    var _a, _b, _c, _d;
    const doc = (_c = (_b = view == null ? void 0 : view.dom.ownerDocument) != null ? _b : (_a = native == null ? void 0 : native.values().next().value) == null ? void 0 : _a.ownerDocument) != null ? _c : document;
    const host = doc.createElement("span");
    host.className = "citation-badge";
    host.dataset.citationLabel = cluster.label;
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "citation-badge-button";
    button.textContent = cluster.label;
    button.setAttribute("aria-label", `\u811A\u6CE8 ${cluster.numbers.join("\u3001")}\uFF0C\u5171 ${cluster.numbers.length} \u6761\u6765\u6E90`);
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-haspopup", "dialog");
    host.append(button);
    const state = { cluster, path, button, view, native, cleanup: [] };
    this.badges.set(host, state);
    const popup = this.popup;
    if ((popup == null ? void 0 : popup.editing) && popup.state.path === path && sameCluster(popup.state.cluster, cluster)) {
      ((_d = doc.defaultView) != null ? _d : window).requestAnimationFrame(() => {
        var _a2;
        if (this.popup !== popup || !host.isConnected || host.closest(".workspace-leaf-content") !== popup.owner) return;
        popup.badge = host;
        popup.state = state;
        button.setAttribute("aria-controls", popup.element.id);
        button.setAttribute("aria-expanded", "true");
        (_a2 = popup.place) == null ? void 0 : _a2.call(popup);
      });
    }
    const on = (type, action) => {
      host.addEventListener(type, action);
      state.cleanup.push(() => host.removeEventListener(type, action));
    };
    const tap = new TouchTap();
    on("pointerdown", (event) => {
      tap.begin(event.pointerId, event.clientX, event.clientY);
    });
    on("pointermove", (event) => tap.move(event.pointerId, event.clientX, event.clientY));
    on("pointerup", (event) => tap.end(event.pointerId));
    on("pointercancel", () => tap.cancel());
    on("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    on("click", (event) => {
      var _a2, _b2;
      event.preventDefault();
      event.stopPropagation();
      if (tap.suppressed && event.detail !== 0) return;
      this.clearTimers();
      if (((_a2 = this.popup) == null ? void 0 : _a2.badge) === host) {
        if (this.popup.pinned) void this.closePopup(true);
        else {
          this.popup.pinned = true;
          (_b2 = this.popup.element.querySelector(".citation-source-jump")) == null ? void 0 : _b2.focus();
        }
      } else void this.openPopup(host, true);
    });
    on("mouseenter", () => {
      var _a2, _b2, _c2;
      if (!((_a2 = doc.defaultView) == null ? void 0 : _a2.matchMedia("(hover: hover)").matches)) return;
      if (this.closeTimer !== null) {
        window.clearTimeout(this.closeTimer);
        this.closeTimer = null;
      }
      if (((_b2 = this.popup) == null ? void 0 : _b2.pinned) || ((_c2 = this.popup) == null ? void 0 : _c2.badge) === host) return;
      if (this.hoverTimer !== null) window.clearTimeout(this.hoverTimer);
      this.hoverTimer = window.setTimeout(() => {
        this.hoverTimer = null;
        if (host.isConnected) void this.openPopup(host, false);
      }, 150);
    });
    on("mouseleave", () => {
      var _a2;
      if (this.hoverTimer !== null) {
        window.clearTimeout(this.hoverTimer);
        this.hoverTimer = null;
      }
      if (((_a2 = this.popup) == null ? void 0 : _a2.badge) === host && !this.popup.pinned) this.deferClose();
    });
    return host;
  }
  disposeBadge(element) {
    var _a;
    if (((_a = this.popup) == null ? void 0 : _a.badge) === element && !this.popup.editing) void this.closePopup(false, true);
    const state = this.badges.get(element);
    state == null ? void 0 : state.cleanup.forEach((cleanup) => cleanup());
    this.badges.delete(element);
    const restore = this.readingRestores.get(element);
    this.readingRestores.delete(element);
    restore == null ? void 0 : restore();
  }
  clearTimers() {
    if (this.hoverTimer !== null) window.clearTimeout(this.hoverTimer);
    if (this.closeTimer !== null) window.clearTimeout(this.closeTimer);
    this.hoverTimer = this.closeTimer = null;
  }
  deferClose() {
    if (this.closeTimer !== null) window.clearTimeout(this.closeTimer);
    this.closeTimer = window.setTimeout(() => {
      var _a;
      this.closeTimer = null;
      if (!((_a = this.popup) == null ? void 0 : _a.pinned)) void this.closePopup(false);
    }, 240);
  }
  async openPopup(badge, pinned) {
    var _a, _b, _c, _d, _e, _f;
    const request = ++this.popupRequest;
    const previous = this.badges.get(badge);
    if (!previous || !await this.closePopup(false)) return;
    if (!this.alive || request !== this.popupRequest) return;
    let state = this.badges.get(badge);
    if (!state) {
      const replacement = [...this.badges].find(([element2, candidate]) => element2.isConnected && candidate.path === previous.path && sameCluster(candidate.cluster, previous.cluster));
      if (replacement) [badge, state] = replacement;
    }
    if (!state) return;
    const source = await this.sourceForPath(state.path);
    if (!this.alive || request !== this.popupRequest || !badge.isConnected) return;
    const model = this.model(source, state.path);
    const members = state.cluster.members.map((reference) => model.references.find((item) => referenceKey(item) === referenceKey(reference)));
    if (members.some((reference) => !reference || reference.number === null || !reference.definition)) return;
    const current = members;
    const numbers = [...new Set(current.map((reference) => reference.number))];
    state = { ...state, cluster: { from: current[0].from, to: current[current.length - 1].to, members: current, numbers, label: formatNumbers(numbers) } };
    this.badges.set(badge, state);
    state.button.textContent = state.cluster.label;
    state.button.setAttribute("aria-label", `\u811A\u6CE8 ${numbers.join("\u3001")}\uFF0C\u5171 ${numbers.length} \u6761\u6765\u6E90`);
    badge.dataset.citationLabel = state.cluster.label;
    const doc = badge.ownerDocument;
    const element = doc.createElement("div");
    element.className = "citation-badge-popover";
    element.id = `citation-source-popover-${++this.popupSerial}`;
    element.setAttribute("role", "dialog");
    element.setAttribute("aria-label", "\u5F15\u7528\u6765\u6E90\u5217\u8868");
    const component = this.addChild(new import_obsidian5.Component());
    component.load();
    const popup = { badge, element, component, pinned, state, editing: false, editors: [], rect: badge.getBoundingClientRect(), owner: badge.closest(".workspace-leaf-content") };
    this.popup = popup;
    state.button.setAttribute("aria-controls", element.id);
    state.button.setAttribute("aria-expanded", "true");
    const top = element.createDiv({ cls: "citation-popover-header" });
    top.createEl("span", { text: `\u5F15\u7528\u6765\u6E90 \xB7 ${state.cluster.numbers.length} \u9879`, cls: "citation-popover-title" });
    const close = top.createEl("button", { text: "\u5173\u95ED", cls: "citation-popover-close", attr: { type: "button", "aria-label": "\u4FDD\u5B58\u5E76\u5173\u95ED\u5F15\u7528\u6765\u6E90" } });
    component.registerDomEvent(close, "click", () => {
      void this.closePopup(true);
    });
    const list = element.createDiv({ cls: "citation-source-list" });
    const beginEditing = () => {
      var _a2;
      if (this.popup !== popup || popup.closing || popup.editing) return;
      this.clearTimers();
      popup.editing = true;
      popup.pinned = true;
      element.classList.add("citation-popup-editing");
      popup.editors.forEach((editor) => editor.setEditing(true));
      (_a2 = popup.place) == null ? void 0 : _a2.call(popup);
    };
    const seen = /* @__PURE__ */ new Set();
    for (const reference of state.cluster.members) {
      if (reference.number === null || seen.has(reference.number)) continue;
      seen.add(reference.number);
      const row = list.createDiv({ cls: "citation-source-row" });
      row.createEl("span", { text: String(reference.number), cls: "citation-source-number" });
      const content = row.createDiv({ cls: "citation-source-content" });
      const text = (_b = (_a = reference.definition) == null ? void 0 : _a.content) != null ? _b : reference.content;
      const path = state.path;
      const editor = new PopupContentEditor(content, text, reference.number, component, {
        app: this.app,
        path,
        save: (expected, draft) => this.writeContent(popup, reference.sourceId, expected, draft),
        read: async () => {
          const source2 = await this.sourceForPath(path);
          const definition = this.model(source2, path).definitions.get(reference.sourceId);
          if (!definition) throw new DefinitionEditError("missing", "\u5F15\u7528\u5B9A\u4E49\u5DF2\u66F4\u65B0\uFF0C\u7F16\u8F91\u5185\u5BB9\u5DF2\u4FDD\u7559\u3002");
          return definition.content;
        },
        requestEditing: beginEditing,
        changed: () => {
          var _a2;
          return (_a2 = popup.place) == null ? void 0 : _a2.call(popup);
        }
      });
      popup.editors.push(editor);
      const jump = row.createEl("button", { text: "\u5B9A\u4F4D", cls: "citation-source-jump", attr: { type: "button", "aria-label": `\u5B9A\u4F4D\u811A\u6CE8 ${reference.number}` } });
      component.registerDomEvent(jump, "click", () => {
        void this.navigateReference(popup.state, reference);
      });
    }
    component.registerDomEvent(element, "mouseenter", () => {
      if (this.closeTimer !== null) {
        window.clearTimeout(this.closeTimer);
        this.closeTimer = null;
      }
    });
    component.registerDomEvent(element, "mouseleave", () => {
      if (!popup.pinned) this.deferClose();
    });
    component.registerDomEvent(doc, "keydown", (event) => {
      if (event.key === "Escape" && !event.isComposing && !event.defaultPrevented && this.popup === popup) {
        event.preventDefault();
        void this.closePopup(true);
      }
    }, true);
    component.registerDomEvent(doc, "pointerdown", (event) => {
      const target = event.target;
      if (popup.editors.some((editor) => editor.ownsTarget(target))) return;
      if (this.popup === popup && !element.contains(target) && !popup.badge.contains(target)) void this.closePopup(false);
    }, true);
    let side = "below";
    const place = () => {
      var _a2, _b2, _c2, _d2, _e2, _f2;
      if (this.popup !== popup) return;
      const win2 = (_a2 = doc.defaultView) != null ? _a2 : window;
      const liveRect = popup.badge.getBoundingClientRect();
      if (liveRect.width > 0) popup.rect = liveRect;
      const rect = popup.rect;
      const visual2 = win2.visualViewport;
      const viewport = {
        left: (_b2 = visual2 == null ? void 0 : visual2.offsetLeft) != null ? _b2 : 0,
        top: (_c2 = visual2 == null ? void 0 : visual2.offsetTop) != null ? _c2 : 0,
        width: (_d2 = visual2 == null ? void 0 : visual2.width) != null ? _d2 : win2.innerWidth,
        height: (_e2 = visual2 == null ? void 0 : visual2.height) != null ? _e2 : win2.innerHeight
      };
      const { width, maxHeight } = popupPlacement(viewport, rect, 0, popup.editing);
      element.style.width = `${width}px`;
      element.style.maxHeight = `${maxHeight}px`;
      const contentHeight = element.scrollHeight + element.offsetHeight - element.clientHeight;
      const placement = popupPlacement(viewport, rect, contentHeight, popup.editing);
      const { left, top: topY, height } = placement;
      if (side !== placement.side) {
        side = placement.side;
        const effect = (_f2 = popup.animation) == null ? void 0 : _f2.effect;
        if (!popup.closing && effect instanceof win2.KeyframeEffect) effect.setKeyframes(popupOpeningFrames(side));
      }
      element.dataset.citationSide = side;
      element.style.left = `${left}px`;
      element.style.top = side === "above" ? "auto" : `${topY}px`;
      element.style.bottom = side === "above" ? `${(doc.documentElement.clientHeight || win2.innerHeight) - topY - height}px` : "auto";
      element.style.transformOrigin = `${Math.max(0, Math.min(width, rect.left + rect.width / 2 - left))}px ${side === "above" ? "bottom" : "top"}`;
    };
    popup.place = place;
    doc.body.append(element);
    place();
    component.registerDomEvent(doc, "scroll", (event) => {
      if (element.contains(event.target)) return;
      if (popup.pinned) place();
      else void this.closePopup(false);
    }, true);
    component.registerDomEvent((_c = doc.defaultView) != null ? _c : window, "resize", place);
    const visual = (_d = doc.defaultView) == null ? void 0 : _d.visualViewport;
    if (visual) {
      visual.addEventListener("resize", place);
      visual.addEventListener("scroll", place);
      component.register(() => {
        visual.removeEventListener("resize", place);
        visual.removeEventListener("scroll", place);
      });
    }
    component.registerDomEvent(element, "focusin", (event) => {
      const target = event.target;
      if (import_obsidian5.Platform.isMobile && target.matches("textarea")) {
        const timer = window.setTimeout(() => {
          if (this.popup !== popup) return;
          place();
          target.scrollIntoView({ block: "nearest" });
        }, 180);
        component.register(() => window.clearTimeout(timer));
      }
    });
    if (pinned && !import_obsidian5.Platform.isMobile) (_e = element.querySelector(".citation-source-jump")) == null ? void 0 : _e.focus({ preventScroll: true });
    const win = (_f = doc.defaultView) != null ? _f : window;
    if (!win.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      popup.animation = element.animate(
        popupOpeningFrames(side),
        { duration: 210, easing: "cubic-bezier(0.18,0.8,0.2,1)", fill: "both" }
      );
      popup.animation.onfinish = () => {
        var _a2;
        (_a2 = popup.animation) == null ? void 0 : _a2.cancel();
        popup.animation = void 0;
      };
    }
    component.register(() => {
      var _a2;
      return (_a2 = popup.animation) == null ? void 0 : _a2.cancel();
    });
    if (win.ResizeObserver) {
      const observer = new win.ResizeObserver(place);
      observer.observe(element);
      component.register(() => observer.disconnect());
    }
    window.requestAnimationFrame(place);
  }
  writeContent(popup, id, expected, draft) {
    var _a;
    const path = popup.state.path;
    const previous = (_a = this.writes.get(path)) != null ? _a : Promise.resolve("");
    const work = previous.catch(() => "").then(async () => {
      var _a2;
      const views = this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view).filter((view) => {
        var _a3;
        return view instanceof import_obsidian5.MarkdownView && ((_a3 = view.file) == null ? void 0 : _a3.path) === path && view.getMode() === "source";
      });
      const preferred = (_a2 = views.find((view) => popup.state.view && view.contentEl.contains(popup.state.view.dom))) != null ? _a2 : views[0];
      if (preferred) {
        const source = preferred.editor.getValue();
        if (views.some((view) => view.editor.getValue() !== source)) {
          throw new DefinitionEditError("conflict", "\u7B14\u8BB0\u5B58\u5728\u5E76\u884C\u7F16\u8F91\uFF0C\u5B8C\u6210\u540C\u6B65\u540E\u5373\u53EF\u4FDD\u5B58\u3002");
        }
        const replacement = replaceDefinitionContent(source, id, expected, draft);
        if (replacement.source !== source) {
          preferred.editor.transaction({ changes: [{
            from: preferred.editor.offsetToPos(replacement.from),
            to: preferred.editor.offsetToPos(replacement.to),
            text: replacement.insert
          }] }, "citation-badges:edit-footnote");
          this.models.delete(path);
          await preferred.save();
        }
        return replacement.definition.content;
      }
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof import_obsidian5.TFile)) throw new DefinitionEditError("missing", "\u5F15\u7528\u6240\u5728\u7B14\u8BB0\u5DF2\u66F4\u65B0\uFF0C\u7F16\u8F91\u5185\u5BB9\u5DF2\u4FDD\u7559\u3002");
      let content = expected;
      await this.app.vault.process(file, (source) => {
        const replacement = replaceDefinitionContent(source, id, expected, draft);
        content = replacement.definition.content;
        return replacement.source;
      });
      this.models.delete(path);
      this.scheduleReadingRefresh();
      return content;
    });
    this.writes.set(path, work);
    void work.finally(() => {
      if (this.writes.get(path) === work) this.writes.delete(path);
    }).catch(() => {
    });
    return work;
  }
  async navigateReference(state, reference) {
    var _a, _b, _c, _d, _e;
    const native = (_a = state.native) == null ? void 0 : _a.get(referenceKey(reference));
    if (!await this.closePopup(false)) return;
    const source = await this.sourceForPath(state.path);
    if (!this.alive) return;
    const current = this.model(source, state.path).references.find((item) => referenceKey(item) === referenceKey(reference));
    if (current) reference = current;
    const view = (_b = this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view).find((item) => {
      var _a2;
      return item instanceof import_obsidian5.MarkdownView && ((_a2 = item.file) == null ? void 0 : _a2.path) === state.path && (state.view ? item.contentEl.contains(state.view.dom) : !!native && item.contentEl.contains(native));
    })) != null ? _b : this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view).find((item) => {
      var _a2;
      return item instanceof import_obsidian5.MarkdownView && ((_a2 = item.file) == null ? void 0 : _a2.path) === state.path;
    });
    if (view) this.returnLocation = {
      view,
      path: state.path,
      from: state.cluster.from,
      sourceId: state.cluster.members[0].sourceId,
      occurrence: state.cluster.members[0].occurrence,
      state: { ...view.getState() }
    };
    if (native == null ? void 0 : native.isConnected) {
      const id = (_c = native.getAttribute("href")) == null ? void 0 : _c.slice(1);
      const root = native.closest(".markdown-preview-view");
      const target = id && (root == null ? void 0 : root.querySelector(`[id="${CSS.escape(id)}"]`));
      if (target && target.getBoundingClientRect().height > 0) {
        centerRenderedTarget(target);
        return;
      }
    }
    if (state.view && reference.definition && ((_d = view == null ? void 0 : view.file) == null ? void 0 : _d.path) === state.path && view.getMode() === "source" && state.view.dom.isConnected && view.contentEl.contains(state.view.dom)) {
      const pos = Math.min(reference.definition.from, state.view.state.doc.length);
      state.view.dispatch({ selection: { anchor: pos } });
      state.view.focus();
      centerEditorPosition(state.view, pos);
      return;
    }
    if (view && reference.definition) {
      this.app.workspace.setActiveLeaf(view.leaf, { focus: true });
      await view.setState({ mode: "source", source: false }, { history: false });
      if (!this.alive || view.leaf.view !== view || ((_e = view.file) == null ? void 0 : _e.path) !== state.path || view.getMode() !== "source") return;
      view.editor.focus();
      await centerMarkdownPosition(view, reference.definition.from);
    }
  }
  async returnToCitation() {
    var _a, _b, _c;
    const location = this.returnLocation;
    if (!location) return;
    const file = this.app.vault.getAbstractFileByPath(location.path);
    if (!(file instanceof import_obsidian5.TFile)) return;
    if (!await this.closePopup(false)) return;
    const leaf = location.view.leaf;
    if (!(leaf.view instanceof import_obsidian5.MarkdownView) || ((_a = leaf.view.file) == null ? void 0 : _a.path) !== location.path) await leaf.openFile(file);
    const view = leaf.view;
    if (!(view instanceof import_obsidian5.MarkdownView)) return;
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    await view.setState(location.state, { history: false });
    if (!this.alive || leaf.view !== view || ((_b = view.file) == null ? void 0 : _b.path) !== location.path) return;
    const source = await this.sourceForPath(location.path);
    const reference = this.model(source, location.path).references.find((item) => item.sourceId === location.sourceId && item.occurrence === location.occurrence);
    const from = Math.min(source.length, (_c = reference == null ? void 0 : reference.from) != null ? _c : location.from);
    const line = source.slice(0, from).split("\n").length - 1;
    leaf.setEphemeralState({ line });
    if (view.getMode() === "source") {
      const position = view.editor.offsetToPos(from);
      view.editor.setCursor(position);
      view.editor.focus();
      await centerMarkdownPosition(view, from);
    }
  }
  async closePopup(focus, immediate = false) {
    this.clearTimers();
    const popup = this.popup;
    if (!popup) return true;
    if (popup.closing) return popup.closing;
    const close = async () => {
      var _a, _b, _c, _d;
      popup.element.inert = true;
      try {
        await Promise.all(popup.editors.map((editor) => editor.flush()));
      } catch (e) {
        popup.element.inert = false;
        popup.pinned = true;
        popup.closing = void 0;
        return false;
      }
      const state = (_a = this.badges.get(popup.badge)) != null ? _a : popup.state;
      state.button.setAttribute("aria-expanded", "false");
      state.button.removeAttribute("aria-controls");
      const win = (_b = popup.element.ownerDocument.defaultView) != null ? _b : window;
      const style = win.getComputedStyle(popup.element);
      const opacity = style.opacity, transform = style.transform;
      (_c = popup.animation) == null ? void 0 : _c.cancel();
      popup.animation = void 0;
      if (!immediate && popup.element.isConnected && !win.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        popup.animation = popup.element.animate([
          { opacity, transform },
          { opacity: 0, transform: "scale(0.97)" }
        ], { duration: 110, easing: "ease-out", fill: "both" });
        await popup.animation.finished.catch(() => {
        });
      }
      if (this.popup === popup) this.popup = null;
      (_d = popup.animation) == null ? void 0 : _d.cancel();
      this.removeChild(popup.component);
      popup.component.unload();
      popup.element.remove();
      if (focus && state.button.isConnected) state.button.focus();
      return true;
    };
    popup.closing = close();
    const result = await popup.closing;
    if (!result) popup.closing = void 0;
    return result;
  }
  async processRendered(element, context) {
    if (!this.alive || element.closest(".citation-badge-popover, .citation-callout-render")) return;
    const child = new import_obsidian5.MarkdownRenderChild(element);
    context.addChild(child);
    let alive = true;
    child.register(() => {
      alive = false;
    });
    const source = await this.sourceForPath(context.sourcePath);
    if (this.alive && alive) {
      const model = this.model(source, context.sourcePath);
      if (await this.enhanceCallout(element, context.sourcePath, model, child)) return;
      this.enhanceReading(element, context.sourcePath, model, child);
    }
  }
  async enhanceCallout(root, path, model, component) {
    var _a;
    const block = root.closest(".cm-callout");
    const widget = (_a = block == null ? void 0 : block.cmTile) == null ? void 0 : _a.widget;
    if (!block || !widget || model.source.slice(widget.start, widget.end) !== widget.text) return false;
    const previous = this.calloutRenders.get(block);
    const prepared = prepareCallout(model, widget.start, widget.end);
    if (!prepared.clusters.length) {
      previous == null ? void 0 : previous.dispose();
      return false;
    }
    const text = widget.text, from = widget.start, to = widget.end;
    const key = JSON.stringify([path, from, to, text, prepared.clusters.map((cluster) => [
      cluster.label,
      cluster.members.map((member) => [member.from, member.to, member.sourceId, member.occurrence])
    ])]);
    if ((previous == null ? void 0 : previous.key) === key) return true;
    const foldStates = Array.from(root.matches(".callout") ? [root, ...Array.from(root.querySelectorAll(".callout"))] : root.querySelectorAll(".callout")).map((callout) => callout.classList.contains("is-collapsed"));
    previous == null ? void 0 : previous.dispose();
    const renderComponent = component.addChild(new import_obsidian5.Component());
    const mount = { key, dispose: () => {
      component.removeChild(renderComponent);
      renderComponent.unload();
    } };
    this.calloutRenders.set(block, mount);
    renderComponent.register(() => {
      if (this.calloutRenders.get(block) === mount) this.calloutRenders.delete(block);
    });
    const rendered = root.ownerDocument.createElement("div");
    rendered.className = "citation-callout-render";
    await import_obsidian5.MarkdownRenderer.render(this.app, prepared.source, rendered, path, renderComponent);
    if (!this.alive || !block.isConnected || this.calloutRenders.get(block) !== mount || widget.text !== text || widget.start !== from || widget.end !== to) {
      mount.dispose();
      return true;
    }
    const original = root.matches(".callout") ? root : root.querySelector(".callout");
    const replacement = rendered.querySelector(".callout");
    if (!original || !replacement) {
      mount.dispose();
      return false;
    }
    const callouts = [replacement, ...Array.from(replacement.querySelectorAll(".callout"))];
    callouts.forEach((callout, index) => {
      var _a2;
      return callout.classList.toggle("is-collapsed", (_a2 = foldStates[index]) != null ? _a2 : false);
    });
    const nativeTasks = original.querySelectorAll(".task-list-item-checkbox");
    Array.from(replacement.querySelectorAll(".task-list-item-checkbox")).forEach((task, index) => {
      var _a2;
      const line = (_a2 = nativeTasks[index]) == null ? void 0 : _a2.getAttribute("data-line");
      if (line !== null && line !== void 0) task.setAttribute("data-line", line);
    });
    for (const marker of Array.from(replacement.querySelectorAll("[data-citation-callout]"))) {
      const cluster = prepared.clusters[Number(marker.dataset.citationCallout)];
      if (!cluster) continue;
      const badge = this.createBadge(cluster, path);
      marker.replaceWith(badge);
      renderComponent.register(() => this.disposeBadge(badge));
    }
    original.replaceWith(rendered);
    renderComponent.register(() => {
      if (rendered.isConnected) {
        [original, ...Array.from(original.querySelectorAll(".callout"))].forEach((callout, index) => {
          var _a2, _b;
          callout.classList.toggle("is-collapsed", (_b = (_a2 = callouts[index]) == null ? void 0 : _a2.classList.contains("is-collapsed")) != null ? _b : false);
        });
        rendered.replaceWith(original);
      }
    });
    return true;
  }
  async sourceForPath(path) {
    const view = this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view).find((item) => {
      var _a;
      return item instanceof import_obsidian5.MarkdownView && ((_a = item.file) == null ? void 0 : _a.path) === path && item.getMode() === "source";
    });
    if (view == null ? void 0 : view.editor) return view.editor.getValue();
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof import_obsidian5.TFile ? this.app.vault.cachedRead(file) : "";
  }
  enhanceReading(root, path, model, component) {
    const candidates = Array.from(root.querySelectorAll("sup.footnote-ref")).filter((sup) => !sup.classList.contains("citation-native-reference") && !sup.closest(".citation-badge-popover"));
    const nativeReferences = new Map(model.references.filter((reference) => reference.kind === "standard" && reference.number !== null).map((reference) => [referenceKey(reference), reference]));
    const records = candidates.map((sup) => {
      var _a, _b;
      const anchor = sup.querySelector("a.footnote-link");
      const match = (_a = anchor == null ? void 0 : anchor.textContent) == null ? void 0 : _a.match(/^\[(\d+)(?:-(\d+))?\]$/);
      if (!anchor || !match || !anchor.dataset.footref || anchor.dataset.footref.startsWith("[inline")) return null;
      const sourceId = anchor.dataset.footref;
      const occurrence = Number((_b = match[2]) != null ? _b : 0);
      const reference = nativeReferences.get(`${sourceId}:${occurrence}`);
      if (!reference) return null;
      return { sup, anchor, reference: { ...reference, number: Number(match[1]) } };
    }).filter((item) => item !== null);
    for (let index = 0; index < records.length; ) {
      const group = [records[index++]];
      while (index < records.length) {
        const previous = group[group.length - 1];
        const next = records[index];
        if (previous.reference.to !== next.reference.from || previous.sup.parentElement !== next.sup.parentElement || previous.sup.nextSibling !== next.sup) break;
        group.push(next);
        index++;
      }
      const members = group.map((item) => item.reference);
      const numbers = [...new Set(members.map((item) => item.number))];
      const cluster = { from: members[0].from, to: members[members.length - 1].to, members, numbers, label: formatNumbers(numbers) };
      const native = new Map(group.map((item) => [referenceKey(item.reference), item.anchor]));
      const badge = this.createBadge(cluster, path, void 0, native);
      group[0].sup.before(badge);
      const restore = group.map(({ sup, anchor }) => {
        const aria = sup.getAttribute("aria-hidden");
        const tab = anchor.getAttribute("tabindex");
        sup.classList.add("citation-native-reference");
        sup.setAttribute("aria-hidden", "true");
        anchor.setAttribute("tabindex", "-1");
        return () => {
          sup.classList.remove("citation-native-reference");
          if (aria === null) sup.removeAttribute("aria-hidden");
          else sup.setAttribute("aria-hidden", aria);
          if (tab === null) anchor.removeAttribute("tabindex");
          else anchor.setAttribute("tabindex", tab);
        };
      });
      this.readingRestores.set(badge, () => {
        badge.remove();
        restore.forEach((action) => action());
      });
      component.register(() => this.disposeBadge(badge));
    }
  }
  scheduleReadingRefresh() {
    if (!this.alive) return;
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      void this.refreshReading();
    }, 100);
  }
  async refreshReading() {
    var _a;
    if (!this.alive) return;
    for (const [root, mount] of this.manualMounts) {
      if (!root.isConnected) {
        this.removeChild(mount.component);
        mount.component.unload();
        this.manualMounts.delete(root);
      }
    }
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof import_obsidian5.MarkdownView) || !view.file) continue;
      const path = view.file.path;
      const callouts = view.contentEl.querySelectorAll(".cm-callout > .markdown-rendered");
      if (callouts.length) {
        const model = this.model(await this.sourceForPath(path), path);
        for (const callout of Array.from(callouts)) {
          let mount2 = this.manualMounts.get(callout);
          if (!mount2) {
            const component = this.addChild(new import_obsidian5.MarkdownRenderChild(callout));
            component.load();
            mount2 = { component, path };
            this.manualMounts.set(callout, mount2);
          }
          await this.enhanceCallout(callout, path, model, mount2.component);
        }
      }
      const root = view.contentEl.querySelector(".markdown-preview-view");
      if (!root || !root.isConnected) continue;
      let mount = this.manualMounts.get(root);
      if (mount && mount.path !== path) {
        this.removeChild(mount.component);
        mount.component.unload();
        this.manualMounts.delete(root);
        mount = void 0;
      }
      if (!root.querySelector("sup.footnote-ref:not(.citation-native-reference)")) continue;
      const source = await this.sourceForPath(path);
      if (!this.alive || !root.isConnected || ((_a = view.file) == null ? void 0 : _a.path) !== path) continue;
      if (!mount) {
        const component = this.addChild(new import_obsidian5.MarkdownRenderChild(root));
        component.load();
        mount = { component, path };
        this.manualMounts.set(root, mount);
      }
      this.enhanceReading(root, path, this.model(source, path), mount.component);
    }
  }
  applySettings() {
    document.body.style.setProperty("--citation-scale", `${this.settings.scale}em`);
    document.body.style.setProperty("--citation-tint", `${this.settings.tint}%`);
    document.body.style.setProperty("--citation-radius", `${this.settings.radius}px`);
  }
  async saveSettings() {
    this.applySettings();
    await this.saveData(this.settings);
  }
};
var BadgeSettingTab = class extends import_obsidian5.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian5.Setting(containerEl).setName("\u5F15\u7528\u5B57\u53F7\u6BD4\u4F8B").setDesc("\u5F15\u7528\u5B57\u53F7\u968F\u6B63\u6587\u53D8\u5316\uFF0C\u9ED8\u8BA4\u7EA6\u4E3A\u6B63\u6587\u7684 71%\u3002").addSlider((slider) => slider.setLimits(0.6, 0.9, 0.01).setValue(this.plugin.settings.scale).setDynamicTooltip().onChange((value) => {
      this.plugin.settings.scale = value;
      void this.plugin.saveSettings();
    }));
    new import_obsidian5.Setting(containerEl).setName("\u6DE1\u5E95\u5F3A\u5EA6").setDesc("\u4E3B\u9898\u5F3A\u8C03\u8272\u5728\u5FBD\u6807\u80CC\u666F\u4E2D\u7684\u6BD4\u4F8B\u3002").addSlider((slider) => slider.setLimits(5, 20, 1).setValue(this.plugin.settings.tint).setDynamicTooltip().onChange((value) => {
      this.plugin.settings.tint = value;
      void this.plugin.saveSettings();
    }));
    new import_obsidian5.Setting(containerEl).setName("\u5FBD\u6807\u5706\u89D2").setDesc("\u5355\u4F4D\u4E3A\u50CF\u7D20\u3002").addSlider((slider) => slider.setLimits(2, 6, 1).setValue(this.plugin.settings.radius).setDynamicTooltip().onChange((value) => {
      this.plugin.settings.radius = value;
      void this.plugin.saveSettings();
    }));
  }
};
