"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ImageLayoutsEnhanced
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");

// src/types.ts
var DEFAULT_OPTIONS = {
  id: "",
  layout: "g",
  fit: "contain",
  height: 320,
  gap: 8,
  radius: 8,
  caption: "",
  grid: "A A B\nA A C",
  thumbnails: true,
  overlay: "never",
  align: "full",
  width: "100%",
  descriptions: [],
  fromFolder: "",
  sortBy: "name",
  reverse: false,
  limit: 0
};
var LAYOUT_LABELS = {
  a: "\u53CC\u56FE\u7B49\u5BBD",
  b: "\u5DE6\u5927\u53F3\u5C0F",
  c: "\u5DE6\u5C0F\u53F3\u5927",
  d: "\u5DE6\u4E3B\u56FE\uFF0B\u4E24\u56FE",
  e: "\u53F3\u4E3B\u56FE\uFF0B\u4E24\u56FE",
  f: "\u5DE6\u4E3B\u56FE\uFF0B\u4E09\u56FE",
  g: "\u53F3\u4E3B\u56FE\uFF0B\u4E09\u56FE",
  h: "\u4E09\u56FE\u7B49\u5BBD",
  i: "\u56DB\u56FE\u7B49\u5BBD",
  single: "\u5355\u56FE",
  "masonry-2": "\u7011\u5E03\u6D41 \xB7 \u4E24\u5217",
  "masonry-3": "\u7011\u5E03\u6D41 \xB7 \u4E09\u5217",
  "masonry-4": "\u7011\u5E03\u6D41 \xB7 \u56DB\u5217",
  "masonry-5": "\u7011\u5E03\u6D41 \xB7 \u4E94\u5217",
  "masonry-6": "\u7011\u5E03\u6D41 \xB7 \u516D\u5217",
  carousel: "\u4E3B\u56FE\uFF0B\u5E95\u90E8\u7F29\u7565\u56FE",
  "stage-left": "\u5DE6\u4E3B\u56FE\uFF0B\u5168\u90E8\u56FE\u7247",
  "stage-right": "\u53F3\u4E3B\u56FE\uFF0B\u5168\u90E8\u56FE\u7247",
  filmstrip: "\u6A2A\u5411\u56FE\u7247\u5E26",
  focus: "\u4E3B\u56FE\uFF0B\u4FA7\u8FB9\u65B9\u683C",
  custom: "\u81EA\u5B9A\u4E49\u7F51\u683C"
};

// src/model.ts
var layouts = /* @__PURE__ */ new Set(["a", "b", "c", "d", "e", "f", "g", "h", "i", "single", "masonry-2", "masonry-3", "masonry-4", "masonry-5", "masonry-6", "carousel", "filmstrip", "focus", "custom", "stage-left", "stage-right"]);
var own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
var record = (value) => value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
var pick = (object, key, alias) => own(object, key) ? object[key] : alias && own(object, alias) ? object[alias] : void 0;
var word = (value) => typeof value === "string" ? value.trim().toLowerCase() : "";
var text = (value, fallback) => typeof value === "string" ? value : fallback;
var bool = (value, fallback) => typeof value === "boolean" ? value : fallback;
function bounded(value, fallback, min, max) {
  const number = typeof value === "number" ? value : typeof value === "string" && /^\d+(?:\.\d+)?(?:px)?$/i.test(value.trim()) ? Number(value.trim().replace(/px$/i, "")) : NaN;
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
function dimension(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return `${Math.min(4096, value)}px`;
  if (typeof value !== "string") return fallback;
  const match = /^(\d+(?:\.\d+)?)(px|%|rem|em|vw|vh)$/i.exec(value.trim());
  if (!match || Number(match[1]) <= 0) return fallback;
  const unit = match[2].toLowerCase();
  const max = ["%", "vw", "vh"].includes(unit) ? 100 : ["em", "rem"].includes(unit) ? 256 : 4096;
  return `${Math.min(max, Number(match[1]))}${unit}`;
}
function normalized(input, fallback) {
  const object = record(input);
  const layoutInput = word(object.layout).replace(/^legacy-layout-/, "").replace(/^masonry([2-6])$/, "masonry-$1");
  const overlay = word(object.overlay);
  const fit = word(object.fit);
  const align = word(object.align);
  return {
    id: text(object.id, fallback.id),
    layout: layouts.has(layoutInput) ? layoutInput : fallback.layout,
    fit: ["cover", "contain", "natural"].includes(fit) ? fit : fallback.fit,
    height: bounded(pick(object, "height", "carouselHeight"), fallback.height, 120, 1200),
    gap: bounded(object.gap, fallback.gap, 0, 64),
    radius: bounded(object.radius, fallback.radius, 0, 48),
    caption: text(object.caption, fallback.caption),
    grid: text(object.grid, fallback.grid),
    thumbnails: bool(pick(object, "thumbnails", "carouselShowThumbnails"), fallback.thumbnails),
    overlay: ["never", "hover", "always"].includes(overlay) ? overlay : typeof object.permanentOverlay === "boolean" ? object.permanentOverlay ? "always" : "hover" : fallback.overlay,
    align: ["left", "center", "right", "full"].includes(align) ? align : fallback.align,
    width: dimension(object.width, fallback.width),
    descriptions: Array.isArray(object.descriptions) ? object.descriptions.map((value) => typeof value === "string" ? value : "") : [...fallback.descriptions],
    fromFolder: text(object.fromFolder, fallback.fromFolder),
    sortBy: ["name", "mtime"].includes(word(object.sortBy)) ? word(object.sortBy) : fallback.sortBy,
    reverse: bool(object.reverse, fallback.reverse),
    limit: Math.floor(bounded(object.limit, fallback.limit, 0, 1e3))
  };
}
function normalizeOptions(input, defaults = {}) {
  return normalized(input, normalized(defaults, DEFAULT_OPTIONS));
}
function lines(source) {
  const result = [];
  let from = 0;
  while (from < source.length) {
    const newline = source.indexOf("\n", from);
    const next = newline < 0 ? source.length : newline + 1;
    const to = newline < 0 ? source.length : newline > from && source[newline - 1] === "\r" ? newline - 1 : newline;
    result.push({ from, to, next, text: source.slice(from, to), index: result.length });
    from = next;
  }
  return result;
}
function codeSpanEnd(source, from, size) {
  const tail = source.slice(from);
  const blockBoundary = /\r?\n[ \t]*\r?\n|\r?\n {0,3}(?:`{3,}|~{3,})/.exec(tail);
  const end = blockBoundary ? from + blockBoundary.index : source.length;
  const runs = /`+/g;
  runs.lastIndex = from;
  let match;
  while ((match = runs.exec(source)) && match.index < end) if (match[0].length === size) return match.index + size;
  return 0;
}
function parseGroups(source) {
  const result = [];
  const sourceLines = lines(source);
  let frontmatter = sourceLines[0] !== void 0 && /^(?:\uFEFF)?---[ \t]*$/.test(sourceLines[0].text);
  let comment = false;
  let rawCodeTag;
  let inlineCodeEnd = 0;
  let fence;
  let pending;
  for (const line of sourceLines) {
    if (frontmatter) {
      if (line.index > 0 && /^(?:---|\.\.\.)[ \t]*$/.test(line.text)) frontmatter = false;
      continue;
    }
    const fenceMarker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line.text);
    if (fence) {
      if (fenceMarker && fenceMarker[1][0] === fence.char && fenceMarker[1].length >= fence.size && /^[ \t]*$/.test(fenceMarker[2])) fence = void 0;
      continue;
    }
    if (!comment && !rawCodeTag && inlineCodeEnd <= line.from && fenceMarker && !(fenceMarker[1][0] === "`" && fenceMarker[2].includes("`"))) {
      fence = { char: fenceMarker[1][0], size: fenceMarker[1].length };
      continue;
    }
    if (!comment && !rawCodeTag && inlineCodeEnd <= line.from) {
      const opening = /^ {0,3}<!--[ \t]*image-layouts:[ \t]*(.*?)[ \t]*-->[ \t]*$/.exec(line.text);
      const closing = /^ {0,3}<!--[ \t]*\/image-layouts[ \t]*-->[ \t]*$/.test(line.text);
      if (opening) {
        let options = null;
        try {
          if (!opening[1].includes("-->") && !opening[1].includes("<!--")) {
            const parsed = JSON.parse(opening[1]);
            if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) options = normalizeOptions(parsed);
          }
        } catch {
        }
        if (pending) {
          pending.depth++;
          pending.invalid = true;
        } else pending = { line, options, depth: 1, invalid: options === null };
        continue;
      }
      if (closing) {
        if (pending) {
          pending.depth--;
          if (pending.depth === 0) {
            if (!pending.invalid && pending.options) {
              result.push({ from: pending.line.from, to: line.to, bodyFrom: pending.line.next, bodyTo: line.from, startLine: pending.line.index, endLine: line.index, body: source.slice(pending.line.next, line.from), raw: source.slice(pending.line.from, line.to), options: pending.options, kind: "comment" });
            }
            pending = void 0;
          }
        }
        continue;
      }
    }
    let position = 0;
    while (position < line.text.length) {
      if (rawCodeTag) {
        const closing = new RegExp(`<\\/${rawCodeTag}\\s*>`, "i").exec(line.text.slice(position));
        if (!closing) break;
        position += closing.index + closing[0].length;
        rawCodeTag = void 0;
        continue;
      }
      if (line.from + position < inlineCodeEnd) {
        position = Math.min(line.text.length, inlineCodeEnd - line.from);
        continue;
      }
      if (comment) {
        const end = line.text.indexOf("-->", position);
        if (end < 0) break;
        comment = false;
        position = end + 3;
      } else {
        const token = /<!--|`+|<(pre|code|script|style|textarea)\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(line.text.slice(position));
        if (!token) break;
        const start = position + token.index;
        if (token[0] === "<!--") {
          comment = true;
          position = start + 4;
        } else if (token[1]) {
          rawCodeTag = token[1].toLowerCase();
          position = start + token[0].length;
        } else {
          let slashes = 0;
          for (let cursor = start - 1; cursor >= 0 && line.text[cursor] === "\\"; cursor--) slashes++;
          position = start + token[0].length;
          if (slashes % 2 === 0) inlineCodeEnd = codeSpanEnd(source, line.from + position, token[0].length);
        }
      }
    }
  }
  return result;
}
function serializeOpen(options) {
  const value = normalizeOptions(options);
  const compact = { layout: value.layout };
  if (value.id) compact.id = value.id;
  for (const key of Object.keys(DEFAULT_OPTIONS)) {
    if (key === "id" || key === "layout") continue;
    if (JSON.stringify(value[key]) !== JSON.stringify(DEFAULT_OPTIONS[key])) compact[key] = value[key];
  }
  const json = JSON.stringify(compact).replace(/[<>&\u2028\u2029]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return `<!-- image-layouts: ${json} -->`;
}
function validRange(source, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > source.length || from > to) return false;
  const boundary = (offset) => !(offset > 0 && offset < source.length && (/[\uD800-\uDBFF]/.test(source[offset - 1]) && /[\uDC00-\uDFFF]/.test(source[offset]) || source[offset - 1] === "\r" && source[offset] === "\n"));
  return boundary(from) && boundary(to);
}
function wrapSelection(source, from, to, options) {
  if (!validRange(source, from, to) || from === to || !source.slice(from, to).trim()) return null;
  if (parseGroups(source).some((group) => from < group.to && to > group.from)) return null;
  if (/<!--[ \t]*\/?image-layouts(?::|[ \t]*-->)/.test(source.slice(from, to))) return null;
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const before = from > 0 && source[from - 1] !== "\n" ? eol : "";
  const body = source.slice(from, to);
  const bodyEnd = body.endsWith("\n") ? "" : eol;
  const after = to < source.length ? eol : "";
  const insert = `${before}${serializeOpen(options)}${eol}${body}${bodyEnd}<!-- /image-layouts -->${after}`;
  const candidate = source.slice(0, from) + insert + source.slice(to);
  if (!parseGroups(candidate).some((group) => group.from === from + before.length && group.body === body + bodyEnd)) return null;
  return { from, to, insert };
}
function currentGroup(source, group) {
  return parseGroups(source).find((candidate) => candidate.from === group.from && candidate.to === group.to && candidate.raw === group.raw);
}
function updateGroup(source, group, patch) {
  const current = currentGroup(source, group);
  if (!current) return null;
  const firstLineEnd = source.indexOf("\n", current.from);
  const end = firstLineEnd > current.from && source[firstLineEnd - 1] === "\r" ? firstLineEnd - 1 : firstLineEnd;
  const indent = /^ */.exec(source.slice(current.from, end))?.[0] ?? "";
  return { from: current.from, to: end, insert: indent + serializeOpen(normalizeOptions(patch, current.options)) };
}
function unwrapGroup(source, group) {
  const current = currentGroup(source, group);
  if (!current) return null;
  const end = source.startsWith("\r\n", current.to) ? current.to + 2 : source[current.to] === "\n" ? current.to + 1 : current.to;
  return { from: current.from, to: end, insert: current.body };
}
function parseCustomGrid(grid) {
  const rows = grid.trim().split(/\r?\n/).map((row) => row.replace(/[ \t]/g, "")).filter(Boolean);
  if (!rows.length || !rows[0].length) return { error: "\u8BF7\u8F93\u5165\u5305\u542B\u5B57\u6BCD\u533A\u57DF\u7684\u7F51\u683C\u3002" };
  const columns2 = rows[0].length;
  if (rows.length > 64 || columns2 > 64) return { error: "\u7F51\u683C\u7684\u884C\u5217\u6570\u5E94\u5728 1 \u81F3 64 \u4E4B\u95F4\u3002" };
  if (rows.some((row) => row.length !== columns2)) return { error: "\u6BCF\u884C\u9700\u8981\u5305\u542B\u76F8\u540C\u6570\u91CF\u7684\u7F51\u683C\u5355\u5143\u3002" };
  if (rows.some((row) => /[^A-Za-z.]/.test(row))) return { error: "\u7F51\u683C\u5355\u5143\u4F7F\u7528\u82F1\u6587\u5B57\u6BCD\u6216\u7A7A\u4F4D\u7B26\u53F7 .\u3002" };
  const regions = /* @__PURE__ */ new Map();
  rows.forEach((row, y) => [...row].forEach((letter2, x) => {
    if (letter2 === ".") return;
    const region = regions.get(letter2);
    if (region) {
      region.bottom = y;
      region.left = Math.min(region.left, x);
      region.right = Math.max(region.right, x);
      region.count++;
    } else regions.set(letter2, { top: y, bottom: y, left: x, right: x, count: 1 });
  }));
  if (!regions.size) return { error: "\u7F51\u683C\u9700\u8981\u81F3\u5C11\u4E00\u4E2A\u5B57\u6BCD\u533A\u57DF\u3002" };
  for (const [letter2, region] of regions) if ((region.bottom - region.top + 1) * (region.right - region.left + 1) !== region.count) return { error: `\u5B57\u6BCD ${letter2} \u7684\u533A\u57DF\u9700\u8981\u7EC4\u6210\u5B8C\u6574\u77E9\u5F62\u3002` };
  const indexes = new Map([...regions.keys()].map((letter2, index) => [letter2, index]));
  const areas = rows.map((row) => `"${[...row].map((letter2) => letter2 === "." ? "." : `image-${indexes.get(letter2)}`).join(" ")}"`).join(" ");
  return { areas, columns: columns2, slots: regions.size };
}

// src/images.ts
var IMAGE_EXTENSION = /\.(?:avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|tiff?|webp)$/i;
var unescapeMarkdown = (value) => value.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, "$1");
var normalizeLabel = (value) => unescapeMarkdown(value).trim().replace(/\s+/g, " ").toLowerCase();
var decodeEntities = (value) => value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
  const names = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" };
  if (entity[1] !== "#") return names[entity.toLowerCase()] ?? entity;
  const code = entity[2].toLowerCase() === "x" ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
  return code > 0 && code <= 1114111 ? String.fromCodePoint(code) : entity;
});
function isImage(target) {
  if (/^(?:https?:\/\/|data:image\/)/i.test(target)) return true;
  let path = target.split(/[?#]/, 1)[0];
  try {
    path = decodeURIComponent(path);
  } catch {
  }
  return IMAGE_EXTENSION.test(path);
}
function visibleSource(text2) {
  const chars = text2.split("");
  const hide = (start, end) => {
    for (let i = start; i < end; i++) if (chars[i] !== "\n" && chars[i] !== "\r") chars[i] = " ";
  };
  const frontmatter = /^(?:\uFEFF)?---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text2);
  if (frontmatter) hide(0, frontmatter[0].length);
  for (const match of text2.matchAll(/<!--[\s\S]*?(?:-->|$)/g)) hide(match.index, match.index + match[0].length);
  let fence;
  let offset = 0;
  for (const line of text2.split(/(?<=\n)/)) {
    const available = chars.slice(offset, offset + line.length).join("");
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)/.exec(available);
    if (fence) {
      hide(offset, offset + line.length);
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.size && /^\s*$/.test(marker[2])) fence = void 0;
    } else if (marker && !(marker[1][0] === "`" && marker[2].includes("`"))) {
      fence = { char: marker[1][0], size: marker[1].length };
      hide(offset, offset + line.length);
    }
    offset += line.length;
  }
  let source = chars.join("");
  for (const match of source.matchAll(/<(pre|code|script|style|textarea)\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?(?:<\/\1\s*>|$)/gi)) hide(match.index, match.index + match[0].length);
  source = chars.join("");
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== "`" || escaped(source, i)) continue;
    let end = i;
    while (source[end] === "`") end++;
    const size = end - i;
    let closing = end;
    while ((closing = source.indexOf("`".repeat(size), closing)) >= 0) {
      if (source[closing - 1] !== "`" && source[closing + size] !== "`") break;
      closing += size;
    }
    if (closing >= 0) {
      hide(i, closing + size);
      i = closing + size - 1;
    } else i = end - 1;
  }
  source = chars.join("");
  return source;
}
function escaped(text2, index) {
  let slashes = 0;
  while (index > 0 && text2[--index] === "\\") slashes++;
  return slashes % 2 === 1;
}
function closingBracket(text2, start) {
  let depth = 1;
  for (let i = start; i < text2.length; i++) {
    if (escaped(text2, i)) continue;
    if (text2[i] === "[") depth++;
    if (text2[i] === "]" && --depth === 0) return i;
  }
  return -1;
}
function destination(text2, start) {
  let i = start;
  while (/\s/.test(text2[i] ?? "") && i < text2.length) i++;
  const first = i;
  let target;
  if (text2[i] === "<") {
    i++;
    const pathStart = i;
    while (i < text2.length && (text2[i] !== ">" || escaped(text2, i)) && text2[i] !== "\n") i++;
    if (text2[i] !== ">") return;
    target = text2.slice(pathStart, i++);
  } else {
    let depth = 0;
    while (i < text2.length) {
      if (!escaped(text2, i)) {
        if (text2[i] === "(") depth++;
        else if (text2[i] === ")") {
          if (depth === 0) break;
          depth--;
        } else if (/\s/.test(text2[i]) && depth === 0) break;
      }
      i++;
    }
    if (i === first) return;
    target = text2.slice(first, i);
  }
  return { target: unescapeMarkdown(target), end: i };
}
function extractImages(text2) {
  const source = visibleSource(text2);
  const refs = /* @__PURE__ */ new Map();
  for (const match of source.matchAll(/^ {0,3}\[([^\]\n]+)\]:[ \t]*(.*)$/gm)) {
    const parsed = destination(match[2], 0);
    if (parsed && !refs.has(normalizeLabel(match[1]))) refs.set(normalizeLabel(match[1]), parsed.target);
  }
  const results = [];
  const lineStarts = [0];
  for (let i = 0; i < text2.length; i++) if (text2[i] === "\n") lineStarts.push(i + 1);
  const add = (offset, end, target, alt, kind) => {
    if (!isImage(target)) return;
    let low = 0, high = lineStarts.length;
    while (low + 1 < high) {
      const mid = low + high >>> 1;
      if (lineStarts[mid] <= offset) low = mid;
      else high = mid;
    }
    results.push({ target, alt, kind, line: low, offset, raw: text2.slice(offset, end) });
  };
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "<" && /^<img\b/i.test(source.slice(i))) {
      const tag = /^<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(source.slice(i));
      if (!tag) continue;
      const attributes = /* @__PURE__ */ new Map();
      for (const attr of tag[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attributes.set(attr[1].toLowerCase(), decodeEntities(attr[2] ?? attr[3] ?? attr[4]));
      if (attributes.has("src")) add(i, i + tag[0].length, attributes.get("src"), attributes.get("alt") ?? "", "html");
      i += tag[0].length - 1;
      continue;
    }
    if (source[i] !== "!" || source[i + 1] !== "[" || escaped(source, i)) continue;
    if (source[i + 2] === "[") {
      const end2 = source.indexOf("]]", i + 3);
      if (end2 < 0 || /[\r\n]/.test(source.slice(i + 3, end2))) continue;
      const [target, ...aliases] = text2.slice(i + 3, end2).split("|");
      add(i, end2 + 2, target.trim(), aliases.join("|"), "wiki");
      i = end2 + 1;
      continue;
    }
    const bracket = closingBracket(source, i + 2);
    if (bracket < 0) continue;
    const alt = unescapeMarkdown(text2.slice(i + 2, bracket));
    let end = bracket + 1;
    if (source[end] === "(") {
      const parsed = destination(source, end + 1);
      if (!parsed) continue;
      end = parsed.end;
      while (/\s/.test(source[end] ?? "") && end < source.length) end++;
      if (/['"(]/.test(source[end] ?? "")) {
        const quote = source[end++] === "(" ? ")" : source[end - 1];
        while (end < source.length && (source[end] !== quote || escaped(source, end))) end++;
        if (source[end] !== quote) continue;
        end++;
        while (/\s/.test(source[end] ?? "") && end < source.length) end++;
      }
      if (source[end] !== ")") continue;
      add(i, end + 1, parsed.target, alt, "markdown");
      i = end;
    } else {
      let label = alt;
      if (source[end] === "[") {
        const labelEnd = closingBracket(source, end + 1);
        if (labelEnd < 0) continue;
        label = source.slice(end + 1, labelEnd) || alt;
        end = labelEnd + 1;
      }
      const target = refs.get(normalizeLabel(label));
      if (target) {
        add(i, end, target, alt, "reference");
        i = end - 1;
      }
    }
  }
  return results;
}
function getSupplementalMarkdown(body, knownReferences) {
  let output = body;
  const references = knownReferences ?? extractImages(body);
  const unique = /* @__PURE__ */ new Map();
  for (const image of references) {
    if (Number.isInteger(image.offset) && image.offset >= 0 && image.raw.length > 0 && body.slice(image.offset, image.offset + image.raw.length) === image.raw) unique.set(image.offset, image);
  }
  for (const image of [...unique.values()].sort((a, b) => b.offset - a.offset)) output = output.slice(0, image.offset) + output.slice(image.offset + image.raw.length);
  return output.trim();
}

// src/layouts.ts
var PRESETS = {
  a: { weights: [1, 1], rows: [[0, 1]] },
  b: { weights: [2, 1], rows: [[0, 1]] },
  c: { weights: [1, 2], rows: [[1, 0]] },
  d: { weights: [2, 1], rows: [[0, 1], [0, 2]] },
  e: { weights: [1, 2], rows: [[1, 0], [2, 0]] },
  f: { weights: [3, 1], rows: [[0, 1], [0, 2], [0, 3]] },
  g: { weights: [1, 3], rows: [[1, 0], [2, 0], [3, 0]] },
  h: { weights: [1, 1, 1], rows: [[0, 1, 2]] },
  i: { weights: [1, 1, 1, 1], rows: [[0, 1, 2, 3]] },
  single: { weights: [1], rows: [[0]] }
};
function definition(rows, weights) {
  const regions = /* @__PURE__ */ new Map();
  rows.forEach((row, y) => row.forEach((area, x) => {
    if (area === ".") return;
    const region = regions.get(area);
    if (region) {
      region.rowSpan = Math.max(region.rowSpan, y + 2 - region.row);
      region.columnSpan = Math.max(region.columnSpan, x + 2 - region.column);
    } else {
      regions.set(area, {
        imageIndex: Number(area.slice("image-".length)),
        area,
        row: y + 1,
        column: x + 1,
        rowSpan: 1,
        columnSpan: 1
      });
    }
  }));
  return {
    columns: weights.length,
    rows: rows.length,
    columnFractions: [...weights],
    areas: rows.map((row) => `"${row.join(" ")}"`).join(" "),
    slots: regions.size,
    cells: [...regions.values()].sort((a, b) => a.imageIndex - b.imageIndex)
  };
}
function getGridDefinition(layout, customGrid = "") {
  if (layout === "custom") {
    const parsed = parseCustomGrid(customGrid);
    if ("error" in parsed) {
      return { ...getGridDefinition("g"), fallbackReason: parsed.error };
    }
    const rows = [...parsed.areas.matchAll(/"([^"]+)"/g)].map((match) => match[1].split(" "));
    return definition(rows, Array(parsed.columns).fill(1));
  }
  const preset = PRESETS[layout];
  return preset ? definition(preset.rows.map((row) => row.map((index) => `image-${index}`)), preset.weights) : null;
}
function getMasonryColumnCount(layout) {
  const match = /^masonry-([2-6])$/.exec(layout);
  return match ? Number(match[1]) : null;
}
function getBalancedGridDefinition(imageCount) {
  const count = Number.isFinite(imageCount) ? Math.max(1, Math.floor(imageCount)) : 1;
  const columns2 = count <= 3 ? count : Math.ceil(Math.sqrt(count));
  const rows = [];
  for (let first = 0; first < count; first += columns2) {
    const last = Math.min(first + columns2 - 1, count - 1);
    rows.push(Array.from({ length: columns2 }, (_, column) => `image-${Math.min(first + column, last)}`));
  }
  return definition(rows, Array(columns2).fill(1));
}
function getMatchingGridDefinition(layout, imageCount, customGrid = "") {
  const preset = getGridDefinition(layout, customGrid);
  if (preset?.slots === imageCount) return preset;
  const balanced = getBalancedGridDefinition(imageCount);
  return preset?.fallbackReason ? { ...balanced, fallbackReason: preset.fallbackReason } : balanced;
}
function getScalableStageDefinition(direction, imageCount) {
  const count = Number.isFinite(imageCount) ? Math.max(1, Math.floor(imageCount)) : 1;
  if (count === 1) return getGridDefinition("single");
  if (count <= 4) {
    const presets = direction === "left" ? ["b", "d", "f"] : ["c", "e", "g"];
    return getGridDefinition(presets[count - 2]);
  }
  const sideCount = count - 1;
  const rows = [];
  for (let index = 1; index <= sideCount; index += 2) {
    const first = `image-${index}`;
    const second = `image-${Math.min(index + 1, sideCount)}`;
    rows.push(direction === "left" ? ["image-0", first, second] : [first, second, "image-0"]);
  }
  return definition(rows, direction === "left" ? [3, 1, 1] : [1, 1, 3]);
}
function getDominantGridDefinition(layout, imageCount) {
  const direction = ["b", "d", "f", "stage-left"].includes(layout) ? "left" : ["c", "e", "g", "stage-right"].includes(layout) ? "right" : void 0;
  if (!direction) return null;
  const preset = getGridDefinition(layout);
  if (preset && (imageCount === void 0 || imageCount === preset.slots)) return preset;
  return getScalableStageDefinition(direction, imageCount ?? 4);
}
function getStageLayoutLabel(layout, imageCount, customGrid = "") {
  const grid = getDominantGridDefinition(layout, imageCount);
  if (!grid) {
    const preset2 = getGridDefinition(layout, customGrid);
    return preset2 && preset2.slots !== imageCount ? `${imageCount}\u56FE\u7F51\u683C` : LAYOUT_LABELS[layout];
  }
  const preset = getGridDefinition(layout);
  if (preset?.slots === imageCount) return LAYOUT_LABELS[layout];
  if (imageCount <= 1) return "\u5355\u56FE";
  const direction = grid.cells[0].column === 1 ? "\u5DE6" : "\u53F3";
  return `${direction}\u4E3B\u56FE\uFF0B${imageCount - 1}\u56FE`;
}
function getStageThumbnailOrder(count, activeIndex = 0) {
  const order = Array.from({ length: Math.max(0, count - 1) }, (_, index) => index + 1);
  if (activeIndex > 0 && activeIndex < count) order[activeIndex - 1] = 0;
  return order;
}
function swapStageImage(order, previous, next) {
  const slot = order.indexOf(next);
  if (slot < 0 || previous === next) return [...order];
  return order.map((index, position) => position === slot ? previous : index);
}
function getFocusPlacement(width) {
  return Number.isFinite(width) && width >= 640 ? "side" : "bottom";
}

// src/layout-choices.ts
var fixed = {
  1: [{ layout: "single", preview: ["A"] }],
  2: [{ layout: "a", preview: ["AB"] }, { layout: "b", preview: ["AAB"] }, { layout: "c", preview: ["BAA"] }],
  3: [{ layout: "d", preview: ["AAB", "AAC"] }, { layout: "e", preview: ["BAA", "CAA"] }, { layout: "h", preview: ["ABC"] }],
  4: [{ layout: "f", preview: ["AAAB", "AAAC", "AAAD"] }, { layout: "g", preview: ["BAAA", "CAAA", "DAAA"] }, { layout: "i", preview: ["ABCD"] }]
};
function letter(index) {
  return index < 26 ? String.fromCharCode(65 + index) : index < 52 ? String.fromCharCode(97 + index - 26) : String.fromCharCode(57344 + index - 52);
}
function rowLetters(from, count) {
  return Array.from({ length: count }, (_, index) => letter(from + index)).join("");
}
function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}
function balancedRows(count) {
  const rows = Math.max(1, Math.round(Math.sqrt(count)));
  const base = Math.floor(count / rows), extra = count % rows;
  const sizes = Array.from({ length: rows }, (_, index) => base + (index >= rows - extra ? 1 : 0));
  const width = sizes.reduce((a, b) => a / gcd(a, b) * b, 1);
  let next = 0;
  const preview = sizes.map((size) => Array.from({ length: size }, () => letter(next++).repeat(width / size)).join(""));
  return { preview, sizes };
}
function stagePreview(count, right) {
  if (count < 5) return fixed[count]?.find((item) => item.layout === (right ? count === 2 ? "c" : count === 3 ? "e" : "g" : count === 2 ? "b" : count === 3 ? "d" : "f"))?.preview.slice() ?? ["A"];
  const rows = [];
  for (let index = 1; index < count; index += 2) {
    const first = letter(index), last = index + 1 < count ? letter(index + 1) : first;
    rows.push(right ? first + last + "AAA" : "AAA" + first + last);
  }
  return rows;
}
function masonryPreview(count, columns2) {
  const base = Math.floor(count / columns2), extra = count % columns2;
  const stacks = Array.from({ length: columns2 }, (_, index) => base + (index < extra ? 1 : 0));
  const height = Math.max(...stacks);
  let next = 0;
  const cells = stacks.map((size) => {
    const rows = [];
    const unit = Math.floor(height / size), remainder = height % size;
    for (let index = 0; index < size; index++) {
      const token = letter(next++);
      rows.push(...Array(unit + (index < remainder ? 1 : 0)).fill(token));
    }
    return rows;
  });
  return Array.from({ length: height }, (_, row) => cells.map((column) => column[row]).join(""));
}
function getLayoutChoices(count) {
  if (!Number.isFinite(count) || !Number.isInteger(count) || count < 1) return [];
  const choices = (fixed[count] ?? []).map((item) => ({
    key: item.layout,
    layout: item.layout,
    label: LAYOUT_LABELS[item.layout],
    preview: [...item.preview]
  }));
  if (count === 1) return choices;
  if (count >= 5) {
    choices.push(
      { key: "stage-left", layout: "stage-left", label: `\u5DE6\u4E3B\u56FE\uFF0B${count - 1}\u56FE`, preview: stagePreview(count, false) },
      { key: "stage-right", layout: "stage-right", label: `\u53F3\u4E3B\u56FE\uFF0B${count - 1}\u56FE`, preview: stagePreview(count, true) }
    );
  }
  const seen = new Set(choices.map((choice) => choice.preview.join("\n")));
  const custom = (key, label, preview) => {
    const grid = preview.join("\n");
    if (seen.has(grid)) return;
    seen.add(grid);
    choices.push({ key, label, layout: "custom", grid, preview: [...preview] });
  };
  if (count <= 52) {
    custom("custom-row", `\u6A2A\u6392 \xB7 ${count}\u56FE`, [rowLetters(0, count)]);
    if (count === 2) custom("custom-stack", "\u53CC\u56FE\u7AD6\u6392", ["A", "B"]);
    let rows = Math.floor(Math.sqrt(count));
    while (rows > 1 && count % rows !== 0) rows--;
    if (rows > 1) {
      const columns2 = count / rows;
      custom(
        `custom-grid-${columns2}x${rows}`,
        `\u7B49\u683C \xB7 ${columns2}\xD7${rows}`,
        Array.from({ length: rows }, (_, row) => rowLetters(row * columns2, columns2))
      );
    }
    const balanced = balancedRows(count);
    custom("custom-balanced", `\u62FC\u56FE \xB7 ${balanced.sizes.join("\uFF0B")}`, balanced.preview);
    if (count >= 3) {
      const side = balancedRows(count - 1);
      const sideRows = side.preview.map((row) => [...row].map((token) => letter(token.charCodeAt(0) >= 97 ? token.charCodeAt(0) - 97 + 27 : token.charCodeAt(0) - 65 + 1)).join(""));
      const primary = "A".repeat(sideRows[0].length);
      custom("custom-top", `\u4E0A\u4E3B\u56FE\uFF0B${count - 1}\u56FE`, [primary, primary, ...sideRows]);
    }
  }
  for (let columns2 = 2; columns2 <= Math.min(6, count); columns2++) {
    choices.push({
      key: `masonry-${columns2}`,
      layout: `masonry-${columns2}`,
      label: `\u7011\u5E03\u6D41 \xB7 ${columns2}\u5217\uFF0F${count}\u56FE`,
      preview: masonryPreview(count, columns2)
    });
  }
  const thumbRow = rowLetters(1, count - 1), primaryRow = "A".repeat(thumbRow.length);
  choices.push(
    { key: "filmstrip", layout: "filmstrip", label: `\u6A2A\u5411\u6D4F\u89C8 \xB7 ${count}\u56FE`, kind: "browse", preview: [rowLetters(0, count)] },
    { key: "carousel", layout: "carousel", label: `\u8F6E\u64AD\u6D4F\u89C8 \xB7 ${count}\u56FE`, kind: "browse", preview: [primaryRow, primaryRow, thumbRow] },
    { key: "focus", layout: "focus", label: `\u4E3B\u56FE\u6D4F\u89C8 \xB7 ${count}\u56FE`, kind: "browse", preview: stagePreview(count, false) }
  );
  return choices;
}

// src/renderer.ts
var FIT_LABELS = { contain: "\u5B8C\u6574\u663E\u793A", cover: "\u586B\u6EE1\u533A\u57DF", natural: "\u539F\u59CB\u6BD4\u4F8B" };
var FIT_ORDER = ["contain", "cover", "natural"];
var FIT_ICONS = {
  contain: "M4 3h16v18H4zM4 7h16M4 17h16",
  cover: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 17 17 7M10 7h7v7",
  natural: "M3 7V3h4m10 0h4v4M3 17v4h4m10 0h4v-4M6 10l2-2v8m8-6 2-2v8M12 10h.01M12 14h.01"
};
var TOOLBAR_ICONS = {
  layout: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  settings: "M4 5h16M4 12h16M4 19h16M8 3v4M16 10v4M10 17v4",
  edit: "M9 7l-5 5 5 5m6-10 5 5-5 5m-1-13-4 16",
  unwrap: "M3 10h5m-5 0V5m0 5a8 8 0 1 1 2.5 9"
};
var GalleryRenderer = class {
  constructor(host, images, options, callbacks) {
    this.host = host;
    this.callbacks = callbacks;
    this.doc = host.ownerDocument;
    this.images = images.map((image) => ({ ...image }));
    this.index = Math.max(0, Math.min(images.length - 1, callbacks.initialIndex ?? 0));
    this.options = { ...options, descriptions: [...options.descriptions] };
    this.root = this.element("section", "ilg-gallery");
    this.root.tabIndex = 0;
    this.root.setAttribute("role", "region");
    this.root.setAttribute("aria-label", options.caption || "\u56FE\u7247\u753B\u5ECA");
    this.root.dataset.ilgGallery = options.id;
    const toolbar = this.element("div", "ilg-toolbar");
    this.select = this.element("select", "ilg-layout-select");
    this.select.setAttribute("aria-label", "\u56FE\u7247\u5E03\u5C40");
    this.select.hidden = true;
    this.select.tabIndex = -1;
    this.select.setAttribute("aria-hidden", "true");
    this.listen(this.select, "change", () => {
      const choice = this.layoutChoices.find((item) => item.key === this.select.value);
      if (choice) this.requestChange({ layout: choice.layout, ...choice.grid ? { grid: choice.grid } : {} });
    });
    toolbar.appendChild(this.select);
    this.layoutButton = this.iconButton("layout", "\u9009\u62E9\u56FE\u7247\u5E03\u5C40", TOOLBAR_ICONS.layout, () => callbacks.pickLayout?.(this.layoutButton));
    this.layoutButton.disabled = !callbacks.pickLayout;
    toolbar.appendChild(this.layoutButton);
    this.fitButton = this.iconButton("fit", "\u5207\u6362\u56FE\u7247\u9002\u914D\u65B9\u5F0F", FIT_ICONS[this.options.fit], () => {
      this.requestChange({ fit: FIT_ORDER[(FIT_ORDER.indexOf(this.options.fit) + 1) % FIT_ORDER.length] });
    });
    this.fitButton.classList.add("ilg-fit");
    toolbar.appendChild(this.fitButton);
    if (callbacks.configure) {
      const settings = this.iconButton("settings", "\u753B\u5ECA\u8BBE\u7F6E", TOOLBAR_ICONS.settings, () => callbacks.configure?.(settings));
      toolbar.appendChild(settings);
    }
    const edit = this.iconButton("edit", "\u7F16\u8F91\u56FE\u7247\u5F15\u7528\u4E0E\u56FE\u6CE8", TOOLBAR_ICONS.edit, () => callbacks.edit(edit));
    toolbar.appendChild(edit);
    const unwrap = this.iconButton("unwrap", "\u6062\u590D\u666E\u901A Markdown \u56FE\u7247", TOOLBAR_ICONS.unwrap, () => callbacks.unwrap());
    unwrap.classList.add("ilg-unwrap");
    toolbar.appendChild(unwrap);
    this.counter = this.element("span", "ilg-counter");
    this.counter.setAttribute("aria-live", "polite");
    this.counter.setAttribute("aria-atomic", "true");
    toolbar.appendChild(this.counter);
    this.root.appendChild(toolbar);
    this.body = this.element("div", "ilg-body");
    this.root.appendChild(this.body);
    host.appendChild(this.root);
    this.listen(this.root, "click", (event) => event.stopPropagation());
    this.listen(this.root, "keydown", (event) => this.onKeyDown(event));
    this.focusPlacement = getFocusPlacement(host.getBoundingClientRect().width);
    const Resize = this.doc.defaultView?.ResizeObserver;
    if (Resize) {
      this.observer = new Resize((entries) => {
        if (this.destroyed) return;
        const width = entries.find((entry) => entry.target === host)?.contentRect.width;
        if (width === void 0) return;
        const placement = getFocusPlacement(width);
        if (placement !== this.focusPlacement) {
          this.focusPlacement = placement;
          if (this.focusPanel && !this.focusFrame) {
            const win = this.doc.defaultView;
            if (win?.requestAnimationFrame) this.focusFrame = win.requestAnimationFrame(() => {
              this.focusFrame = 0;
              if (!this.destroyed) this.applyFocusPlacement();
            });
            else this.applyFocusPlacement();
          }
        }
      });
      this.observer.observe(host);
    }
    this.render();
  }
  doc;
  root;
  body;
  counter;
  select;
  layoutButton;
  fitButton;
  layoutChoices = [];
  cleanups = [];
  options;
  images;
  index = 0;
  destroyed = false;
  observer;
  mainFigure;
  track;
  thumbButtons = [];
  stageThumbnailOrder = [];
  stageSlot = -1;
  stripFigures = [];
  previous;
  next;
  focusPanel;
  focusPlacement = "bottom";
  scrollFrame = 0;
  focusFrame = 0;
  pointerStart;
  suppressClickUntil = 0;
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.observer?.disconnect();
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    if (this.scrollFrame) this.doc.defaultView?.cancelAnimationFrame(this.scrollFrame);
    if (this.focusFrame) this.doc.defaultView?.cancelAnimationFrame(this.focusFrame);
    this.root.remove();
    this.thumbButtons = [];
    this.stripFigures = [];
    this.track = void 0;
    this.mainFigure = void 0;
  }
  element(tag, className = "") {
    const element = this.doc.createElement(tag);
    element.className = className;
    return element;
  }
  listen(target, type, listener) {
    target.addEventListener(type, listener);
    this.cleanups.push(() => target.removeEventListener(type, listener));
  }
  button(text2, className, label, action) {
    const button = this.element("button", className);
    button.type = "button";
    button.textContent = text2;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      action();
    });
    return button;
  }
  iconButton(action, label, path, callback) {
    const button = this.button("", "ilg-toolbar-button ilg-toolbar-icon", label, callback);
    button.dataset.action = action;
    this.setButtonIcon(button, path);
    return button;
  }
  setButtonIcon(button, pathData) {
    const svg = this.doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = this.doc.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    svg.appendChild(path);
    button.replaceChildren(svg);
  }
  requestChange(patch) {
    if (this.destroyed) return;
    this.options = { ...this.options, ...patch };
    this.render();
    this.callbacks.change(patch);
  }
  render() {
    if (this.scrollFrame) this.doc.defaultView?.cancelAnimationFrame(this.scrollFrame);
    if (this.focusFrame) this.doc.defaultView?.cancelAnimationFrame(this.focusFrame);
    this.scrollFrame = 0;
    this.mainFigure = void 0;
    this.track = void 0;
    this.focusPanel = void 0;
    this.previous = void 0;
    this.next = void 0;
    this.thumbButtons = [];
    this.stripFigures = [];
    this.pointerStart = void 0;
    this.body.replaceChildren();
    this.root.dataset.layout = this.options.layout;
    this.root.dataset.fit = this.options.fit;
    this.root.dataset.overlay = this.options.overlay;
    this.root.dataset.align = this.options.align;
    this.root.style.setProperty("--ilg-height", `${this.options.height}px`);
    this.root.style.setProperty("--ilg-gap", `${this.options.gap}px`);
    this.root.style.setProperty("--ilg-radius", `${this.options.radius}px`);
    this.root.style.width = this.options.align === "full" ? "100%" : this.options.width;
    this.root.style.maxWidth = this.options.width;
    this.updateLayoutChoices();
    this.setButtonIcon(this.fitButton, FIT_ICONS[this.options.fit]);
    this.fitButton.dataset.fit = this.options.fit;
    const nextFit = FIT_ORDER[(FIT_ORDER.indexOf(this.options.fit) + 1) % FIT_ORDER.length];
    const fitLabel = `\u56FE\u7247\u9002\u914D\uFF1A${FIT_LABELS[this.options.fit]}\uFF1B\u70B9\u51FB\u5207\u6362\u4E3A${FIT_LABELS[nextFit]}`;
    this.fitButton.title = fitLabel;
    this.fitButton.setAttribute("aria-label", fitLabel);
    this.index = Math.min(this.index, Math.max(0, this.images.length - 1));
    if (!this.images.length) {
      const empty = this.element("div", "ilg-empty");
      empty.textContent = "\u6DFB\u52A0\u56FE\u7247\u5F15\u7528\u540E\uFF0C\u753B\u5ECA\u5C06\u5728\u6B64\u663E\u793A\u3002";
      this.body.appendChild(empty);
    } else if (this.options.layout === "filmstrip") {
      this.renderFilmstrip();
    } else if (this.options.layout === "carousel" || this.options.layout === "focus") {
      this.renderViewer();
    } else {
      const columns2 = getMasonryColumnCount(this.options.layout);
      if (columns2) this.renderMasonry(columns2);
      else {
        const dominant = getDominantGridDefinition(this.options.layout, this.images.length);
        if (dominant) this.renderDominantGrid(dominant);
        else this.renderGrid();
      }
    }
    if (this.options.caption) {
      const caption = this.element("p", "ilg-gallery-caption");
      caption.textContent = this.options.caption;
      this.body.appendChild(caption);
    }
    this.updateNavigation();
  }
  description(index) {
    return (this.options.descriptions[index] || this.images[index]?.alt || "").replace(/\|\s*\d+(?:\s*x\s*\d+)?\s*$/i, "").trim();
  }
  updateLayoutChoices() {
    this.layoutChoices = getLayoutChoices(this.images.length);
    const normalizeGrid = (grid) => grid.split(/\r?\n/).map((line) => line.replace(/\s+/g, "")).join("\n").trim();
    let current = this.layoutChoices.find((choice) => choice.layout === this.options.layout && (choice.layout !== "custom" || normalizeGrid(choice.grid || "") === normalizeGrid(this.options.grid)));
    if (!current) {
      const stage = getDominantGridDefinition(this.options.layout, this.images.length);
      if (stage) {
        const signature = (grid) => JSON.stringify([grid.columnFractions, grid.rows, grid.areas]);
        current = this.layoutChoices.find((choice) => {
          const candidate = getDominantGridDefinition(choice.layout, this.images.length);
          return candidate && signature(candidate) === signature(stage);
        });
      }
    }
    if (!current) {
      current = {
        key: "current-layout",
        label: getStageLayoutLabel(this.options.layout, this.images.length, this.options.grid),
        layout: this.options.layout,
        grid: this.options.layout === "custom" ? this.options.grid : void 0,
        preview: []
      };
      this.layoutChoices.unshift(current);
    }
    this.select.replaceChildren();
    this.layoutChoices.forEach((choice) => {
      const option = this.doc.createElement("option");
      option.value = choice.key;
      option.textContent = choice.label;
      this.select.appendChild(option);
    });
    this.select.value = current.key;
    const label = `\u56FE\u7247\u5E03\u5C40\uFF1A${current.label}\uFF1B\u9009\u62E9\u7248\u5F0F`;
    this.layoutButton.title = label;
    this.layoutButton.setAttribute("aria-label", label);
    this.layoutButton.dataset.layout = this.options.layout;
  }
  imageButton(index, thumbnail = false) {
    const image = this.images[index];
    const alt = this.description(index) || `\u56FE\u7247 ${index + 1}`;
    let img;
    const button = this.button(
      "",
      thumbnail ? "ilg-thumb" : "ilg-image-button",
      thumbnail ? `\u663E\u793A\u56FE\u7247 ${index + 1}\uFF1A${alt}` : `\u67E5\u770B\u56FE\u7247 ${index + 1}\uFF1A${alt}`,
      () => {
        if (thumbnail) this.setActive(index);
        else if (Date.now() >= this.suppressClickUntil) this.callbacks.open(index, img);
      }
    );
    img = this.doc.createElement("img");
    img.alt = alt;
    img.loading = thumbnail || !["carousel", "focus"].includes(this.options.layout) ? "lazy" : "eager";
    img.decoding = "async";
    img.draggable = false;
    img.dataset.ilgViewerIndex = String(index);
    button.dataset.index = String(index);
    const failure = () => {
      button.classList.add("ilg-image-error");
      img.hidden = true;
      if (!button.querySelector(".ilg-placeholder")) {
        const placeholder = this.element("span", "ilg-placeholder");
        placeholder.textContent = `\u56FE\u7247\u6682\u672A\u8F7D\u5165
${image.alt || image.target || `\u56FE\u7247 ${index + 1}`}`;
        button.appendChild(placeholder);
      }
    };
    img.addEventListener("error", failure, { once: true });
    button.appendChild(img);
    if (image.missing || !image.src) failure();
    else img.src = image.src;
    return button;
  }
  figure(index, kind, thumbnail = false) {
    const figure = this.element("figure", `ilg-figure ilg-${kind}-figure`);
    figure.dataset.index = String(index);
    const button = this.imageButton(index, thumbnail);
    figure.appendChild(button);
    const description = this.description(index);
    if (description) {
      const caption = this.element("figcaption", "ilg-image-caption");
      caption.textContent = description;
      caption.title = description;
      figure.appendChild(caption);
    }
    if (!thumbnail && (kind === "main" || getDominantGridDefinition(this.options.layout))) {
      const zoom = this.button("", "ilg-stage-zoom", `\u653E\u5927\u56FE\u7247 ${index + 1}`, () => {
        const origin = button.querySelector("img");
        if (origin) this.callbacks.open(index, origin);
      });
      const svg = this.doc.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      const path = this.doc.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6");
      svg.appendChild(path);
      zoom.appendChild(svg);
      figure.appendChild(zoom);
    }
    if (kind === "filmstrip") {
      const img = button.querySelector("img");
      const updateRatio = () => {
        if (img.naturalHeight > 0) figure.style.setProperty("--ilg-image-ratio", String(img.naturalWidth / img.naturalHeight));
      };
      img.addEventListener("load", updateRatio, { once: true });
      if (img.complete) updateRatio();
    }
    return figure;
  }
  renderDominantGrid(grid) {
    if (this.stageThumbnailOrder.length !== Math.max(0, this.images.length - 1) || this.stageThumbnailOrder.includes(this.index)) {
      this.stageThumbnailOrder = getStageThumbnailOrder(this.images.length, this.index);
    }
    const stage = this.element("div", "ilg-grid ilg-dominant-grid");
    stage.style.gridTemplateColumns = grid.columnFractions.map((weight) => `minmax(0, ${weight}fr)`).join(" ");
    stage.style.gridTemplateRows = `repeat(${grid.rows}, minmax(0, 1fr))`;
    stage.style.setProperty("--ilg-stage-rows", String(grid.rows));
    const primary = grid.cells[0];
    const main = this.element("div", "ilg-main ilg-stage-main");
    main.style.gridColumn = `${primary.column} / span ${primary.columnSpan}`;
    main.style.gridRow = `1 / span ${grid.rows}`;
    this.mainFigure = this.element("div", "ilg-stage-main-content");
    this.mainFigure.appendChild(this.figure(this.index, "cell"));
    main.appendChild(this.mainFigure);
    this.attachArrows(main);
    this.attachSwipe(main);
    stage.appendChild(main);
    if (grid.slots > 1) {
      this.track = this.element("div", "ilg-stage-thumbnails");
      const sideColumn = primary.column === 1 ? primary.column + primary.columnSpan : 1;
      const sideColumns = grid.columns - primary.columnSpan;
      this.track.style.gridColumn = `${sideColumn} / span ${sideColumns}`;
      this.track.style.gridRow = `1 / span ${grid.rows}`;
      this.track.style.gridTemplateColumns = `repeat(${sideColumns}, minmax(0, 1fr))`;
      this.track.style.gridTemplateRows = `repeat(${grid.rows}, minmax(0, 1fr))`;
      this.track.dataset.sideColumns = String(sideColumns);
      this.track.setAttribute("aria-label", "\u5207\u6362\u4E3B\u56FE\uFF0C\u672C\u7EC4\u5168\u90E8\u5019\u9009\u56FE\u7247");
      this.renderStageThumbnails(grid);
      stage.appendChild(this.track);
    }
    this.body.appendChild(stage);
  }
  renderStageThumbnails(grid = getDominantGridDefinition(this.options.layout, this.images.length)) {
    const track = this.track;
    if (!track) return;
    const scrollTop = track.scrollTop;
    const restoreFocus = track.contains(this.doc.activeElement);
    this.thumbButtons = [];
    track.replaceChildren();
    this.stageThumbnailOrder.forEach((index, slot) => {
      const figure = this.figure(index, "cell", true);
      figure.classList.add("ilg-stage-thumb-figure");
      figure.dataset.slot = String(slot);
      const cell = grid?.cells[slot + 1];
      if (cell && grid) {
        const primary = grid.cells[0];
        const sideColumn = primary.column === 1 ? primary.column + primary.columnSpan : 1;
        figure.style.gridColumn = `${cell.column - sideColumn + 1} / span ${cell.columnSpan}`;
        figure.style.gridRow = `${cell.row} / span ${cell.rowSpan}`;
      }
      const button = figure.querySelector("button");
      this.thumbButtons.push(button);
      track.appendChild(figure);
    });
    if (!this.stageThumbnailOrder.length) {
      const empty = this.element("div", "ilg-grid-placeholder");
      empty.textContent = "\u5F85\u6DFB\u52A0\u56FE\u7247";
      track.appendChild(empty);
    }
    track.scrollTop = scrollTop;
    if (restoreFocus) this.thumbButtons[this.stageSlot]?.focus({ preventScroll: true });
  }
  renderGrid() {
    const grid = getMatchingGridDefinition(this.options.layout, this.images.length, this.options.grid);
    const stage = this.element("div", "ilg-grid ilg-complete-grid");
    stage.style.gridTemplateColumns = grid.columnFractions.map((weight) => `minmax(0, ${weight}fr)`).join(" ");
    stage.style.gridTemplateRows = `repeat(${grid.rows}, minmax(0, 1fr))`;
    stage.style.setProperty("--ilg-stage-rows", String(grid.rows));
    stage.style.gridTemplateAreas = grid.areas;
    grid.cells.forEach((cell) => {
      let figure;
      if (cell.imageIndex < this.images.length) figure = this.figure(cell.imageIndex, "cell");
      else {
        figure = this.element("div", "ilg-grid-placeholder");
        figure.textContent = "\u5F85\u6DFB\u52A0\u56FE\u7247";
        figure.setAttribute("aria-label", `\u56FE\u7247\u4F4D\u7F6E ${cell.imageIndex + 1}`);
      }
      figure.style.gridArea = cell.area;
      stage.appendChild(figure);
    });
    this.body.appendChild(stage);
    if (grid.fallbackReason) {
      const message = this.element("p", "ilg-layout-message");
      message.textContent = `\u81EA\u5B9A\u4E49\u7F51\u683C\uFF1A${grid.fallbackReason} \u5F53\u524D\u6309 ${this.images.length} \u5F20\u56FE\u7247\u5B8C\u6574\u6392\u5217\u3002`;
      this.body.appendChild(message);
    }
  }
  renderMasonry(columns2) {
    const masonry = this.element("div", "ilg-masonry");
    masonry.style.columnCount = String(columns2);
    this.images.forEach((_, index) => masonry.appendChild(this.figure(index, "masonry")));
    this.body.appendChild(masonry);
  }
  renderFilmstrip() {
    const wrap = this.element("div", "ilg-filmstrip-wrap");
    this.track = this.element("div", "ilg-filmstrip");
    this.track.setAttribute("aria-label", "\u6A2A\u5411\u6EDA\u52A8\u56FE\u7247\u5E26");
    this.images.forEach((_, index) => {
      const figure = this.figure(index, "filmstrip");
      this.stripFigures.push(figure);
      this.track.appendChild(figure);
    });
    const track = this.track;
    track.addEventListener("scroll", () => {
      if (this.scrollFrame || this.destroyed) return;
      this.scrollFrame = this.doc.defaultView?.requestAnimationFrame(() => {
        this.scrollFrame = 0;
        if (this.destroyed || this.track !== track) return;
        const center = track.scrollLeft + track.clientWidth / 2;
        let nearest = 0;
        let distance = Infinity;
        this.stripFigures.forEach((figure, index) => {
          const diff = Math.abs(figure.offsetLeft - track.offsetLeft + figure.offsetWidth / 2 - center);
          if (diff < distance) {
            distance = diff;
            nearest = index;
          }
        });
        this.index = nearest;
        this.callbacks.select?.(this.index);
        this.updateNavigation();
      }) || 0;
    }, { passive: true });
    wrap.appendChild(track);
    this.attachArrows(wrap);
    this.body.appendChild(wrap);
    if (this.index > 0) this.scrollToActive(false);
  }
  renderViewer() {
    const viewer = this.element("div", this.options.layout === "focus" ? "ilg-focus" : "ilg-carousel");
    if (this.options.layout === "focus") this.focusPanel = viewer;
    const stage = this.element("div", "ilg-main");
    this.mainFigure = this.element("div", "ilg-main-content");
    this.mainFigure.appendChild(this.figure(this.index, "main"));
    stage.appendChild(this.mainFigure);
    this.attachArrows(stage);
    this.attachSwipe(stage);
    viewer.appendChild(stage);
    this.track = this.element("div", this.options.thumbnails ? "ilg-thumbnails" : "ilg-pills");
    this.track.setAttribute("aria-label", "\u9009\u62E9\u56FE\u7247");
    this.images.forEach((_, index) => {
      const button = this.options.thumbnails ? this.imageButton(index, true) : this.button(String(index + 1), "ilg-pill", `\u663E\u793A\u56FE\u7247 ${index + 1}`, () => this.setActive(index));
      this.thumbButtons.push(button);
      this.track.appendChild(button);
    });
    viewer.appendChild(this.track);
    this.body.appendChild(viewer);
    this.applyFocusPlacement();
  }
  attachSwipe(stage) {
    stage.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch") {
        if (this.pointerStart) {
          this.pointerStart = void 0;
          return;
        }
        this.pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
      }
    }, { passive: true });
    stage.addEventListener("pointerup", (event) => {
      const start = this.pointerStart;
      this.pointerStart = void 0;
      if (!start || start.id !== event.pointerId) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        this.suppressClickUntil = Date.now() + 400;
        this.setActive(this.index + (dx < 0 ? 1 : -1));
      }
    });
    stage.addEventListener("pointercancel", () => {
      this.pointerStart = void 0;
    });
  }
  attachArrows(container) {
    this.previous = this.button("\u2039", "ilg-nav ilg-prev", "\u4E0A\u4E00\u5F20\u56FE\u7247", () => this.setActive(this.index - 1));
    this.next = this.button("\u203A", "ilg-nav ilg-next", "\u4E0B\u4E00\u5F20\u56FE\u7247", () => this.setActive(this.index + 1));
    container.append(this.previous, this.next);
    if (this.images.length === 1) {
      this.previous.hidden = true;
      this.next.hidden = true;
    }
  }
  applyFocusPlacement() {
    if (!this.focusPanel) return;
    this.focusPanel.classList.toggle("ilg-focus-side", this.focusPlacement === "side");
    this.focusPanel.classList.toggle("ilg-focus-bottom", this.focusPlacement === "bottom");
  }
  /** Locate a source occurrence without opening a viewer or moving keyboard focus. */
  revealImage(index) {
    if (this.destroyed || index < 0 || index >= this.images.length) return null;
    this.setActive(index);
    return this.mainFigure ?? this.root.querySelector(`.ilg-figure[data-index="${index}"]`);
  }
  setActive(index) {
    if (this.destroyed || !this.images.length) return;
    const next = Math.max(0, Math.min(this.images.length - 1, index));
    if (next === this.index) return;
    const dominant = !!getDominantGridDefinition(this.options.layout);
    if (dominant) {
      this.stageSlot = this.stageThumbnailOrder.indexOf(next);
      this.stageThumbnailOrder = swapStageImage(this.stageThumbnailOrder, this.index, next);
    }
    const restoreMainFocus = this.mainFigure?.contains(this.doc.activeElement);
    this.index = next;
    this.callbacks.select?.(this.index);
    if (this.mainFigure) this.mainFigure.replaceChildren(this.figure(this.index, dominant ? "cell" : "main"));
    if (dominant) this.renderStageThumbnails();
    if (restoreMainFocus) this.mainFigure?.querySelector("button")?.focus({ preventScroll: true });
    this.updateNavigation();
    this.scrollToActive(true);
  }
  scrollToActive(smooth) {
    if (!this.track) return;
    if (getDominantGridDefinition(this.options.layout)) return;
    const target = this.options.layout === "filmstrip" ? this.stripFigures[this.index] : this.thumbButtons[this.index];
    if (!target) return;
    const reduced = this.doc.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior = smooth && !reduced ? "smooth" : "auto";
    if (this.options.layout === "focus" && this.focusPlacement === "side" && this.options.thumbnails) {
      const top = target.offsetTop - this.track.offsetTop;
      if (top < this.track.scrollTop || top + target.offsetHeight > this.track.scrollTop + this.track.clientHeight) {
        this.track.scrollTo({ top: Math.max(0, top - this.track.clientHeight / 2 + target.offsetHeight / 2), behavior });
      }
    } else {
      const left = target.offsetLeft - this.track.offsetLeft;
      if (this.options.layout === "filmstrip" || left < this.track.scrollLeft || left + target.offsetWidth > this.track.scrollLeft + this.track.clientWidth) {
        this.track.scrollTo({ left: Math.max(0, left - (this.track.clientWidth - target.offsetWidth) / 2), behavior });
      }
    }
  }
  updateNavigation() {
    this.counter.textContent = `${this.images.length ? this.index + 1 : 0} / ${this.images.length}`;
    if (this.previous) this.previous.disabled = this.index === 0;
    if (this.next) this.next.disabled = this.index >= this.images.length - 1;
    this.root.dataset.activeIndex = String(this.index);
    this.thumbButtons.forEach((button, index) => {
      const selected = Number(button.dataset.index ?? index) === this.index;
      button.classList.toggle("ilg-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    this.stripFigures.forEach((figure, index) => figure.classList.toggle("ilg-selected", index === this.index));
  }
  onKeyDown(event) {
    const element = event.target;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !this.root.contains(this.doc.activeElement) || element?.nodeType === 1 && element.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (!["carousel", "focus", "filmstrip"].includes(this.options.layout) && !getDominantGridDefinition(this.options.layout)) return;
    const target = event.key === "ArrowLeft" ? this.index - 1 : event.key === "ArrowRight" ? this.index + 1 : event.key === "Home" ? 0 : event.key === "End" ? this.images.length - 1 : void 0;
    if (target === void 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.setActive(target);
  }
};

// src/integration.ts
var import_obsidian2 = require("obsidian");

// src/viewer.ts
var import_obsidian = require("obsidian");

// src/gestures.ts
var ImageGestures = class {
  scale = 1;
  x = 0;
  y = 0;
  pointers = /* @__PURE__ */ new Map();
  origin = { x: 0, y: 0, scale: 1, cx: 0, cy: 0, distance: 0 };
  down(id, x, y) {
    this.pointers.set(id, { x, y });
    this.rebase();
  }
  move(id, x, y) {
    if (!this.pointers.has(id)) return false;
    this.pointers.set(id, { x, y });
    const { cx, cy, distance } = this.geometry(), base = this.origin;
    const ratio = base.distance > 0 && distance > 0 ? distance / base.distance : 1;
    this.scale = Math.max(0.1, Math.min(20, base.scale * ratio));
    const actual = this.scale / base.scale;
    this.x = cx - (base.cx - base.x) * actual;
    this.y = cy - (base.cy - base.y) * actual;
    return true;
  }
  up(id) {
    this.pointers.delete(id);
    this.rebase();
  }
  reset() {
    this.pointers.clear();
    this.scale = 1;
    this.x = this.y = 0;
    this.rebase();
  }
  zoom(factor) {
    this.scale = Math.max(0.1, Math.min(20, this.scale * factor));
    this.rebase();
  }
  geometry() {
    const [a, b] = [...this.pointers.values()];
    if (!a) return { cx: 0, cy: 0, distance: 0 };
    return b ? { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) } : { cx: a.x, cy: a.y, distance: 0 };
  }
  rebase() {
    this.origin = { x: this.x, y: this.y, scale: this.scale, ...this.geometry() };
  }
};
function attachImageGestures(stage, model, render) {
  const point = (event) => {
    const r = stage.getBoundingClientRect();
    return { x: event.clientX - r.left - r.width / 2, y: event.clientY - r.top - r.height / 2 };
  };
  const down = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const p = point(event);
    model.down(event.pointerId, p.x, p.y);
    try {
      stage.setPointerCapture(event.pointerId);
    } catch {
      model.up(event.pointerId);
    }
  };
  const move = (event) => {
    const p = point(event);
    if (model.move(event.pointerId, p.x, p.y)) {
      event.preventDefault();
      render();
    }
  };
  const end = (event) => {
    model.up(event.pointerId);
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  };
  stage.addEventListener("pointerdown", down);
  stage.addEventListener("pointermove", move);
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  stage.addEventListener("lostpointercapture", end);
  return () => {
    stage.removeEventListener("pointerdown", down);
    stage.removeEventListener("pointermove", move);
    stage.removeEventListener("pointerup", end);
    stage.removeEventListener("pointercancel", end);
    stage.removeEventListener("lostpointercapture", end);
    model.reset();
  };
}

// src/viewer.ts
var GalleryViewer = class extends import_obsidian.Modal {
  constructor(app, images, index) {
    super(app);
    this.images = images;
    this.index = Math.max(0, Math.min(images.length - 1, Number.isFinite(index) ? Math.trunc(index) : 0));
  }
  index;
  gestures = new ImageGestures();
  rotation = 0;
  image;
  stage;
  count;
  caption;
  error;
  previous;
  next;
  dispose = [];
  observer;
  onOpen() {
    this.modalEl.addClass("ilg-viewer");
    this.titleEl.setText("\u56FE\u7247\u9884\u89C8");
    const toolbar = this.contentEl.createDiv("ilg-viewer-toolbar");
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "\u56FE\u7247\u67E5\u770B\u5DE5\u5177");
    const button = (icon, title, action) => {
      const element = toolbar.createEl("button", { attr: { type: "button", "aria-label": title, title } });
      (0, import_obsidian.setIcon)(element, icon);
      this.listen(element, "click", action);
      return element;
    };
    this.previous = button("chevron-left", "\u4E0A\u4E00\u5F20\uFF08\u2190\uFF09", () => this.change(-1));
    this.next = button("chevron-right", "\u4E0B\u4E00\u5F20\uFF08\u2192\uFF09", () => this.change(1));
    button("zoom-in", "\u653E\u5927\uFF08\uFF0B\uFF09", () => this.zoom(1.25));
    button("zoom-out", "\u7F29\u5C0F\uFF08\uFF0D\uFF09", () => this.zoom(0.8));
    button("maximize", "\u9002\u5E94\u7A97\u53E3\uFF080\uFF09", () => this.reset());
    button("rotate-cw", "\u987A\u65F6\u9488\u65CB\u8F6C\uFF08R\uFF09", () => this.rotate());
    button("x", "\u5173\u95ED\u56FE\u7247\u9884\u89C8", () => this.close());
    this.count = toolbar.createSpan("ilg-viewer-count");
    this.count.setAttribute("aria-live", "polite");
    this.stage = this.contentEl.createDiv("ilg-viewer-stage");
    this.stage.setAttribute("aria-label", "\u53CC\u6307\u6216\u6EDA\u8F6E\u7F29\u653E\uFF0C\u62D6\u52A8\u5E73\u79FB\uFF0C\u53CC\u51FB\u6062\u590D");
    this.image = this.stage.createEl("img", { attr: { draggable: "false", decoding: "async" } });
    this.error = this.stage.createDiv({ cls: "ilg-viewer-error", text: "\u56FE\u7247\u52A0\u8F7D\u5931\u8D25\uFF0C\u53EF\u5207\u6362\u5176\u4ED6\u56FE\u7247" });
    this.error.setAttribute("role", "status");
    this.error.hidden = true;
    this.caption = this.contentEl.createDiv("ilg-viewer-caption");
    this.caption.setAttribute("aria-live", "polite");
    this.listen(this.image, "error", () => {
      this.error.hidden = false;
      this.image.hidden = true;
    });
    this.listen(this.image, "load", () => {
      this.error.hidden = true;
      this.image.hidden = false;
      this.transform();
    });
    this.listen(this.stage, "wheel", (event) => {
      event.preventDefault();
      if (event.deltaY !== 0) this.zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    this.listen(this.stage, "dblclick", () => this.reset());
    this.dispose.push(attachImageGestures(this.stage, this.gestures, () => this.transform()));
    const Observer = this.stage.ownerDocument.defaultView?.ResizeObserver;
    if (Observer) {
      this.observer = new Observer(() => this.transform());
      this.observer.observe(this.stage);
    }
    this.scope.register([], "ArrowLeft", () => {
      this.change(-1);
      return false;
    });
    this.scope.register([], "ArrowRight", () => {
      this.change(1);
      return false;
    });
    this.scope.register([], "+", () => {
      this.zoom(1.25);
      return false;
    });
    this.scope.register(["Shift"], "=", () => {
      this.zoom(1.25);
      return false;
    });
    this.scope.register([], "=", () => {
      this.zoom(1.25);
      return false;
    });
    this.scope.register([], "-", () => {
      this.zoom(0.8);
      return false;
    });
    this.scope.register([], "0", () => {
      this.reset();
      return false;
    });
    this.scope.register([], "r", () => {
      this.rotate();
      return false;
    });
    this.show();
  }
  listen(element, type, listener, options) {
    const handler = listener;
    element.addEventListener(type, handler, options);
    this.dispose.push(() => element.removeEventListener(type, handler, options));
  }
  change(delta) {
    if (this.images.length < 2) return;
    this.index = (this.index + delta + this.images.length) % this.images.length;
    this.show();
  }
  show() {
    const item = this.images[this.index];
    this.previous.disabled = this.next.disabled = this.images.length < 2;
    this.count.setText(item ? `${this.index + 1} / ${this.images.length}` : "0 / 0");
    this.caption.setText(item?.alt || item?.target || "");
    this.caption.hidden = !this.caption.textContent;
    this.image.hidden = !item;
    this.error.hidden = true;
    if (item) {
      this.image.src = item.src;
      this.image.alt = item.alt;
    }
    this.reset();
  }
  zoom(factor) {
    this.gestures.zoom(factor);
    this.transform();
  }
  rotate() {
    this.rotation = (this.rotation + 90) % 360;
    this.transform();
  }
  reset() {
    this.gestures.reset();
    this.rotation = 0;
    this.transform();
  }
  transform() {
    const rect = this.stage.getBoundingClientRect(), swapped = Math.abs(this.rotation % 180) === 90;
    this.image.style.maxWidth = `${swapped ? rect.height : rect.width}px`;
    this.image.style.maxHeight = `${swapped ? rect.width : rect.height}px`;
    this.image.style.transform = `translate(${this.gestures.x}px, ${this.gestures.y}px) rotate(${this.rotation}deg) scale(${this.gestures.scale})`;
  }
  onClose() {
    this.observer?.disconnect();
    this.observer = void 0;
    for (const dispose of this.dispose.splice(0)) dispose();
    this.contentEl.empty();
  }
};

// src/integration.ts
function getToolkit(app) {
  try {
    const manager = app.plugins;
    return manager?.getPlugin?.("obsidian-image-toolkit");
  } catch {
    return void 0;
  }
}
function findSourceLeaf(app, origin, sourcePath) {
  const candidates = app.workspace.getLeavesOfType("markdown").filter((leaf) => leaf.view instanceof import_obsidian2.MarkdownView && !!leaf.view.file && (!sourcePath || leaf.view.file.path === sourcePath));
  return candidates.find((leaf) => leaf.view.containerEl.contains(origin)) ?? candidates.find((leaf) => leaf === app.workspace.getMostRecentLeaf()) ?? candidates[0];
}
function displaysImage(origin, image) {
  try {
    return origin.src === new URL(image.src, origin.ownerDocument.baseURI).href;
  } catch {
    return origin.src === image.src;
  }
}
function openGalleryImage(app, images, index, origin, sourcePath) {
  const requested = images[Math.max(0, Math.min(images.length - 1, Number.isFinite(index) ? Math.trunc(index) : 0))];
  const available = images.filter((image) => !!image.src && !image.missing);
  const selected = Math.max(0, available.indexOf(requested));
  const toolkit = getToolkit(app);
  const bridge = toolkit?.noteImageStage;
  if (origin?.isConnected && available.length && bridge?.imageLayoutBridgeVersion === 1 && typeof bridge.openGallery === "function" && displaysImage(origin, available[selected])) {
    try {
      const leaf = findSourceLeaf(app, origin, sourcePath);
      if (leaf?.view instanceof import_obsidian2.MarkdownView && leaf.view.file) {
        app.workspace.setActiveLeaf(leaf, { focus: false });
        if (bridge.openGallery(
          available.map(({ src, alt }) => ({ src, alt })),
          selected,
          origin,
          leaf.view.file.path
        ) === true) return "toolkit";
      }
    } catch (error) {
      console.warn("Image Layouts Enhanced: Image Toolkit adapter uses the independent viewer", error);
    }
  }
  new GalleryViewer(app, available, selected).open();
  return "fallback";
}

// src/source-edits.ts
function editLegacyGroup(source, group, patch, externalConfiguration = false) {
  if (group.kind !== "fence" || group.from < 0 || group.to <= group.from || group.to > source.length || source.slice(group.from, group.to) !== group.raw) return null;
  const opening = /^ {0,3}(`{3,}|~{3,})[ \t]*image-layout(?:[-\w]*)[ \t]*\r?\n/.exec(group.raw);
  if (!opening) return null;
  const lines2 = group.raw.slice(opening[0].length).split(/\r?\n/);
  const close = lines2.findIndex((line) => {
    const match = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
    return !!match && match[1][0] === opening[1][0] && match[1].length >= opening[1].length;
  });
  if (close < 0 || lines2.slice(close + 1).some((line) => line !== "")) return null;
  if (patch === "unwrap") return { from: group.from, to: group.to, insert: group.body };
  const eol = group.raw.includes("\r\n") ? "\r\n" : "\n";
  const trailing = group.raw.endsWith("\n") ? eol : "";
  const options = normalizeOptions({ ...group.options, ...patch, id: patch.id || group.options.id || crypto.randomUUID().replace(/-/g, "").slice(0, 10) });
  const marker = externalConfiguration ? serializeOpen({ id: options.id, layout: options.layout }) : serializeOpen(options);
  return { from: group.from, to: group.to, insert: `${marker}${eol}${group.body.replace(/\r?\n?$/, eol)}<!-- /image-layouts -->${trailing}` };
}

// src/source-target.ts
function legacyStarts(source) {
  const starts = [];
  let position = 0, fence, comment = false;
  let frontmatter = /^(?:\uFEFF)?---[ \t]*(?:\r?\n|$)/.test(source);
  for (const line of source.split(/(?<=\n)/)) {
    const value = line.replace(/\r?\n$/, "");
    if (frontmatter) {
      if (position > 0 && /^(?:---|\.\.\.)[ \t]*$/.test(value)) frontmatter = false;
      position += line.length;
      continue;
    }
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(value);
      if (close && close[1][0] === fence.character && close[1].length >= fence.length) fence = void 0;
      position += line.length;
      continue;
    }
    if (comment) {
      if (value.includes("-->")) comment = false;
      position += line.length;
      continue;
    }
    const open = /^ {0,3}(`{3,}|~{3,})[ \t]*(.*)$/.exec(value);
    if (open) {
      fence = { character: open[1][0], length: open[1].length };
      if (/^image-layout(?:-[\w-]+)?[ \t]*$/.test(open[2])) starts.push(position);
    } else {
      const start = value.indexOf("<!--");
      if (start >= 0 && !value.includes("-->", start + 4)) comment = true;
    }
    position += line.length;
  }
  return starts;
}
function resolveGallerySourceTarget(source, snapshot) {
  let group;
  if (snapshot.kind === "comment") {
    const matches = parseGroups(source).filter((candidate) => snapshot.options.id ? candidate.options.id === snapshot.options.id : candidate.raw === snapshot.raw);
    if (matches.length === 1) group = matches[0];
    else {
      group = matches.find((candidate) => candidate.from === snapshot.from && candidate.raw === snapshot.raw);
      if (!group) {
        const exact = matches.filter((candidate) => candidate.raw === snapshot.raw);
        if (exact.length === 1) group = exact[0];
      }
    }
  } else {
    if (snapshot.from < 0 || !snapshot.raw || snapshot.bodyFrom < snapshot.from || snapshot.bodyTo > snapshot.to) return null;
    const candidates = legacyStarts(source).filter((from3) => source.slice(from3, from3 + snapshot.raw.length) === snapshot.raw);
    const from2 = candidates.includes(snapshot.from) ? snapshot.from : candidates.length === 1 ? candidates[0] : void 0;
    if (from2 !== void 0) {
      const delta = from2 - snapshot.from;
      group = { ...snapshot, from: from2, to: snapshot.to + delta, bodyFrom: snapshot.bodyFrom + delta, bodyTo: snapshot.bodyTo + delta };
    }
  }
  if (!group) return null;
  const refs = group.kind === "fence" ? extractImages(group.body).map((ref) => ({ ...ref, offset: ref.offset + group.bodyFrom })) : extractImages(source).filter((ref) => ref.offset >= group.bodyFrom && ref.offset + ref.raw.length <= group.bodyTo);
  const from = refs[0]?.offset ?? group.bodyFrom;
  const last = refs.at(-1), to = last ? last.offset + last.raw.length : group.bodyTo;
  return { group, from, to };
}

// src/reference-edits.ts
function safeOffset(source, offset) {
  return Number.isInteger(offset) && offset >= 0 && offset <= source.length && !(offset > 0 && offset < source.length && (source[offset - 1] === "\r" && source[offset] === "\n" || /[\uD800-\uDBFF]/.test(source[offset - 1]) && /[\uDC00-\uDFFF]/.test(source[offset])));
}
function legacyBoundary(group) {
  const opening = /^ {0,3}(`{3,}|~{3,})[ \t]*image-layout(?:-[\w-]+)?[ \t]*\r?\n/.exec(group.raw);
  if (!opening) return null;
  const character = opening[1][0], length = opening[1].length;
  const close = new RegExp(`^ {0,3}${character}{${length},}[ \\t]*(?:\\r?\\n|$)`, "gm");
  close.lastIndex = opening[0].length;
  const match = close.exec(group.raw);
  if (!match || group.raw.slice(match.index + match[0].length).trim()) return null;
  const rawBody = group.raw.slice(opening[0].length, match.index);
  const metadata = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/.exec(rawBody);
  const bodyStart = group.from + opening[0].length + (metadata?.[0].length ?? 0);
  const closingFrom = group.from + match.index;
  if (group.bodyFrom < bodyStart || group.bodyTo > closingFrom || group.raw.slice(bodyStart - group.from, group.bodyFrom - group.from).trim() || group.raw.slice(group.bodyTo - group.from, closingFrom - group.from).trim()) return null;
  return { closingFrom, character, length, hasMetadata: Boolean(metadata) };
}
function buildReferenceBodyEdit(source, snapshot, expectedBody, replacementBody) {
  const target = resolveGallerySourceTarget(source, snapshot);
  if (!target) return null;
  const group = target.group;
  if (!safeOffset(source, group.bodyFrom) || !safeOffset(source, group.bodyTo) || group.bodyFrom > group.bodyTo || group.body !== expectedBody || source.slice(group.bodyFrom, group.bodyTo) !== expectedBody) return null;
  if (group.bodyFrom > 0 && source[group.bodyFrom - 1] !== "\n") return null;
  if (/<!--[ \t]*\/?image-layouts(?::|[ \t]*-->)/i.test(replacementBody)) return null;
  const legacy = group.kind === "fence" ? legacyBoundary(group) : void 0;
  if (group.kind === "fence" && !legacy) return null;
  const eol = /\r\n|\n/.exec(group.raw)?.[0] ?? /\r\n|\n/.exec(source)?.[0] ?? "\n";
  let insert = replacementBody.replace(/\r\n|\r|\n/g, eol);
  if (legacy) {
    const close = new RegExp(`^ {0,3}${legacy.character}{${legacy.length},}[ \\t]*$`, "m");
    if (close.test(insert.replace(/\r\n/g, "\n"))) return null;
    if (!legacy.hasMetadata && /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/.test(insert)) return null;
  }
  const suffixHasNewline = source[group.bodyTo] === "\n" || source.startsWith("\r\n", group.bodyTo);
  if (insert && !insert.endsWith("\n") && !suffixHasNewline) insert += eol;
  const edit = { from: group.bodyFrom, to: group.bodyTo, insert };
  if (group.kind === "comment") {
    const changed = source.slice(0, edit.from) + insert + source.slice(edit.to);
    const next = parseGroups(changed).find((candidate) => candidate.from === group.from);
    if (!next || next.bodyFrom !== group.bodyFrom || next.bodyTo !== group.bodyFrom + insert.length || next.to !== group.to + insert.length - (group.bodyTo - group.bodyFrom)) return null;
  }
  return edit;
}

// src/popover.ts
var openPopovers = /* @__PURE__ */ new WeakMap();
var exitingPopovers = /* @__PURE__ */ new WeakMap();
var openRequests = /* @__PURE__ */ new WeakMap();
var closingDocuments = /* @__PURE__ */ new WeakMap();
function removeExitingPopovers(doc) {
  const exits = exitingPopovers.get(doc);
  if (!exits) return;
  for (const finish of [...exits]) finish();
}
function closePopover(doc) {
  const previousDepth = closingDocuments.get(doc) ?? 0;
  closingDocuments.set(doc, previousDepth + 1);
  try {
    openPopovers.get(doc)?.close();
  } finally {
    removeExitingPopovers(doc);
    if (previousDepth) closingDocuments.set(doc, previousDepth);
    else closingDocuments.delete(doc);
  }
}
var AnchoredPopover = class {
  constructor(anchor, label, onClose) {
    this.anchor = anchor;
    this.onClose = onClose;
    this.doc = anchor?.ownerDocument ?? (typeof activeDocument !== "undefined" ? activeDocument : document);
    this.ownerWindow = this.doc.defaultView;
    this.anchorRect = anchor?.getBoundingClientRect();
    this.el = this.doc.createElement("div");
    this.el.className = "ilg-popover";
    this.el.setAttribute("role", "dialog");
    this.el.setAttribute("aria-label", label);
    this.el.setAttribute("data-ilg-interactive", "1");
    this.el.tabIndex = -1;
    this.el.hidden = true;
    this.contentEl = this.doc.createElement("div");
    this.contentEl.className = "ilg-popover-content";
    this.el.appendChild(this.contentEl);
  }
  el;
  contentEl;
  doc;
  ownerWindow;
  cleanup = [];
  observer;
  positionFrame = 0;
  anchorRect;
  opened = false;
  closed = false;
  open() {
    if (this.opened || this.closed) return;
    if (closingDocuments.has(this.doc)) {
      this.close();
      return;
    }
    if (this.isImageAnchor() && !this.anchor?.isConnected) {
      this.close();
      return;
    }
    const request = (openRequests.get(this.doc) ?? 0) + 1;
    openRequests.set(this.doc, request);
    removeExitingPopovers(this.doc);
    openPopovers.get(this.doc)?.close();
    removeExitingPopovers(this.doc);
    if (openRequests.get(this.doc) !== request) {
      this.close();
      return;
    }
    openPopovers.set(this.doc, this);
    this.opened = true;
    for (const event of ["click", "dblclick", "mousedown", "mouseup", "pointerdown", "pointerup", "wheel", "drag", "dragend", "dragenter", "dragleave"]) {
      this.listen(this.el, event, (event2) => event2.stopPropagation());
    }
    for (const event of ["dragover", "drop"]) this.listen(this.el, event, (event2) => {
      event2.preventDefault();
      event2.stopPropagation();
    });
    this.listen(this.el, "contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    this.listen(this.el, "dragstart", (event) => {
      const target = event.target;
      if (target?.tagName === "IMG" || typeof target?.closest === "function" && target.closest("img")) event.preventDefault();
      event.stopPropagation();
    });
    this.listen(this.doc, "pointerdown", (event) => {
      if (!this.containsEvent(event)) this.close();
    }, true);
    this.listen(this.doc, "keydown", (event) => {
      const keyboard = event;
      if (keyboard.key !== "Escape" || keyboard.isComposing || keyboard.keyCode === 229) return;
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }, true);
    this.listen(this.doc, "scroll", (event) => {
      if (this.containsEvent(event)) return;
      const target = event.target;
      if (!this.anchor?.isConnected || !target || target === this.doc || typeof target.contains === "function" && target.contains(this.anchor)) this.close();
    }, true);
    if (this.ownerWindow) {
      this.listen(this.ownerWindow, "resize", () => this.queuePosition());
      if (this.ownerWindow.visualViewport) {
        this.listen(this.ownerWindow.visualViewport, "resize", () => this.queuePosition());
        this.listen(this.ownerWindow.visualViewport, "scroll", () => this.queuePosition());
      }
      this.listen(this.ownerWindow, "blur", () => this.close());
    }
    this.el.style.visibility = "hidden";
    this.el.hidden = false;
    this.doc.body.appendChild(this.el);
    this.position();
    if (!this.reducedMotion()) {
      this.el.setAttribute("data-ilg-phase", "initial");
      this.el.getBoundingClientRect();
    }
    this.el.setAttribute("data-ilg-phase", "open");
    this.el.style.visibility = "";
    const Observer = this.ownerWindow?.ResizeObserver;
    if (Observer && this.anchor?.isConnected) {
      const initial = this.anchor.getBoundingClientRect();
      const observer = new Observer(() => {
        if (!this.anchor?.isConnected) {
          this.close();
          return;
        }
        const current = this.anchor.getBoundingClientRect();
        if (Math.abs(current.width - initial.width) > 0.5 || Math.abs(current.height - initial.height) > 0.5) {
          this.close();
          return;
        }
        this.queuePosition();
      });
      this.observer = observer;
      observer.observe(this.anchor);
      observer.observe(this.el);
    }
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.positionFrame) this.ownerWindow?.cancelAnimationFrame(this.positionFrame);
    this.positionFrame = 0;
    this.observer?.disconnect();
    this.observer = void 0;
    this.cleanup.splice(0).forEach((dispose) => dispose());
    if (openPopovers.get(this.doc) === this) openPopovers.delete(this.doc);
    this.el.setAttribute("aria-hidden", "true");
    this.el.setAttribute("inert", "");
    this.el.inert = true;
    this.el.style.pointerEvents = "none";
    if (this.opened && this.el.isConnected && !this.reducedMotion() && typeof this.ownerWindow?.setTimeout === "function") {
      this.beginExit();
    } else this.el.remove();
    this.onClose?.();
  }
  listen(target, event, callback, options) {
    if (this.closed) return;
    target.addEventListener(event, callback, options);
    const capture = typeof options === "boolean" ? options : options?.capture ?? false;
    this.cleanup.push(() => target.removeEventListener(event, callback, capture));
  }
  containsEvent(event) {
    if (event.composedPath().includes(this.el)) return true;
    const target = event.target;
    return Boolean(target && typeof target.nodeType === "number" && this.el.contains(target));
  }
  queuePosition() {
    if (!this.ownerWindow?.requestAnimationFrame) {
      this.position();
      return;
    }
    if (this.positionFrame) return;
    this.positionFrame = this.ownerWindow.requestAnimationFrame(() => {
      this.positionFrame = 0;
      if (!this.closed) this.position();
    });
  }
  position() {
    const visual = this.ownerWindow?.visualViewport;
    const viewportWidth = visual?.width ?? this.ownerWindow?.innerWidth ?? this.doc.documentElement.clientWidth;
    const viewportHeight = visual?.height ?? this.ownerWindow?.innerHeight ?? this.doc.documentElement.clientHeight;
    const offsetLeft = visual?.offsetLeft ?? 0;
    const offsetTop = visual?.offsetTop ?? 0;
    const margin = 8;
    this.el.style.maxHeight = `${Math.max(80, viewportHeight - 2 * margin)}px`;
    this.el.style.maxWidth = `${Math.max(80, viewportWidth - 2 * margin)}px`;
    const rect = this.el.getBoundingClientRect();
    const panel = { width: this.el.offsetWidth || rect.width, height: this.el.offsetHeight || rect.height };
    const anchor = this.anchor?.isConnected ? this.anchor.getBoundingClientRect() : this.anchorRect;
    const imageAnchor = this.isImageAnchor();
    let left = anchor ? imageAnchor ? anchor.right - panel.width : anchor.left : (viewportWidth - panel.width) / 2;
    let top = anchor ? imageAnchor ? anchor.top + 36 : anchor.bottom + 6 : (viewportHeight - panel.height) / 2;
    let placement = anchor ? "below" : "center";
    if (!imageAnchor && anchor && top + panel.height > viewportHeight - margin && anchor.top - panel.height - 6 >= margin) {
      top = anchor.top - panel.height - 6;
      placement = "above";
    }
    left = Math.max(offsetLeft + margin, Math.min(left, Math.max(offsetLeft + margin, offsetLeft + viewportWidth - panel.width - margin)));
    top = Math.max(offsetTop + margin, Math.min(top, Math.max(offsetTop + margin, offsetTop + viewportHeight - panel.height - margin)));
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    const anchorX = anchor ? (imageAnchor ? anchor.right - 24 : (anchor.left + anchor.right) / 2) - left : panel.width / 2;
    const originX = Math.max(12, Math.min(anchorX, Math.max(12, panel.width - 12)));
    this.el.style.transformOrigin = `${originX}px ${placement === "above" ? "bottom" : placement === "center" ? "center" : "top"}`;
    this.el.setAttribute("data-ilg-placement", placement);
  }
  reducedMotion() {
    return this.ownerWindow?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }
  beginExit() {
    this.el.setAttribute("data-ilg-phase", "exiting");
    const exits = exitingPopovers.get(this.doc) ?? /* @__PURE__ */ new Set();
    exitingPopovers.set(this.doc, exits);
    let timer;
    const finish = () => {
      if (timer !== void 0) this.ownerWindow?.clearTimeout(timer);
      timer = void 0;
      this.el.remove();
      exits.delete(finish);
      if (!exits.size) exitingPopovers.delete(this.doc);
    };
    exits.add(finish);
    try {
      timer = this.ownerWindow.setTimeout(finish, 120);
    } catch {
      finish();
    }
  }
  isImageAnchor() {
    return this.anchor?.tagName === "IMG" || Boolean(this.anchor?.classList?.contains("image-anchor"));
  }
};

// src/reference-editor.ts
var documentDrafts = /* @__PURE__ */ new WeakMap();
var anchorDrafts = /* @__PURE__ */ new WeakMap();
var draftLimit = 64;
var editorSequence = 0;
var ReferenceEditor = class {
  constructor(anchor, sourceBody, saveBody, options = {}) {
    this.anchor = anchor;
    this.sourceBody = sourceBody;
    this.saveBody = saveBody;
    this.popover = new AnchoredPopover(anchor, "\u56FE\u7247\u5F15\u7528\u4E0E\u56FE\u6CE8", () => this.onClose());
    this.popover.el.classList.add("ilg-reference-editor");
    this.normalizedSource = sourceBody.replace(/\r\n?/g, "\n");
    this.draftKey = options.draftKey;
    if (this.draftKey !== void 0) {
      const doc2 = this.popover.el.ownerDocument;
      let drafts = documentDrafts.get(doc2);
      if (!drafts) {
        drafts = /* @__PURE__ */ new Map();
        documentDrafts.set(doc2, drafts);
      }
      this.drafts = drafts;
    }
    const recovered = this.drafts ? this.drafts.get(this.draftKey) : anchorDrafts.get(anchor);
    if (recovered?.source === sourceBody) this.record = recovered;
    const doc = this.popover.el.ownerDocument;
    const label = doc.createElement("label");
    label.className = "ilg-reference-label";
    label.textContent = "\u56FE\u7247\u5F15\u7528\u4E0E\u56FE\u6CE8";
    this.input = doc.createElement("textarea");
    this.input.className = "ilg-reference-input";
    this.input.id = `ilg-reference-${++editorSequence}`;
    label.htmlFor = this.input.id;
    this.input.setAttribute("aria-label", "\u56FE\u7247\u5F15\u7528\u4E0E\u56FE\u6CE8");
    this.input.spellcheck = false;
    this.input.value = this.record?.value ?? this.normalizedSource;
    const footer = doc.createElement("div");
    footer.className = "ilg-reference-footer";
    this.status = doc.createElement("span");
    this.status.className = "ilg-reference-status";
    this.status.setAttribute("role", "status");
    this.status.setAttribute("aria-live", "polite");
    if (this.record) this.status.textContent = "\u5DF2\u6062\u590D\u8349\u7A3F";
    this.cancelButton = doc.createElement("button");
    this.cancelButton.type = "button";
    this.cancelButton.className = "ilg-reference-cancel";
    this.cancelButton.textContent = "\u53D6\u6D88";
    this.saveButton = doc.createElement("button");
    this.saveButton.type = "button";
    this.saveButton.className = "ilg-reference-save mod-cta";
    this.saveButton.textContent = "\u4FDD\u5B58";
    this.saveButton.title = "\u4FDD\u5B58\uFF08\u2318 / Ctrl + Enter\uFF09";
    footer.append(this.status, this.cancelButton, this.saveButton);
    this.popover.contentEl.append(label, this.input, footer);
    this.popover.listen(this.cancelButton, "click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
    });
    this.popover.listen(this.saveButton, "click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.submit();
    });
    this.popover.listen(this.input, "input", () => {
      this.rememberDraft();
      if (this.status.classList.contains("is-error")) {
        this.status.classList.remove("is-error");
        this.status.textContent = "";
      }
    });
    this.popover.listen(this.input, "compositionstart", () => {
      this.composing = true;
    });
    this.popover.listen(this.input, "compositionend", () => {
      this.composing = false;
      this.rememberDraft();
    });
    this.popover.listen(this.input, "contextmenu", (event) => event.stopPropagation());
    const shortcut = (event) => {
      const key = event;
      if (!this.containsEvent(event)) return;
      if (key.key === "Escape") {
        event.stopImmediatePropagation();
        if (this.isComposing(key)) return;
        event.preventDefault();
        if (!this.saving) this.cancel();
      } else if (key.key === "Enter" && (key.ctrlKey || key.metaKey)) {
        event.stopImmediatePropagation();
        if (this.isComposing(key)) return;
        event.preventDefault();
        void this.submit();
      }
    };
    if (doc.defaultView) this.popover.listen(doc.defaultView, "keydown", shortcut, true);
    this.popover.listen(doc, "keydown", shortcut, true);
    this.popover.listen(this.popover.el, "keydown", (event) => {
      event.stopPropagation();
      const key = event;
      if (key.key === "Enter" && (key.ctrlKey || key.metaKey) && !this.isComposing(key)) {
        event.preventDefault();
        void this.submit();
      }
    });
    for (const event of ["keyup", "beforeinput", "input", "compositionstart", "compositionupdate", "compositionend", "paste", "cut", "copy"]) {
      this.popover.listen(this.popover.el, event, (event2) => event2.stopPropagation());
    }
  }
  popover;
  input;
  status;
  saveButton;
  cancelButton;
  normalizedSource;
  draftKey;
  drafts;
  record;
  opened = false;
  closed = false;
  composing = false;
  saving = false;
  deliberateClose = false;
  get el() {
    return this.popover.el;
  }
  get contentEl() {
    return this.popover.contentEl;
  }
  open() {
    if (this.opened || this.closed) return;
    if (!this.anchor.isConnected) {
      this.close();
      return;
    }
    this.opened = true;
    this.popover.open();
    if (!this.closed) this.input.focus({ preventScroll: true });
  }
  /** Automatic closes retain an edited draft in this document's bounded session cache. */
  close() {
    this.popover.close();
  }
  containsEvent(event) {
    return event.composedPath().includes(this.popover.el) || Boolean(event.target && this.popover.el.contains(event.target));
  }
  isComposing(event) {
    return this.composing || event.isComposing || event.keyCode === 229;
  }
  rememberDraft() {
    if (this.deliberateClose) return;
    if (this.input.value === this.normalizedSource) {
      this.clearDraft();
      return;
    }
    this.record = { source: this.sourceBody, value: this.input.value };
    if (this.drafts) {
      this.drafts.delete(this.draftKey);
      this.drafts.set(this.draftKey, this.record);
      while (this.drafts.size > draftLimit) this.drafts.delete(this.drafts.keys().next().value);
    } else anchorDrafts.set(this.anchor, this.record);
  }
  clearDraft(force = false) {
    if (this.drafts) {
      if (force || this.record && this.drafts.get(this.draftKey) === this.record) this.drafts.delete(this.draftKey);
    } else if (force || this.record && anchorDrafts.get(this.anchor) === this.record) anchorDrafts.delete(this.anchor);
    this.record = void 0;
  }
  cancel() {
    if (this.saving || this.closed) return;
    this.deliberateClose = true;
    this.clearDraft(true);
    this.popover.close();
  }
  async submit() {
    if (this.closed || this.saving || this.composing) return;
    this.rememberDraft();
    this.saving = true;
    this.saveButton.disabled = this.cancelButton.disabled = true;
    this.input.readOnly = true;
    this.saveButton.textContent = "\u4FDD\u5B58\u4E2D\u2026";
    this.status.classList.remove("is-error");
    this.status.textContent = "";
    const value = this.input.value;
    const body = value === this.normalizedSource ? this.sourceBody : this.sourceBody.includes("\r\n") ? value.replace(/\r\n?|\n/g, "\r\n") : value;
    try {
      await this.saveBody(body);
      this.deliberateClose = true;
      this.clearDraft();
      this.popover.close();
    } catch (error) {
      if (!this.closed) {
        const reason = error instanceof Error ? error.message.slice(0, 140) : "";
        this.status.classList.add("is-error");
        this.status.textContent = reason ? `\u4FDD\u5B58\u5931\u8D25\uFF1A${reason}` : "\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5";
        this.input.focus({ preventScroll: true });
      }
    } finally {
      this.saving = false;
      if (!this.closed) {
        this.saveButton.disabled = this.cancelButton.disabled = false;
        this.input.readOnly = false;
        this.saveButton.textContent = "\u4FDD\u5B58";
      }
    }
  }
  onClose() {
    if (this.closed) return;
    if (!this.deliberateClose) this.rememberDraft();
    this.closed = true;
  }
};

// src/gallery-configuration.ts
var fitLabels = { contain: "\u5B8C\u6574", cover: "\u586B\u6EE1", natural: "\u539F\u59CB" };
var fitTitles = { contain: "\u5B8C\u6574\u7B49\u6BD4\u663E\u793A", cover: "\u586B\u6EE1\u56FE\u7247\u533A\u57DF", natural: "\u4FDD\u6301\u539F\u59CB\u6BD4\u4F8B" };
var fields = ["fit", "height", "gap", "radius", "caption", "thumbnails", "overlay", "align", "width", "grid"];
var configurationSequence = 0;
function getConfigurationPatch(original, values) {
  return Object.fromEntries(fields.filter((key) => original[key] !== values[key]).map((key) => [key, values[key]]));
}
var GalleryConfiguration = class {
  constructor(anchor, options, save) {
    this.anchor = anchor;
    this.save = save;
    this.original = { ...options, descriptions: [...options.descriptions] };
    this.values = { ...this.original, descriptions: [...this.original.descriptions] };
    this.popover = new AnchoredPopover(anchor, "\u753B\u5ECA\u8BBE\u7F6E", () => {
      this.closed = true;
    });
    this.popover.el.classList.add("ilg-configuration");
    this.doc = this.popover.el.ownerDocument;
    const heading = this.create("div", this.popover.contentEl, "ilg-config-heading", "\u753B\u5ECA\u8BBE\u7F6E");
    heading.setAttribute("role", "heading");
    heading.setAttribute("aria-level", "3");
    const fitRow = this.create("div", this.popover.contentEl, "ilg-config-fit-row");
    this.create("span", fitRow, "ilg-config-label", "\u9002\u914D");
    const fitGroup = this.create("div", fitRow, "ilg-config-fit");
    fitGroup.setAttribute("role", "group");
    fitGroup.setAttribute("aria-label", "\u56FE\u7247\u663E\u793A\u65B9\u5F0F");
    for (const fit of ["contain", "cover", "natural"]) {
      const button = this.create("button", fitGroup, "ilg-config-fit-button", fitLabels[fit]);
      button.type = "button";
      button.dataset.fit = fit;
      button.title = fitTitles[fit];
      button.setAttribute("aria-label", fitTitles[fit]);
      this.fitButtons.push(button);
      this.controls.push(button);
      this.popover.listen(button, "click", (event) => {
        event.stopPropagation();
        if (this.saving) return;
        this.values.fit = fit;
        this.updateFit();
        this.clearError();
      });
    }
    this.updateFit();
    this.slider("height", "\u9AD8\u5EA6", 120, 1200);
    this.slider("gap", "\u95F4\u8DDD", 0, 64);
    this.slider("radius", "\u5706\u89D2", 0, 48);
    const captionField = this.create("div", this.popover.contentEl, "ilg-config-field ilg-config-caption-field");
    const caption = this.create("textarea", captionField, "ilg-config-caption");
    caption.dataset.field = "caption";
    this.label(captionField, caption, "\u6574\u7EC4\u56FE\u6CE8", true);
    caption.rows = 2;
    caption.value = this.values.caption;
    caption.placeholder = "\u4E3A\u8FD9\u7EC4\u56FE\u7247\u6DFB\u52A0\u56FE\u6CE8";
    caption.spellcheck = false;
    caption.dataset.field = "caption";
    this.controls.push(caption);
    this.popover.listen(caption, "input", () => {
      this.values.caption = caption.value;
      this.clearError();
    });
    this.popover.listen(caption, "contextmenu", (event) => event.stopPropagation());
    const thumbLabel = this.create("label", this.popover.contentEl, "ilg-config-toggle-row");
    this.create("span", thumbLabel, "ilg-config-label", "\u7F29\u7565\u56FE");
    const thumbnails = this.create("input", thumbLabel, "ilg-config-toggle");
    thumbnails.type = "checkbox";
    thumbnails.checked = this.values.thumbnails;
    thumbnails.dataset.field = "thumbnails";
    thumbnails.setAttribute("role", "switch");
    thumbnails.setAttribute("aria-label", "\u663E\u793A\u7F29\u7565\u56FE");
    this.controls.push(thumbnails);
    this.popover.listen(thumbnails, "change", () => {
      this.values.thumbnails = thumbnails.checked;
      this.clearError();
    });
    const advanced = this.create("details", this.popover.contentEl, "ilg-config-advanced");
    const summary = this.create("summary", advanced, "ilg-config-advanced-summary", "\u9AD8\u7EA7\u8BBE\u7F6E");
    summary.title = "\u56FE\u7247\u8BF4\u660E\u3001\u5BF9\u9F50\u4E0E\u5BBD\u5EA6";
    const advancedBody = this.create("div", advanced, "ilg-config-advanced-body");
    const paired = this.create("div", advancedBody, "ilg-config-paired");
    this.dropdown(paired, "overlay", "\u56FE\u7247\u8BF4\u660E", { never: "\u56FE\u7247\u4E0B\u65B9", hover: "\u60AC\u505C\u53E0\u52A0", always: "\u59CB\u7EC8\u53E0\u52A0" });
    this.dropdown(paired, "align", "\u5BF9\u9F50", { full: "\u5360\u6EE1\u5BBD\u5EA6", left: "\u5DE6\u5BF9\u9F50", center: "\u5C45\u4E2D", right: "\u53F3\u5BF9\u9F50" });
    const widthField = this.create("div", advancedBody, "ilg-config-field");
    const width = this.create("input", widthField, "ilg-config-width");
    width.dataset.field = "width";
    this.label(widthField, width, "\u753B\u5ECA\u5BBD\u5EA6", true);
    width.type = "text";
    width.value = this.values.width;
    width.placeholder = "70% \u6216 480px";
    width.dataset.field = "width";
    this.controls.push(width);
    this.popover.listen(width, "input", () => {
      this.values.width = width.value;
      this.clearError();
    });
    if (this.values.layout === "custom") {
      const gridField = this.create("div", advancedBody, "ilg-config-field");
      const grid = this.create("textarea", gridField, "ilg-config-custom-grid");
      grid.dataset.field = "grid";
      this.label(gridField, grid, "\u81EA\u5B9A\u4E49\u7F51\u683C", true);
      grid.rows = 3;
      grid.value = this.values.grid;
      grid.spellcheck = false;
      grid.dataset.field = "grid";
      grid.placeholder = "AA\nBC";
      this.controls.push(grid);
      this.popover.listen(grid, "input", () => {
        this.values.grid = grid.value;
        this.clearError();
      });
      this.popover.listen(grid, "contextmenu", (event) => event.stopPropagation());
    }
    const footer = this.create("div", this.popover.contentEl, "ilg-config-footer");
    this.status = this.create("span", footer, "ilg-config-status");
    this.status.setAttribute("role", "status");
    this.status.setAttribute("aria-live", "polite");
    this.cancelButton = this.create("button", footer, "ilg-config-cancel", "\u53D6\u6D88");
    this.cancelButton.type = "button";
    this.saveButton = this.create("button", footer, "ilg-config-save mod-cta", "\u4FDD\u5B58");
    this.saveButton.type = "button";
    this.saveButton.title = "\u4FDD\u5B58\uFF08\u2318 / Ctrl + Enter\uFF09";
    this.popover.listen(this.cancelButton, "click", (event) => {
      event.stopPropagation();
      if (!this.saving) this.close();
    });
    this.popover.listen(this.saveButton, "click", (event) => {
      event.stopPropagation();
      void this.submit();
    });
    const shortcut = (event) => {
      const key = event;
      if (!this.containsEvent(event)) return;
      if (key.key === "Escape") {
        event.stopImmediatePropagation();
        if (this.isComposing(key)) return;
        event.preventDefault();
        if (!this.saving) this.close();
      } else if (key.key === "Enter" && (key.ctrlKey || key.metaKey)) {
        event.stopImmediatePropagation();
        if (this.isComposing(key)) return;
        event.preventDefault();
        void this.submit();
      }
    };
    if (this.doc.defaultView) this.popover.listen(this.doc.defaultView, "keydown", shortcut, true);
    this.popover.listen(this.doc, "keydown", shortcut, true);
    this.popover.listen(this.popover.el, "keydown", (event) => {
      event.stopPropagation();
      const key = event;
      if (key.key === "Enter" && (key.ctrlKey || key.metaKey) && !this.isComposing(key)) {
        event.preventDefault();
        void this.submit();
      }
    });
    this.popover.listen(this.popover.el, "compositionstart", (event) => {
      this.composing = true;
      event.stopPropagation();
    });
    this.popover.listen(this.popover.el, "compositionend", (event) => {
      this.composing = false;
      event.stopPropagation();
    });
    for (const event of ["keyup", "beforeinput", "input", "compositionupdate", "paste", "cut", "copy"]) this.popover.listen(this.popover.el, event, (event2) => event2.stopPropagation());
  }
  popover;
  original;
  values;
  doc;
  status;
  saveButton;
  cancelButton;
  controls = [];
  fitButtons = [];
  id = ++configurationSequence;
  composing = false;
  saving = false;
  opened = false;
  closed = false;
  get el() {
    return this.popover.el;
  }
  get contentEl() {
    return this.popover.contentEl;
  }
  open() {
    if (this.opened || this.closed) return;
    if (!this.anchor.isConnected) {
      this.close();
      return;
    }
    this.opened = true;
    this.popover.open();
    if (!this.closed) this.fitButtons.find((button) => button.dataset.fit === this.values.fit)?.focus({ preventScroll: true });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.popover.close();
  }
  create(tag, parent, className, text2 = "") {
    const element = this.doc.createElement(tag);
    element.className = className;
    element.textContent = text2;
    parent.appendChild(element);
    return element;
  }
  label(parent, control, name, prepend = false) {
    const label = this.doc.createElement("label");
    label.className = "ilg-config-label";
    label.textContent = name;
    control.id = `ilg-config-${this.id}-${control.dataset.field ?? parent.className.replace(/\W+/g, "-")}`;
    label.htmlFor = control.id;
    if (prepend) parent.insertBefore(label, control);
    else parent.appendChild(label);
  }
  slider(key, name, min, max) {
    const field = this.create("div", this.popover.contentEl, "ilg-config-field ilg-config-slider-field");
    const header = this.create("div", field, "ilg-config-slider-header");
    const input = this.create("input", field, "ilg-config-range");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = "1";
    input.value = String(this.values[key]);
    input.dataset.field = key;
    this.label(header, input, name);
    this.controls.push(input);
    const value = this.create("span", header, "ilg-config-value");
    value.setAttribute("aria-hidden", "true");
    const update = () => {
      value.textContent = `${this.values[key]} px`;
      input.setAttribute("aria-valuetext", value.textContent);
      input.style.setProperty("--ilg-config-progress", `${Math.max(0, Math.min(100, (this.values[key] - min) / (max - min) * 100))}%`);
    };
    update();
    this.popover.listen(input, "input", () => {
      const next = Number(input.value);
      if (Number.isFinite(next)) {
        this.values[key] = Math.round(Math.max(min, Math.min(max, next)));
        update();
        this.clearError();
      }
    });
    this.popover.listen(input, "pointerdown", () => field.classList.add("is-adjusting"));
    this.popover.listen(this.doc, "pointerup", () => field.classList.remove("is-adjusting"), true);
    this.popover.listen(input, "pointercancel", () => field.classList.remove("is-adjusting"));
  }
  dropdown(parent, key, name, options) {
    const field = this.create("div", parent, "ilg-config-field");
    const select = this.create("select", field, "ilg-config-select");
    select.dataset.field = key;
    this.label(field, select, name, true);
    Object.entries(options).forEach(([value, label]) => {
      const option = this.create("option", select, "", String(label));
      option.value = value;
    });
    select.value = this.values[key];
    this.controls.push(select);
    this.popover.listen(select, "change", () => {
      this.values[key] = select.value;
      this.clearError();
    });
  }
  updateFit() {
    this.fitButtons.forEach((button) => {
      const selected = button.dataset.fit === this.values.fit;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  containsEvent(event) {
    return event.composedPath().includes(this.popover.el) || Boolean(event.target && this.popover.el.contains(event.target));
  }
  isComposing(event) {
    return this.composing || event.isComposing || event.keyCode === 229;
  }
  clearError() {
    if (this.status) {
      this.status.classList.remove("is-error");
      this.status.textContent = "";
    }
  }
  validation() {
    if (this.values.width !== this.original.width) {
      const match = /^(\d+(?:\.\d+)?)(px|%|rem|em|vw|vh)$/i.exec(this.values.width.trim());
      if (!match || Number(match[1]) <= 0) return "\u5BBD\u5EA6\u53EF\u586B\u5199 70% \u6216 480px";
      const unit = match[2].toLowerCase(), max = ["%", "vw", "vh"].includes(unit) ? 100 : ["rem", "em"].includes(unit) ? 256 : 4096;
      if (Number(match[1]) > max) return `\u5BBD\u5EA6\u6700\u5927\u4E3A ${max}${unit}`;
      this.values.width = `${Number(match[1])}${unit}`;
    }
    if (this.values.layout === "custom" && this.values.grid !== this.original.grid) {
      const parsed = parseCustomGrid(this.values.grid);
      if ("error" in parsed) return parsed.error;
    }
    return void 0;
  }
  async submit() {
    if (this.closed || this.saving || this.composing) return;
    const error = this.validation();
    if (error) {
      this.status.textContent = error;
      this.status.classList.add("is-error");
      return;
    }
    const patch = getConfigurationPatch(this.original, this.values);
    if (!Object.keys(patch).length) {
      this.close();
      return;
    }
    this.saving = true;
    this.controls.forEach((control) => control.disabled = true);
    this.saveButton.disabled = this.cancelButton.disabled = true;
    this.saveButton.textContent = "\u4FDD\u5B58\u4E2D\u2026";
    this.clearError();
    try {
      await this.save(patch);
      this.close();
    } catch (error2) {
      if (!this.closed) {
        const reason = error2 instanceof Error ? error2.message.slice(0, 140) : "";
        this.status.textContent = reason ? `\u4FDD\u5B58\u5931\u8D25\uFF1A${reason}` : "\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5";
        this.status.classList.add("is-error");
      }
    } finally {
      this.saving = false;
      if (!this.closed) {
        this.controls.forEach((control) => control.disabled = false);
        this.saveButton.disabled = this.cancelButton.disabled = false;
        this.saveButton.textContent = "\u4FDD\u5B58";
      }
    }
  }
};

// src/image-controls.ts
var ImageControls = class {
  constructor(doc, resolve) {
    this.doc = doc;
    this.resolve = resolve;
    this.ownerWindow = doc.defaultView;
    this.toolbar = doc.createElement("div");
    this.toolbar.className = "ilg-image-controls";
    this.toolbar.setAttribute("role", "toolbar");
    this.toolbar.setAttribute("aria-label", "\u56FE\u7247\u64CD\u4F5C");
    this.toolbar.hidden = true;
    this.layoutButton = this.createButton("\u5E03\u5C40", () => this.context?.layout);
    this.settingsButton = this.createButton("\u8BBE\u7F6E", () => this.context?.configure);
    this.settingsButton.setAttribute("aria-label", "\u753B\u5ECA\u8BBE\u7F6E");
    doc.body.appendChild(this.toolbar);
    this.listen(doc, "pointerdown", (event) => {
      const pointer = event;
      if (pointer.pointerType !== "touch") return;
      if (this.press) {
        this.cancelPress();
        return;
      }
      const target = this.element(event.target);
      if (target && this.toolbar.contains(target)) return;
      const image = this.findImage(target);
      if (!image) {
        this.hide();
        return;
      }
      this.press = { id: pointer.pointerId, x: pointer.clientX, y: pointer.clientY, image };
      this.pressTimer = this.ownerWindow?.setTimeout(() => {
        if (!this.press) return;
        this.touchControls = true;
        this.suppressedImage = image;
        this.suppressUntil = Date.now() + 1800;
        this.show(image);
        this.cancelPress();
      }, 450);
    }, true);
    this.listen(doc, "pointermove", (event) => {
      const pointer = event;
      if (this.press && (pointer.pointerId !== this.press.id || Math.hypot(pointer.clientX - this.press.x, pointer.clientY - this.press.y) > 10)) this.cancelPress();
    }, true);
    for (const type of ["pointerup", "pointercancel"]) this.listen(doc, type, () => this.cancelPress(), true);
    this.listen(doc, "click", (event) => {
      if (Date.now() < this.suppressUntil && this.findImage(this.element(event.target)) === this.suppressedImage) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.suppressedImage = void 0;
      }
    }, true);
    this.listen(doc, "contextmenu", (event) => {
      if (this.touchControls && this.findImage(this.element(event.target)) === this.image) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    this.listen(doc, "pointerover", (event) => {
      if (event.pointerType === "touch") return;
      const target = this.element(event.target);
      if (target && this.toolbar.contains(target)) {
        this.cancelHide();
        return;
      }
      const image = this.findImage(target);
      if (image) this.show(image);
    });
    this.listen(doc, "pointerout", (event) => {
      const pointer = event;
      if (pointer.pointerType === "touch" || this.touchControls) return;
      const target = this.element(pointer.target);
      if (!target || this.findImage(target) !== this.image && !this.toolbar.contains(target)) return;
      const related = this.element(pointer.relatedTarget);
      if (related && (this.findImage(related) === this.image || this.toolbar.contains(related))) this.cancelHide();
      else this.scheduleHide();
    });
    this.listen(doc, "focusin", (event) => {
      const target = this.element(event.target);
      if (target && this.toolbar.contains(target)) {
        this.cancelHide();
        return;
      }
      const image = this.findImage(target);
      if (image) this.show(image);
      else this.scheduleHide();
    });
    this.listen(doc, "keydown", (event) => {
      if (event.key === "Escape") this.hide();
    });
    this.listen(doc, "scroll", (event) => {
      this.cancelPress();
      const target = event.target;
      if (!this.image || !target || target === this.doc || typeof target.contains === "function" && target.contains(this.image)) this.hide();
    }, true);
    if (this.ownerWindow) this.listen(this.ownerWindow, "resize", () => this.hide());
  }
  toolbar;
  layoutButton;
  settingsButton;
  ownerWindow;
  image;
  context;
  hideTimer;
  pressTimer;
  press;
  suppressedImage;
  suppressUntil = 0;
  touchControls = false;
  dispose = [];
  destroy() {
    this.cancelPress();
    this.hide();
    this.dispose.splice(0).forEach((dispose) => dispose());
    this.toolbar.remove();
  }
  createButton(text2, action) {
    const button = this.doc.createElement("button");
    button.type = "button";
    button.textContent = text2;
    this.toolbar.appendChild(button);
    this.listen(button, "pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    this.listen(button, "click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const callback = action();
      this.hide();
      callback?.();
    });
    return button;
  }
  element(target) {
    const element = target;
    return element && typeof element.closest === "function" ? element : void 0;
  }
  findImage(target) {
    if (!target || target.closest(".ilg-viewer, .nis-viewer, .ilg-image-controls, .ilg-popover, .nis-stage")) return;
    const image = target.closest("img") ?? target.closest("button")?.querySelector("img");
    if (image?.tagName !== "IMG" || !image.closest(".markdown-source-view, .markdown-preview-view")) return;
    return image;
  }
  show(image) {
    this.cancelHide();
    const rect = image.getBoundingClientRect();
    const viewportWidth = this.ownerWindow?.innerWidth ?? this.doc.documentElement.clientWidth;
    const viewportHeight = this.ownerWindow?.innerHeight ?? this.doc.documentElement.clientHeight;
    if (!image.isConnected || rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= viewportHeight || rect.right <= 0 || rect.left >= viewportWidth) {
      this.hide();
      return;
    }
    const context = this.resolve(image);
    if (!context) {
      this.hide();
      return;
    }
    this.image = image;
    this.context = context;
    const label = context.grouped ? "\u753B\u5ECA\u5E03\u5C40" : "\u56FE\u7247\u5E03\u5C40";
    this.layoutButton.setAttribute("aria-label", label);
    this.layoutButton.title = label;
    this.settingsButton.title = "\u753B\u5ECA\u8BBE\u7F6E";
    this.settingsButton.hidden = !context.grouped;
    this.settingsButton.disabled = !context.configure;
    this.toolbar.style.visibility = "hidden";
    this.toolbar.hidden = false;
    const bounds = this.toolbar.getBoundingClientRect();
    const margin = 8;
    const desiredLeft = rect.width >= bounds.width + 2 * margin ? rect.right - bounds.width - margin : rect.right + 6;
    const left = Math.max(margin, Math.min(desiredLeft, Math.max(margin, viewportWidth - bounds.width - margin)));
    const top = Math.max(margin, Math.min(rect.top + margin, Math.max(margin, viewportHeight - bounds.height - margin)));
    this.toolbar.style.left = `${left}px`;
    this.toolbar.style.top = `${top}px`;
    this.toolbar.style.visibility = "";
  }
  scheduleHide() {
    if (this.touchControls) return;
    this.cancelHide();
    if (this.ownerWindow) this.hideTimer = this.ownerWindow.setTimeout(() => this.hide(), 150);
    else this.hide();
  }
  cancelHide() {
    if (this.hideTimer !== void 0) this.ownerWindow?.clearTimeout(this.hideTimer);
    this.hideTimer = void 0;
  }
  cancelPress() {
    if (this.pressTimer !== void 0) this.ownerWindow?.clearTimeout(this.pressTimer);
    this.pressTimer = void 0;
    this.press = void 0;
  }
  hide() {
    this.cancelHide();
    this.touchControls = false;
    this.toolbar.hidden = true;
    this.image = void 0;
    this.context = void 0;
  }
  listen(target, event, callback, capture = false) {
    target.addEventListener(event, callback, capture);
    this.dispose.push(() => target.removeEventListener(event, callback, capture));
  }
};

// src/group-picker.ts
var columns = 4;
var clampIndex = (index, count) => Math.max(0, Math.min(count - 1, Number.isFinite(index) ? Math.trunc(index) : 0));
function anchoredRange(anchor, target, count) {
  if (!Number.isFinite(count) || count < 1) return { first: -1, last: -1 };
  const first = clampIndex(anchor, count), last = clampIndex(target, count);
  return { first: Math.min(first, last), last: Math.max(first, last) };
}
function extendRange(range, target, count) {
  if (range.first < 0 || range.last < 0) return anchoredRange(target, target, count);
  const valid = anchoredRange(range.first, range.last, count);
  if (valid.first < 0) return valid;
  const index = clampIndex(target, count);
  return { first: Math.min(valid.first, index), last: Math.max(valid.last, index) };
}
function pickerImageName(image) {
  const clean = (text2) => text2.split("|").map((part) => part.trim()).filter((part) => part && !/^\d+(?:\s*x\s*\d+)?(?:px)?$/i.test(part)).join(" \xB7 ");
  return clean(image.alt) || clean(image.target.split(/[\\/]/).pop() || "") || "\u56FE\u7247";
}
var GalleryGroupPicker = class {
  constructor(_app, images, anchorIndex, chosen, anchorEl) {
    this.chosen = chosen;
    this.images = images.map((image) => ({ ...image }));
    this.anchor = this.images.length ? clampIndex(anchorIndex, this.images.length) : -1;
    this.range = anchoredRange(this.anchor, this.anchor, this.images.length);
    this.popover = new AnchoredPopover(anchorEl, "\u9009\u62E9\u7EC4\u6210\u753B\u5ECA\u7684\u56FE\u7247", () => this.cleanup());
    this.popover.el.classList.add("ilg-group-picker");
  }
  images;
  anchor;
  popover;
  range;
  summary;
  confirm;
  list;
  cards = [];
  opened = false;
  closed = false;
  submitted = false;
  paintPointer = null;
  suppressContextUntil = 0;
  suppressClickUntil = 0;
  get el() {
    return this.popover.el;
  }
  get contentEl() {
    return this.popover.contentEl;
  }
  open() {
    if (this.opened || this.closed) return;
    this.opened = true;
    this.render();
    this.popover.open();
    this.cards[this.anchor]?.focus({ preventScroll: true });
  }
  close() {
    this.popover.close();
  }
  create(tag, parent, className, text2 = "") {
    const element = this.contentEl.ownerDocument.createElement(tag);
    element.className = className;
    element.textContent = text2;
    parent.appendChild(element);
    return element;
  }
  render() {
    this.contentEl.replaceChildren();
    this.list = this.create("div", this.contentEl, "ilg-group-picker-list");
    this.list.setAttribute("role", "group");
    this.list.setAttribute("aria-label", "\u6309\u6B63\u6587\u987A\u5E8F\u6392\u5217\u7684\u56FE\u7247");
    this.images.forEach((image, index) => {
      const name = pickerImageName(image);
      const card = this.create("button", this.list, "ilg-group-picker-card");
      card.type = "button";
      card.dataset.index = String(index);
      card.title = `${index + 1} \xB7 ${name}`;
      card.setAttribute("aria-label", `\u7B2C ${index + 1} \u5F20\u56FE\u7247\uFF1A${name}`);
      if (index === this.anchor) card.setAttribute("aria-current", "true");
      const preview = this.create("span", card, "ilg-group-picker-preview");
      const img = this.create("img", preview, "");
      img.alt = name;
      img.loading = "lazy";
      img.decoding = "async";
      img.draggable = false;
      const failure = () => {
        img.hidden = true;
        if (!preview.querySelector(".ilg-group-picker-placeholder")) this.create("span", preview, "ilg-group-picker-placeholder", "\u2026");
      };
      this.popover.listen(img, "error", failure);
      if (image.missing || !image.src) failure();
      else img.src = image.src;
      const label = this.create("span", card, "ilg-group-picker-card-label");
      this.create("span", label, "ilg-group-picker-number", String(index + 1));
      this.create("span", label, "ilg-group-picker-description", name);
      this.popover.listen(card, "click", (event) => {
        event.stopPropagation();
        const mouse = event;
        if (mouse.button !== 0 || this.paintPointer !== null || Date.now() < this.suppressClickUntil) {
          event.preventDefault();
          return;
        }
        this.applyRange(anchoredRange(this.anchor, index, this.images.length));
      });
      this.popover.listen(card, "pointerdown", (event) => {
        event.stopPropagation();
        const pointer = event;
        if (pointer.button !== 2) return;
        event.preventDefault();
        this.paintPointer = pointer.pointerId;
        this.suppressContextUntil = Date.now() + 1e3;
        this.paint(index);
        card.focus({ preventScroll: true });
      });
      this.popover.listen(card, "pointerover", (event) => {
        event.stopPropagation();
        const pointer = event;
        if (this.paintPointer === pointer.pointerId && (pointer.buttons & 2) !== 0) this.paint(index);
      });
      this.popover.listen(card, "keydown", (event) => this.keydown(event, index));
      for (const name2 of ["dblclick", "mousedown", "mouseup", "pointerup", "pointermove", "pointerout", "pointerenter", "pointerleave", "pointercancel", "auxclick"]) {
        this.popover.listen(card, name2, (event) => {
          event.stopPropagation();
          if (name2 === "dblclick" || name2 === "auxclick" || event.button === 2 && name2 === "mousedown") event.preventDefault();
        });
      }
      this.popover.listen(card, "contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      this.popover.listen(card, "dragstart", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      this.cards.push(card);
    });
    const footer = this.create("div", this.contentEl, "ilg-group-picker-footer");
    this.summary = this.create("span", footer, "ilg-group-picker-summary");
    this.summary.setAttribute("role", "status");
    this.summary.setAttribute("aria-live", "polite");
    this.confirm = this.create("button", footer, "ilg-group-picker-confirm", "\u5E03\u5C40");
    this.confirm.type = "button";
    this.confirm.setAttribute("aria-label", "\u9009\u62E9\u5E03\u5C40");
    this.popover.listen(this.confirm, "click", (event) => {
      event.stopPropagation();
      event.preventDefault();
      if (this.submitted || !this.images.length || this.range.first < 0 || this.range.last < this.range.first) return;
      this.submitted = true;
      const { first, last } = this.range;
      this.close();
      this.chosen(first, last);
    });
    this.registerPaintTracking();
    this.update();
  }
  registerPaintTracking() {
    const doc = this.contentEl.ownerDocument;
    this.popover.listen(doc, "pointermove", (event) => {
      const pointer = event;
      if (this.paintPointer === null || pointer.pointerId !== this.paintPointer) return;
      event.stopPropagation();
      event.preventDefault();
      if ((pointer.buttons & 2) === 0) {
        this.stopPainting();
        return;
      }
      const target = doc.elementFromPoint(pointer.clientX, pointer.clientY);
      const card = target?.closest(".ilg-group-picker-card");
      if (!card || !this.el.contains(card)) return;
      const index = Number(card.dataset.index);
      if (Number.isInteger(index) && index >= 0 && index < this.images.length) this.paint(index);
    }, true);
    for (const name of ["pointerup", "pointercancel"]) this.popover.listen(doc, name, (event) => {
      const pointer = event;
      if (this.paintPointer === null || pointer.pointerId !== this.paintPointer) return;
      event.stopPropagation();
      event.preventDefault();
      this.stopPainting();
    }, true);
    this.popover.listen(doc, "contextmenu", (event) => {
      const target = event.target;
      if (this.paintPointer !== null || Date.now() < this.suppressContextUntil || target && this.el.contains(target)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    this.popover.listen(doc, "auxclick", (event) => {
      if (event.button === 2 && Date.now() < this.suppressContextUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    if (doc.defaultView) this.popover.listen(doc.defaultView, "blur", () => this.stopPainting());
  }
  stopPainting() {
    if (this.paintPointer === null) return;
    this.paintPointer = null;
    this.suppressContextUntil = Date.now() + 500;
    this.suppressClickUntil = Date.now() + 200;
  }
  paint(index) {
    this.applyRange(extendRange(this.range, index, this.images.length));
  }
  applyRange(range) {
    if (range.first === this.range.first && range.last === this.range.last) return;
    this.range = range;
    this.update();
  }
  update() {
    const count = this.range.first >= 0 ? this.range.last - this.range.first + 1 : 0;
    if (this.summary) this.summary.textContent = `${count}\u5F20`;
    this.cards.forEach((card, index) => {
      const selected = index >= this.range.first && index <= this.range.last;
      card.classList.toggle("is-selected", selected);
      card.setAttribute("aria-pressed", String(selected));
    });
    if (this.confirm) this.confirm.disabled = count === 0 || this.submitted;
  }
  keydown(event, index) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.key === "ArrowLeft" ? index - 1 : event.key === "ArrowRight" ? index + 1 : event.key === "ArrowUp" ? index - columns : event.key === "ArrowDown" ? index + columns : event.key === "Home" ? 0 : event.key === "End" ? this.images.length - 1 : void 0;
    if (target === void 0) return;
    event.preventDefault();
    event.stopPropagation();
    const next = clampIndex(target, this.images.length);
    this.cards[next]?.focus({ preventScroll: true });
    this.applyRange(anchoredRange(this.anchor, next, this.images.length));
    const card = this.cards[next], list = this.list;
    if (card && list) {
      const top = card.offsetTop;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (top + card.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + card.offsetHeight - list.clientHeight;
    }
  }
  cleanup() {
    this.stopPainting();
    this.closed = true;
    this.cards = [];
    this.list = void 0;
    this.summary = this.confirm = void 0;
    this.contentEl.replaceChildren();
  }
};

// src/layout-picker.ts
var LayoutPicker = class {
  constructor(_app, count, chosen, anchor, current) {
    this.chosen = chosen;
    this.popover = new AnchoredPopover(anchor, "\u9009\u62E9\u56FE\u7247\u5E03\u5C40");
    this.popover.el.classList.add("ilg-layout-popover");
    const doc = this.popover.el.ownerDocument;
    const list = doc.createElement("div");
    list.className = "ilg-picker";
    this.popover.contentEl.appendChild(list);
    const choices = getLayoutChoices(count);
    const normalizeGrid = (grid) => grid.replace(/[ \t]/g, "").trim();
    let selected = choices.find((choice) => choice.layout === current?.layout && (choice.grid === void 0 || normalizeGrid(choice.grid) === normalizeGrid(current.grid ?? "")));
    if (!selected && current?.layout) {
      const actual = getDominantGridDefinition(current.layout, count);
      const signature = (grid) => JSON.stringify([grid.columnFractions, grid.rows, grid.areas]);
      if (actual) selected = choices.find((choice) => {
        const candidate = getDominantGridDefinition(choice.layout, count);
        return candidate && signature(candidate) === signature(actual);
      });
    }
    for (const choice of choices) {
      const { layout, label } = choice;
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "ilg-picker-card";
      button.dataset.layout = layout;
      button.dataset.choice = choice.key;
      button.dataset.kind = choice.kind ?? "grid";
      button.setAttribute("aria-label", label);
      button.title = label;
      if (selected?.key === choice.key) {
        button.classList.add("is-selected");
        button.setAttribute("aria-current", "true");
      }
      const diagram = doc.createElement("span");
      diagram.className = "ilg-picker-diagram";
      diagram.setAttribute("aria-hidden", "true");
      const rows = choice.preview;
      diagram.style.gridTemplateColumns = `repeat(${rows[0].length},minmax(0,1fr))`;
      diagram.style.gridTemplateRows = `repeat(${rows.length},minmax(0,1fr))`;
      for (const letter2 of new Set(rows.join(""))) {
        if (letter2 === "." || letter2 === " ") continue;
        const positions = rows.flatMap((row, r) => [...row].flatMap((value, c) => value === letter2 ? [[r, c]] : []));
        const top = Math.min(...positions.map(([r]) => r)), bottom = Math.max(...positions.map(([r]) => r));
        const left = Math.min(...positions.map(([, c]) => c)), right = Math.max(...positions.map(([, c]) => c));
        const swatch = doc.createElement("span");
        swatch.className = `ilg-swatch ilg-swatch-${letter2.charCodeAt(0) % 4}`;
        swatch.style.gridArea = `${top + 1}/${left + 1}/${bottom + 2}/${right + 2}`;
        diagram.appendChild(swatch);
      }
      const caption = doc.createElement("span");
      caption.textContent = label;
      caption.className = "ilg-picker-label";
      button.append(diagram, caption);
      list.appendChild(button);
      this.popover.listen(button, "click", (event) => {
        event.stopPropagation();
        this.close();
        this.chosen({ layout, ...choice.grid !== void 0 ? { grid: choice.grid } : {} });
      });
    }
  }
  popover;
  open() {
    this.popover.open();
  }
  close() {
    this.popover.close();
  }
};

// src/configuration.ts
function groupKey(path, id) {
  return JSON.stringify([path, id]);
}
function getEffectiveOptions(group, path, settings) {
  if (group.kind === "fence") return group.options;
  const firstLine = group.raw.split(/\r?\n/, 1)[0];
  const marker = /^ {0,3}<!--[ \t]*image-layouts:[ \t]*(.*?)[ \t]*-->[ \t]*$/.exec(firstLine);
  if (!marker) return group.options;
  try {
    const raw = JSON.parse(marker[1]);
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return group.options;
    return normalizeOptions(raw, settings[groupKey(path, group.options.id)] ?? {});
  } catch {
    return group.options;
  }
}
function getStoredOptions(options) {
  const canonical = normalizeOptions(options);
  return Object.fromEntries(Object.entries(canonical).filter(
    ([key, value]) => key !== "id" && key !== "layout" && JSON.stringify(value) !== JSON.stringify(DEFAULT_OPTIONS[key])
  ));
}
function renameGroupSettings(settings, oldPath, newPath) {
  const renamed = { ...settings };
  if (oldPath === newPath) return renamed;
  const moves = [];
  for (const [key, value] of Object.entries(settings)) {
    try {
      const parts = JSON.parse(key);
      if (!Array.isArray(parts) || parts.length !== 2 || typeof parts[0] !== "string" || typeof parts[1] !== "string" || parts[0] !== oldPath && !parts[0].startsWith(oldPath + "/")) continue;
      const path = newPath + parts[0].slice(oldPath.length);
      moves.push({ oldKey: key, newKey: groupKey(path, parts[1]), value });
    } catch {
    }
  }
  for (const move of moves) delete renamed[move.oldKey];
  for (const move of moves) renamed[move.newKey] = move.value;
  return renamed;
}

// src/main.ts
var DEFAULT_SETTINGS = { layout: "g", fit: "contain", height: 320, gap: 8, radius: 8 };
var lineOffset = (source, line) => {
  let pos = 0;
  for (let i = 0; i < line; i++) {
    const next = source.indexOf("\n", pos);
    if (next < 0) return source.length;
    pos = next + 1;
  }
  return pos;
};
var shortId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);
function minimalHeaderEdit(source, group, options) {
  const edit = updateGroup(source, group, {});
  if (!edit) return null;
  const indent = /^ */.exec(source.slice(edit.from, edit.to))?.[0] ?? "";
  return { ...edit, insert: indent + serializeOpen({ id: options.id, layout: options.layout }) };
}
var GalleryChild = class extends import_obsidian3.MarkdownRenderChild {
  constructor(host, plugin, group, path, source) {
    super(host);
    this.plugin = plugin;
    this.group = group;
    this.path = path;
    this.source = source;
  }
  renderer;
  onload() {
    this.renderer = this.plugin.mount(this.containerEl, this.group, this.path, this.source, this);
  }
  onunload() {
    this.renderer?.destroy();
    this.containerEl.remove();
  }
};
var widgetChildren = /* @__PURE__ */ new WeakMap();
var GalleryWidget = class extends import_view.WidgetType {
  constructor(plugin, group, path, source, revision = plugin.configurationRevision) {
    super();
    this.plugin = plugin;
    this.group = group;
    this.path = path;
    this.source = source;
    this.revision = revision;
  }
  eq(other) {
    return this.revision === other.revision && this.path === other.path && this.group.from === other.group.from && this.group.raw === other.group.raw && this.source === other.source;
  }
  toDOM(view) {
    const host = view.dom.ownerDocument.createElement("div");
    host.className = "ilg-host ilg-live";
    host.contentEditable = "false";
    host.dataset.ilgGroupId = this.group.options.id;
    const child = new GalleryChild(host, this.plugin, this.group, this.path, this.source);
    child.load();
    widgetChildren.set(host, child);
    return host;
  }
  ignoreEvent() {
    return true;
  }
  destroy(host) {
    widgetChildren.get(host)?.unload();
    widgetChildren.delete(host);
  }
};
function decorations(state, plugin, groups) {
  if (state.field(import_obsidian3.editorLivePreviewField, false) !== true) return import_view.Decoration.none;
  const path = state.field(import_obsidian3.editorInfoField, false)?.file?.path ?? "";
  const source = state.doc.toString();
  const ranges = groups.filter((group) => !state.selection.ranges.some((selection) => selection.empty ? selection.from >= group.from && selection.from < group.to : selection.from < group.to && selection.to > group.from)).map((group) => import_view.Decoration.replace({ widget: new GalleryWidget(plugin, group, path, source), block: true }).range(group.from, group.to));
  return import_view.Decoration.set(ranges, true);
}
var ImageLayoutsEnhanced = class extends import_obsidian3.Plugin {
  settings = { ...DEFAULT_SETTINGS };
  groupSettings = {};
  configurationRevision = 0;
  storageQueue = Promise.resolve();
  diagnostics = { reading: 0, live: 0, toolkit: 0, fallback: 0 };
  readingChildren = /* @__PURE__ */ new Set();
  hiddenSections = /* @__PURE__ */ new WeakMap();
  anchorChildren = /* @__PURE__ */ new WeakMap();
  selectedImages = /* @__PURE__ */ new Map();
  imageControls = /* @__PURE__ */ new Map();
  imageSources = /* @__PURE__ */ new Map();
  navigationRenderers = /* @__PURE__ */ new WeakMap();
  hostGroups = /* @__PURE__ */ new WeakMap();
  parsedSources = /* @__PURE__ */ new Map();
  parsed(source, path) {
    const saved = this.parsedSources.get(path);
    if (saved?.source === source) return saved;
    const value = { source, groups: parseGroups(source), refs: extractImages(source) };
    if (this.parsedSources.size >= 16) this.parsedSources.delete(this.parsedSources.keys().next().value);
    this.parsedSources.set(path, value);
    return value;
  }
  async onload() {
    try {
      const saved = await this.loadData();
      const options = normalizeOptions(saved);
      this.settings = { layout: options.layout, fit: options.fit, height: options.height, gap: options.gap, radius: options.radius };
      if (saved?.groupSettings && typeof saved.groupSettings === "object" && !Array.isArray(saved.groupSettings)) this.groupSettings = { ...saved.groupSettings };
    } catch (error) {
      console.error("Image Layouts Enhanced: configuration read", error);
      new import_obsidian3.Notice("\u753B\u5ECA\u914D\u7F6E\u8BFB\u53D6\u9047\u5230\u95EE\u9898\uFF0C\u5F53\u524D\u4F7F\u7528\u9ED8\u8BA4\u663E\u793A\u53C2\u6570");
    }
    this.addSettingTab(new GallerySettings(this.app, this));
    this.registerEditorExtension(import_state.StateField.define({
      create: (state) => {
        const groups = parseGroups(state.doc.toString());
        return { groups, decorations: decorations(state, this, groups) };
      },
      update: (previous, transaction) => {
        const groups = transaction.docChanged ? parseGroups(transaction.state.doc.toString()) : previous.groups;
        return { groups, decorations: decorations(transaction.state, this, groups) };
      },
      provide: (field) => import_view.EditorView.decorations.from(field, (value) => value.decorations)
    }));
    this.registerMarkdownPostProcessor((el, ctx) => {
      this.annotateImages(el, ctx);
      return this.reading(el, ctx);
    });
    this.installImageControls();
    this.registerEvent(this.app.workspace.on("layout-change", () => this.installImageControls()));
    for (const suffix of ["", "left", "center", "right", ...Object.keys(LAYOUT_LABELS).filter((name) => !["focus", "filmstrip", "carousel", "custom"].includes(name))]) {
      this.registerMarkdownCodeBlockProcessor(suffix ? `image-layout-${suffix}` : "image-layout", (source, el, ctx) => this.legacy(source, el, ctx, suffix));
    }
    this.addCommand({ id: "create-gallery", name: "\u5C06\u9009\u4E2D\u56FE\u7247\u7EC4\u6210\u753B\u5ECA", editorCallback: (editor) => this.insert(editor) });
    this.addCommand({ id: "change-layout", name: "\u5F53\u524D\u56FE\u7247\u7EC4\uFF1A\u9009\u62E9\u5E03\u5C40", editorCheckCallback: (checking, editor) => {
      const group = parseGroups(editor.getValue()).find((g) => editor.posToOffset(editor.getCursor()) >= g.from && editor.posToOffset(editor.getCursor()) <= g.to);
      if (!group) return false;
      if (!checking) {
        const path = this.pathForEditor(editor);
        if (path) new LayoutPicker(this.app, this.images({ ...group, options: getEffectiveOptions(group, path, this.groupSettings) }, path, editor.getValue()).length, (patch) => void this.editFile(path, group, patch).catch(() => {
        }), void 0, getEffectiveOptions(group, path, this.groupSettings)).open();
      }
      return true;
    } });
    this.addCommand({ id: "unwrap-gallery", name: "\u5F53\u524D\u56FE\u7247\u7EC4\uFF1A\u6062\u590D\u666E\u901A\u56FE\u7247", editorCheckCallback: (checking, editor) => {
      const at = editor.posToOffset(editor.getCursor());
      const group = parseGroups(editor.getValue()).find((g) => at >= g.from && at <= g.to);
      if (!group) return false;
      if (!checking) this.applyEditor(editor, unwrapGroup(editor.getValue(), group));
      return true;
    } });
    this.addCommand({ id: "compact-gallery-markers", name: "\u7CBE\u7B80\u5F53\u524D\u7B14\u8BB0\u7684\u56FE\u7247\u7EC4\u6807\u8BB0", editorCallback: (editor) => void this.compact(editor).catch(() => {
    }) });
    this.addCommand({ id: "insert-template", name: "\u63D2\u5165\u56FE\u7247\u7EC4\u6A21\u677F", editorCallback: (editor) => void this.insertTemplate(editor).catch(() => {
    }) });
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor) => {
      const from = editor.posToOffset(editor.getCursor("from")), to = editor.posToOffset(editor.getCursor("to"));
      if (extractImages(editor.getValue()).some((ref) => ref.offset >= from && ref.offset + ref.raw.length <= to)) menu.addItem((item) => item.setTitle("\u5C06\u9009\u4E2D\u56FE\u7247\u7EC4\u6210\u753B\u5ECA").setIcon("images").onClick(() => this.insert(editor)));
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      const before = this.groupSettings;
      const next = renameGroupSettings(before, oldPath, file.path);
      if (JSON.stringify(before) === JSON.stringify(next)) return;
      this.groupSettings = next;
      void this.persistSettings().then(() => this.refreshConfiguration(file.path)).catch(() => {
        if (this.groupSettings === next) this.groupSettings = before;
      });
    }));
  }
  onunload() {
    for (const [doc, controls] of this.imageControls) {
      closePopover(doc);
      controls.destroy();
    }
    this.imageControls.clear();
    this.imageSources.clear();
    for (const child of [...this.readingChildren]) child.unload();
    this.readingChildren.clear();
    this.parsedSources.clear();
    this.selectedImages.clear();
  }
  trackReading(child, ctx) {
    this.readingChildren.add(child);
    child.register(() => this.readingChildren.delete(child));
    ctx.addChild(child);
  }
  installImageControls() {
    const documents = /* @__PURE__ */ new Set([document, ...this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view.containerEl.ownerDocument)]);
    for (const [doc, controls] of this.imageControls) if (!documents.has(doc)) {
      closePopover(doc);
      controls.destroy();
      this.imageControls.delete(doc);
    }
    for (const doc of documents) if (!this.imageControls.has(doc)) this.imageControls.set(doc, new ImageControls(doc, (image) => this.imageContext(image)));
  }
  imageUrl(src, doc) {
    try {
      const url = new URL(src, doc.baseURI);
      if (url.protocol === "app:") {
        url.search = "";
        url.hash = "";
      }
      return url.href;
    } catch {
      return src;
    }
  }
  sourceForTarget(target, path) {
    if (/^https?:\/\/|^data:image\//i.test(target)) return target;
    let decoded = target;
    try {
      decoded = decodeURIComponent(target);
    } catch {
    }
    const file = this.app.metadataCache.getFirstLinkpathDest(decoded.split("#")[0], path);
    return file ? this.app.vault.getResourcePath(file) : "";
  }
  annotateImages(el, ctx) {
    if (el.closest(".ilg-host")) return;
    const images = Array.from(el.querySelectorAll("img")).filter((image) => !image.closest(".ilg-host"));
    const info = ctx.getSectionInfo(el);
    if (!info) return;
    const from = lineOffset(info.text, info.lineStart), to = lineOffset(info.text, info.lineEnd + 1);
    if (!/!\[|<img\b/i.test(info.text.slice(from, to))) return;
    const refs = this.parsed(info.text, ctx.sourcePath).refs.filter((ref) => ref.offset >= from && ref.offset < to);
    if (!refs.length) return;
    if (this.imageSources.size >= 16 && !this.imageSources.has(ctx.sourcePath)) this.imageSources.delete(this.imageSources.keys().next().value);
    this.imageSources.set(ctx.sourcePath, info.text);
    if (el.dataset.ilgSectionPath !== ctx.sourcePath) el.dataset.ilgSectionPath = ctx.sourcePath;
    if (el.dataset.ilgSectionFrom !== String(from)) el.dataset.ilgSectionFrom = String(from);
    if (el.dataset.ilgSectionTo !== String(to)) el.dataset.ilgSectionTo = String(to);
    const used = /* @__PURE__ */ new Set();
    for (const image of images) {
      const ref = refs.find((ref2) => !used.has(ref2.offset) && this.imageUrl(this.sourceForTarget(ref2.target, ctx.sourcePath), image.ownerDocument) === this.imageUrl(image.currentSrc || image.src, image.ownerDocument));
      if (ref) {
        used.add(ref.offset);
        image.dataset.ilgSourcePath = ctx.sourcePath;
        image.dataset.ilgSourceOffset = String(ref.offset);
      }
    }
  }
  imageContext(image) {
    const view = this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view).find((view2) => view2 instanceof import_obsidian3.MarkdownView && view2.containerEl.contains(image));
    const path = view?.file?.path;
    if (!view || !path) return;
    const host = image.closest(".ilg-host"), mounted = host ? this.hostGroups.get(host) : void 0;
    if (mounted && mounted.path !== path) return;
    const source = view.getMode() === "source" ? view.editor.getValue() : view.data ?? this.imageSources.get(path) ?? this.parsedSources.get(path)?.source ?? mounted?.source;
    if (source === void 0) return;
    const parsed = this.parsed(source, path);
    let group = mounted?.group;
    if (!group) {
      const matching = parsed.refs.filter((ref2) => this.imageUrl(this.sourceForTarget(ref2.target, path), image.ownerDocument) === this.imageUrl(image.currentSrc || image.src, image.ownerDocument));
      let ref = image.dataset.ilgSourcePath === path ? matching.find((ref2) => ref2.offset === Number(image.dataset.ilgSourceOffset)) : void 0;
      const section = image.closest("[data-ilg-section-path]");
      if (!ref && section?.dataset.ilgSectionPath === path) {
        const candidates = matching.filter((ref2) => ref2.offset >= Number(section.dataset.ilgSectionFrom) && ref2.offset < Number(section.dataset.ilgSectionTo));
        if (candidates.length === 1) ref = candidates[0];
        else if (candidates.length > 1) {
          const duplicates = Array.from(section.querySelectorAll("img")).filter((item) => !item.closest(".ilg-host") && this.imageUrl(item.currentSrc || item.src, item.ownerDocument) === this.imageUrl(image.currentSrc || image.src, image.ownerDocument));
          if (duplicates.length === candidates.length) ref = candidates[duplicates.indexOf(image)];
        }
      }
      if (!ref && view.getMode() === "source") {
        try {
          const cm = view.editor.cm;
          const pos = cm.posAtDOM(image);
          const from = source.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
          const end = source.indexOf("\n", pos);
          const to = end < 0 ? source.length : end;
          ref = matching.find((ref2) => ref2.offset <= pos && ref2.offset + ref2.raw.length >= pos) ?? matching.find((ref2) => ref2.offset >= from && ref2.offset <= to);
        } catch {
        }
      }
      if (!ref && matching.length === 1) ref = matching[0];
      if (!ref) return;
      group = parsed.groups.find((group2) => ref.offset >= group2.bodyFrom && ref.offset < group2.bodyTo);
      if (!group) return { grouped: false, layout: () => void this.chooseImageGroup(view, path, source, ref.offset, image).catch((error) => {
        console.error("Image Layouts Enhanced", error);
        new import_obsidian3.Notice("\u56FE\u7247\u5E03\u5C40\u6253\u5F00\u9047\u5230\u95EE\u9898\uFF0C\u8BF7\u91CD\u8BD5");
      }) };
    }
    const selected = group;
    const guarded = (action) => void this.sameSource(view, path, source).then((valid) => {
      if (valid) action();
    });
    return {
      grouped: true,
      layout: () => guarded(() => new LayoutPicker(this.app, this.images({ ...selected, options: getEffectiveOptions(selected, path, this.groupSettings) }, path, source).length, (patch) => void this.sameSource(view, path, source).then((valid) => valid ? this.editFile(path, selected, patch) : void 0).catch(() => {
      }), image, getEffectiveOptions(selected, path, this.groupSettings)).open()),
      configure: () => guarded(() => new GalleryConfiguration(image, getEffectiveOptions(selected, path, this.groupSettings), (patch) => this.editFile(path, selected, patch)).open())
    };
  }
  async sameSource(view, path, source) {
    const attached = this.app.workspace.getLeavesOfType("markdown").some((leaf) => leaf.view === view);
    const current = attached && view.file?.path === path ? view.getMode() === "source" ? view.editor.getValue() : await this.app.vault.cachedRead(view.file) : void 0;
    if (current !== source) {
      new import_obsidian3.Notice("\u7B14\u8BB0\u5185\u5BB9\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u5728\u5F53\u524D\u56FE\u7247\u4E0A\u91CD\u65B0\u6253\u5F00\u5E03\u5C40");
      return false;
    }
    return true;
  }
  async chooseImageGroup(view, path, source, offset, anchorEl) {
    if (!await this.sameSource(view, path, source)) return;
    const parsed = this.parsed(source, path), refs = parsed.refs;
    const anchor = refs.findIndex((ref) => ref.offset === offset);
    if (anchor < 0) return;
    const inside = (index) => parsed.groups.some((group) => refs[index].offset >= group.from && refs[index].offset < group.to);
    const separated = (first2, last2) => {
      const between = source.slice(refs[first2].offset + refs[first2].raw.length, refs[last2].offset);
      return /^ {0,3}#{1,6}\s/m.test(between) || between.split("\n").filter((line) => line.trim()).length > 12;
    };
    let first = anchor, last = anchor;
    while (first > 0 && anchor - first < 10 && !inside(first - 1) && !separated(first - 1, first)) first--;
    while (last < refs.length - 1 && last - anchor < 10 && !inside(last + 1) && !separated(last, last + 1)) last++;
    const nearby = refs.slice(first, last + 1);
    const images = nearby.map((ref) => {
      const src = this.sourceForTarget(ref.target, path);
      const alt = ref.kind === "wiki" ? ref.alt.split("|").filter((part) => !/^\d+(?:x\d+)?$/.test(part.trim())).join("|") : ref.alt;
      return { src, alt: alt || ref.target.split("/").pop() || "", target: ref.target, line: ref.line, sourceOffset: ref.offset, missing: !src };
    });
    new GalleryGroupPicker(this.app, images, anchor - first, (start, end) => new LayoutPicker(this.app, end - start + 1, (patch) => void (async () => {
      if (!await this.sameSource(view, path, source)) return;
      const options = normalizeOptions({ ...this.settings, id: shortId(), ...patch });
      let to = nearby[end].offset + nearby[end].raw.length;
      if (source.startsWith("\r\n", to)) to += 2;
      else if (source[to] === "\n") to++;
      const edit = wrapSelection(source, nearby[start].offset, to, { id: options.id, layout: options.layout });
      if (!edit) {
        new import_obsidian3.Notice("\u8BF7\u5728\u5B8C\u6574\u56FE\u7247\u6BB5\u843D\u4E2D\u9009\u62E9\u76F8\u90BB\u56FE\u7247");
        return;
      }
      await this.storeConfigurations({ [groupKey(path, options.id)]: getStoredOptions(options) });
      if (!await this.sameSource(view, path, source)) return;
      if (view.getMode() === "source") {
        this.applyEditor(view.editor, edit);
        view.editor.setCursor(view.editor.offsetToPos(edit.from + edit.insert.length));
      } else {
        const file = view.file;
        let changed = false;
        await this.app.vault.process(file, (current) => {
          if (current !== source) return current;
          changed = true;
          return current.slice(0, edit.from) + edit.insert + current.slice(edit.to);
        });
        if (!changed) {
          new import_obsidian3.Notice("\u7B14\u8BB0\u5185\u5BB9\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u56FE\u7247");
          return;
        }
      }
      this.refreshConfiguration(path);
    })().catch((error) => {
      console.error("Image Layouts Enhanced", error);
      new import_obsidian3.Notice("\u56FE\u7247\u5E03\u5C40\u4FDD\u5B58\u9047\u5230\u95EE\u9898\uFF0C\u8BF7\u91CD\u8BD5");
    }), anchorEl, this.settings).open(), anchorEl).open();
  }
  async persistSettings() {
    const snapshot = { ...this.settings, groupSettings: JSON.parse(JSON.stringify(this.groupSettings)) };
    const write = this.storageQueue.catch(() => {
    }).then(() => this.saveData(snapshot));
    this.storageQueue = write;
    try {
      await write;
    } catch (error) {
      console.error("Image Layouts Enhanced: configuration write", error);
      new import_obsidian3.Notice("\u753B\u5ECA\u914D\u7F6E\u4FDD\u5B58\u9047\u5230\u95EE\u9898\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
      throw error;
    }
  }
  async storeConfigurations(changes) {
    const before = this.groupSettings;
    const next = { ...before, ...changes };
    this.groupSettings = next;
    try {
      await this.persistSettings();
    } catch (error) {
      if (this.groupSettings === next) this.groupSettings = before;
      throw error;
    }
  }
  pathForEditor(editor) {
    const view = this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view).find((view2) => view2 instanceof import_obsidian3.MarkdownView && view2.editor === editor);
    return view?.file?.path ?? null;
  }
  refreshConfiguration(path) {
    this.configurationRevision++;
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof import_obsidian3.MarkdownView) || view.file?.path !== path) continue;
      try {
        if (view.getMode() === "source") {
          const cm = view.editor.cm;
          cm?.dispatch({});
        } else view.previewMode?.rerender?.(true);
      } catch (error) {
        console.warn("Image Layouts Enhanced: configuration refresh", error);
      }
    }
  }
  async insertTemplate(editor) {
    const path = this.pathForEditor(editor);
    if (!path) {
      new import_obsidian3.Notice("\u8BF7\u5728\u7B14\u8BB0\u7F16\u8F91\u5668\u4E2D\u63D2\u5165\u56FE\u7247\u7EC4");
      return;
    }
    const source = editor.getValue(), at = editor.posToOffset(editor.getCursor("to"));
    const options = normalizeOptions({ ...this.settings, id: shortId(), layout: "filmstrip" });
    const eol = source.includes("\r\n") ? "\r\n" : "\n";
    const prefix = at > 0 && source[at - 1] !== "\n" ? eol : "";
    const template = `${prefix}${serializeOpen({ id: options.id, layout: options.layout })}${eol}${eol}![[\u56FE\u72471.png]]${eol}${eol}![[\u56FE\u72472.png]]${eol}${eol}<!-- /image-layouts -->${eol}`;
    if (!parseGroups(source.slice(0, at) + template + source.slice(at)).some((group) => group.options.id === options.id)) {
      new import_obsidian3.Notice("\u8BF7\u5728\u56FE\u7247\u7EC4\u548C\u4EE3\u7801\u533A\u57DF\u4E4B\u5916\u63D2\u5165\u6A21\u677F");
      return;
    }
    await this.storeConfigurations({ [groupKey(path, options.id)]: getStoredOptions(options) });
    if (editor.getValue() !== source || this.pathForEditor(editor) !== path) {
      new import_obsidian3.Notice("\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u7B14\u8BB0\u5185\u5BB9\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u63D2\u5165\u56FE\u7247\u7EC4");
      return;
    }
    editor.replaceRange(template, editor.offsetToPos(at));
    this.refreshConfiguration(path);
  }
  async compact(editor) {
    const path = this.pathForEditor(editor);
    if (!path) {
      new import_obsidian3.Notice("\u8BF7\u5728\u7B14\u8BB0\u7F16\u8F91\u5668\u4E2D\u7CBE\u7B80\u56FE\u7247\u7EC4\u6807\u8BB0");
      return;
    }
    const source = editor.getValue();
    const groups = parseGroups(source);
    const changes = {};
    const edits = [];
    const used = /* @__PURE__ */ new Set();
    for (const group of groups) {
      const effective = getEffectiveOptions(group, path, this.groupSettings);
      const id = effective.id && !used.has(effective.id) ? effective.id : shortId();
      used.add(id);
      const options = { ...effective, id };
      changes[groupKey(path, id)] = getStoredOptions(options);
      const edit = minimalHeaderEdit(source, group, options);
      if (edit && source.slice(edit.from, edit.to) !== edit.insert) edits.push(edit);
    }
    if (!groups.length) {
      new import_obsidian3.Notice("\u5F53\u524D\u7B14\u8BB0\u5305\u542B 0 \u4E2A\u56FE\u7247\u7EC4");
      return;
    }
    await this.storeConfigurations(changes);
    if (editor.getValue() !== source || this.pathForEditor(editor) !== path) {
      new import_obsidian3.Notice("\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u7B14\u8BB0\u5185\u5BB9\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u7CBE\u7B80\u6807\u8BB0");
      return;
    }
    for (const edit of edits.reverse()) this.applyEditor(editor, edit);
    this.refreshConfiguration(path);
    new import_obsidian3.Notice(`\u5DF2\u8FC1\u79FB ${groups.length} \u4E2A\u56FE\u7247\u7EC4\u914D\u7F6E\uFF0C\u7CBE\u7B80 ${edits.length} \u4E2A\u6807\u8BB0`);
  }
  insert(editor) {
    const source = editor.getValue(), from = editor.posToOffset(editor.getCursor("from")), to = editor.posToOffset(editor.getCursor("to"));
    if (!extractImages(source).some((ref) => ref.offset >= from && ref.offset + ref.raw.length <= to)) {
      new import_obsidian3.Notice("\u9009\u4E2D\u9700\u8981\u7EC4\u5408\u7684\u56FE\u7247\u5F15\u7528\uFF0C\u518D\u6267\u884C\u6B64\u547D\u4EE4");
      return;
    }
    const path = this.pathForEditor(editor);
    if (!path) {
      new import_obsidian3.Notice("\u8BF7\u5728\u7B14\u8BB0\u7F16\u8F91\u5668\u4E2D\u521B\u5EFA\u56FE\u7247\u7EC4");
      return;
    }
    new LayoutPicker(this.app, extractImages(source).filter((ref) => ref.offset >= from && ref.offset + ref.raw.length <= to).length, (patch) => void (async () => {
      if (editor.getValue() !== source || this.pathForEditor(editor) !== path) {
        new import_obsidian3.Notice("\u9009\u533A\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u56FE\u7247");
        return;
      }
      const options = normalizeOptions({ ...this.settings, ...patch, id: shortId() });
      const edit = wrapSelection(source, from, to, { id: options.id, layout: options.layout });
      if (!edit) {
        new import_obsidian3.Notice("\u8BF7\u9009\u62E9\u5B8C\u6574\u7684\u56FE\u7247\u6BB5\u843D\uFF0C\u6216\u5728\u73B0\u6709\u56FE\u7247\u7EC4\u4E2D\u5207\u6362\u5E03\u5C40");
        return;
      }
      await this.storeConfigurations({ [groupKey(path, options.id)]: getStoredOptions(options) });
      if (editor.getValue() !== source || this.pathForEditor(editor) !== path) {
        new import_obsidian3.Notice("\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u9009\u533A\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u56FE\u7247");
        return;
      }
      this.applyEditor(editor, edit);
      const anchor = Math.min(edit.from + edit.insert.length, editor.getValue().length);
      editor.setCursor(editor.offsetToPos(anchor));
      this.refreshConfiguration(path);
    })().catch(() => {
    })).open();
  }
  applyEditor(editor, edit) {
    if (!edit) {
      new import_obsidian3.Notice("\u56FE\u7247\u7EC4\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u5728\u5F53\u524D\u5185\u5BB9\u4E0A\u64CD\u4F5C");
      return;
    }
    editor.replaceRange(edit.insert, editor.offsetToPos(edit.from), editor.offsetToPos(edit.to));
  }
  async editFile(path, group, patch) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof import_obsidian3.TFile)) throw Error("\u7B14\u8BB0\u4F4D\u7F6E\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u8BBE\u7F6E");
    const view = this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view).find((view2) => view2 instanceof import_obsidian3.MarkdownView && view2.file?.path === path && view2.getMode() === "source");
    const source = view ? view.editor.getValue() : await this.app.vault.cachedRead(file);
    const parsed = parseGroups(source), current = resolveGallerySourceTarget(source, group)?.group;
    if (!current) throw Error("\u56FE\u7247\u7EC4\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u5728\u5F53\u524D\u753B\u5ECA\u4E0A\u91CD\u65B0\u6253\u5F00\u8BBE\u7F6E");
    let edit;
    if (patch === "unwrap") edit = current.kind === "comment" ? unwrapGroup(source, current) : editLegacyGroup(source, current, "unwrap");
    else {
      const effective = getEffectiveOptions(current, path, this.groupSettings);
      const duplicate = current.kind === "comment" && parsed.filter((item) => item.options.id === current.options.id).length > 1;
      const id = effective.id && !duplicate ? effective.id : shortId();
      const options = normalizeOptions({ ...effective, ...patch, id });
      await this.storeConfigurations({ [groupKey(path, id)]: getStoredOptions(options) });
      edit = current.kind === "comment" ? minimalHeaderEdit(source, current, options) : editLegacyGroup(source, current, options, true);
    }
    if (!edit) throw Error("\u56FE\u7247\u7EC4\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u5728\u5F53\u524D\u753B\u5ECA\u4E0A\u91CD\u65B0\u6253\u5F00\u8BBE\u7F6E");
    try {
      if (view) {
        if (!this.app.workspace.getLeavesOfType("markdown").some((leaf) => leaf.view === view) || view.getMode() !== "source" || view.editor.getValue() !== source || view.file?.path !== path) throw Error("\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u7B14\u8BB0\u89C6\u56FE\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u8BBE\u7F6E");
        this.applyEditor(view.editor, edit);
      } else {
        let changed = false;
        await this.app.vault.process(file, (currentSource) => {
          if (currentSource !== source || file.path !== path || this.app.workspace.getLeavesOfType("markdown").some((leaf) => leaf.view instanceof import_obsidian3.MarkdownView && leaf.view.file?.path === path && leaf.view.getMode() === "source")) return currentSource;
          changed = true;
          return currentSource.slice(0, edit.from) + edit.insert + currentSource.slice(edit.to);
        });
        if (!changed) throw Error("\u914D\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u7B14\u8BB0\u5185\u5BB9\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u8BBE\u7F6E");
      }
    } catch (error) {
      console.error("Image Layouts Enhanced: source write", error);
      new import_obsidian3.Notice("\u56FE\u7247\u7EC4\u66F4\u65B0\u9047\u5230\u95EE\u9898\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
      throw error;
    }
    this.refreshConfiguration(path);
  }
  async referenceSnapshot(path, origin) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof import_obsidian3.TFile)) throw Error("\u7B14\u8BB0\u4F4D\u7F6E\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u5F15\u7528");
    const views = this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view).filter((view) => view instanceof import_obsidian3.MarkdownView && view.file?.path === path);
    const originView = views.find((view) => origin && view.containerEl.contains(origin));
    let editorView = originView?.getMode() === "source" ? originView : views.find((view) => view.getMode() === "source");
    if (editorView) return { file, editorView, source: editorView.editor.getValue() };
    const source = await this.app.vault.cachedRead(file);
    editorView = this.app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view).find((view) => view instanceof import_obsidian3.MarkdownView && view.file?.path === path && view.getMode() === "source");
    return { file, editorView, source: editorView ? editorView.editor.getValue() : source };
  }
  async editReferences(path, group, origin, anchor) {
    const before = await this.referenceSnapshot(path, origin), target = resolveGallerySourceTarget(before.source, group);
    if (!target) {
      new import_obsidian3.Notice("\u56FE\u7247\u7EC4\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u5728\u5F53\u524D\u753B\u5ECA\u4E0A\u91CD\u65B0\u6253\u5F00\u5F15\u7528");
      return;
    }
    const snapshot = target.group, expectedBody = snapshot.body;
    const occurrence = parseGroups(before.source).filter((item) => item.options.id === snapshot.options.id).findIndex((item) => item.from === snapshot.from);
    new ReferenceEditor(anchor ?? origin, expectedBody, async (replacement) => {
      const current = await this.referenceSnapshot(path, origin);
      const resolved = resolveGallerySourceTarget(current.source, snapshot);
      if (!resolved) throw Error("\u56FE\u7247\u7EC4\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u7F16\u8F91");
      if (resolved.group.body !== expectedBody) throw Error("\u8FD9\u7EC4\u5185\u5BB9\u5DF2\u5728\u5176\u4ED6\u7A97\u53E3\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u7F16\u8F91");
      const edit = buildReferenceBodyEdit(current.source, snapshot, expectedBody, replacement);
      if (!edit) throw Error("\u5F15\u7528\u5185\u5BB9\u4F1A\u6539\u53D8\u56FE\u7247\u7EC4\u8FB9\u754C\uFF0C\u8BF7\u68C0\u67E5 Markdown \u6807\u8BB0");
      if (current.source.slice(edit.from, edit.to) === edit.insert) return;
      if (current.editorView) {
        const attached = this.app.workspace.getLeavesOfType("markdown").some((leaf) => leaf.view === current.editorView);
        if (!attached || current.editorView.file?.path !== path || current.editorView.editor.getValue() !== current.source) throw Error("\u7B14\u8BB0\u5185\u5BB9\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u4FDD\u5B58");
        this.applyEditor(current.editorView.editor, edit);
      } else {
        let changed = false;
        await this.app.vault.process(current.file, (source) => {
          if (this.app.workspace.getLeavesOfType("markdown").some((leaf) => leaf.view instanceof import_obsidian3.MarkdownView && leaf.view.file?.path === path && leaf.view.getMode() === "source")) return source;
          const patch = buildReferenceBodyEdit(source, snapshot, expectedBody, replacement);
          if (!patch || current.file.path !== path) return source;
          changed = true;
          return source.slice(0, patch.from) + patch.insert + source.slice(patch.to);
        });
        if (!changed) throw Error("\u8FD9\u7EC4\u5185\u5BB9\u5DF2\u5728\u5176\u4ED6\u7A97\u53E3\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u7F16\u8F91");
      }
      this.refreshConfiguration(path);
    }, { draftKey: JSON.stringify([path, snapshot.options.id || snapshot.from, occurrence]) }).open();
  }
  images(group, path, source) {
    const refs = this.parsed(source, path).refs.filter((ref) => ref.offset >= group.bodyFrom && ref.offset < group.bodyTo);
    const extracted = group.kind === "fence" ? extractImages(group.body).map((ref) => ({ ...ref, offset: ref.offset + group.bodyFrom, line: ref.line + source.slice(0, group.bodyFrom).split("\n").length - 1 })) : refs;
    const resolve = (target) => {
      if (/^https?:\/\/|^data:image\//i.test(target)) return target;
      let decoded = target;
      try {
        decoded = decodeURIComponent(target);
      } catch {
      }
      const file = this.app.metadataCache.getFirstLinkpathDest(decoded.split("#")[0], path);
      return file ? this.app.vault.getResourcePath(file) : "";
    };
    const images = extracted.map((ref, index) => {
      const alt = ref.kind === "wiki" ? ref.alt.split("|").filter((part) => !/^\d+(?:x\d+)?$/.test(part.trim())).join("|") : ref.alt;
      const src = resolve(ref.target);
      return { src, target: ref.target, alt: group.options.descriptions[index] ?? alt, line: ref.line, sourceOffset: ref.offset, missing: !src };
    });
    if (group.options.fromFolder) {
      const folder = group.options.fromFolder.replace(/^\/+|\/+$/g, "");
      let files = this.app.vault.getFiles().filter((file) => file.parent?.path === folder && /^(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(file.extension));
      files.sort((a, b) => group.options.sortBy === "mtime" ? a.stat.mtime - b.stat.mtime : a.name.localeCompare(b.name));
      if (group.options.reverse) files.reverse();
      if (group.options.limit > 0) files = files.slice(0, group.options.limit);
      images.push(...files.map((file) => ({ src: this.app.vault.getResourcePath(file), target: file.path, alt: file.basename, line: group.startLine, sourceOffset: group.bodyFrom, missing: false })));
    }
    return images;
  }
  getSourceImageNavigationLine(source, offset) {
    return parseGroups(source).find((group) => offset >= group.bodyFrom && offset < group.bodyTo)?.startLine ?? null;
  }
  revealSourceImage(path, offset, container) {
    for (const host of Array.from(container.querySelectorAll(".ilg-host"))) {
      const mounted = this.navigationRenderers.get(host);
      if (!mounted || mounted.path !== path) continue;
      const index = mounted.images.findIndex((image) => image.sourceOffset === offset);
      if (index >= 0) return mounted.renderer.revealImage(index);
    }
    return null;
  }
  mount(host, group, path, source, component) {
    this.hostGroups.set(host, { group, path, source });
    const effective = { ...group, options: getEffectiveOptions(group, path, this.groupSettings) };
    const images = this.images(effective, path, source);
    const siblings = this.parsed(source, path).groups.filter((item) => item.options.id === group.options.id);
    const occurrence = siblings.findIndex((item) => item.from === group.from);
    const selectionKey = `${path}:${group.options.id || group.from}:${occurrence}`;
    host.dataset.ilgGroupId = group.options.id;
    host.dataset.ilgLayout = group.options.layout;
    const renderer = new GalleryRenderer(host, images, effective.options, {
      open: (index, origin) => {
        const result = openGalleryImage(this.app, images, index, origin, path);
        this.diagnostics[result]++;
      },
      change: (patch) => void this.editFile(path, group, patch).catch(() => this.refreshConfiguration(path)),
      edit: (anchor) => void this.editReferences(path, group, host, anchor).catch((error) => {
        console.error("Image Layouts Enhanced: edit references", error);
        new import_obsidian3.Notice("\u56FE\u7247\u5F15\u7528\u6253\u5F00\u9047\u5230\u95EE\u9898\uFF0C\u8BF7\u91CD\u8BD5");
      }),
      unwrap: () => void this.editFile(path, group, "unwrap").catch(() => {
      }),
      pickLayout: (anchor) => new LayoutPicker(this.app, images.length, (patch) => void this.editFile(path, group, patch).catch(() => this.refreshConfiguration(path)), anchor, effective.options).open(),
      configure: (anchor) => new GalleryConfiguration(anchor ?? host, effective.options, (patch) => this.editFile(path, group, patch)).open(),
      initialIndex: this.selectedImages.get(selectionKey) ?? 0,
      select: (index) => {
        if (this.selectedImages.size > 512) this.selectedImages.delete(this.selectedImages.keys().next().value);
        this.selectedImages.set(selectionKey, index);
      }
    });
    this.navigationRenderers.set(host, { path, images, renderer });
    const bodyRefs = this.parsed(source, path).refs.filter((ref) => ref.offset >= group.bodyFrom && ref.offset < group.bodyTo).map((ref) => ({ ...ref, offset: ref.offset - group.bodyFrom }));
    const supplemental = getSupplementalMarkdown(group.body, group.kind === "comment" ? bodyRefs : void 0);
    if (supplemental.trim()) {
      const body = host.createDiv("ilg-supplemental");
      void import_obsidian3.MarkdownRenderer.render(this.app, supplemental, body, path, component);
    }
    if (host.classList.contains("ilg-live")) this.diagnostics.live++;
    return renderer;
  }
  async reading(el, ctx) {
    if (el.closest(".ilg-host")) return;
    const info = ctx.getSectionInfo(el);
    if (!info) return;
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(file instanceof import_obsidian3.TFile)) return;
    const source = info.text;
    if (!source.includes("image-layouts:")) return;
    const groups = this.parsed(source, ctx.sourcePath).groups;
    if (!groups.length) return;
    for (const group of groups) {
      if (info.lineStart < group.startLine || info.lineEnd > group.endLine) continue;
      if (info.lineStart === group.startLine) {
        this.anchorChildren.get(el)?.unload();
        const host = el.createDiv("ilg-host ilg-reading");
        const child = new GalleryChild(host, this, group, ctx.sourcePath, source);
        this.anchorChildren.set(el, child);
        child.register(() => {
          if (this.anchorChildren.get(el) === child) this.anchorChildren.delete(el);
        });
        this.trackReading(child, ctx);
        this.diagnostics.reading++;
        continue;
      }
      const state = this.hiddenSections.get(el) ?? { display: el.style.display, count: 0 };
      state.count++;
      this.hiddenSections.set(el, state);
      el.style.display = "none";
      const hidden = new import_obsidian3.MarkdownRenderChild(el);
      hidden.register(() => {
        state.count--;
        if (state.count === 0) {
          el.style.display = state.display;
          this.hiddenSections.delete(el);
        }
      });
      this.trackReading(hidden, ctx);
    }
  }
  async legacy(body, el, ctx, suffix) {
    let values = {};
    let imagesBody = body;
    const meta = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/.exec(body);
    if (meta) {
      try {
        values = (0, import_obsidian3.parseYaml)(meta[1]) ?? {};
        imagesBody = body.slice(meta[0].length);
      } catch {
        el.setText("\u5E03\u5C40\u914D\u7F6E\u9700\u8981\u6709\u6548\u7684 YAML");
        return;
      }
    }
    const aligned = ["left", "center", "right"].includes(suffix);
    const options = normalizeOptions({ ...values, layout: aligned ? "single" : suffix || values.layout || this.settings.layout, ...aligned ? { align: suffix, width: values.width ?? "50%" } : {} });
    const info = ctx.getSectionInfo(el);
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    const source = info?.text ?? (file instanceof import_obsidian3.TFile ? await this.app.vault.cachedRead(file) : body);
    const from = info ? lineOffset(source, info.lineStart) : -1;
    const to = info ? lineOffset(source, info.lineEnd + 1) : -1;
    const bodyFrom = source.indexOf(imagesBody, from);
    const group = { from, to, bodyFrom: bodyFrom >= 0 ? bodyFrom : 0, bodyTo: (bodyFrom >= 0 ? bodyFrom : 0) + imagesBody.length, startLine: info?.lineStart ?? 0, endLine: info?.lineEnd ?? 0, body: imagesBody, raw: from >= 0 ? source.slice(from, to) : "", options, kind: "fence" };
    const host = el.createDiv("ilg-host ilg-legacy");
    this.trackReading(new GalleryChild(host, this, group, ctx.sourcePath, source), ctx);
  }
};
var GallerySettings = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    this.containerEl.empty();
    this.containerEl.createEl("h2", { text: "\u56FE\u7247\u753B\u5ECA" });
    this.containerEl.createEl("p", { text: "\u9009\u4E2D\u56FE\u7247\u5F15\u7528\uFF0C\u6267\u884C\u201C\u5C06\u9009\u4E2D\u56FE\u7247\u7EC4\u6210\u753B\u5ECA\u201D\u3002\u6BCF\u4E2A\u56FE\u7247\u7EC4\u4FDD\u5B58\u81EA\u5DF1\u7684\u5E03\u5C40\uFF0C\u653E\u5927\u67E5\u770B\u4F18\u5148\u8054\u52A8 Image Toolkit\u3002" });
    new import_obsidian3.Setting(this.containerEl).setName("\u65B0\u56FE\u7247\u7EC4\u9ED8\u8BA4\u5E03\u5C40").addDropdown((dropdown) => {
      for (const [id, label] of Object.entries(LAYOUT_LABELS)) dropdown.addOption(id, label);
      dropdown.setValue(this.plugin.settings.layout).onChange(async (value) => {
        this.plugin.settings.layout = value;
        await this.plugin.persistSettings().catch(() => {
        });
      });
    });
    new import_obsidian3.Setting(this.containerEl).setName("\u56FE\u7247\u663E\u793A\u65B9\u5F0F").setDesc("\u5B8C\u6574\u663E\u793A\u9002\u5408\u79D1\u7814\u56FE\uFF1B\u586B\u6EE1\u533A\u57DF\u9002\u5408\u7167\u7247\u62FC\u56FE\u3002").addDropdown((dropdown) => dropdown.addOptions({ contain: "\u5B8C\u6574\u7B49\u6BD4\u663E\u793A", cover: "\u586B\u6EE1\u533A\u57DF", natural: "\u539F\u59CB\u6BD4\u4F8B" }).setValue(this.plugin.settings.fit).onChange(async (value) => {
      this.plugin.settings.fit = value;
      await this.plugin.persistSettings().catch(() => {
      });
    }));
    new import_obsidian3.Setting(this.containerEl).setName("\u753B\u5ECA\u9AD8\u5EA6").addSlider((slider) => slider.setLimits(180, 640, 20).setValue(this.plugin.settings.height).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.height = value;
      await this.plugin.persistSettings().catch(() => {
      });
    }));
  }
};
