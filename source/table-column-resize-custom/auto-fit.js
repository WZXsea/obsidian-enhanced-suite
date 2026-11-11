// Allocate a fixed width budget while preserving columns that already fit.
function tcrFitColumnWidths(preferred, minimums, availableWidth) {
  const budget = Number.isFinite(availableWidth) ? Math.max(0, availableWidth) : 0;
  const wanted = preferred.map((value, index) => {
    const minimum = Number.isFinite(minimums?.[index]) ? Math.max(0, minimums[index]) : 0;
    return Math.max(minimum, Number.isFinite(value) ? Math.max(0, value) : minimum);
  });
  if (!wanted.length) return [];
  const floors = wanted.map((value, index) => Math.min(value,
    Number.isFinite(minimums?.[index]) ? Math.max(0, minimums[index]) : 0));
  const total = wanted.reduce((sum, value) => sum + value, 0);
  if (total <= budget) return wanted;
  const floorTotal = floors.reduce((sum, value) => sum + value, 0);
  // Very narrow screens retain the relative minimum sizes within the viewport.
  if (floorTotal >= budget) return floors.map(value => floorTotal ? value / floorTotal * budget : 0);
  // Water filling caps long columns equally, leaving short columns at their
  // measured content width. Every iteration is a read-only numerical pass.
  let low = 0, high = Math.max(...wanted);
  for (let step = 0; step < 48; step++) {
    const cap = (low + high) / 2;
    const sum = wanted.reduce((sum, value, index) => sum + Math.max(floors[index], Math.min(value, cap)), 0);
    if (sum > budget) high = cap;
    else low = cap;
  }
  return wanted.map((value, index) => Math.max(floors[index], Math.min(value, low)));
}

// Live Preview keeps a hidden readonly copy while the current cell is edited.
// Use the visible editor text for this single cell instead of its stale copy.
function tcrAutoFitEditingText(cell) {
  const editor = cell.querySelector('.cm-editor');
  if (!editor) return null;
  const contents = editor.querySelector('.cm-content');
  if (!contents) return null;
  const lines = Array.from(contents.querySelectorAll('.cm-line'));
  return lines.length ? lines.map(line => line.textContent || '').join('\n') : contents.textContent || '';
}

function tcrCleanAutoFitClone(clone) {
  // Citation Badges and other visible buttons contribute content width.
  clone.querySelectorAll('colgroup, .tcr-handle, .table-col-drag-handle, .table-row-drag-handle, .table-cell-input, .citation-native-reference, .tcr-font-toolbar, input, textarea, select, script, style').forEach(node => node.remove());
  clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
}

// Caller temporarily restores merge display with tcrWithMergeLayout. Measure
// a detached clone rather than changing widths or content in the source table.
function tcrMeasureAutoFit(table, availableWidth, minColumnWidth = 50) {
  const doc = table.ownerDocument, win = doc.defaultView;
  const available = Number.isFinite(availableWidth) ? Math.max(0, availableWidth) : 0;
  const sourceRows = Array.from(table.rows);
  const count = sourceRows.reduce((max, row) => Math.max(max,
    Array.from(row.cells).reduce((sum, cell) => sum + Math.max(1, cell.colSpan || 1), 0)), 0);
  if (!available || !count) return {widths: [], total: 0, widthPercent: 0};
  const properties = ['font-family', 'font-size', 'font-style', 'font-weight', 'font-stretch',
    'font-variant', 'letter-spacing', 'word-spacing', 'line-height', 'text-transform',
    'text-indent', 'padding-left', 'padding-right', 'border-left-width', 'border-right-width',
    'border-left-style', 'border-right-style', 'box-sizing', 'white-space'];
  // Read source styles together before attaching the single measurement tree.
  const records = sourceRows.flatMap(row => {
    let column = 0;
    return Array.from(row.cells, cell => {
      const style = win.getComputedStyle(cell), span = Math.max(1, cell.colSpan || 1);
      const record = {cell, column, span, editingText: tcrAutoFitEditingText(cell), values: properties.map(name => style.getPropertyValue(name))};
      column += span;
      return record;
    });
  });
  const clone = table.cloneNode(true);
  clone.classList.remove('tcr-width-custom', 'tcr-has-merges');
  clone.classList.add('tcr-auto-fit-measure');
  clone.removeAttribute('id');
  clone.removeAttribute('data-tcr');
  clone.removeAttribute('data-tcr-font');
  clone.setAttribute('aria-hidden', 'true');
  clone.setAttribute('inert', '');
  tcrCleanAutoFitClone(clone);
  const set = (element, name, value) => element.style.setProperty(name, value, 'important');
  for (const element of [clone, ...clone.querySelectorAll('thead, tbody, tfoot, tr')]) {
    set(element, 'display', 'block');
    set(element, 'width', 'max-content');
    set(element, 'min-width', '0');
    set(element, 'max-width', 'none');
  }
  set(clone, 'position', 'fixed'); set(clone, 'inset', '0 auto auto -100000px');
  set(clone, 'visibility', 'hidden'); set(clone, 'pointer-events', 'none');
  set(clone, 'margin', '0'); set(clone, 'transform', 'none');
  const cells = Array.from(clone.rows).flatMap(row => Array.from(row.cells));
  records.forEach((record, index) => {
    const cell = cells[index];
    if (record.editingText !== null) {
      const content = cell.querySelector('.table-cell-wrapper') || cell;
      content.textContent = record.editingText;
      set(content, 'white-space', 'pre-line');
    }
    cell.classList.remove('tcr-merge-covered');
    cell.removeAttribute('colspan'); cell.removeAttribute('rowspan');
    properties.forEach((name, propertyIndex) => set(cell, name, record.values[propertyIndex]));
    set(cell, 'display', 'block'); set(cell, 'width', 'max-content');
    set(cell, 'min-width', '0'); set(cell, 'max-width', 'none');
    set(cell, 'overflow-wrap', 'normal');
    set(cell, 'word-break', 'normal');
    // Live Preview wrappers otherwise inherit the current cell's fixed width.
    cell.querySelectorAll('.table-cell-wrapper, .table-cell').forEach(wrapper => {
      set(wrapper, 'display', 'block');
      set(wrapper, 'width', 'max-content'); set(wrapper, 'min-width', '0');
      set(wrapper, 'max-width', 'none'); set(wrapper, 'white-space', record.editingText !== null ? 'pre-line' : 'inherit');
    });
    cell.querySelectorAll('img, video, svg, canvas').forEach(media => set(media, 'max-width', `${available}px`));
  });
  const preferred = Array(count).fill(0), minimums = Array(count).fill(0);
  try {
    (table.parentElement || doc.body).append(clone);
    const measured = cells.map(cell => cell.getBoundingClientRect().width);
    records.forEach((record, index) => {
      const size = Math.ceil(measured[index] + 2); // Rounding and collapsed borders.
      const minimum = Math.min(size, Math.max(24,
        Number.isFinite(minColumnWidth) ? minColumnWidth : 50));
      for (let column = record.column; column < record.column + record.span; column++) {
        preferred[column] = Math.max(preferred[column], size / record.span);
        minimums[column] = Math.max(minimums[column], minimum / record.span);
      }
    });
  } finally { clone.remove(); }
  const widths = tcrFitColumnWidths(preferred, minimums, available);
  const total = widths.reduce((sum, width) => sum + width, 0);
  return {widths, total, widthPercent: Math.min(100, total / available * 100)};
}
