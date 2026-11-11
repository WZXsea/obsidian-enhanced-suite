// Copy the table source when its renderer exposes an exact source location.
// DOM serialization is reserved for rendered tables without a source mapping.
const TCR_COPY_CONTROLS = '.citation-native-reference, .tcr-merge-covered, .tcr-handle, .table-col-drag-handle, .table-row-drag-handle, .table-cell-input, .tcr-font-toolbar, .tcr-font-menu, button, input, select, textarea';
const TCR_COPY_TAGS = new Set('THEAD TBODY TFOOT TR TH TD CAPTION A STRONG B EM I CODE PRE BR P SPAN DIV S DEL SUB SUP IMG UL OL LI'.split(' '));
function tcrCopyTableBlocks(source) {
  const lines = source.split('\n');
  const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim());
  const separator = (line) => {
    const parts = cells(line);
    return line.includes('|') && parts.length >= 1 && parts.every(cell => /^:?-{3,}:?$/.test(cell));
  };
  const blocks = [];
  const offsets = [];
  let offset = 0;
  for (const line of lines) { offsets.push(offset); offset += line.length + 1; }
  let fence = null;
  for (let index = 0; index < lines.length; index++) {
    const marker = lines[index].match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      continue;
    }
    if (fence || index === 0) continue;
    if (!separator(lines[index]) || !lines[index - 1].includes('|') || !lines[index - 1].trim()) continue;
    const start = index - 1;
    let end = index;
    while (end + 1 < lines.length && lines[end + 1].trim() && lines[end + 1].includes('|')) end++;
    blocks.push({ start, end, markdown: source.slice(offsets[start], offsets[end] + lines[end].replace(/\r$/, '').length) });
    index = end;
  }
  return blocks;
}
async function tcrCopySourceMarkdown(plugin, table) {
  const owner = plugin.app.workspace.getLeavesOfType('markdown').map(leaf => leaf.view)
    .find(view => view.containerEl?.contains(table));
  if (!owner?.file) return null;
  const widget = table.closest('.cm-table-widget');
  if (widget) {
    const editor = owner.editor;
    const cm = editor?.cm ?? owner.editMode?.editor?.cm;
    if (!editor || !cm?.posAtDOM) return null;
    try {
      const position = cm.posAtDOM(widget);
      const doc = cm.state.doc;
      const mapped = doc.lineAt(position).number;
      let start = mapped;
      let end = Math.min(doc.lines, mapped + 2);
      while (start > 1 && doc.line(start - 1).text.trim() && doc.line(start - 1).text.includes('|')) start--;
      while (end < doc.lines && doc.line(end + 1).text.trim() && doc.line(end + 1).text.includes('|')) end++;
      const line = mapped - start;
      const candidates = tcrCopyTableBlocks(doc.sliceString(doc.line(start).from, doc.line(end).to)).filter(block =>
        block.start <= line && block.end >= line || block.start > line && block.start - line <= 2);
      const containing = candidates.find(block => block.start <= line && block.end >= line);
      if (containing) return containing.markdown;
      if (candidates.length === 1) return candidates[0].markdown;
    } catch (_) { /* Virtualized widgets can lose their document mapping. */ }
    return null;
  }
  try {
    const info = owner.previewMode?.renderer?.getSectionInfo(table);
    if (!info || !Number.isInteger(info.lineStart) || !Number.isInteger(info.lineEnd)) return null;
    const source = await plugin.app.vault.cachedRead(owner.file);
    let start = 0;
    for (let line = 0; line < info.lineStart; line++) start = source.indexOf('\n', start) + 1;
    let end = start;
    for (let line = info.lineStart; line <= info.lineEnd; line++) {
      const next = source.indexOf('\n', end);
      if (next < 0) { end = source.length; break; }
      end = next + 1;
    }
    const candidates = tcrCopyTableBlocks(source.slice(start, end));
    // A source section with several tables requires a DOM ordinal, never a
    // first-header match (different tables may have identical headings).
    if (candidates.length === 1) return candidates[0].markdown;
    const section = table.closest('.markdown-preview-section');
    if (section && candidates.length > 1) {
      const rendered = Array.from(section.querySelectorAll('table')).filter(item => item.closest('.markdown-preview-section') === section);
      if (rendered.length === candidates.length) {
        const ordinal = rendered.indexOf(table);
        if (ordinal >= 0) return candidates[ordinal].markdown;
      }
    }
  } catch (_) { /* Embedded/generated tables use the clean DOM fallback. */ }
  return null;
}
function tcrCopyCleanTable(table) {
  const doc = table.ownerDocument;
  const clean = doc.createElement('table');
  const safeURL = value => value && !/^\s*(javascript|vbscript|data):/i.test(value);
  const walk = (node, parent) => {
    if (node.nodeType === 3) { parent.append(doc.createTextNode(node.textContent)); return; }
    if (node.nodeType !== 1 || node.matches(TCR_COPY_CONTROLS) || /^(SCRIPT|STYLE|COLGROUP|COL)$/.test(node.tagName)) return;
    if (node.matches('.citation-badge')) {
      const reference = doc.createElement('sup');
      reference.textContent = `[${node.dataset.citationLabel || node.textContent}]`;
      parent.append(reference);
      return;
    }
    const destination = TCR_COPY_TAGS.has(node.tagName) ? doc.createElement(node.tagName.toLowerCase()) : parent;
    if (destination !== parent) {
      if (node.tagName === 'A') {
        const href = node.getAttribute('href') || node.getAttribute('data-href');
        if (safeURL(href)) destination.setAttribute('href', href);
      }
      if (node.tagName === 'IMG') {
        const src = node.getAttribute('src');
        if (safeURL(src)) destination.setAttribute('src', src);
        destination.setAttribute('alt', node.getAttribute('alt') || '');
      }
      if ((node.tagName === 'TH' || node.tagName === 'TD')) {
        for (const name of ['colspan', 'rowspan']) {
          const value = Number(node.getAttribute(name));
          if (Number.isInteger(value) && value > 1) destination.setAttribute(name, String(value));
        }
        const computed = doc.defaultView.getComputedStyle(node);
        destination.style.fontSize = computed.fontSize;
        if (!clean.style.fontSize) clean.style.fontSize = computed.fontSize;
        if (['left', 'right', 'center'].includes(computed.textAlign)) destination.style.textAlign = computed.textAlign;
      }
      parent.append(destination);
    }
    for (const child of node.childNodes) walk(child, destination);
  };
  for (const node of table.childNodes) walk(node, clean);
  return clean;
}
function tcrCopyDOMMarkdown(clean) {
  const inline = node => {
    if (node.nodeType === 3) return node.textContent.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
    if (node.nodeType !== 1) return '';
    const text = Array.from(node.childNodes).map(inline).join('');
    switch (node.tagName) {
      case 'BR': return '<br>';
      case 'STRONG': case 'B': return `**${text}**`;
      case 'EM': case 'I': return `*${text}*`;
      case 'DEL': case 'S': return `~~${text}~~`;
      case 'CODE': {
        const raw = node.textContent.replace(/\|/g, '\\|');
        const runs = raw.match(/`+/g) || [];
        const fence = '`'.repeat(Math.max(0, ...runs.map(run => run.length)) + 1);
        const pad = /^`|`$|^ .* $/.test(raw) ? ' ' : '';
        return `${fence}${pad}${raw}${pad}${fence}`;
      }
      case 'A': return node.getAttribute('href') ? `[${text}](${node.getAttribute('href').replace(/\|/g, '%7C').replace(/\(/g, '%28').replace(/\)/g, '%29')})` : text;
      case 'IMG': return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})`;
      case 'P': case 'DIV': return `${text}<br>`;
      default: return text;
    }
  };
  const rows = Array.from(clean.querySelectorAll('tr')).filter(row => row.closest('table') === clean)
    .map(row => Array.from(row.children).filter(cell => cell.tagName === 'TH' || cell.tagName === 'TD').map(cell => inline(cell).replace(/[\r\n]+/g, ' ').replace(/(?:<br>)+$/, '').trim()));
  if (!rows.length) return '';
  const columns = Math.max(...rows.map(row => row.length));
  const line = row => '| ' + Array.from({ length: columns }, (_, index) => row[index] || '').join(' | ') + ' |';
  const headerCells = clean.querySelector('tr')?.children;
  const separator = Array.from({ length: columns }, (_, index) => {
    const align = headerCells?.[index]?.style.textAlign;
    return align === 'center' ? ':---:' : align === 'right' ? '---:' : '---';
  });
  return [line(rows[0]), line(separator), ...rows.slice(1).map(line)].join('\n');
}
async function getTableCopyContent(plugin, table) {
  const clean = tcrCopyCleanTable(table);
  const markdown = await tcrCopySourceMarkdown(plugin, table) ?? tcrCopyDOMMarkdown(clean);
  return { markdown, html: clean.outerHTML };
}
async function copyTableContent(plugin, table) {
  const content = await getTableCopyContent(plugin, table);
  const win = table.ownerDocument.defaultView;
  try {
    if (win.navigator.clipboard?.write && win.ClipboardItem) {
      await win.navigator.clipboard.write([new win.ClipboardItem({
        'text/plain': new win.Blob([content.markdown], { type: 'text/plain' }),
        'text/html': new win.Blob([content.html], { type: 'text/html' })
      })]);
      return content;
    }
  } catch (_) { /* Desktop clipboard provides the same two formats. */ }
  try {
    const clipboard = import_obsidian2.Platform.isDesktop ? require('electron').clipboard : null;
    if (clipboard?.write) {
      clipboard.write({ text: content.markdown, html: content.html });
      return content;
    }
  } catch (_) { /* Mobile contexts expose the browser text clipboard. */ }
  try {
    if (win.navigator.clipboard?.writeText) {
      await win.navigator.clipboard.writeText(content.markdown);
      return content;
    }
  } catch (_) { /* Older Android WebViews use the synchronous text fallback. */ }
  const doc = table.ownerDocument, active = doc.activeElement;
  const input = doc.createElement('textarea');
  input.value = content.markdown;
  input.setAttribute('readonly', '');
  input.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px;';
  doc.body.append(input);
  try {
    input.focus({preventScroll: true}); input.select();
    input.setSelectionRange(0, input.value.length);
    if (doc.execCommand?.('copy')) return content;
  } finally {
    input.remove();
    active?.focus?.({preventScroll: true});
  }
  throw new Error('当前剪贴板写入接口需要重新授权');
}
